// Bulk Puzzle Creator - Create multiple puzzles for consecutive days
// Workflow: Configure → Assign Words → Generate → Review → Download

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  generateSinglePuzzle,
  generateDates,
  getPuzzleStats,
  determineResumeStep,
  getStepClass,
  type Step,
} from "../../services/bulkPuzzleGenerator";
import { exportBatchAsZip, getExportableCount } from "../../services/zipExporter";
import {
  saveBatchToStorage,
  loadBatchFromStorage,
  clearBatchFromStorage,
  hasSavedBatch,
} from "../../utils/batchStorage";
import { THEME_LIBRARY, getRandomPairs } from "../../data/themePairs";
import type {
  BulkBatch,
  BulkPuzzleEntry,
  ReviewMode,
  ThemeDefinition,
} from "../../types/creator";
import "./BulkPuzzleCreator.css";

export function BulkPuzzleCreator() {
  // Current step in workflow
  const [step, setStep] = useState<Step>("config");

  // Batch state
  const [batch, setBatch] = useState<BulkBatch | null>(null);

  // Config step state
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [numberOfDays, setNumberOfDays] = useState(7);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("quick");

  // Resume modal
  const [showResumeModal, setShowResumeModal] = useState(false);

  // Generation progress
  const [generatingIndex, setGeneratingIndex] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Review state
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapColumnIndex, setSwapColumnIndex] = useState<number | null>(null);

  // Check for saved batch on mount
  useEffect(() => {
    if (hasSavedBatch()) {
      setShowResumeModal(true);
    }
  }, []);

  // Auto-save batch changes
  useEffect(() => {
    if (batch) {
      saveBatchToStorage(batch);
    }
  }, [batch]);

  // Helper to update a single puzzle (fixes race conditions with functional update)
  const updatePuzzle = useCallback(
    (index: number, updates: Partial<BulkPuzzleEntry>) => {
      setBatch((prevBatch) => {
        if (!prevBatch) return null;
        const newPuzzles = [...prevBatch.puzzles];
        newPuzzles[index] = { ...newPuzzles[index], ...updates };
        return {
          ...prevBatch,
          puzzles: newPuzzles,
          lastModified: new Date().toISOString(),
        };
      });
    },
    []
  );

  // Initialize batch with configuration
  const initializeBatch = () => {
    const dates = generateDates(startDate, numberOfDays);
    const randomPairs = getRandomPairs(numberOfDays);

    // Guard against empty theme library
    if (randomPairs.length === 0) {
      setGenerationError("No theme pairs available. Please check theme configuration.");
      return;
    }

    const puzzles: BulkPuzzleEntry[] = dates.map((date, i) => {
      const { theme, pair } = randomPairs[i % randomPairs.length];
      return {
        date,
        cascadeWord: pair.cascadeWord,
        seedWord: pair.seedWord,
        cascadeRow: 2 as const,
        columnWords: ["", "", "", "", ""],
        columnOptions: [[], [], [], [], []],
        status: "pending" as const,
        theme: theme.name,
      };
    });

    const newBatch: BulkBatch = {
      id: crypto.randomUUID(),
      config: { startDate, numberOfDays, reviewMode },
      puzzles,
      currentPuzzleIndex: 0,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    setBatch(newBatch);
    setStep("assign");
  };

  // Resume saved batch
  const resumeBatch = () => {
    const saved = loadBatchFromStorage();
    if (saved) {
      setBatch(saved);
      setStep(determineResumeStep(saved.puzzles));
    }
    setShowResumeModal(false);
  };

  // Start fresh (discard saved)
  const startFresh = () => {
    clearBatchFromStorage();
    setShowResumeModal(false);
  };

  // Update a puzzle's cascade/seed words
  const updatePuzzleWords = (index: number, cascadeWord: string, seedWord: string) => {
    updatePuzzle(index, {
      cascadeWord: cascadeWord.toUpperCase(),
      seedWord: seedWord.toUpperCase(),
    });
  };

  // Apply a theme to a puzzle
  const applyThemeToPuzzle = (index: number, theme: ThemeDefinition) => {
    const pair = theme.pairs[Math.floor(Math.random() * theme.pairs.length)];
    updatePuzzle(index, {
      cascadeWord: pair.cascadeWord,
      seedWord: pair.seedWord,
      theme: theme.name,
    });
  };

  // Generate all puzzles
  const generateAllPuzzles = async () => {
    if (!batch) return;

    setStep("generating");
    setGeneratingIndex(0);
    setGenerationError(null);

    // Get current puzzles from state
    const puzzlesToGenerate = [...batch.puzzles];

    for (let i = 0; i < puzzlesToGenerate.length; i++) {
      setGeneratingIndex(i);
      const puzzle = puzzlesToGenerate[i];

      // Skip already generated
      if (puzzle.status === "generated" || puzzle.status === "reviewed") {
        continue;
      }

      // Mark as generating
      updatePuzzle(i, { status: "generating" });

      try {
        const generated = await generateSinglePuzzle(puzzle.cascadeWord, puzzle.seedWord);

        if (generated) {
          updatePuzzle(i, {
            ...generated,
            status: "generated",
          });
        } else {
          updatePuzzle(i, {
            status: "error",
            errorMessage: "No viable puzzle configuration found",
          });
        }
      } catch (error) {
        console.error(`Failed to generate puzzle for ${puzzle.date}:`, error);
        updatePuzzle(i, {
          status: "error",
          errorMessage: String(error),
        });
      }
    }

    setStep("review");
  };

  // Regenerate a single puzzle
  const regeneratePuzzle = async (index: number) => {
    // Get current puzzle data from batch
    const puzzle = batch?.puzzles[index];
    if (!puzzle) return;

    updatePuzzle(index, { status: "generating" });

    try {
      const generated = await generateSinglePuzzle(puzzle.cascadeWord, puzzle.seedWord);

      if (generated) {
        updatePuzzle(index, {
          ...generated,
          status: "generated",
        });
      } else {
        updatePuzzle(index, {
          status: "error",
          errorMessage: "No viable configuration found",
        });
      }
    } catch (error) {
      updatePuzzle(index, {
        status: "error",
        errorMessage: String(error),
      });
    }
  };

  // Swap a column word
  const handleWordSwap = (newWord: string) => {
    if (!batch || swapColumnIndex === null) return;

    const puzzle = batch.puzzles[currentReviewIndex];
    const newColumnWords = [...puzzle.columnWords];
    newColumnWords[swapColumnIndex] = newWord;

    updatePuzzle(currentReviewIndex, {
      columnWords: newColumnWords,
      status: "reviewed",
    });

    setSwapModalOpen(false);
    setSwapColumnIndex(null);
  };

  // Download ZIP
  const handleDownload = async () => {
    if (!batch) return;

    const exportable = getExportableCount(batch);
    if (exportable === 0) {
      setGenerationError("No puzzles available to export");
      return;
    }

    await exportBatchAsZip(batch);
    clearBatchFromStorage();
  };

  // Reset everything
  const handleReset = () => {
    clearBatchFromStorage();
    setBatch(null);
    setStep("config");
    setCurrentReviewIndex(0);
    setGenerationError(null);
  };

  // Render puzzle grid preview
  const renderPuzzlePreview = (puzzle: BulkPuzzleEntry, compact = false) => {
    const { cascadeWord, seedWord, cascadeRow, columnWords } = puzzle;
    const COLUMN_LENGTHS = [4, 5, 5, 5, 6] as const;

    if (!columnWords.some((w) => w)) {
      return <div className="preview-empty">Not generated yet</div>;
    }

    return (
      <div className={`puzzle-preview ${compact ? "compact" : ""}`}>
        {/* Seed word header */}
        <div className="preview-row seed-row">
          {seedWord.split("").map((letter, i) => (
            <div key={i} className="preview-cell seed-cell">
              {letter}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {[0, 1, 2, 3, 4, 5].map((rowIndex) => {
          const isCascadeRow = rowIndex === cascadeRow;

          return (
            <div key={rowIndex} className={`preview-row ${isCascadeRow ? "cascade-row" : ""}`}>
              {columnWords.map((word, colIndex) => {
                const letter = word[rowIndex] || "";
                const maxLen = COLUMN_LENGTHS[colIndex];

                if (rowIndex >= maxLen) {
                  return <div key={colIndex} className="preview-cell empty" />;
                }

                return (
                  <div
                    key={colIndex}
                    className={`preview-cell ${isCascadeRow ? "cascade-cell" : ""}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Cascade word indicator */}
        <div className="cascade-label">
          CASCADE: <strong>{cascadeWord}</strong> (row {cascadeRow + 1})
        </div>
      </div>
    );
  };

  // Calculate stats for display
  const stats = batch ? getPuzzleStats(batch.puzzles) : null;

  return (
    <div className="bulk-puzzle-creator">
      {/* Header */}
      <header className="bulk-header">
        <Link to="/creator" className="back-link">
          ← Single Puzzle Creator
        </Link>
        <h1>Bulk Puzzle Creator</h1>
        <p className="subtitle">Create multiple CASCADE puzzles at once</p>
      </header>

      {/* Progress Steps */}
      <div className="step-progress">
        <div className={getStepClass("config", step)}>1. Configure</div>
        <div className={getStepClass("assign", step)}>2. Assign Words</div>
        <div className={getStepClass("generating", step)}>3. Generate</div>
        <div className={getStepClass("review", step)}>4. Review</div>
        <div className={getStepClass("download", step)}>5. Download</div>
      </div>

      {/* Step Content */}
      <div className="step-content">
        {/* Step 1: Configure */}
        {step === "config" && (
          <div className="config-step">
            <h2>Configure Your Batch</h2>

            <div className="config-form">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="date-input"
                />
              </div>

              <div className="form-group">
                <label>Number of Days</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={numberOfDays}
                  onChange={(e) =>
                    setNumberOfDays(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))
                  }
                  className="number-input"
                />
                <span className="input-hint">1-31 days</span>
              </div>

              <div className="form-group">
                <label>Review Mode</label>
                <div className="review-mode-options">
                  <button
                    className={`mode-btn ${reviewMode === "full" ? "selected" : ""}`}
                    onClick={() => setReviewMode("full")}
                  >
                    <span className="mode-icon">📝</span>
                    <span className="mode-name">Full Review</span>
                    <span className="mode-desc">Edit each puzzle individually</span>
                  </button>
                  <button
                    className={`mode-btn ${reviewMode === "quick" ? "selected" : ""}`}
                    onClick={() => setReviewMode("quick")}
                  >
                    <span className="mode-icon">⚡</span>
                    <span className="mode-name">Quick Review</span>
                    <span className="mode-desc">Overview with quick edits</span>
                  </button>
                  <button
                    className={`mode-btn ${reviewMode === "auto" ? "selected" : ""}`}
                    onClick={() => setReviewMode("auto")}
                  >
                    <span className="mode-icon">🤖</span>
                    <span className="mode-name">Auto Generate</span>
                    <span className="mode-desc">Trust the algorithm</span>
                  </button>
                </div>
              </div>
            </div>

            {generationError && <div className="error-message">{generationError}</div>}

            <button className="btn-primary" onClick={initializeBatch}>
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Assign Words */}
        {step === "assign" && batch && (
          <div className="assign-step">
            <h2>Assign Cascade & Seed Words</h2>
            <p className="step-hint">
              Each puzzle needs a cascade word (hidden) and seed word (starting letters). Click a
              theme to auto-fill, or enter words manually.
            </p>

            {/* Theme Palette */}
            <div className="theme-palette">
              <h3>Quick Theme Selection</h3>
              <div className="theme-grid">
                {THEME_LIBRARY.map((theme) => (
                  <button
                    key={theme.id}
                    className="theme-chip"
                    onClick={() => {
                      const pendingIndex = batch.puzzles.findIndex((p) => p.status === "pending");
                      if (pendingIndex >= 0) {
                        applyThemeToPuzzle(pendingIndex, theme);
                      }
                    }}
                    title={`${theme.pairs.length} word pairs`}
                  >
                    <span className="theme-icon">{theme.icon}</span>
                    <span className="theme-name">{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Puzzle List */}
            <div className="puzzle-list">
              {batch.puzzles.map((puzzle, index) => (
                <div key={puzzle.date} className="puzzle-row">
                  <div className="puzzle-date">{puzzle.date}</div>
                  <div className="puzzle-inputs">
                    <div className="word-input-pair">
                      <label>Cascade</label>
                      <input
                        type="text"
                        maxLength={5}
                        value={puzzle.cascadeWord}
                        onChange={(e) => updatePuzzleWords(index, e.target.value, puzzle.seedWord)}
                        placeholder="5 letters"
                        className={puzzle.cascadeWord.length === 5 ? "valid" : ""}
                      />
                    </div>
                    <div className="word-input-pair">
                      <label>Seed</label>
                      <input
                        type="text"
                        maxLength={5}
                        value={puzzle.seedWord}
                        onChange={(e) => updatePuzzleWords(index, puzzle.cascadeWord, e.target.value)}
                        placeholder="5 letters"
                        className={puzzle.seedWord.length === 5 ? "valid" : ""}
                      />
                    </div>
                  </div>
                  <div className="puzzle-theme-badge">{puzzle.theme || "Custom"}</div>
                  <div className="puzzle-actions">
                    <button
                      className="btn-small"
                      onClick={() => {
                        const pairs = getRandomPairs(1);
                        if (pairs.length > 0) {
                          const { theme, pair } = pairs[0];
                          updatePuzzle(index, {
                            cascadeWord: pair.cascadeWord,
                            seedWord: pair.seedWord,
                            theme: theme.name,
                          });
                        }
                      }}
                      title="Random theme"
                    >
                      🎲
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep("config")}>
                ← Back
              </button>
              <button
                className="btn-primary"
                onClick={generateAllPuzzles}
                disabled={batch.puzzles.some(
                  (p) => p.cascadeWord.length !== 5 || p.seedWord.length !== 5
                )}
              >
                Generate All →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Generating */}
        {step === "generating" && batch && (
          <div className="generating-step">
            <h2>Generating Puzzles</h2>

            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${((generatingIndex + 1) / batch.puzzles.length) * 100}%`,
                  }}
                />
              </div>
              <div className="progress-text">
                {generatingIndex + 1} / {batch.puzzles.length} puzzles
              </div>
            </div>

            <div className="generating-status">
              {batch.puzzles[generatingIndex] && (
                <p>
                  Generating puzzle for <strong>{batch.puzzles[generatingIndex].date}</strong>...
                </p>
              )}
            </div>

            {generationError && <div className="error-message">{generationError}</div>}
          </div>
        )}

        {/* Step 4: Review */}
        {step === "review" && batch && stats && (
          <div className="review-step">
            <h2>Review Puzzles</h2>

            {/* Stats */}
            <div className="review-stats">
              <span className="stat success">✓ {stats.successful} generated</span>
              <span className="stat error">✗ {stats.errors} errors</span>
            </div>

            {/* Full Review Mode */}
            {batch.config.reviewMode === "full" && (
              <div className="full-review">
                <div className="review-nav">
                  <button
                    className="btn-secondary"
                    onClick={() => setCurrentReviewIndex(Math.max(0, currentReviewIndex - 1))}
                    disabled={currentReviewIndex === 0}
                  >
                    ← Previous
                  </button>
                  <span className="nav-indicator">
                    Puzzle {currentReviewIndex + 1} of {batch.puzzles.length}
                  </span>
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      setCurrentReviewIndex(
                        Math.min(batch.puzzles.length - 1, currentReviewIndex + 1)
                      )
                    }
                    disabled={currentReviewIndex === batch.puzzles.length - 1}
                  >
                    Next →
                  </button>
                </div>

                <div className="current-puzzle-review">
                  <div className="puzzle-info">
                    <h3>{batch.puzzles[currentReviewIndex].date}</h3>
                    <span className={`status-badge ${batch.puzzles[currentReviewIndex].status}`}>
                      {batch.puzzles[currentReviewIndex].status}
                    </span>
                  </div>

                  {renderPuzzlePreview(batch.puzzles[currentReviewIndex])}

                  {batch.puzzles[currentReviewIndex].status !== "error" && (
                    <div className="column-words-edit">
                      <h4>Column Words (click to swap)</h4>
                      <div className="column-word-buttons">
                        {batch.puzzles[currentReviewIndex].columnWords.map((word, i) => (
                          <button
                            key={i}
                            className="column-word-btn"
                            onClick={() => {
                              setSwapColumnIndex(i);
                              setSwapModalOpen(true);
                            }}
                          >
                            {word}
                            {batch.puzzles[currentReviewIndex].columnOptions[i]?.length > 1 && (
                              <span className="swap-badge">
                                ↔ {batch.puzzles[currentReviewIndex].columnOptions[i].length}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {batch.puzzles[currentReviewIndex].status === "error" && (
                    <div className="error-panel">
                      <p>{batch.puzzles[currentReviewIndex].errorMessage}</p>
                      <button
                        className="btn-secondary"
                        onClick={() => regeneratePuzzle(currentReviewIndex)}
                      >
                        🔄 Retry Generation
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Review Mode */}
            {batch.config.reviewMode === "quick" && (
              <div className="quick-review">
                <div className="quick-review-grid">
                  {batch.puzzles.map((puzzle, index) => (
                    <div
                      key={puzzle.date}
                      className={`quick-review-card ${puzzle.status}`}
                      onClick={() => {
                        setCurrentReviewIndex(index);
                        setBatch((prev) =>
                          prev
                            ? { ...prev, config: { ...prev.config, reviewMode: "full" } }
                            : null
                        );
                      }}
                    >
                      <div className="card-date">{puzzle.date}</div>
                      <div className="card-words">
                        {puzzle.cascadeWord} / {puzzle.seedWord}
                      </div>
                      {puzzle.status === "error" ? (
                        <div className="card-error">❌ Error</div>
                      ) : (
                        <div className="card-preview">{renderPuzzlePreview(puzzle, true)}</div>
                      )}
                      <div className="card-actions">
                        {puzzle.status === "error" && (
                          <button
                            className="btn-small"
                            onClick={(e) => {
                              e.stopPropagation();
                              regeneratePuzzle(index);
                            }}
                          >
                            🔄
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auto Mode - just show summary */}
            {batch.config.reviewMode === "auto" && (
              <div className="auto-review">
                <p className="auto-message">
                  All puzzles have been auto-generated. Ready to download!
                </p>
                <div className="auto-summary">
                  {batch.puzzles.map((puzzle) => (
                    <div key={puzzle.date} className={`summary-item ${puzzle.status}`}>
                      <span>{puzzle.date}</span>
                      <span>{puzzle.status === "error" ? "❌" : "✓"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep("assign")}>
                ← Back to Words
              </button>
              <button
                className="btn-primary"
                onClick={() => setStep("download")}
                disabled={stats.successful === 0}
              >
                Continue to Download →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Download */}
        {step === "download" && batch && stats && (
          <div className="download-step">
            <h2>Download Your Puzzles</h2>

            <div className="download-summary">
              <div className="summary-card">
                <span className="summary-label">Date Range</span>
                <span className="summary-value">
                  {batch.puzzles[0]?.date} → {batch.puzzles[batch.puzzles.length - 1]?.date}
                </span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Total Puzzles</span>
                <span className="summary-value">{stats.successful}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Themes Used</span>
                <span className="summary-value">
                  {[...new Set(batch.puzzles.map((p) => p.theme).filter(Boolean))].length}
                </span>
              </div>
            </div>

            <div className="download-info">
              <p>
                Your puzzles will be downloaded as a ZIP file containing individual JSON files for
                each day.
              </p>
              <p>
                Place the JSON files in <code>public/puzzles/</code> to make them available as
                daily puzzles.
              </p>
            </div>

            {generationError && <div className="error-message">{generationError}</div>}

            <button className="btn-download" onClick={handleDownload}>
              📥 Download {stats.successful} Puzzles as ZIP
            </button>

            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep("review")}>
                ← Back to Review
              </button>
              <button className="btn-secondary" onClick={handleReset}>
                Start New Batch
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resume Modal */}
      {showResumeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Resume Previous Batch?</h3>
            <p>You have an in-progress batch. Would you like to continue?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={startFresh}>
                Start Fresh
              </button>
              <button className="btn-primary" onClick={resumeBatch}>
                Resume Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Word Swap Modal */}
      {swapModalOpen && swapColumnIndex !== null && batch && (
        <div className="modal-overlay" onClick={() => setSwapModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Swap Word for Column {swapColumnIndex + 1}</h3>
              <button className="modal-close" onClick={() => setSwapModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Current:{" "}
                <strong>{batch.puzzles[currentReviewIndex].columnWords[swapColumnIndex]}</strong>
              </p>
              <div className="word-options">
                {batch.puzzles[currentReviewIndex].columnOptions[swapColumnIndex]?.map((word) => (
                  <button
                    key={word}
                    className={`word-option ${
                      word === batch.puzzles[currentReviewIndex].columnWords[swapColumnIndex]
                        ? "current"
                        : ""
                    }`}
                    onClick={() => handleWordSwap(word)}
                  >
                    {word}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
