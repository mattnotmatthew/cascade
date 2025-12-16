// Direct Puzzle Creator - Simple workflow
// 1. Enter cascade word + seed word
// 2. Check viability, select row
// 3. Review column words and save

import { useState } from "react";
import { Link } from "react-router-dom";
import { datamuseApi } from "../services/datamuseApi";
import { EXPECTED_LENGTHS, type SavedPuzzle } from "../types/creator";
import { ThemeToggle } from "../components/ThemeToggle";
import "./PuzzleCreatorSimple.css";

type Step = "words" | "row" | "review";

interface RowViability {
  row: 1 | 2 | 3;
  viable: boolean;
  columnWordCounts: number[];
  columnWords: string[][]; // All available words per column
}

interface SelectedPuzzle {
  cascadeWord: string;
  seedWord: string;
  cascadeRow: 1 | 2 | 3;
  columnWords: string[]; // Selected word for each column
  columnOptions: string[][]; // All options per column
}

export function PuzzleCreatorSimple() {
  const [step, setStep] = useState<Step>("words");

  // Step 1: Word entry
  const [cascadeWord, setCascadeWord] = useState("");
  const [seedWord, setSeedWord] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: Row selection
  const [rowViabilities, setRowViabilities] = useState<RowViability[]>([]);

  // Step 3: Review & Save
  const [selectedPuzzle, setSelectedPuzzle] = useState<SelectedPuzzle | null>(
    null
  );
  const [puzzleDate, setPuzzleDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [puzzleTheme, setPuzzleTheme] = useState("");

  // Swap modal state
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapColumnIndex, setSwapColumnIndex] = useState<number | null>(null);

  // Check viability for all rows
  const checkViability = async () => {
    const cascade = cascadeWord.toUpperCase().trim();
    const seed = seedWord.toUpperCase().trim();

    // Validation
    if (cascade.length !== 5) {
      setError("Cascade word must be exactly 5 letters");
      return;
    }
    if (seed.length !== 5) {
      setError("Seed word must be exactly 5 letters");
      return;
    }
    if (!/^[A-Z]+$/.test(cascade) || !/^[A-Z]+$/.test(seed)) {
      setError("Words must contain only letters A-Z");
      return;
    }

    setError(null);
    setIsChecking(true);

    try {
      const viabilities: RowViability[] = [];

      // Check each row (1, 2, 3)
      for (const row of [1, 2, 3] as const) {
        const columnWords: string[][] = [];
        const columnWordCounts: number[] = [];

        // Check each column
        for (let col = 0; col < 5; col++) {
          const wordLength = EXPECTED_LENGTHS[col];
          const seedLetter = seed[col];
          const cascadeLetter = cascade[col];

          const words = await datamuseApi.getColumnWords(
            seedLetter,
            cascadeLetter,
            row,
            wordLength
          );

          columnWords.push(words);
          columnWordCounts.push(words.length);
        }

        // Row is viable if all columns have at least one word
        const viable = columnWordCounts.every((count) => count > 0);

        viabilities.push({
          row,
          viable,
          columnWordCounts,
          columnWords,
        });
      }

      setRowViabilities(viabilities);
      setCascadeWord(cascade);
      setSeedWord(seed);
      setStep("row");
    } catch (err) {
      console.error("Viability check failed:", err);
      setError("Failed to check word viability. Please try again.");
    }

    setIsChecking(false);
  };

  // Select a row and proceed to review
  const selectRow = (viability: RowViability) => {
    if (!viability.viable) return;

    // Auto-select the first (most common) word for each column
    const selectedWords = viability.columnWords.map((words) => words[0] || "");

    setSelectedPuzzle({
      cascadeWord,
      seedWord,
      cascadeRow: viability.row,
      columnWords: selectedWords,
      columnOptions: viability.columnWords,
    });

    setStep("review");
  };

  // Handle word swap
  const openSwapModal = (columnIndex: number) => {
    setSwapColumnIndex(columnIndex);
    setSwapModalOpen(true);
  };

  const handleWordSwap = (newWord: string) => {
    if (selectedPuzzle && swapColumnIndex !== null) {
      const newColumnWords = [...selectedPuzzle.columnWords];
      newColumnWords[swapColumnIndex] = newWord;
      setSelectedPuzzle({ ...selectedPuzzle, columnWords: newColumnWords });
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

  // Start over
  const reset = () => {
    setStep("words");
    setCascadeWord("");
    setSeedWord("");
    setRowViabilities([]);
    setSelectedPuzzle(null);
    setPuzzleTheme("");
    setError(null);
  };

  // Render puzzle grid preview
  const renderPuzzleGrid = (
    puzzle: SelectedPuzzle,
    showSwapButtons = false
  ) => {
    const { cascadeWord: cascade, seedWord: seed, cascadeRow, columnWords } = puzzle;

    return (
      <div className="puzzle-grid-preview">
        {/* Seed word header */}
        <div className="grid-row seed-row">
          {seed.split("").map((letter, i) => (
            <div key={i} className="grid-cell seed-header">
              {letter}
            </div>
          ))}
        </div>

        {/* Column headers */}
        <div className="grid-row header-row">
          {columnWords.map((_, i) => (
            <div key={i} className="grid-cell header">
              {EXPECTED_LENGTHS[i]}L
            </div>
          ))}
        </div>

        {/* Build rows (0-5, showing up to 6 letters for longest word) */}
        {[0, 1, 2, 3, 4, 5].map((rowIndex) => {
          const isCascadeRow = rowIndex === cascadeRow;

          return (
            <div
              key={rowIndex}
              className={`grid-row ${isCascadeRow ? "cascade-row" : ""}`}
            >
              {columnWords.map((word, colIndex) => {
                const letter = word[rowIndex] || "";
                const maxLen = EXPECTED_LENGTHS[colIndex];

                // Don't show cells beyond word length
                if (rowIndex >= maxLen) {
                  return (
                    <div key={colIndex} className="grid-cell empty"></div>
                  );
                }

                return (
                  <div
                    key={colIndex}
                    className={`grid-cell ${
                      rowIndex === 0 ? "seed-letter" : ""
                    } ${isCascadeRow ? "cascade-letter" : ""}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Cascade word indicator */}
        <div className="cascade-indicator">
          <span>Cascade: </span>
          <strong>{cascade}</strong>
          <span className="cascade-row-label">(row {cascadeRow + 1})</span>
        </div>

        {/* Column words with swap buttons */}
        {showSwapButtons && (
          <div className="column-words-row">
            {columnWords.map((word, i) => (
              <div key={i} className="column-word-card">
                <div className="column-label">Col {i + 1}</div>
                <button
                  className="column-word-btn"
                  onClick={() => openSwapModal(i)}
                  title={`${puzzle.columnOptions[i].length} options available`}
                >
                  {word}
                  {puzzle.columnOptions[i].length > 1 && (
                    <span className="swap-indicator">
                      ↔ {puzzle.columnOptions[i].length}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render row viability card
  const renderRowCard = (viability: RowViability) => {
    const { row, viable, columnWordCounts } = viability;
    const totalOptions = columnWordCounts.reduce((a, b) => a + b, 0);
    const missingColumns = columnWordCounts
      .map((count, i) => (count === 0 ? i + 1 : null))
      .filter((x) => x !== null);

    return (
      <div
        key={row}
        className={`row-card ${viable ? "viable" : "not-viable"} ${
          viable ? "clickable" : ""
        }`}
        onClick={() => viable && selectRow(viability)}
      >
        <div className="row-card-header">
          <span className="row-number">Row {row + 1}</span>
          {viable ? (
            <span className="viable-badge">✓ Viable</span>
          ) : (
            <span className="not-viable-badge">✗ Not Viable</span>
          )}
        </div>

        {viable ? (
          <div className="row-card-body">
            <div className="total-options">{totalOptions} word options</div>
            <div className="column-counts">
              {columnWordCounts.map((count, i) => (
                <span key={i} className="col-count">
                  C{i + 1}: {count}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="row-card-body not-viable-body">
            <div className="missing-info">
              Missing words for column{missingColumns.length > 1 ? "s" : ""}:{" "}
              {missingColumns.join(", ")}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="puzzle-creator-simple">
      <header className="creator-header">
        <div className="creator-header-top">
          <ThemeToggle />
        </div>
        <h1>Puzzle Creator</h1>
        <p className="subtitle">Create CASCADE puzzles with direct word entry</p>
      </header>

      {/* Progress indicator */}
      <div className="progress-bar">
        <div
          className={`progress-step ${step === "words" ? "active" : "complete"}`}
        >
          1. Enter Words
        </div>
        <div
          className={`progress-step ${
            step === "row" ? "active" : step === "review" ? "complete" : ""
          }`}
        >
          2. Select Row
        </div>
        <div className={`progress-step ${step === "review" ? "active" : ""}`}>
          3. Review & Save
        </div>
      </div>

      {/* Step 1: Word Entry */}
      {step === "words" && (
        <div className="step-content">
          <h2>Enter Your Words</h2>
          <p>
            Enter the cascade word (hidden bonus) and seed word (first letters
            of each column)
          </p>

          <div className="word-inputs">
            <div className="word-input-group">
              <label>Cascade Word (5 letters)</label>
              <p className="input-hint">
                The hidden word that runs horizontally across all columns
              </p>
              <div className="letter-boxes">
                {[0, 1, 2, 3, 4].map((i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    className="letter-box"
                    value={cascadeWord[i]?.toUpperCase() || ""}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      if (/^[A-Z]?$/.test(val)) {
                        const newWord = cascadeWord.split("");
                        newWord[i] = val;
                        setCascadeWord(newWord.join(""));
                        // Auto-focus next input
                        if (val && i < 4) {
                          const next = e.target.nextElementSibling as HTMLInputElement;
                          next?.focus();
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !cascadeWord[i] && i > 0) {
                        const prev = (e.target as HTMLElement)
                          .previousElementSibling as HTMLInputElement;
                        prev?.focus();
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="word-input-group">
              <label>Seed Word (5 letters)</label>
              <p className="input-hint">
                First letters of each column word (shown to players)
              </p>
              <div className="letter-boxes">
                {[0, 1, 2, 3, 4].map((i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    className="letter-box"
                    value={seedWord[i]?.toUpperCase() || ""}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      if (/^[A-Z]?$/.test(val)) {
                        const newWord = seedWord.split("");
                        newWord[i] = val;
                        setSeedWord(newWord.join(""));
                        // Auto-focus next input
                        if (val && i < 4) {
                          const next = e.target.nextElementSibling as HTMLInputElement;
                          next?.focus();
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !seedWord[i] && i > 0) {
                        const prev = (e.target as HTMLElement)
                          .previousElementSibling as HTMLInputElement;
                        prev?.focus();
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            className="btn-primary check-btn"
            onClick={checkViability}
            disabled={
              isChecking || cascadeWord.length !== 5 || seedWord.length !== 5
            }
          >
            {isChecking ? (
              <>
                <span className="spinner"></span> Checking viability...
              </>
            ) : (
              "Check Viability →"
            )}
          </button>

          <div className="word-length-info">
            <h4>Column Word Lengths</h4>
            <div className="length-chips">
              <span>Col 1: 4 letters</span>
              <span>Col 2: 5 letters</span>
              <span>Col 3: 5 letters</span>
              <span>Col 4: 5 letters</span>
              <span>Col 5: 6 letters</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Row Selection */}
      {step === "row" && (
        <div className="step-content">
          <h2>Select Cascade Row</h2>
          <p>
            Choose which row the cascade word "{cascadeWord}" will appear in.
            Click a viable row to continue.
          </p>

          <div className="words-summary">
            <span>
              Cascade: <strong>{cascadeWord}</strong>
            </span>
            <span>
              Seed: <strong>{seedWord}</strong>
            </span>
          </div>

          <div className="row-cards">
            {rowViabilities.map((v) => renderRowCard(v))}
          </div>

          {rowViabilities.every((v) => !v.viable) && (
            <div className="no-viable-warning">
              <p>
                No viable rows found for this combination. Try different words.
              </p>
            </div>
          )}

          <div className="step-actions">
            <button className="btn-secondary" onClick={() => setStep("words")}>
              ← Change Words
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Save */}
      {step === "review" && selectedPuzzle && (
        <div className="step-content">
          <h2>Review & Save</h2>
          <p>Click any column word to swap it with an alternative</p>

          {renderPuzzleGrid(selectedPuzzle, true)}

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
                placeholder="e.g., Ocean Storm, Nature..."
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
            <button className="btn-secondary" onClick={() => setStep("row")}>
              ← Change Row
            </button>
            <button className="btn-secondary" onClick={reset}>
              Start Over
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
              <p className="modal-hint">
                {selectedPuzzle.columnOptions[swapColumnIndex].length} options
                available (sorted by frequency)
              </p>
              <div className="alternative-list">
                {selectedPuzzle.columnOptions[swapColumnIndex].map((word) => (
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
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="creator-footer">
        <Link to="/creator/bulk" className="bulk-link">
          Need multiple puzzles? Try Bulk Creator →
        </Link>
      </footer>
    </div>
  );
}
