import { useState, useEffect, useCallback } from "react";
import { WordColumn } from "./WordColumn";
import {
  generatePuzzle,
  guessLetter,
  skipToWordGuessing,
  calculateFinalScore,
  selectWord,
  updateWordInput,
  isVowel,
  submitAllWords,
  getScoreBreakdown,
  revealHint,
} from "../utils/gameLogic";
import {
  loadTodaysPuzzle,
  savedPuzzleToGamePuzzle,
} from "../services/puzzleLoader";
import type { Puzzle } from "../types/game";
import "./GameBoard.css";

const VOWELS = ["A", "E", "I", "O", "U"];

export function GameBoard() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [puzzleSource, setPuzzleSource] = useState<"curated" | "random">(
    "random"
  );
  const [puzzleTheme, setPuzzleTheme] = useState<string | null>(null);
  const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
    null
  );

  // Load puzzle on mount - try curated first, fall back to random
  useEffect(() => {
    async function loadPuzzle() {
      setIsLoading(true);
      try {
        const savedPuzzle = await loadTodaysPuzzle();
        if (savedPuzzle) {
          console.log("[GameBoard] Loaded curated puzzle for today");
          setPuzzle(savedPuzzleToGamePuzzle(savedPuzzle));
          setPuzzleSource("curated");
          setPuzzleTheme(savedPuzzle.metadata?.theme || null);
        } else {
          console.log("[GameBoard] No curated puzzle, generating random");
          setPuzzle(generatePuzzle());
          setPuzzleSource("random");
          setPuzzleTheme(null);
        }
      } catch (error) {
        console.error("[GameBoard] Failed to load puzzle:", error);
        setPuzzle(generatePuzzle());
        setPuzzleSource("random");
        setPuzzleTheme(null);
      }
      setIsLoading(false);
    }
    loadPuzzle();
  }, []);

  // Handle keyboard input for letter guessing phase
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!puzzle) return;

      const key = e.key.toUpperCase();

      // Letter guessing phase - global keyboard input
      if (puzzle.phase === "guessing-letters") {
        if (/^[A-Z]$/.test(key)) {
          // Check if it's a vowel and we've hit the limit
          if (isVowel(key) && puzzle.guessedVowels >= puzzle.maxVowels) {
            return;
          }
          if (!puzzle.guessedLetters.includes(key)) {
            setPuzzle(guessLetter(puzzle, key));
          }
        }
      }

      // Word guessing phase - type into selected word
      if (
        puzzle.phase === "guessing-words" &&
        puzzle.selectedWordIndex !== null
      ) {
        const wordIndex = puzzle.selectedWordIndex;
        const word = puzzle.words[wordIndex];

        if (/^[A-Z]$/.test(key)) {
          const newInput = [...word.userInput];

          if (selectedCellIndex !== null && !word.revealed[selectedCellIndex]) {
            // Type into the specifically selected cell
            newInput[selectedCellIndex] = key;
            setPuzzle(updateWordInput(puzzle, wordIndex, newInput));

            // Move to next empty non-revealed cell
            let nextCell: number | null = null;
            for (let i = selectedCellIndex + 1; i < word.word.length; i++) {
              if (!word.revealed[i] && newInput[i] === "") {
                nextCell = i;
                break;
              }
            }
            // If no next cell found, wrap around to beginning
            if (nextCell === null) {
              for (let i = 1; i < selectedCellIndex; i++) {
                if (!word.revealed[i] && newInput[i] === "") {
                  nextCell = i;
                  break;
                }
              }
            }
            setSelectedCellIndex(nextCell);
          } else {
            // No specific cell selected - find first empty non-revealed position
            for (let i = 0; i < word.word.length; i++) {
              if (!word.revealed[i] && newInput[i] === "") {
                newInput[i] = key;
                setPuzzle(updateWordInput(puzzle, wordIndex, newInput));
                break;
              }
            }
          }
        } else if (e.key === "Backspace") {
          const newInput = [...word.userInput];

          if (selectedCellIndex !== null && !word.revealed[selectedCellIndex]) {
            // Delete from specifically selected cell
            if (newInput[selectedCellIndex] !== "") {
              newInput[selectedCellIndex] = "";
              setPuzzle(updateWordInput(puzzle, wordIndex, newInput));
            } else {
              // Cell already empty, move to previous non-revealed cell with content
              for (let i = selectedCellIndex - 1; i >= 0; i--) {
                if (!word.revealed[i] && newInput[i] !== "") {
                  newInput[i] = "";
                  setSelectedCellIndex(i);
                  setPuzzle(updateWordInput(puzzle, wordIndex, newInput));
                  break;
                }
              }
            }
          } else {
            // No specific cell selected - delete last user-entered letter
            for (let i = word.word.length - 1; i >= 0; i--) {
              if (!word.revealed[i] && newInput[i] !== "") {
                newInput[i] = "";
                setPuzzle(updateWordInput(puzzle, wordIndex, newInput));
                break;
              }
            }
          }
        } else if (e.key === "Tab") {
          e.preventDefault(); // Prevent default tab behavior
          // Find next word column (cycle through all)
          const totalWords = puzzle.words.length;
          const nextIndex = (wordIndex + 1) % totalWords;
          setPuzzle(selectWord(puzzle, nextIndex));
          setSelectedCellIndex(null); // Reset cell selection when changing columns
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          // Move to previous non-revealed cell
          if (selectedCellIndex !== null) {
            for (let i = selectedCellIndex - 1; i >= 1; i--) {
              if (!word.revealed[i]) {
                setSelectedCellIndex(i);
                break;
              }
            }
          }
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          // Move to next non-revealed cell
          const startIdx = selectedCellIndex ?? 0;
          for (let i = startIdx + 1; i < word.word.length; i++) {
            if (!word.revealed[i]) {
              setSelectedCellIndex(i);
              break;
            }
          }
        }
      }
    },
    [puzzle, selectedCellIndex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleGuessLetter = (letter: string) => {
    if (puzzle && puzzle.phase === "guessing-letters") {
      setPuzzle(guessLetter(puzzle, letter));
    }
  };

  const handleSkipToWords = () => {
    if (puzzle) {
      setPuzzle(skipToWordGuessing(puzzle));
    }
  };

  const handleSelectWord = (index: number) => {
    if (puzzle && puzzle.phase === "guessing-words") {
      setPuzzle(selectWord(puzzle, index));
      // Reset cell selection when selecting a new word
      if (puzzle.selectedWordIndex !== index) {
        setSelectedCellIndex(null);
      }
    }
  };

  const handleSelectCell = (wordIndex: number, cellIndex: number) => {
    if (puzzle && puzzle.phase === "guessing-words") {
      if (puzzle.selectedWordIndex !== wordIndex) {
        setPuzzle(selectWord(puzzle, wordIndex));
      }
      setSelectedCellIndex(cellIndex);
    }
  };

  const handleUseHint = (wordIndex: number, letterIndex: number) => {
    if (
      puzzle &&
      puzzle.phase === "guessing-words" &&
      puzzle.hintsRemaining > 0
    ) {
      setPuzzle(revealHint(puzzle, wordIndex, letterIndex));
    }
  };

  const handleSubmitPuzzle = () => {
    if (puzzle && puzzle.phase === "guessing-words") {
      setPuzzle(submitAllWords(puzzle));
      setSelectedCellIndex(null);
    }
  };

  const handleNewGame = () => {
    setPuzzle(generatePuzzle());
    setSelectedCellIndex(null);
  };

  if (!puzzle || isLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading puzzle...</p>
      </div>
    );
  }

  const correctWords = puzzle.words.filter((w) => w.correct).length;
  const finalScore =
    puzzle.phase === "complete" ? calculateFinalScore(puzzle) : puzzle.score;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const remainingGuesses =
    puzzle.maxLetterGuesses - puzzle.guessedLetters.length;
  const remainingVowels = puzzle.maxVowels - puzzle.guessedVowels;
  const breakdown =
    puzzle.phase === "complete" ? getScoreBreakdown(puzzle) : [];
  const totalScore = breakdown.reduce((sum, item) => sum + item.points, 0);

  const isLetterDisabled = (letter: string) => {
    if (puzzle.phase !== "guessing-letters") return true;
    if (puzzle.guessedLetters.includes(letter)) return true;
    if (VOWELS.includes(letter) && puzzle.guessedVowels >= puzzle.maxVowels)
      return true;
    return false;
  };

  return (
    <div className="game-board">
      {/* HEADER - Always visible, compact */}
      <header className="game-header">
        <div className="title-row">
          <h1 className="game-title">CASCADE</h1>
          <span className={`puzzle-badge ${puzzleSource}`}>
            {puzzleSource === "curated" ? "📅 Daily" : "🎲 Random"}
          </span>
        </div>
        {puzzleTheme && (
          <p className="puzzle-theme">
            Theme: <strong>{puzzleTheme}</strong>
          </p>
        )}
        <p className="game-subtitle">
          {puzzle.phase === "guessing-letters" &&
            "Guess letters to reveal hidden words"}
          {puzzle.phase === "guessing-words" &&
            "Fill in the blanks and submit!"}
          {puzzle.phase === "complete" && "Game Complete!"}
        </p>
      </header>

      {/* MAIN CONTENT - 3 Panel Layout */}
      <div className="game-main">
        {/* LEFT PANEL - Score & Controls */}
        <div className="left-panel">
          {/* Score Card - Always visible */}
          <div className="panel-card score-card">
            <div className="score-value">
              <span className="score-number">{finalScore}</span>
              <span className="score-label">Points</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <span
                className={`phase-badge ${
                  puzzle.phase === "guessing-letters"
                    ? "letter-phase"
                    : puzzle.phase === "guessing-words"
                    ? "word-phase"
                    : "complete"
                }`}
              >
                {puzzle.phase === "guessing-letters" && "Letter Phase"}
                {puzzle.phase === "guessing-words" && "Word Phase"}
                {puzzle.phase === "complete" && "Complete"}
              </span>
            </div>
          </div>

          {/* Letter Phase Controls */}
          {puzzle.phase === "guessing-letters" && (
            <div className="panel-card letter-controls">
              <h3>Guess Letters</h3>
              <div className="guess-stats">
                <div className="stat letters-stat">
                  <span className="stat-value">{remainingGuesses}</span>
                  <span>Guesses</span>
                </div>
                <div className="stat vowels-stat">
                  <span className="stat-value">{remainingVowels}</span>
                  <span>Vowels</span>
                </div>
              </div>
              <div className="alphabet-grid">
                {alphabet.map((letter) => (
                  <button
                    key={letter}
                    className={`letter-button ${
                      puzzle.guessedLetters.includes(letter) ? "used" : ""
                    } ${VOWELS.includes(letter) ? "vowel" : ""} ${
                      VOWELS.includes(letter) &&
                      puzzle.guessedVowels >= puzzle.maxVowels &&
                      !puzzle.guessedLetters.includes(letter)
                        ? "vowel-disabled"
                        : ""
                    }`}
                    onClick={() => handleGuessLetter(letter)}
                    disabled={isLetterDisabled(letter)}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              {remainingGuesses > 0 && puzzle.guessedLetters.length >= 2 && (
                <button className="skip-button" onClick={handleSkipToWords}>
                  Skip to Words →
                </button>
              )}
            </div>
          )}

          {/* Word Phase Controls */}
          {puzzle.phase === "guessing-words" && (
            <div className="panel-card word-controls">
              <h3>Submit Your Guesses</h3>
              <div className="hints-display">
                <span className="hints-icon">💡</span>
                <span
                  className={`hints-count ${
                    puzzle.hintsRemaining === 0 ? "empty" : ""
                  }`}
                >
                  {puzzle.hintsRemaining}/{puzzle.maxHints}
                </span>
                <span className="hints-label">Hints</span>
              </div>
              <p className="hint-tip">Right-click a blank to use hint</p>
              <button className="submit-button" onClick={handleSubmitPuzzle}>
                Submit Puzzle
              </button>
            </div>
          )}

          {/* Complete Phase Controls */}
          {puzzle.phase === "complete" && (
            <div className="panel-card complete-controls">
              <h3>Results</h3>
              <div className="final-stats">
                <div className="words-result">
                  <strong>{correctWords}</strong> / {puzzle.words.length} words
                </div>
                {correctWords === puzzle.words.length && (
                  <span className="perfect-badge">🎉 Perfect!</span>
                )}
              </div>
              <button className="new-game-button" onClick={handleNewGame}>
                Play Again
              </button>
            </div>
          )}

          {/* Guessed Letters - Show during word phase and complete */}
          {(puzzle.phase === "guessing-words" || puzzle.phase === "complete") &&
            puzzle.guessedLetters.length > 0 && (
              <div className="panel-card guessed-letters-card">
                <h3>Letters Guessed</h3>
                <div className="guessed-letters-grid">
                  {puzzle.guessedLetters.map((letter) => {
                    const isInWords = puzzle.words.some((w) =>
                      w.word.includes(letter)
                    );
                    return (
                      <span
                        key={letter}
                        className={`guessed-letter ${
                          isInWords ? "hit" : "miss"
                        }`}
                      >
                        {letter}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
        </div>

        {/* CENTER PANEL - Word Columns */}
        <div className="center-panel">
          <div className="word-columns-container">
            {puzzle.words.map((word, index) => (
              <WordColumn
                key={index}
                puzzleWord={word}
                position={index}
                keyLetter={puzzle.keyWord[index]}
                isWordGuessingPhase={puzzle.phase === "guessing-words"}
                isSelected={puzzle.selectedWordIndex === index}
                onSelectWord={() => handleSelectWord(index)}
                cascadeRow={puzzle.cascadeWord.row}
                showResults={puzzle.phase === "complete"}
                selectedCellIndex={
                  puzzle.selectedWordIndex === index ? selectedCellIndex : null
                }
                onSelectCell={(cellIndex) => handleSelectCell(index, cellIndex)}
                hintsRemaining={puzzle.hintsRemaining}
                onUseHint={(letterIndex) => handleUseHint(index, letterIndex)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT PANEL - Info & Instructions */}
        <div className="right-panel">
          {/* Cascade Status - Always visible */}
          <div className="panel-card cascade-card">
            <h3>🎯 Cascade Bonus</h3>
            <div className="cascade-status">
              <div className="cascade-row-indicator">
                Row {puzzle.cascadeWord.row + 1} across all words
              </div>
              {puzzle.cascadeAwarded ? (
                <div className="cascade-value awarded">+500 Earned!</div>
              ) : puzzle.cascadeLocked ? (
                <div className="cascade-value locked">Missed</div>
              ) : (
                <div className="cascade-value pending">+500 Available</div>
              )}
              {puzzle.phase === "complete" && (
                <div className="cascade-word-display">
                  <span className="cascade-word-label">The word was:</span>
                  <span className="cascade-word-value">
                    {puzzle.cascadeWord.word}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Scoring Guide - Always visible */}
          <div className="panel-card scoring-card">
            <h3>Scoring</h3>
            <div className="scoring-formula">
              base × (1 + 0.75×blanks − 0.25×hints)
            </div>
            <table className="scoring-table">
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Length</th>
                  <th>Base</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>4</td>
                  <td>100</td>
                </tr>
                <tr>
                  <td>2-4</td>
                  <td>5</td>
                  <td>150</td>
                </tr>
                <tr>
                  <td>5</td>
                  <td>6</td>
                  <td>200</td>
                </tr>
              </tbody>
            </table>
            <div className="scoring-bonuses">
              <p>
                <strong>🎯 Cascade:</strong> +500
              </p>
              <p>
                <strong>✨ Auto-complete:</strong> base + 50
              </p>
            </div>
          </div>

          {/* Instructions - Phase specific */}
          {puzzle.phase === "guessing-letters" && (
            <div className="panel-card instructions-card">
              <h3>How to Play</h3>
              <ul className="instructions-list">
                <li>
                  <strong>1.</strong> Click letters to reveal them
                </li>
                <li>
                  <strong>2.</strong> Vowels are limited (orange)
                </li>
                <li>
                  <strong>3.</strong> More blanks = higher score!
                </li>
                <li>
                  Press <kbd>Skip</kbd> when ready for words
                </li>
              </ul>
            </div>
          )}

          {puzzle.phase === "guessing-words" && (
            <div className="panel-card instructions-card">
              <h3>How to Play</h3>
              <ul className="instructions-list">
                <li>
                  <strong>1.</strong> Click a column to select
                </li>
                <li>
                  <strong>2.</strong> Type to fill blanks
                </li>
                <li>
                  <strong>3.</strong> <kbd>Tab</kbd> = next word
                </li>
                <li>
                  <strong>4.</strong> Submit when ready!
                </li>
              </ul>
            </div>
          )}

          {/* Score Breakdown - Complete phase */}
          {puzzle.phase === "complete" && (
            <div className="panel-card breakdown-card">
              <h3>Score Breakdown</h3>
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th>Word</th>
                    <th>Details</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((item, idx) => (
                    <tr
                      key={idx}
                      className={item.points > 0 ? "scored-row" : "zero-row"}
                    >
                      <td className="label-cell">{item.label}</td>
                      <td className="detail-cell">{item.detail || "—"}</td>
                      <td className="points-cell">
                        {item.points > 0 ? `+${item.points}` : "0"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>
                      <strong>Total</strong>
                    </td>
                    <td className="points-cell">
                      <strong>{totalScore}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
