// Simulation-specific types for CASCADE game balance analysis

import type { Puzzle } from "../types/game";

// Strategy interface - defines how a simulated player behaves
export interface Strategy {
  name: string;
  description: string;
  // Returns letter to guess, or null to skip to word phase
  selectLetter: (state: SimGameState) => string | null;
  // Returns probability of correctly guessing a word given its state
  getWordGuessAccuracy: (wordState: WordGuessState) => number;
}

// State passed to strategy for decision making
export interface SimGameState {
  puzzle: Puzzle;
  availableLetters: string[]; // Letters not yet guessed
  availableVowels: string[]; // Vowels not yet guessed
  lettersGuessed: string[];
  vowelsGuessed: number;
  currentScore: number;
  letterHitsThisRound: number; // Hits from most recent letter guess
}

// State of a word for guessing accuracy calculation
export interface WordGuessState {
  wordLength: number;
  revealedCount: number;
  blanksCount: number;
  position: number; // 0-4
  isAutoCompleted: boolean;
}

// Configuration for a simulation run
export interface SimulationConfig {
  iterations: number;
  strategy: Strategy;
  verboseLogging: boolean;
  // Optional overrides for testing different scoring params
  scoringOverrides?: Partial<ScoringConfig>;
}

// Scoring configuration v3 (mirrors gameLogic.ts)
export interface ScoringConfig {
  // Letter phase
  streakBonuses: number[]; // Bonus per streak length [0, 10, 20, 35, 50, 60, 70]
  maxLetterGuesses: number; // 7
  maxVowels: number; // 3
  minLettersBeforeSkip: number; // 4 - minimum letters before skip allowed

  // Word phase
  blankMultiplier: number; // Each blank adds this to the multiplier (0.4)
  maxBlankMultiplier: number; // Cap on blank multiplier (2.5)
  autoCompleteMultiplier: number; // Multiplier for auto-completed words (2.0)
  autoCompleteBonus: number; // Flat bonus for auto-completed words (50)
  wrongGuessPenalty: number; // Points deducted for wrong word guesses (25)
  hintPenalties: number[]; // Escalating: [0, 0.35, 0.50] - first hint free

  // Cascade
  cascadeFlatBonus: number; // Flat bonus for cascade (500)

  // Word base scores
  wordScoring: Array<{ baseScore: number }>;
}

// Results from a single simulated game
export interface GameResult {
  totalScore: number;
  letterPhaseScore: number;
  wordPhaseScore: number;
  cascadeBonus: number;
  lettersGuessed: number;
  letterHits: number;
  vowelsUsed: number;
  wordsCorrect: number;
  wordsWrong: number; // v3: track wrong guesses
  wordsAutoCompleted: number;
  blanksAtWordPhase: number; // Total unrevealed letters when entering word phase
  cascadeEarned: boolean;
}

// Aggregated results from multiple simulations
export interface SimulationResults {
  strategyName: string;
  iterations: number;

  // Averages
  avgTotalScore: number;
  avgLetterPhaseScore: number;
  avgWordPhaseScore: number;
  avgCascadeBonus: number;
  avgLettersGuessed: number;
  avgLetterHitRate: number; // hits per letter guessed
  avgWordsCorrect: number;
  avgWordsAutoCompleted: number;
  avgBlanksAtWordPhase: number;
  cascadeEarnedRate: number; // % of games where cascade was earned

  // Variance
  scoreStdDev: number;
  minScore: number;
  maxScore: number;

  // Distribution
  scorePercentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };

  // Raw data for further analysis
  allResults: GameResult[];
}

// Letter frequency statistics
export interface LetterStats {
  letter: string;
  frequencyInWordList: number; // % of words containing this letter
  avgWordsPerPuzzle: number; // Expected words containing letter in a puzzle
  expectedHitBonus: number; // avgWordsPerPuzzle × letterHitBonus
  isVowel: boolean;
}

// Comparison report across strategies
export interface StrategyComparison {
  strategies: SimulationResults[];
  insights: string[];
  recommendedConfig?: Partial<ScoringConfig>;
}
