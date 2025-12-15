// Auto-generates complete puzzles from cascade + seed words
// Picks the best available words for each column automatically

import { getWordsWithLetterAt } from "../data/words";
import { EXPECTED_LENGTHS } from "../types/creator";
import { analyzePuzzleViability } from "./viabilityChecker";

export interface GeneratedPuzzle {
  cascadeWord: string;
  seedWord: string;
  cascadeRow: 1 | 2 | 3;
  columnWords: string[];
  // Alternatives for each column (for swapping)
  alternatives: string[][];
  // Quality score (higher = better)
  score: number;
  // Any issues with the generation
  warnings: string[];
}

/**
 * Get all valid words for a column at a specific cascade row
 */
function getColumnCandidates(
  seedLetter: string,
  cascadeLetter: string,
  cascadeRow: 1 | 2 | 3,
  wordLength: number
): string[] {
  // Get words that have cascadeLetter at the cascade row position
  const wordsWithCascadeLetter = getWordsWithLetterAt(
    cascadeLetter.toLowerCase(),
    cascadeRow,
    wordLength
  );

  // Filter to words that also start with seedLetter
  return wordsWithCascadeLetter
    .filter((w) => w[0].toLowerCase() === seedLetter.toLowerCase())
    .map((w) => w.toUpperCase());
}

/**
 * Auto-generate a complete puzzle from cascade and seed words
 */
export function autoGeneratePuzzle(
  cascadeWord: string,
  seedWord: string,
  cascadeRow?: 1 | 2 | 3
): GeneratedPuzzle | null {
  if (cascadeWord.length !== 5 || seedWord.length !== 5) {
    return null;
  }

  const cascade = cascadeWord.toUpperCase();
  const seed = seedWord.toUpperCase();

  // Analyze viability to find best row if not specified
  const viability = analyzePuzzleViability(seed, cascade);
  const row = cascadeRow ?? viability.recommendedRow;

  const columnWords: string[] = [];
  const alternatives: string[][] = [];
  const warnings: string[] = [];

  // Generate word for each column
  for (let i = 0; i < 5; i++) {
    const wordLength = EXPECTED_LENGTHS[i];
    const candidates = getColumnCandidates(
      seed[i],
      cascade[i],
      row,
      wordLength
    );

    if (candidates.length === 0) {
      // No valid words for this column
      warnings.push(
        `Column ${i + 1}: No valid ${wordLength}-letter words found`
      );
      columnWords.push("");
      alternatives.push([]);
    } else {
      // Pick first word (could be improved with frequency sorting)
      columnWords.push(candidates[0]);
      // Store alternatives (skip the first one we picked)
      alternatives.push(candidates.slice(1, 6));
    }
  }

  // Check if puzzle is complete
  const hasEmptyColumn = columnWords.some((w) => w === "");
  if (hasEmptyColumn) {
    return null;
  }

  // Calculate score based on number of alternatives (more = better flexibility)
  const score = alternatives.reduce(
    (sum, alts) => sum + Math.min(alts.length, 5),
    0
  );

  return {
    cascadeWord: cascade,
    seedWord: seed,
    cascadeRow: row,
    columnWords,
    alternatives,
    score,
    warnings,
  };
}

/**
 * Try to generate puzzles for all viable seed words
 * Returns sorted by quality score
 */
export function generatePuzzleOptions(
  cascadeWord: string,
  candidateSeedWords: string[]
): GeneratedPuzzle[] {
  const results: GeneratedPuzzle[] = [];

  for (const seedWord of candidateSeedWords) {
    if (seedWord.length !== 5) continue;

    const puzzle = autoGeneratePuzzle(cascadeWord, seedWord);
    if (puzzle) {
      results.push(puzzle);
    }
  }

  // Sort by score (highest first)
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Swap a column word with an alternative
 */
export function swapColumnWord(
  puzzle: GeneratedPuzzle,
  columnIndex: number,
  newWord: string
): GeneratedPuzzle {
  const newColumnWords = [...puzzle.columnWords];
  const newAlternatives = puzzle.alternatives.map((alts) => [...alts]);

  // Move current word to alternatives
  const currentWord = newColumnWords[columnIndex];
  if (!newAlternatives[columnIndex].includes(currentWord)) {
    newAlternatives[columnIndex].unshift(currentWord);
  }

  // Remove new word from alternatives
  newAlternatives[columnIndex] = newAlternatives[columnIndex].filter(
    (w) => w !== newWord
  );

  // Set new word
  newColumnWords[columnIndex] = newWord;

  return {
    ...puzzle,
    columnWords: newColumnWords,
    alternatives: newAlternatives,
  };
}

/**
 * Get all alternatives for a column (including current word)
 */
export function getAllColumnOptions(
  puzzle: GeneratedPuzzle,
  columnIndex: number
): string[] {
  const current = puzzle.columnWords[columnIndex];
  const alts = puzzle.alternatives[columnIndex];
  return [current, ...alts];
}
