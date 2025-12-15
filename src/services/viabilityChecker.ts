// Viability checker for puzzle combinations
// Analyzes how many valid column words exist for a cascade+seed combination

import { getWordsWithLetterAt, isValidWord } from "../data/words";
import { EXPECTED_LENGTHS } from "../types/creator";

export interface ColumnViability {
  columnIndex: number;
  seedLetter: string;
  cascadeLetter: string;
  wordLength: number;
  wordCounts: {
    row1: number;
    row2: number;
    row3: number;
  };
  // Sample words for each row position
  sampleWords: {
    row1: string[];
    row2: string[];
    row3: string[];
  };
}

export interface PuzzleViability {
  seedWord: string;
  cascadeWord: string;
  columns: ColumnViability[];
  // Best cascade row based on total available words
  recommendedRow: 1 | 2 | 3;
  // Score per row (sum of word counts across all columns)
  rowScores: {
    row1: number;
    row2: number;
    row3: number;
  };
  // Worst column per row (bottleneck)
  bottlenecks: {
    row1: { column: number; count: number };
    row2: { column: number; count: number };
    row3: { column: number; count: number };
  };
}

/**
 * Check how many valid words exist for a column with given constraints
 * Uses local word list for fast checking
 */
function countLocalWords(
  seedLetter: string,
  cascadeLetter: string,
  cascadeRow: 1 | 2 | 3,
  wordLength: number
): { count: number; samples: string[] } {
  // Get words that have cascadeLetter at the cascade row position
  const wordsWithCascadeLetter = getWordsWithLetterAt(
    cascadeLetter.toLowerCase(),
    cascadeRow,
    wordLength
  );

  // Filter to words that also start with seedLetter
  const validWords = wordsWithCascadeLetter.filter(
    (w) => w[0].toLowerCase() === seedLetter.toLowerCase()
  );

  return {
    count: validWords.length,
    samples: validWords.slice(0, 5).map((w) => w.toUpperCase()),
  };
}

/**
 * Analyze viability of a single column across all cascade rows
 */
function analyzeColumn(
  columnIndex: number,
  seedLetter: string,
  cascadeLetter: string
): ColumnViability {
  const wordLength = EXPECTED_LENGTHS[columnIndex];

  const row1 = countLocalWords(seedLetter, cascadeLetter, 1, wordLength);
  const row2 = countLocalWords(seedLetter, cascadeLetter, 2, wordLength);
  const row3 = countLocalWords(seedLetter, cascadeLetter, 3, wordLength);

  return {
    columnIndex,
    seedLetter: seedLetter.toUpperCase(),
    cascadeLetter: cascadeLetter.toUpperCase(),
    wordLength,
    wordCounts: {
      row1: row1.count,
      row2: row2.count,
      row3: row3.count,
    },
    sampleWords: {
      row1: row1.samples,
      row2: row2.samples,
      row3: row3.samples,
    },
  };
}

/**
 * Analyze the full puzzle viability for a cascade+seed combination
 */
