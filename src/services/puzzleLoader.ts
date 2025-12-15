// Puzzle loader service for loading curated daily puzzles

import type { SavedPuzzle } from "../types/creator";
import type { Puzzle, PuzzleWord, CascadeConfig } from "../types/game";

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

/**
 * Convert a SavedPuzzle (from creator) to a Puzzle (for gameplay)
 */
export function savedPuzzleToGamePuzzle(saved: SavedPuzzle): Puzzle {
  // Build puzzle words from column words
  const words: PuzzleWord[] = saved.columnWords.map((word) => {
    const length = word.length;
    const revealed = new Array(length).fill(false);
    revealed[0] = true; // First letter (key letter) is always revealed

    return {
      word: word.toUpperCase(),
      revealed,
      guessed: false,
      correct: false,
      autoCompleted: false,
      userInput: new Array(length).fill(""),
      hintsUsed: 0,
      blanksAtWordPhase: 0, // Will be set when entering word phase
    };
  });

  // Build cascade config
  const positions = [];
  for (let col = 0; col < 5; col++) {
    positions.push({ col, row: saved.cascadeRow });
  }

  const cascadeWord: CascadeConfig = {
    type: "horizontal",
    row: saved.cascadeRow,
    word: saved.cascadeWord.toUpperCase(),
    positions,
  };

  return {
    keyWord: saved.seedWord.toUpperCase(),
    words,
    guessedLetters: [],
    guessedVowels: 0,
    maxLetterGuesses: 6,
    maxVowels: 2,
    phase: "guessing-letters",
    score: 0,
    selectedWordIndex: null,
    cascadeWord,
    cascadeLocked: false,
    cascadeAwarded: false,
    hintsRemaining: 3,
    maxHints: 3,
  };
}

/**
 * Load a puzzle for a specific date from public/puzzles/
 * Filename format: YYYY-MM-DD.json
 */
export async function loadPuzzleForDate(
  date: string
): Promise<SavedPuzzle | null> {
  try {
    const response = await fetch(`/puzzles/${date}.json`);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[PuzzleLoader] No puzzle found for ${date}`);
        return null;
      }
      throw new Error(`Failed to load puzzle: ${response.status}`);
    }

    const puzzle: SavedPuzzle = await response.json();
    console.log(
      `[PuzzleLoader] Loaded puzzle for ${date}:`,
      puzzle.seedWord,
      puzzle.cascadeWord
    );
    return puzzle;
  } catch (error) {
    console.error(`[PuzzleLoader] Error loading puzzle for ${date}:`, error);
    return null;
  }
}

/**
 * Load today's puzzle
 * Returns null if no puzzle exists for today
 */
export async function loadTodaysPuzzle(): Promise<SavedPuzzle | null> {
  return loadPuzzleForDate(getTodayDateString());
}

/**
 * Check if a puzzle exists for a specific date
 */
export async function puzzleExistsForDate(date: string): Promise<boolean> {
  try {
    const response = await fetch(`/puzzles/${date}.json`, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Load the puzzle index (list of all available puzzles)
 * The index should be at public/puzzles/index.json
 */
export async function loadPuzzleIndex(): Promise<string[]> {
  try {
    const response = await fetch("/puzzles/index.json");
    if (!response.ok) {
      return [];
    }
    return await response.json();
  } catch {
    return [];
  }
}
