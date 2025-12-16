// Core simulation engine for CASCADE game balance analysis

import type {
  Strategy,
  SimGameState,
  WordGuessState,
  SimulationConfig,
  GameResult,
  ScoringConfig,
} from "./types";
import { generatePuzzle, isVowel } from "../utils/gameLogic";
import type { PuzzleWord } from "../types/game";

// Default scoring config v2 (matches current implementation)
const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  // Letter phase - streak bonuses
  streakBonuses: [0, 0, 15, 25, 40, 50, 50], // Index = streak length
  maxLetterGuesses: 6,
  maxVowels: 2,

  // Word phase
  blankMultiplier: 0.75, // Each blank adds 0.75 to multiplier
  autoCompleteBonus: 75, // Extra points when word is auto-completed
  hintPenalties: [0, 0.35, 0.5], // First hint free, then escalating

  // Cascade - now percentage amplifier instead of flat bonus
  cascadeAmplifier: 0.25, // 25% of total word score

  // Word base scores
  wordScoring: [
    { baseScore: 100 }, // Position 0: 4 letters
    { baseScore: 150 }, // Position 1: 5 letters
    { baseScore: 150 }, // Position 2: 5 letters
    { baseScore: 150 }, // Position 3: 5 letters
    { baseScore: 200 }, // Position 4: 6 letters
  ],
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Get streak bonus for a given streak length
function getStreakBonus(streakLength: number, config: ScoringConfig): number {
  if (streakLength < 0) return 0;
  if (streakLength >= config.streakBonuses.length) {
    return config.streakBonuses[config.streakBonuses.length - 1];
  }
  return config.streakBonuses[streakLength];
}

// Calculate word score: base × (1 + blankMultiplier × blanks)
// Auto-complete: base + autoCompleteBonus
function calculateWordScore(
  position: number,
  blanks: number,
  config: ScoringConfig,
  isAutoComplete: boolean = false
): number {
  const wordConfig = config.wordScoring[position];
  if (isAutoComplete) {
    return wordConfig.baseScore + config.autoCompleteBonus;
  }
  if (blanks === 0) {
    return wordConfig.baseScore;
  }
  const multiplier = 1 + config.blankMultiplier * blanks;
  return Math.round(wordConfig.baseScore * multiplier);
}

// Check if letter appears in any word (excluding position 0)
function isLetterHit(letter: string, words: PuzzleWord[]): boolean {
  return words.some((w) => w.word.slice(1).includes(letter));
}

// Count how many words contain a letter (excluding position 0)
function countLetterHits(letter: string, words: PuzzleWord[]): number {
  return words.filter((w) => w.word.slice(1).includes(letter)).length;
}