export function analyzePuzzleViability(
  seedWord: string,
  cascadeWord: string
): PuzzleViability {
  if (seedWord.length !== 5 || cascadeWord.length !== 5) {
    throw new Error("Both seed and cascade words must be 5 letters");
  }

  // Analyze each column
  const columns: ColumnViability[] = [];
  for (let i = 0; i < 5; i++) {
    columns.push(analyzeColumn(i, seedWord[i], cascadeWord[i]));
  }

  // Calculate row scores (sum of word counts, but use minimum as bottleneck indicator)
  const rowScores = {
    row1: columns.reduce(
      (sum, col) => sum + Math.min(col.wordCounts.row1, 10),
      0
    ),
    row2: columns.reduce(
      (sum, col) => sum + Math.min(col.wordCounts.row2, 10),
      0
    ),
    row3: columns.reduce(
      (sum, col) => sum + Math.min(col.wordCounts.row3, 10),
      0
    ),
  };

  // Find bottleneck (column with fewest options) for each row
  const findBottleneck = (row: "row1" | "row2" | "row3") => {
    let minCol = 0;
    let minCount = columns[0].wordCounts[row];
    for (let i = 1; i < columns.length; i++) {
      if (columns[i].wordCounts[row] < minCount) {
        minCount = columns[i].wordCounts[row];
        minCol = i;
      }
    }
    return { column: minCol, count: minCount };
  };

  const bottlenecks = {
    row1: findBottleneck("row1"),
    row2: findBottleneck("row2"),
    row3: findBottleneck("row3"),
  };

  // Recommend the row with the highest minimum (best worst-case)
  // This avoids rows where any column has 0 options
  let recommendedRow: 1 | 2 | 3 = 1;
  let bestMinimum = bottlenecks.row1.count;

  if (bottlenecks.row2.count > bestMinimum) {
    bestMinimum = bottlenecks.row2.count;
    recommendedRow = 2;
  }
  if (bottlenecks.row3.count > bestMinimum) {
    recommendedRow = 3;
  }

  return {
    seedWord: seedWord.toUpperCase(),
    cascadeWord: cascadeWord.toUpperCase(),
    columns,
    recommendedRow,
    rowScores,
    bottlenecks,
  };
}

/**
 * Quick check if a cascade+seed combo is viable (no zero-option columns)
 */
export function isComboViable(
  seedWord: string,
  cascadeWord: string
): {
  viable: boolean;
  bestRow: 1 | 2 | 3;
  issues: string[];
} {
  const viability = analyzePuzzleViability(seedWord, cascadeWord);
  const issues: string[] = [];

  // Check each row for zero-option columns
  const row1HasZero = viability.columns.some((c) => c.wordCounts.row1 === 0);
  const row2HasZero = viability.columns.some((c) => c.wordCounts.row2 === 0);
  const row3HasZero = viability.columns.some((c) => c.wordCounts.row3 === 0);

  if (row1HasZero && row2HasZero && row3HasZero) {
    // Find which columns have issues
    for (const col of viability.columns) {
      const allZero =
        col.wordCounts.row1 === 0 &&
        col.wordCounts.row2 === 0 &&
        col.wordCounts.row3 === 0;
      if (allZero) {
        issues.push(
          `Column ${col.columnIndex + 1}: No words start with "${
            col.seedLetter
          }" and have "${col.cascadeLetter}" at any position`
        );
      }
    }
    return { viable: false, bestRow: viability.recommendedRow, issues };
  }

  // Find rows with bottleneck warnings (< 3 options)
  for (const col of viability.columns) {
    const bestCount = Math.max(
      col.wordCounts.row1,
      col.wordCounts.row2,
      col.wordCounts.row3
    );
    if (bestCount < 3) {
      issues.push(
        `Column ${
          col.columnIndex + 1
        }: Limited options (max ${bestCount} words)`
      );
    }
  }

  return {
    viable: true,
    bestRow: viability.recommendedRow,
    issues,
  };
}

/**
 * Find seed words that work well with a given cascade word
 * Returns seed words sorted by viability score
 */
export function findViableSeedWords(
  cascadeWord: string,
  candidateSeedWords: string[]
): Array<{
  seedWord: string;
  score: number;
  bestRow: 1 | 2 | 3;
  viable: boolean;
}> {
  const results = candidateSeedWords
    .filter((seed) => seed.length === 5 && isValidWord(seed))
    .map((seedWord) => {
      const check = isComboViable(seedWord, cascadeWord);
      const viability = analyzePuzzleViability(seedWord, cascadeWord);

      // Score based on minimum options across best row
      const bestRowKey = `row${check.bestRow}` as "row1" | "row2" | "row3";
      const minOptions = viability.bottlenecks[bestRowKey].count;
      const totalOptions = viability.rowScores[bestRowKey];

      // Score = min * 10 + total (prioritize avoiding bottlenecks)
      const score = minOptions * 10 + totalOptions;

      return {
        seedWord: seedWord.toUpperCase(),
        score,
        bestRow: check.bestRow,
        viable: check.viable,
      };
    })
    .sort((a, b) => b.score - a.score);

  return results;
}
