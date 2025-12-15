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

// Scoring configuration (mirrors gameLogic.ts)
export interface ScoringConfig {
  letterHitBonus: number;
  blankMultiplier: number; // Each blank adds this to the multiplier (e.g., 0.5)
  autoCompleteBonus: number; // Extra points when word is auto-completed
  maxLetterGuesses: number;
  maxVowels: number;
  cascadeBonus: number;
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
