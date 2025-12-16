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
import { ThemeToggle } from "./ThemeToggle";
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
  const [showHelp, setShowHelp] = useState(false);

  // Load puzzle on mount - try curated first, fall back to random
  useEffect(() => {
    async function loadPuzzle() {
      setIsLoading(true);
      try {
        const savedPuzzle = await loadTodaysPuzzle();
        if (savedPuzzle) {
          setPuzzle(savedPuzzleToGamePuzzle(savedPuzzle));
          setPuzzleSource("curated");
          setPuzzleTheme(savedPuzzle.metadata?.theme || null);
        } else {
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

  // Handle keyboard input
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!puzzle) return;

      const key = e.key.toUpperCase();

      // Letter guessing phase - global keyboard input
      if (puzzle.phase === "guessing-letters") {
        if (/^[A-Z]$/.test(key)) {
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
            newInput[selectedCellIndex] = key;
            setPuzzle(updateWordInput(puzzle, wordIndex, newInput));

            let nextCell: number | null = null;
            for (let i = selectedCellIndex + 1; i < word.word.length; i++) {
              if (!word.revealed[i] && newInput[i] === "") {
                nextCell = i;
                break;
              }
            }
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
            if (newInput[selectedCellIndex] !== "") {
              newInput[selectedCellIndex] = "";
              setPuzzle(updateWordInput(puzzle, wordIndex, newInput));
            } else {
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
            for (let i = word.word.length - 1; i >= 0; i--) {
              if (!word.revealed[i] && newInput[i] !== "") {
                newInput[i] = "";
                setPuzzle(updateWordInput(puzzle, wordIndex, newInput));
                break;
              }
            }
          }
        } else if (e.key === "Tab") {
          e.preventDefault();
          const totalWords = puzzle.words.length;
          const nextIndex = (wordIndex + 1) % totalWords;
          setPuzzle(selectWord(puzzle, nextIndex));
          setSelectedCellIndex(null);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
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
          const startIdx = selectedCellIndex ?? 0;
          for (let i = startIdx + 1; i < word.word.length; i++) {
            if (!word.revealed[i]) {
              setSelectedCellIndex(i);
              break;
            }
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          setPuzzle(submitAllWords(puzzle));
          setSelectedCellIndex(null);
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
    setPuzzleSource("random");
    setPuzzleTheme(null);
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

  const getLetterState = (letter: string) => {
    if (!puzzle.guessedLetters.includes(letter)) return "available";
    const isHit = puzzle.words.some((w) => w.word.includes(letter));
    return isHit ? "hit" : "miss";
  };

  return (
    <div className="game-board">
      {/* COMPACT HEADER */}
      <header className="game-header">
        <div className="header-left">
          <h1 className="game-title">CASCADE</h1>
          <span className={`puzzle-badge ${puzzleSource}`}>
            {puzzleSource === "curated" ? "Daily" : "Practice"}
          </span>
          {puzzleTheme && <span className="theme-tag">{puzzleTheme}</span>}
        </div>

        <div className="header-center">
          <div className="score-display">
            <span className="score-number">{finalScore}</span>
            <span className="score-label">pts</span>
          </div>
        </div>

        <div className="header-right">
          <ThemeToggle />
          <button
            className="help-button"
            onClick={() => setShowHelp(!showHelp)}
            aria-label="How to play"
          >
            ?
          </button>
        </div>
      </header>

      {/* HELP MODAL */}
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <button className="help-close" onClick={() => setShowHelp(false)}>
              ×
            </button>
            <h2>How to Play</h2>

            <div className="help-section cascade-info">
              <h3>Cascade Word</h3>
              <p>
                A Cascade word runs across Row {puzzle.cascadeWord.row + 1}.<br/>
                The starting word and the Cascade word share a theme.
                Complete the Cascade word to amplify your score!
              </p>
            </div>
            <div className="help-section">
              <h3>Letter Phase</h3>
              <p>Guess up to 6 letters to reveal them across all words.</p>
              <ul>
                <li>
                  <span className="vowel-dot"></span> Vowels are limited (max 2)
                </li>
                <li>Consecutive hits build a streak bonus</li>
                <li>Skip early to keep more blanks</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Word Phase</h3>
              <p>Fill in the blanks to complete each word.</p>
              <ul>
                <li>Click a column, then type your guess</li>
                <li>More blanks = higher multiplier</li>
                <li>Right-click a blank for a hint (first one's free!)</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Scoring Tips</h3>
              <ul>
                <li>Base scores: 100 / 150 / 150 / 150 / 200</li>
                <li>Each blank increases your multiplier</li>
                <li>Letter streaks add bonus points</li>
                <li>The cascade amplifies your total</li>
              </ul>
            </div>

          </div>
        </div>
      )}

      {/* MAIN GAME AREA */}
      <main className="game-main">
        {/* THEME & CASCADE HINTS */}
        {puzzle.phase !== "complete" && (
          <div className="game-hints">
            {puzzle.theme && (
              <div className="theme-badge">
                <span className="theme-label">Today's Theme:</span>
                <span className="theme-name">{puzzle.theme}</span>
              </div>
            )}
            
          </div>
        )}

        {/* WORD COLUMNS - The Hero */}
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

        {/* PHASE-SPECIFIC CONTROLS */}
        {puzzle.phase === "guessing-letters" && (
          <div className="controls-section">
            <div className="phase-status">
              <div className="status-item">
                <span className="status-value">{remainingGuesses}</span>
                <span className="status-label">Guesses left</span>
              </div>
              <div className="status-divider"></div>
              <div className="status-item vowels">
                <span className="status-value">{remainingVowels}</span>
                <span className="status-label">Vowels left</span>
              </div>
            </div>

            <div className="keyboard">
              {alphabet.map((letter) => {
                const state = getLetterState(letter);
                return (
                  <button
                    key={letter}
                    className={`key ${VOWELS.includes(letter) ? "vowel" : ""} ${state}`}
                    onClick={() => handleGuessLetter(letter)}
                    disabled={isLetterDisabled(letter)}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {puzzle.guessedLetters.length >= 2 && remainingGuesses > 0 && (
              <button className="skip-button" onClick={handleSkipToWords}>
                Done with letters — Guess words
              </button>
            )}
          </div>
        )}

        {puzzle.phase === "guessing-words" && (
          <div className="controls-section">
            <div className="word-phase-info">
              {puzzle.selectedWordIndex === null ? (
                <p className="instruction">Click a column to start guessing</p>
              ) : (
                <p className="instruction">
                  Type to fill blanks • <kbd>Tab</kbd> next word •{" "}
                  <kbd>Enter</kbd> submit
                </p>
              )}

              <div className="hints-inline">
                <span className="hints-icon">💡</span>
                <span className="hints-count">
                  {puzzle.hintsRemaining} hints
                </span>
              </div>
            </div>

            <button className="submit-button" onClick={handleSubmitPuzzle}>
              Submit All Words
            </button>
          </div>
        )}

        {puzzle.phase === "complete" && (
          <div className="results-section">
            <div className="results-header">
              {correctWords === puzzle.words.length ? (
                <div className="perfect-result">
                  <span className="celebration">🎉</span>
                  <h2>Perfect!</h2>
                </div>
              ) : (
                <h2>
                  {correctWords} of {puzzle.words.length} correct
                </h2>
              )}
            </div>

            {/* Cascade Result */}
            <div
              className={`cascade-result ${puzzle.cascadeAwarded ? "awarded" : puzzle.cascadeLocked ? "missed" : ""}`}
            >
              <span className="cascade-label">Cascade Word:</span>
              <span className="cascade-word">{puzzle.cascadeWord.word}</span>
              {puzzle.cascadeAwarded && (
                <span className="cascade-bonus">+500</span>
              )}
            </div>

            {/* Score Breakdown */}
            <div className="breakdown">
              <table className="breakdown-table">
                <tbody>
                  {breakdown.map((item, idx) => (
                    <tr
                      key={idx}
                      className={item.points > 0 ? "scored" : "zero"}
                    >
                      <td className="label">{item.label}</td>
                      <td className="detail">{item.detail || ""}</td>
                      <td className="points">
                        {item.points > 0 ? `+${item.points}` : "0"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total</td>
                    <td className="points total">{totalScore}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <button className="new-game-button" onClick={handleNewGame}>
              Play Again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