// Simulate a single game with a given strategy
export function simulateGame(
  strategy: Strategy,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  verbose: boolean = false
): GameResult {
  // Generate a fresh puzzle
  const puzzle = generatePuzzle();
  if (!puzzle) {
    throw new Error("Failed to generate puzzle");
  }

  // Track state
  let letterPhaseScore = 0;
  let wordPhaseScore = 0;
  let cascadeBonus = 0;
  const lettersGuessed: string[] = [];
  let vowelsUsed = 0;
  let totalHits = 0;
  let currentStreak = 0;
  let lastHits = 0; // Hits from the previous letter guess

  // Track revealed letters per word (copy of initial state)
  const revealed: boolean[][] = puzzle.words.map((w) => [...w.revealed]);

  // Available letters for guessing
  let availableLetters = [...ALPHABET];
  let availableVowels = ["A", "E", "I", "O", "U"];

  if (verbose) {
    console.log(`\n--- Simulating game with ${strategy.name} strategy ---`);
    console.log(`Words: ${puzzle.words.map((w) => w.word).join(", ")}`);
    console.log(`Cascade word: ${puzzle.cascadeWord.word}`);
  }

  // === LETTER GUESSING PHASE ===
  while (lettersGuessed.length < config.maxLetterGuesses) {
    // Build state for strategy
    const state: SimGameState = {
      puzzle,
      availableLetters,
      availableVowels,
      lettersGuessed,
      vowelsGuessed: vowelsUsed,
      currentScore: letterPhaseScore,
      letterHitsThisRound: lastHits,
    };

    // Ask strategy for next letter
    const nextLetter = strategy.selectLetter(state);

    if (nextLetter === null) {
      if (verbose) console.log(`Strategy chose to skip to word phase`);
      break;
    }

    // Validate letter choice
    if (!availableLetters.includes(nextLetter)) {
      console.warn(`Invalid letter choice: ${nextLetter}`);
      continue;
    }

    if (isVowel(nextLetter) && vowelsUsed >= config.maxVowels) {
      console.warn(`Vowel limit exceeded: ${nextLetter}`);
      continue;
    }

    // Process the guess
    lettersGuessed.push(nextLetter);
    availableLetters = availableLetters.filter((l) => l !== nextLetter);

    if (isVowel(nextLetter)) {
      vowelsUsed++;
      availableVowels = availableVowels.filter((l) => l !== nextLetter);
    }

    // Check if letter is a hit and calculate streak bonus
    const isHit = isLetterHit(nextLetter, puzzle.words);
    const hits = countLetterHits(nextLetter, puzzle.words);
    totalHits += hits;
    lastHits = hits; // Track for next iteration's state

    let streakBonus = 0;
    if (isHit) {
      currentStreak++;
      streakBonus = getStreakBonus(currentStreak, config);
    } else {
      currentStreak = 0;
    }
    letterPhaseScore += streakBonus;

    // Reveal the letter in all words
    puzzle.words.forEach((word, wordIndex) => {
      for (let i = 0; i < word.word.length; i++) {
        if (word.word[i] === nextLetter) {
          revealed[wordIndex][i] = true;
        }
      }
    });

    if (verbose) {
      console.log(
        `Guessed '${nextLetter}': ${isHit ? "HIT" : "MISS"} (streak: ${currentStreak}), +${streakBonus} pts (total: ${letterPhaseScore})`
      );
    }
  }

  // === CALCULATE BLANKS AT WORD PHASE ===
  let totalBlanks = 0;
  const wordsAutoCompleted: number[] = [];

  puzzle.words.forEach((word, index) => {
    const wordRevealed = revealed[index];
    const blanks = wordRevealed.filter((r) => !r).length;
    totalBlanks += blanks;

    // Check for auto-complete (all revealed)
    if (blanks === 0) {
      wordsAutoCompleted.push(index);
    }
  });

  if (verbose) {
    console.log(
      `Letter phase complete: ${lettersGuessed.length} letters, ${letterPhaseScore} pts, ${totalBlanks} blanks remaining`
    );
    console.log(`Auto-completed words: ${wordsAutoCompleted.length}`);
  }

  // === WORD GUESSING PHASE ===
  let wordsCorrect = 0;
  const cascadeRowCorrect: boolean[] = [];

  puzzle.words.forEach((puzzleWord, index) => {
    const wordRevealed = revealed[index];
    const revealedCount = wordRevealed.filter((r) => r).length;
    const blanks = puzzleWord.word.length - revealedCount;
    const isAuto = wordsAutoCompleted.includes(index);

    // Build word state for accuracy calculation
    const wordState: WordGuessState = {
      wordLength: puzzleWord.word.length,
      revealedCount,
      blanksCount: blanks,
      position: index,
      isAutoCompleted: isAuto,
    };

    // Get accuracy from strategy
    const accuracy = strategy.getWordGuessAccuracy(wordState);

    // Simulate guess (random based on accuracy)
    const isCorrect = isAuto || Math.random() < accuracy;

    if (isCorrect) {
      wordsCorrect++;
      const wordScore = calculateWordScore(index, blanks, config, isAuto);
      wordPhaseScore += wordScore;

      if (verbose) {
        console.log(
          `Word ${index + 1} (${puzzleWord.word}): CORRECT${
            isAuto ? " (auto)" : ""
          }, ${blanks} blanks, +${wordScore} pts`
        );
      }

      // Track cascade row letter correctness
      const cascadePos = puzzle.cascadeWord.positions.find(
        (p) => p.col === index
      );
      if (cascadePos) {
        cascadeRowCorrect.push(true);
      }
    } else {
      if (verbose) {
        console.log(
          `Word ${index + 1} (${puzzleWord.word}): INCORRECT (accuracy: ${(
            accuracy * 100
          ).toFixed(0)}%)`
        );
      }

      // Track cascade row letter incorrectness
      const cascadePos = puzzle.cascadeWord.positions.find(
        (p) => p.col === index
      );
      if (cascadePos) {
        cascadeRowCorrect.push(false);
      }
    }
  });

  // === CASCADE AMPLIFIER ===
  const cascadeEarned =
    cascadeRowCorrect.length === 5 && cascadeRowCorrect.every((c) => c);
  if (cascadeEarned) {
    // v2: Cascade is percentage of word phase score
    cascadeBonus = Math.round(wordPhaseScore * config.cascadeAmplifier);
    if (verbose) {
      console.log(`CASCADE AMPLIFIER: +${cascadeBonus} pts (${config.cascadeAmplifier * 100}% of word score)!`);
    }
  }

  const totalScore = letterPhaseScore + wordPhaseScore + cascadeBonus;

  if (verbose) {
    console.log(`\nFINAL SCORE: ${totalScore}`);
    console.log(
      `  Letter phase: ${letterPhaseScore}, Word phase: ${wordPhaseScore}, Cascade: ${cascadeBonus}`
    );
  }

  return {
    totalScore,
    letterPhaseScore,
    wordPhaseScore,
    cascadeBonus,
    lettersGuessed: lettersGuessed.length,
    letterHits: totalHits,
    vowelsUsed,
    wordsCorrect,
    wordsAutoCompleted: wordsAutoCompleted.length,
    blanksAtWordPhase: totalBlanks,
    cascadeEarned,
  };
}

