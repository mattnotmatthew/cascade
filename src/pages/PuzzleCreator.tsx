// Main Puzzle Creator page component

import { useState, useCallback, useEffect } from "react";
import type {
  PuzzleCreatorState,
  CreatorPuzzle,
  SavedPuzzle,
} from "../types/creator";
import { createInitialCreatorState, EXPECTED_LENGTHS } from "../types/creator";
import { wordsApi } from "../services/wordsApi";
import { datamuseApi } from "../services/datamuseApi";
import {
  analyzePuzzleViability,
  type PuzzleViability,
} from "../services/viabilityChecker";
import {
  validatePuzzle,
  generatePuzzlePreview,
} from "../utils/puzzleValidator";
import { cascadeWords, getWordsWithLetterAt, isValidWord } from "../data/words";
import "./PuzzleCreator.css";

// Word suggestion with frequency
interface WordWithFrequency {
  word: string;
  frequency: number;
  isLoading?: boolean;
}

// Modal state for word suggestions
interface SuggestionModalState {
  isOpen: boolean;
  columnIndex: number;
  words: WordWithFrequency[];
  isLoadingFrequencies: boolean;
}

// Word Suggestion Modal Component
function SuggestionModal({
  modalState,
  onClose,
  onSelect,
  seedLetter,
  cascadeLetter,
  cascadeRow,
  wordLength,
}: {
  modalState: SuggestionModalState;
  onClose: () => void;
  onSelect: (word: string) => void;
  seedLetter: string;
  cascadeLetter: string;
  cascadeRow: number;
  wordLength: number;
}) {
  if (!modalState.isOpen) return null;

  // Sort by frequency (highest first), words without frequency go to end
  const sortedWords = [...modalState.words].sort((a, b) => {
    if (a.frequency === 0 && b.frequency === 0)
      return a.word.localeCompare(b.word);
    if (a.frequency === 0) return 1;
    if (b.frequency === 0) return -1;
    return b.frequency - a.frequency;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Word Suggestions for Column {modalState.columnIndex + 1}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-constraints">
          <span>
            Constraints: Starts with <strong>{seedLetter}</strong>, has{" "}
            <strong>{cascadeLetter}</strong> at position {cascadeRow + 1},
            {wordLength} letters
          </span>
        </div>

        {modalState.isLoadingFrequencies && (
          <div className="modal-loading">Loading frequency data...</div>
        )}

        <div className="modal-words">
          {sortedWords.length === 0 ? (
            <p className="no-suggestions">
              No suggestions found. Try entering a word manually.
            </p>
          ) : (
            <table className="words-table">
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Frequency</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedWords.map(({ word, frequency, isLoading }) => (
                  <tr key={word}>
                    <td className="word-cell">{word}</td>
                    <td className="frequency-cell">
                      {isLoading ? (
                        <span className="loading-dot">...</span>
                      ) : frequency > 0 ? (
                        <span className="frequency-bar">
                          <span
                            className="frequency-fill"
                            style={{
                              width: `${Math.min((frequency / 7) * 100, 100)}%`,
                            }}
                          />
                          <span className="frequency-value">
                            {frequency.toFixed(2)}
                          </span>
                        </span>
                      ) : (
                        <span className="frequency-unknown">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="select-word-btn"
                        onClick={() => {
                          onSelect(word);
                          onClose();
                        }}
                      >
                        Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <span className="frequency-hint">
            Frequency: Higher = more common (scale ~1-7). Top 10 words
            auto-ranked.
          </span>
        </div>
      </div>
    </div>
  );
}

// Step indicator component
function StepIndicator({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  const steps = [
    { num: 1, label: "Words" },
    { num: 2, label: "Cascade Row" },
    { num: 3, label: "Column Words" },
    { num: 4, label: "Preview" },
    { num: 5, label: "Save" },
  ];

  return (
    <div className="step-indicator">
      {steps.map((step, idx) => (
        <div key={step.num} className="step-item">
          <button
            className={`step-circle ${
              currentStep === step.num ? "active" : ""
            } ${currentStep > step.num ? "completed" : ""}`}
            onClick={() => onStepClick(step.num)}
            disabled={currentStep < step.num}
          >
            {currentStep > step.num ? "✓" : step.num}
          </button>
          <span className="step-label">{step.label}</span>
          {idx < steps.length - 1 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}

export function PuzzleCreator() {
  const [state, setState] = useState<PuzzleCreatorState>(
    createInitialCreatorState
  );
  const [apiStatus, setApiStatus] = useState<
    "unchecked" | "connected" | "unavailable"
  >("unchecked");
  const [suggestionModal, setSuggestionModal] = useState<SuggestionModalState>({
    isOpen: false,
    columnIndex: 0,
    words: [],
    isLoadingFrequencies: false,
  });

  // Viability analysis for current cascade+seed combo
  const [viability, setViability] = useState<PuzzleViability | null>(null);
  const [viabilityLoading, setViabilityLoading] = useState(false);

  // Check API status on mount
  useState(() => {
    if (wordsApi.isConfigured()) {
      setApiStatus("connected");
    } else {
      setApiStatus("unavailable");
    }
  });

  // Update viability when cascade or seed word changes
  useEffect(() => {
    if (state.cascadeWord.length === 5 && state.seedWord.length === 5) {
      setViabilityLoading(true);
      try {
        const result = analyzePuzzleViability(
          state.seedWord,
          state.cascadeWord
        );
        setViability(result);
      } catch (e) {
        console.error("Viability check failed:", e);
        setViability(null);
      }
      setViabilityLoading(false);
    } else {
      setViability(null);
    }
  }, [state.cascadeWord, state.seedWord]);

  // Navigation
  const goToStep = (step: number) => {
    if (step >= 1 && step <= 6) {
      setState((prev) => ({
        ...prev,
        currentStep: step as 1 | 2 | 3 | 4 | 5 | 6,
      }));
    }
  };

  const nextStep = () => goToStep(state.currentStep + 1);
  const prevStep = () => goToStep(state.currentStep - 1);

  // Step 1: Cascade word handlers - uses Datamuse for theme search
  const handleThemeSearch = useCallback(async () => {
    if (!state.theme.trim()) {
      // Show all cascade words from local list
      setState((prev) => ({
        ...prev,
        cascadeWordSuggestions: cascadeWords
          .slice(0, 50)
          .map((w) => w.toUpperCase()),
      }));
      return;
    }

    setState((prev) => ({ ...prev, cascadeWordLoading: true }));

    try {
      // Use Datamuse API for theme-based search (no API key needed!)
      const datamuseResults = await datamuseApi.getCascadeWordsForTheme(
        state.theme
      );

      // Also get local matches
      const localMatches = cascadeWords
        .filter((w) => w.toLowerCase().includes(state.theme.toLowerCase()))
        .map((w) => w.toUpperCase());

      // Combine: Datamuse results first (theme-related), then local matches
      const combined = [...new Set([...datamuseResults, ...localMatches])];

      setState((prev) => ({
        ...prev,
        cascadeWordSuggestions:
          combined.length > 0
            ? combined.slice(0, 100)
            : cascadeWords.slice(0, 50).map((w) => w.toUpperCase()),
        cascadeWordLoading: false,
      }));
    } catch (error) {
      console.error("Theme search failed:", error);
      // Fallback to local filtering
      const filtered = cascadeWords
        .filter((w) => w.toLowerCase().includes(state.theme.toLowerCase()))
        .map((w) => w.toUpperCase());
      setState((prev) => ({
        ...prev,
        cascadeWordSuggestions:
          filtered.length > 0
            ? filtered
            : cascadeWords.slice(0, 50).map((w) => w.toUpperCase()),
        cascadeWordLoading: false,
      }));
    }
  }, [state.theme]);

  const selectCascadeWord = (word: string) => {
    setState((prev) => ({ ...prev, cascadeWord: word.toUpperCase() }));
  };

  // Step 2: Seed word handlers
  const handleSeedWordSearch = useCallback(async () => {
    if (!state.cascadeWord || state.cascadeWord.length !== 5) {
      console.warn("[SeedSearch] No valid cascade word:", state.cascadeWord);
      return;
    }

    setState((prev) => ({ ...prev, seedWordLoading: true }));

    // Get common 5-letter words as seed suggestions
    // Use Datamuse to find high-frequency 5-letter words
    try {
      console.log("[SeedSearch] Finding common 5-letter seed words...");

      // Use Datamuse to get common 5-letter words
      const response = await fetch(
        "https://api.datamuse.com/words?sp=?????&max=100&md=f"
      );

      if (!response.ok) {
        throw new Error("Datamuse request failed");
      }

      interface DatamuseResult {
        word: string;
        score: number;
        tags?: string[];
      }

      const data: DatamuseResult[] = await response.json();

      // Extract frequency and sort by it
      const wordsWithFreq = data
        .map((item) => {
          const freqTag = item.tags?.find((t) => t.startsWith("f:"));
          const frequency = freqTag ? parseFloat(freqTag.substring(2)) : 0;
          return { word: item.word, frequency };
        })
        .filter((item) => /^[a-z]{5}$/.test(item.word)) // Only 5-letter words
        .sort((a, b) => b.frequency - a.frequency) // Sort by frequency
        .slice(0, 30);

      const results = wordsWithFreq.map((w) => w.word.toUpperCase());
      console.log("[SeedSearch] Top seed words:", results.slice(0, 5));

      setState((prev) => ({
        ...prev,
        seedWordSuggestions: results,
        seedWordLoading: false,
      }));
    } catch (error) {
      console.error("[SeedSearch] Failed, using local fallback:", error);

      // Fallback: get random sample of 5-letter words from local list
      const fiveLetterWords = getWordsWithLetterAt("a", 0, 5)
        .concat(getWordsWithLetterAt("e", 0, 5))
        .concat(getWordsWithLetterAt("s", 0, 5))
        .concat(getWordsWithLetterAt("t", 0, 5))
        .concat(getWordsWithLetterAt("p", 0, 5));

      // Shuffle and take 30
      const shuffled = [...new Set(fiveLetterWords)]
        .sort(() => Math.random() - 0.5)
        .slice(0, 30)
        .map((w) => w.toUpperCase());

      setState((prev) => ({
        ...prev,
        seedWordSuggestions: shuffled,
        seedWordLoading: false,
      }));
    }
  }, [state.cascadeWord]);

  const selectSeedWord = (word: string) => {
    setState((prev) => ({ ...prev, seedWord: word.toUpperCase() }));
  };

  // Step 3: Cascade row selection
  const selectCascadeRow = (row: 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, cascadeRow: row }));
  };

  // Step 4: Column word handlers - opens modal with all suggestions
  const loadColumnSuggestions = useCallback(
    async (columnIndex: number) => {
      if (!state.seedWord || !state.cascadeWord) return;

      const keyLetter = state.seedWord[columnIndex];
      const cascadeLetter = state.cascadeWord[columnIndex];
      const wordLength = EXPECTED_LENGTHS[columnIndex];

      // Update loading state
      setState((prev) => {
        const newLoading = [...prev.columnLoading] as [
          boolean,
          boolean,
          boolean,
          boolean,
          boolean
        ];
        newLoading[columnIndex] = true;
        return { ...prev, columnLoading: newLoading };
      });

      try {
        let suggestions: string[] = [];

        if (wordsApi.isConfigured()) {
          suggestions = await wordsApi.findWordsWithConstraints(
            keyLetter,
            cascadeLetter,
            state.cascadeRow,
            wordLength
          );
        }

        // Also check local word list
        const localWords = getWordsWithLetterAt(
          cascadeLetter,
          state.cascadeRow,
          wordLength
        )
          .filter((w) => w[0].toUpperCase() === keyLetter.toUpperCase())
          .map((w) => w.toUpperCase());

        // Merge and dedupe
        const allSuggestions = [
          ...new Set([
            ...suggestions.map((w) => w.toUpperCase()),
            ...localWords,
          ]),
        ];

        // Update state with suggestions
        setState((prev) => {
          const newSuggestions = [...prev.columnSuggestions] as [
            string[],
            string[],
            string[],
            string[],
            string[]
          ];
          const newLoading = [...prev.columnLoading] as [
            boolean,
            boolean,
            boolean,
            boolean,
            boolean
          ];
          newSuggestions[columnIndex] = allSuggestions;
          newLoading[columnIndex] = false;
          return {
            ...prev,
            columnSuggestions: newSuggestions,
            columnLoading: newLoading,
          };
        });

        // Open modal with words (initially without frequencies)
        // Only mark first 10 as loading - rest won't auto-fetch
        const MAX_AUTO_FETCH = 10;
        const wordsWithFreq: WordWithFrequency[] = allSuggestions.map(
          (word, idx) => ({
            word,
            frequency: 0,
            isLoading: idx < MAX_AUTO_FETCH, // Only first 10 show loading state
          })
        );

        setSuggestionModal({
          isOpen: true,
          columnIndex,
          words: wordsWithFreq,
          isLoadingFrequencies: true,
        });

        // Fetch frequencies for first 10 words only (to save API calls)
        if (wordsApi.isConfigured() && allSuggestions.length > 0) {
          const wordsToFetch = allSuggestions.slice(0, MAX_AUTO_FETCH);

          for (const word of wordsToFetch) {
            try {
              const freq = await wordsApi.getWordFrequency(word);
              setSuggestionModal((prev) => ({
                ...prev,
                words: prev.words.map((w) =>
                  w.word === word
                    ? { ...w, frequency: freq, isLoading: false }
                    : w
                ),
              }));
            } catch {
              setSuggestionModal((prev) => ({
                ...prev,
                words: prev.words.map((w) =>
                  w.word === word ? { ...w, frequency: 0, isLoading: false } : w
                ),
              }));
            }
          }
          setSuggestionModal((prev) => ({
            ...prev,
            isLoadingFrequencies: false,
          }));
        } else {
          // No API, mark all as loaded with 0 frequency
          setSuggestionModal((prev) => ({
            ...prev,
            words: prev.words.map((w) => ({ ...w, isLoading: false })),
            isLoadingFrequencies: false,
          }));
        }
      } catch (error) {
        console.error(`Column ${columnIndex} search failed:`, error);
        setState((prev) => {
          const newLoading = [...prev.columnLoading] as [
            boolean,
            boolean,
            boolean,
            boolean,
            boolean
          ];
          newLoading[columnIndex] = false;
          return { ...prev, columnLoading: newLoading };
        });
      }
    },
    [state.seedWord, state.cascadeWord, state.cascadeRow]
  );

  // Close modal helper
  const closeSuggestionModal = useCallback(() => {
    setSuggestionModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const setColumnWord = (columnIndex: number, word: string) => {
    setState((prev) => {
      const newWords = [...prev.columnWords] as [
        string,
        string,
        string,
        string,
        string
      ];
      newWords[columnIndex] = word.toUpperCase();
      return { ...prev, columnWords: newWords };
    });
  };

  // Step 5: Validation
  const runValidation = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isValidating: true,
      validationResult: null,
    }));

    const puzzle: CreatorPuzzle = {
      seedWord: state.seedWord,
      cascadeWord: state.cascadeWord,
      cascadeRow: state.cascadeRow,
      columnWords: state.columnWords,
    };

    try {
      // TODO: Load existing puzzles from public/puzzles
      const existingPuzzles: SavedPuzzle[] = [];
      const result = await validatePuzzle(puzzle, existingPuzzles);
      setState((prev) => ({
        ...prev,
        validationResult: result,
        isValidating: false,
      }));
    } catch (error) {
      console.error("Validation failed:", error);
      setState((prev) => ({
        ...prev,
        isValidating: false,
        validationResult: {
          isValid: false,
          errors: [
            { type: "api_error", message: `Validation error: ${error}` },
          ],
          warnings: [],
        },
      }));
    }
  }, [state.seedWord, state.cascadeWord, state.cascadeRow, state.columnWords]);

  // Step 6: Save puzzle
  const savePuzzle = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isSaving: true,
      saveError: null,
      saveSuccess: false,
    }));

    const puzzle: SavedPuzzle = {
      date: state.puzzleDate,
      createdAt: new Date().toISOString(),
      seedWord: state.seedWord,
      cascadeWord: state.cascadeWord,
      cascadeRow: state.cascadeRow,
      columnWords: state.columnWords,
      metadata: {
        theme: state.theme || undefined,
      },
    };

    try {
      // For now, just log and download as JSON
      // In production, this would save to public/puzzles/
      const json = JSON.stringify(puzzle, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.puzzleDate}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setState((prev) => ({ ...prev, isSaving: false, saveSuccess: true }));
    } catch (error) {
      console.error("Save failed:", error);
      setState((prev) => ({
        ...prev,
        isSaving: false,
        saveError: `Failed to save: ${error}`,
      }));
    }
  }, [state]);

  // Render current step content
  const renderStepContent = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <div className="step-content">
            <h2>Step 1: Choose Cascade & Seed Words</h2>
            <p className="step-description">
              Pick the hidden cascade word and the seed word that starts each
              column.
            </p>

            <div className="word-pair-inputs">
              {/* Cascade Word Section */}
              <div className="word-section">
                <h3>🎯 Cascade Word</h3>
                <p className="section-hint">
                  The hidden 5-letter bonus word players discover
                </p>

                <div className="input-group">
                  <label>Theme (optional)</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      value={state.theme}
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, theme: e.target.value }))
                      }
                      placeholder="e.g., animals, food, nature..."
                    />
                    <button
                      onClick={handleThemeSearch}
                      disabled={state.cascadeWordLoading}
                    >
                      {state.cascadeWordLoading ? "Searching..." : "Search"}
                    </button>
                  </div>
                </div>

                <div className="input-group">
                  <label>Cascade word (5 letters)</label>
                  <input
                    type="text"
                    value={state.cascadeWord}
                    onChange={(e) => selectCascadeWord(e.target.value)}
                    placeholder="5-letter word"
                    maxLength={5}
                    className={state.cascadeWord.length === 5 ? "valid" : ""}
                  />
                  {state.cascadeWord && (
                    <span
                      className={`validation-hint ${
                        isValidWord(state.cascadeWord) ? "valid" : "invalid"
                      }`}
                    >
                      {isValidWord(state.cascadeWord)
                        ? "✓ Valid word"
                        : "⚠ Not in word list"}
                    </span>
                  )}
                </div>

                {state.cascadeWordSuggestions.length > 0 && (
                  <div className="suggestions compact">
                    <label>Suggestions (sorted by frequency)</label>
                    <div className="suggestion-grid">
                      {state.cascadeWordSuggestions.slice(0, 20).map((word) => (
                        <button
                          key={word}
                          className={`suggestion-chip ${
                            state.cascadeWord === word ? "selected" : ""
                          }`}
                          onClick={() => selectCascadeWord(word)}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Seed Word Section */}
              <div className="word-section">
                <h3>🌱 Seed Word</h3>
                <p className="section-hint">
                  First letter of each column word
                  {state.cascadeWord.length === 5 && (
                    <span className="cascade-letters">
                      {" "}
                      → {state.cascadeWord.split("").join(" · ")}
                    </span>
                  )}
                </p>

                <div className="input-group">
                  <label>Seed word (5 letters)</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      value={state.seedWord}
                      onChange={(e) => selectSeedWord(e.target.value)}
                      placeholder="5-letter word"
                      maxLength={5}
                      className={state.seedWord.length === 5 ? "valid" : ""}
                    />
                    <button
                      onClick={handleSeedWordSearch}
                      disabled={
                        state.seedWordLoading || state.cascadeWord.length !== 5
                      }
                    >
                      {state.seedWordLoading ? "Loading..." : "Suggest"}
                    </button>
                  </div>
                  {state.seedWord && (
                    <span
                      className={`validation-hint ${
                        isValidWord(state.seedWord) ? "valid" : "invalid"
                      }`}
                    >
                      {isValidWord(state.seedWord)
                        ? "✓ Valid word"
                        : "⚠ Not in word list"}
                    </span>
                  )}
                </div>

                {state.seedWordSuggestions.length > 0 && (
                  <div className="suggestions compact">
                    <label>Suggestions</label>
                    <div className="suggestion-grid">
                      {state.seedWordSuggestions.slice(0, 15).map((word) => (
                        <button
                          key={word}
                          className={`suggestion-chip ${
                            state.seedWord === word ? "selected" : ""
                          }`}
                          onClick={() => selectSeedWord(word)}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Viability Preview Panel - shows when both words are entered */}
            {state.seedWord.length === 5 && state.cascadeWord.length === 5 && (
              <div className="viability-preview">
                {viabilityLoading ? (
                  <div className="viability-loading">
                    Analyzing viability...
                  </div>
                ) : viability ? (
                  <>
                    <h4>📊 Viability Analysis</h4>
                    <p
                      className={`viability-status ${
                        viability.recommendedRow > 0 ? "viable" : "not-viable"
                      }`}
                    >
                      {viability.recommendedRow > 0
                        ? `✅ Good combination! Best cascade row: ${viability.recommendedRow}`
                        : "⚠️ Limited options - consider different words"}
                    </p>
                    <div className="viability-rows">
                      {([1, 2, 3] as const).map((row) => {
                        const rowKey = `row${row}` as "row1" | "row2" | "row3";
                        const score = viability.rowScores[rowKey];
                        return (
                          <div
                            key={row}
                            className={`row-viability ${
                              score >= 15
                                ? "good"
                                : score >= 10
                                ? "fair"
                                : "poor"
                            }`}
                          >
                            <span className="row-label">Row {row}</span>
                            <span className="row-score">{score} options</span>
                            <div className="row-bar">
                              <div
                                className="row-bar-fill"
                                style={{
                                  width: `${Math.min(100, score * 3)}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {viability.recommendedRow > 0 &&
                      (() => {
                        const rowKey = `row${viability.recommendedRow}` as
                          | "row1"
                          | "row2"
                          | "row3";
                        const bottleneck = viability.bottlenecks[rowKey];
                        return bottleneck.count < 5 ? (
                          <div className="viability-bottlenecks">
                            <small>
                              ⚠️ Bottleneck: Col {bottleneck.column + 1} has
                              only {bottleneck.count} words
                            </small>
                          </div>
                        ) : null;
                      })()}
                  </>
                ) : null}
              </div>
            )}

            <div className="step-actions">
              <button
                className="primary"
                onClick={nextStep}
                disabled={
                  state.cascadeWord.length !== 5 || state.seedWord.length !== 5
                }
              >
                Next: Choose Cascade Row →
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h2>Step 2: Choose Cascade Row</h2>
            <p className="step-description">
              The cascade row is where the bonus word letters appear (rows 1-3,
              since row 0 is the key letter).
              {viability?.recommendedRow && (
                <span className="recommended-hint">
                  {" "}
                  💡 Recommended: Row {viability.recommendedRow}
                </span>
              )}
            </p>

            <div className="cascade-row-selector">
              {([1, 2, 3] as const).map((row) => {
                const rowKey = `row${row}` as "row1" | "row2" | "row3";
                const rowScore = viability?.rowScores[rowKey];
                const isRecommended = viability?.recommendedRow === row;
                const scoreClass =
                  rowScore !== undefined
                    ? rowScore >= 15
                      ? "good"
                      : rowScore >= 10
                      ? "fair"
                      : "poor"
                    : "";

                return (
                  <button
                    key={row}
                    className={`row-option ${
                      state.cascadeRow === row ? "selected" : ""
                    } ${isRecommended ? "recommended" : ""} ${scoreClass}`}
                    onClick={() => selectCascadeRow(row)}
                  >
                    <span className="row-number">Row {row}</span>
                    {rowScore !== undefined && (
                      <span className={`row-score-badge ${scoreClass}`}>
                        {rowScore} words available
                      </span>
                    )}
                    <span className="row-hint">
                      Position {row + 1} in each column word
                    </span>
                    {isRecommended && (
                      <span className="recommended-badge">★ Best</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Column-by-column breakdown for selected row */}
            {viability && (
              <div className="column-breakdown">
                <h4>Column Word Availability (Row {state.cascadeRow})</h4>
                <div className="column-bars">
                  {viability.columns.map((col, idx) => {
                    const rowKey = `row${state.cascadeRow}` as
                      | "row1"
                      | "row2"
                      | "row3";
                    const wordCount = col.wordCounts[rowKey] || 0;
                    const barClass =
                      wordCount >= 10
                        ? "good"
                        : wordCount >= 5
                        ? "fair"
                        : "poor";
                    return (
                      <div key={idx} className="column-bar-item">
                        <span className="col-label">Col {idx + 1}</span>
                        <span className="col-pattern">
                          {col.seedLetter}·{col.cascadeLetter}·
                        </span>
                        <div className={`col-bar ${barClass}`}>
                          <div
                            className="col-bar-fill"
                            style={{
                              width: `${Math.min(100, wordCount * 5)}%`,
                            }}
                          />
                        </div>
                        <span className={`col-count ${barClass}`}>
                          {wordCount}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="cascade-preview">
              <p>
                Cascade word <strong>{state.cascadeWord}</strong> will appear in
                row {state.cascadeRow}:
              </p>
              <div className="preview-grid mini">
                {[0, 1, 2, 3].map((row) => (
                  <div
                    key={row}
                    className={`preview-row ${
                      row === state.cascadeRow ? "highlight" : ""
                    }`}
                  >
                    {state.seedWord.split("").map((letter, col) => (
                      <span key={col} className="preview-cell">
                        {row === 0
                          ? letter
                          : row === state.cascadeRow
                          ? state.cascadeWord[col]
                          : "·"}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="step-actions">
              <button onClick={prevStep}>← Back</button>
              <button className="primary" onClick={nextStep}>
                Next: Build Column Words →
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <h2>Step 3: Build Column Words</h2>
            <p className="step-description">
              Choose a word for each column. Each word must start with the seed
              letter and have the cascade letter at row {state.cascadeRow}.
            </p>

            <div className="columns-builder">
              {EXPECTED_LENGTHS.map((length, idx) => (
                <div key={idx} className="column-builder">
                  <h4>
                    Column {idx + 1} ({length} letters)
                    <span className="constraint">
                      Starts with <strong>{state.seedWord[idx]}</strong>, has{" "}
                      <strong>{state.cascadeWord[idx]}</strong> at position{" "}
                      {state.cascadeRow + 1}
                    </span>
                  </h4>

                  <div className="input-with-button">
                    <input
                      type="text"
                      value={state.columnWords[idx]}
                      onChange={(e) => setColumnWord(idx, e.target.value)}
                      placeholder={`${length}-letter word`}
                      maxLength={length}
                      className={
                        state.columnWords[idx]?.length === length ? "valid" : ""
                      }
                    />
                    <button
                      onClick={() => loadColumnSuggestions(idx)}
                      disabled={state.columnLoading[idx]}
                    >
                      {state.columnLoading[idx] ? "..." : "?"}
                    </button>
                  </div>

                  {state.columnWords[idx] && (
                    <span
                      className={`validation-hint ${
                        state.columnWords[idx].length === length &&
                        state.columnWords[idx][0] === state.seedWord[idx] &&
                        state.columnWords[idx][state.cascadeRow] ===
                          state.cascadeWord[idx]
                          ? "valid"
                          : "invalid"
                      }`}
                    >
                      {state.columnWords[idx].length !== length
                        ? `Need ${length} letters`
                        : state.columnWords[idx][0] !== state.seedWord[idx]
                        ? `Must start with ${state.seedWord[idx]}`
                        : state.columnWords[idx][state.cascadeRow] !==
                          state.cascadeWord[idx]
                        ? `Position ${state.cascadeRow + 1} must be ${
                            state.cascadeWord[idx]
                          }`
                        : "✓"}
                    </span>
                  )}

                  {state.columnSuggestions[idx].length > 0 && (
                    <div className="column-suggestions">
                      {state.columnSuggestions[idx].slice(0, 6).map((word) => (
                        <button
                          key={word}
                          className={`suggestion-chip small ${
                            state.columnWords[idx] === word ? "selected" : ""
                          }`}
                          onClick={() => setColumnWord(idx, word)}
                        >
                          {word}
                        </button>
                      ))}
                      {state.columnSuggestions[idx].length > 6 && (
                        <button
                          className="suggestion-chip small view-all"
                          onClick={() => loadColumnSuggestions(idx)}
                        >
                          View All ({state.columnSuggestions[idx].length})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="step-actions">
              <button onClick={prevStep}>← Back</button>
              <button
                className="primary"
                onClick={() => {
                  nextStep();
                  runValidation();
                }}
                disabled={
                  !state.columnWords.every(
                    (w, i) => w?.length === EXPECTED_LENGTHS[i]
                  )
                }
              >
                Next: Preview & Validate →
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <h2>Step 4: Preview & Validate</h2>

            <div className="puzzle-preview">
              <h3>Puzzle Grid</h3>
              <div className="preview-grid">
                <div className="preview-header">
                  {state.seedWord.split("").map((letter, idx) => (
                    <span key={idx} className="header-cell">
                      {letter}
                    </span>
                  ))}
                </div>
                {generatePuzzlePreview({
                  seedWord: state.seedWord,
                  cascadeWord: state.cascadeWord,
                  cascadeRow: state.cascadeRow,
                  columnWords: state.columnWords,
                }).map((row, rowIdx) => (
                  <div
                    key={rowIdx}
                    className={`preview-row ${
                      rowIdx === state.cascadeRow ? "cascade-row" : ""
                    }`}
                  >
                    {row.map((letter, colIdx) => (
                      <span key={colIdx} className="preview-cell">
                        {letter}
                      </span>
                    ))}
                    {rowIdx === state.cascadeRow && (
                      <span className="cascade-label">
                        ← {state.cascadeWord}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="word-list">
                <h4>Words</h4>
                <ul>
                  <li>
                    <strong>Seed:</strong> {state.seedWord}
                  </li>
                  <li>
                    <strong>Cascade:</strong> {state.cascadeWord} (row{" "}
                    {state.cascadeRow})
                  </li>
                  {state.columnWords.map((word, idx) => (
                    <li key={idx}>
                      <strong>Col {idx + 1}:</strong> {word}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="validation-section">
              <h3>Validation</h3>
              {state.isValidating ? (
                <p>Validating...</p>
              ) : state.validationResult ? (
                <div
                  className={`validation-result ${
                    state.validationResult.isValid ? "valid" : "invalid"
                  }`}
                >
                  {state.validationResult.isValid ? (
                    <p className="success">✓ Puzzle is valid!</p>
                  ) : (
                    <div className="errors">
                      <p className="error-title">✗ Validation errors:</p>
                      <ul>
                        {state.validationResult.errors.map((err, idx) => (
                          <li key={idx} className="error">
                            {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {state.validationResult.warnings.length > 0 && (
                    <div className="warnings">
                      <p className="warning-title">⚠ Warnings:</p>
                      <ul>
                        {state.validationResult.warnings.map((warn, idx) => (
                          <li key={idx} className="warning">
                            {warn.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={runValidation}>Run Validation</button>
              )}
            </div>

            <div className="step-actions">
              <button onClick={prevStep}>← Back</button>
              <button
                className="primary"
                onClick={nextStep}
                disabled={!state.validationResult?.isValid}
              >
                Next: Save Puzzle →
              </button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="step-content">
            <h2>Step 5: Save Puzzle</h2>

            <div className="input-group">
              <label>Puzzle Date</label>
              <input
                type="date"
                value={state.puzzleDate}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, puzzleDate: e.target.value }))
                }
              />
            </div>

            <div className="save-preview">
              <h4>Puzzle Summary</h4>
              <pre>
                {JSON.stringify(
                  {
                    date: state.puzzleDate,
                    seedWord: state.seedWord,
                    cascadeWord: state.cascadeWord,
                    cascadeRow: state.cascadeRow,
                    columnWords: state.columnWords,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            {state.saveError && <p className="error">{state.saveError}</p>}

            {state.saveSuccess && (
              <p className="success">
                ✓ Puzzle saved! Check your downloads folder.
              </p>
            )}

            <div className="step-actions">
              <button onClick={prevStep}>← Back</button>
              <button
                className="primary"
                onClick={savePuzzle}
                disabled={state.isSaving}
              >
                {state.isSaving ? "Saving..." : "Download Puzzle JSON"}
              </button>
              <button onClick={() => setState(createInitialCreatorState())}>
                Start New Puzzle
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="puzzle-creator">
      <header className="creator-header">
        <h1>CASCADE Puzzle Creator</h1>
        <div className="api-status">
          API: {apiStatus === "connected" ? "🟢 Connected" : "🟡 Local only"}
        </div>
      </header>

      <StepIndicator currentStep={state.currentStep} onStepClick={goToStep} />

      <main className="creator-main">{renderStepContent()}</main>

      {/* Word Suggestion Modal */}
      <SuggestionModal
        modalState={suggestionModal}
        onClose={closeSuggestionModal}
        onSelect={(word) => setColumnWord(suggestionModal.columnIndex, word)}
        seedLetter={state.seedWord[suggestionModal.columnIndex] || ""}
        cascadeLetter={state.cascadeWord[suggestionModal.columnIndex] || ""}
        cascadeRow={state.cascadeRow}
        wordLength={EXPECTED_LENGTHS[suggestionModal.columnIndex]}
      />
    </div>
  );
}
