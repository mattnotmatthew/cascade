// Streamlined Puzzle Creator - Simple 3-step flow
// 1. Pick a theme/cascade word
// 2. Review auto-generated puzzle, swap words if needed
// 3. Save

import { useState, useEffect } from "react";
import { datamuseApi } from "../services/datamuseApi";
import {
  generatePuzzleOptions,
  swapColumnWord,
  getAllColumnOptions,
  type GeneratedPuzzle,
} from "../services/puzzleGenerator";
import { getWordsByLength } from "../data/words";
import { EXPECTED_LENGTHS, type SavedPuzzle } from "../types/creator";
import "./PuzzleCreatorSimple.css";

type Step = "theme" | "review" | "save";

export function PuzzleCreatorSimple() {
  const [step, setStep] = useState<Step>("theme");

  // Step 1: Theme selection
  const [theme, setTheme] = useState("");
  const [cascadeSuggestions, setCascadeSuggestions] = useState<string[]>([]);
  const [selectedCascade, setSelectedCascade] = useState("");
  const [isLoadingCascade, setIsLoadingCascade] = useState(false);

  // Generated puzzles
  const [puzzleOptions, setPuzzleOptions] = useState<GeneratedPuzzle[]>([]);
  const [selectedPuzzle, setSelectedPuzzle] = useState<GeneratedPuzzle | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);

  // Word swap modal
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapColumnIndex, setSwapColumnIndex] = useState<number | null>(null);

  // Step 3: Save
  const [puzzleDate, setPuzzleDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [puzzleTheme, setPuzzleTheme] = useState("");

  // Fetch cascade word suggestions when theme changes
  useEffect(() => {
    if (theme.length < 2) {
      // Don't fetch for short themes, suggestions will naturally clear on next fetch
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoadingCascade(true);
      try {
        const results = await datamuseApi.getRelatedWords(theme, 100);
        // Filter to 5-letter words (getRelatedWords returns string[])
        const fiveLetterWords = results.filter((w) => w.length === 5);
        setCascadeSuggestions(fiveLetterWords.slice(0, 10));
      } catch (err) {
        console.error("Failed to fetch cascade suggestions:", err);
        setCascadeSuggestions([]);
      }
      setIsLoadingCascade(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [theme]);

  // Generate puzzle options when cascade word is selected
  const handleCascadeSelect = async (cascade: string) => {
    setSelectedCascade(cascade);
    setIsGenerating(true);
    setPuzzleOptions([]);
    setSelectedPuzzle(null);

    try {
      // Get common 5-letter words as seed candidates
      const seedCandidates = getWordsByLength(5).slice(0, 200);

      // Generate puzzle options
      const options = generatePuzzleOptions(cascade, seedCandidates);

      if (options.length > 0) {
        setPuzzleOptions(options.slice(0, 5)); // Top 5 options
        setSelectedPuzzle(options[0]); // Auto-select best one
        setStep("review");
      } else {
        alert(
          "No viable puzzles found for this cascade word. Try a different one."
        );
      }
    } catch (err) {
      console.error("Failed to generate puzzles:", err);
      alert("Error generating puzzles. Please try again.");
    }

    setIsGenerating(false);
  };

  // Handle word swap
  const openSwapModal = (columnIndex: number) => {
    setSwapColumnIndex(columnIndex);
    setSwapModalOpen(true);
  };

  const handleWordSwap = (newWord: string) => {
    if (selectedPuzzle && swapColumnIndex !== null) {
      const updated = swapColumnWord(selectedPuzzle, swapColumnIndex, newWord);
      setSelectedPuzzle(updated);
    }
    setSwapModalOpen(false);
    setSwapColumnIndex(null);
  };

  // Download puzzle JSON
  const handleDownload = () => {
    if (!selectedPuzzle) return;

    const savedPuzzle: SavedPuzzle = {
      date: puzzleDate,
      cascadeWord: selectedPuzzle.cascadeWord,
      seedWord: selectedPuzzle.seedWord,
      cascadeRow: selectedPuzzle.cascadeRow,
      columnWords: selectedPuzzle.columnWords,
      createdAt: new Date().toISOString(),
      metadata: puzzleTheme.trim() ? { theme: puzzleTheme.trim() } : undefined,
    };

    const json = JSON.stringify(savedPuzzle, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${puzzleDate}.json`;
    a.click();

    URL.revokeObjectURL(url);
  };

  // Render puzzle grid preview
  const renderPuzzleGrid = (puzzle: GeneratedPuzzle) => {
    const { cascadeWord, seedWord, cascadeRow, columnWords } = puzzle;

    return (
      <div className="puzzle-grid-preview">
        {/* Column headers */}
        <div className="grid-row header-row">
          {columnWords.map((_, i) => (
            <div key={i} className="grid-cell header">
              {EXPECTED_LENGTHS[i]}L
            </div>
          ))}
        </div>

        {/* Build rows based on cascade row position */}
        {[0, 1, 2, 3, 4].map((rowIndex) => {
          const isCascadeRow = rowIndex === cascadeRow;

          return (
            <div
              key={rowIndex}
              className={`grid-row ${isCascadeRow ? "cascade-row" : ""}`}
            >
              {columnWords.map((word, colIndex) => {
                const letter = word[rowIndex] || "";
                const isSeedLetter = rowIndex === 0;
                const isCascadeLetter = isCascadeRow;

                return (
                  <div
                    key={colIndex}
                    className={`grid-cell 
                      ${isSeedLetter ? "seed-letter" : ""} 
                      ${isCascadeLetter ? "cascade-letter" : ""}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* For 6-letter words, show row 6 */}
        <div className="grid-row">
          {columnWords.map((word, colIndex) => {
            const letter = word[5] || "";
            return (
              <div key={colIndex} className="grid-cell">
                {EXPECTED_LENGTHS[colIndex] === 6 ? letter : ""}
              </div>
            );
          })}
        </div>

        {/* Cascade word indicator */}
        <div className="cascade-indicator">
          <span>Cascade: </span>
          <strong>{cascadeWord}</strong>
          <span className="cascade-row-label">(row {cascadeRow + 1})</span>
        </div>

        {/* Seed word indicator */}
        <div className="seed-indicator">
          <span>Seed: </span>
          <strong>{seedWord}</strong>
        </div>
      </div>
    );
  };

  return (
    <div className="puzzle-creator-simple">
      <header className="creator-header">
        <h1>Puzzle Creator</h1>
        <p className="subtitle">Create daily CASCADE puzzles in 3 easy steps</p>
      </header>

      {/* Progress indicator */}
      <div className="progress-bar">
        <div
          className={`progress-step ${
            step === "theme" ? "active" : "complete"
          }`}
        >
          1. Theme
        </div>
        <div
          className={`progress-step ${
            step === "review" ? "active" : step === "save" ? "complete" : ""
          }`}
        >
          2. Review
        </div>
        <div className={`progress-step ${step === "save" ? "active" : ""}`}>
          3. Save
        </div>
      </div>

      {/* Step 1: Theme Selection */}
      {step === "theme" && (
        <div className="step-content">
          <h2>Choose a Theme</h2>
          <p>Enter a theme word to find related cascade words</p>

          <input
            type="text"
            placeholder="e.g., ocean, space, food..."
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="theme-input"
            autoFocus
          />

          {isLoadingCascade && (
            <div className="loading-text">Finding words...</div>
          )}

          {cascadeSuggestions.length > 0 && (
            <div className="cascade-suggestions">
              <h3>Select a Cascade Word:</h3>
              <div className="suggestion-grid">
                {cascadeSuggestions.map((word) => (
                  <button
                    key={word}
                    className={`suggestion-btn ${
                      selectedCascade === word ? "selected" : ""
                    }`}
                    onClick={() => handleCascadeSelect(word)}
                    disabled={isGenerating}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="generating">
              <div className="spinner"></div>
              <span>Generating puzzles...</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Review Generated Puzzle */}
      {step === "review" && selectedPuzzle && (
        <div className="step-content">
          <h2>Review Your Puzzle</h2>
          <p>Click any column word to swap it with an alternative</p>

          {/* Main puzzle grid */}
          {renderPuzzleGrid(selectedPuzzle)}

          {/* Column words with swap buttons */}
          <div className="column-words-row">
            {selectedPuzzle.columnWords.map((word, i) => (
              <div key={i} className="column-word-card">
                <div className="column-label">Col {i + 1}</div>
                <button
                  className="column-word-btn"
                  onClick={() => openSwapModal(i)}
                  title={
                    selectedPuzzle.alternatives[i].length > 0
                      ? `${selectedPuzzle.alternatives[i].length} alternatives available`
                      : "No alternatives"
                  }
                  disabled={selectedPuzzle.alternatives[i].length === 0}
                >
                  {word}
                  {selectedPuzzle.alternatives[i].length > 0 && (
                    <span className="swap-indicator">↔</span>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Other puzzle options */}
          {puzzleOptions.length > 1 && (
            <div className="other-options">
              <h3>Other Seed Word Options:</h3>
              <div className="option-chips">
                {puzzleOptions.map((opt) => (
                  <button
                    key={opt.seedWord}
                    className={`option-chip ${
                      opt === selectedPuzzle ? "selected" : ""
                    }`}
                    onClick={() => setSelectedPuzzle(opt)}
                  >
                    {opt.seedWord}
                    <span className="score-badge">{opt.score}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="step-actions">
            <button className="btn-secondary" onClick={() => setStep("theme")}>
              ← Back
            </button>
            <button className="btn-primary" onClick={() => setStep("save")}>
              Continue to Save →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Save */}
      {step === "save" && selectedPuzzle && (
        <div className="step-content">
          <h2>Save Your Puzzle</h2>

          {/* Final preview */}
          {renderPuzzleGrid(selectedPuzzle)}

          <div className="save-form">
            <label>
              Puzzle Date:
              <input
                type="date"
                value={puzzleDate}
                onChange={(e) => setPuzzleDate(e.target.value)}
                className="date-input"
              />
            </label>

            <label>
              Theme (shown to players):
              <input
                type="text"
                value={puzzleTheme}
                onChange={(e) => setPuzzleTheme(e.target.value)}
                placeholder="e.g., Ocean Life, Space Exploration..."
                className="theme-input-save"
              />
            </label>

            <div className="download-info">
              <p>
                The puzzle will be saved as <code>{puzzleDate}.json</code>
              </p>
              <p>
                Place it in the <code>public/puzzles/</code> folder to make it
                the daily puzzle.
              </p>
            </div>

            <button className="btn-download" onClick={handleDownload}>
              📥 Download Puzzle JSON
            </button>
          </div>

          <div className="step-actions">
            <button className="btn-secondary" onClick={() => setStep("review")}>
              ← Back
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setStep("theme");
                setTheme("");
                setSelectedCascade("");
                setCascadeSuggestions([]);
                setPuzzleOptions([]);
                setSelectedPuzzle(null);
                setPuzzleTheme("");
              }}
            >
              Create Another Puzzle
            </button>
          </div>
        </div>
      )}

      {/* Word Swap Modal */}
      {swapModalOpen && swapColumnIndex !== null && selectedPuzzle && (
        <div className="modal-overlay" onClick={() => setSwapModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Swap Word for Column {swapColumnIndex + 1}</h3>
              <button
                className="modal-close"
                onClick={() => setSwapModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Current word:{" "}
                <strong>{selectedPuzzle.columnWords[swapColumnIndex]}</strong>
              </p>
              <div className="alternative-list">
                {getAllColumnOptions(selectedPuzzle, swapColumnIndex).map(
                  (word) => (
                    <button
                      key={word}
                      className={`alt-word-btn ${
                        word === selectedPuzzle.columnWords[swapColumnIndex]
                          ? "current"
                          : ""
                      }`}
                      onClick={() => handleWordSwap(word)}
                    >
                      {word}
                      {word === selectedPuzzle.columnWords[swapColumnIndex] &&
                        " ✓"}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