// Run multiple simulations and aggregate results
export function runSimulation(
  config: SimulationConfig
): import("./types").SimulationResults {
  const results: GameResult[] = [];
  const scoringConfig = {
    ...DEFAULT_SCORING_CONFIG,
    ...config.scoringOverrides,
  };

  console.log(
    `\nRunning ${config.iterations} simulations with '${config.strategy.name}' strategy...`
  );

  for (let i = 0; i < config.iterations; i++) {
    const result = simulateGame(
      config.strategy,
      scoringConfig,
      config.verboseLogging && i < 3 // Only verbose for first 3
    );
    results.push(result);

    // Progress indicator
    if ((i + 1) % 1000 === 0) {
      console.log(`  Completed ${i + 1}/${config.iterations}`);
    }
  }

  // Calculate aggregated statistics
  const totalScores = results.map((r) => r.totalScore);
  const avgTotalScore = average(totalScores);
  const scoreStdDev = standardDeviation(totalScores);

  return {
    strategyName: config.strategy.name,
    iterations: config.iterations,

    avgTotalScore,
    avgLetterPhaseScore: average(results.map((r) => r.letterPhaseScore)),
    avgWordPhaseScore: average(results.map((r) => r.wordPhaseScore)),
    avgCascadeBonus: average(results.map((r) => r.cascadeBonus)),
    avgLettersGuessed: average(results.map((r) => r.lettersGuessed)),
    avgLetterHitRate:
      average(results.map((r) => r.letterHits)) /
      Math.max(1, average(results.map((r) => r.lettersGuessed))),
    avgWordsCorrect: average(results.map((r) => r.wordsCorrect)),
    avgWordsAutoCompleted: average(results.map((r) => r.wordsAutoCompleted)),
    avgBlanksAtWordPhase: average(results.map((r) => r.blanksAtWordPhase)),
    cascadeEarnedRate:
      results.filter((r) => r.cascadeEarned).length / results.length,

    scoreStdDev,
    minScore: Math.min(...totalScores),
    maxScore: Math.max(...totalScores),

    scorePercentiles: {
      p10: percentile(totalScores, 10),
      p25: percentile(totalScores, 25),
      p50: percentile(totalScores, 50),
      p75: percentile(totalScores, 75),
      p90: percentile(totalScores, 90),
    },

    allResults: results,
  };
}

// Helper: calculate average
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Helper: calculate standard deviation
function standardDeviation(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = average(arr);
  const squareDiffs = arr.map((value) => Math.pow(value - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

// Helper: calculate percentile
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
