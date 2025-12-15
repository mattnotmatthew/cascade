// Player strategies for CASCADE simulation

import type { Strategy, SimGameState, WordGuessState } from "./types";
import {
  getLettersByExpectedValue,
  getVowelsByExpectedValue,
  getConsonantsByExpectedValue,
} from "./letterAnalysis";

const VOWELS = ["A", "E", "I", "O", "U"];

// Helper to check if letter is vowel
function isVowel(letter: string): boolean {
  return VOWELS.includes(letter.toUpperCase());
}

// Helper to calculate word guess accuracy based on revealed info
function calculateBaseAccuracy(state: WordGuessState): number {
  if (state.isAutoCompleted) return 1.0; // Already complete

  const revealRatio = state.revealedCount / state.wordLength;

  // Accuracy curve based on how much is revealed
  // More revealed = easier to guess
  if (revealRatio >= 0.8) return 0.95; // Almost complete
  if (revealRatio >= 0.6) return 0.75; // Majority revealed
  if (revealRatio >= 0.4) return 0.5; // About half
  if (revealRatio >= 0.2) return 0.3; // Some hints
  return 0.15; // Mostly blind
}

// ============================================
// AGGRESSIVE STRATEGY
// Guess all 6 letters, maximize letter phase points
// ============================================
export const aggressiveStrategy: Strategy = {
  name: "aggressive",
  description: "Use all 6 letter guesses, prioritize high-frequency letters",

  selectLetter(state: SimGameState): string | null {
    // Always use all 6 guesses
    if (state.lettersGuessed.length >= 6) return null;

    // Check vowel limit
    const canUseVowel = state.vowelsGuessed < 2;

    // Get best available letters
    const bestLetters = getLettersByExpectedValue();

    for (const letter of bestLetters) {
      if (state.availableLetters.includes(letter)) {
        if (isVowel(letter) && !canUseVowel) continue;
        return letter;
      }
    }

    return null;
  },

  getWordGuessAccuracy(state: WordGuessState): number {
    // Aggressive strategy assumes skilled player
    return calculateBaseAccuracy(state) * 1.1; // 10% skill bonus
  },
};

// ============================================
// CONSERVATIVE STRATEGY
// Only guess 2 letters (minimum), skip early for word multipliers
// ============================================
export const conservativeStrategy: Strategy = {
  name: "conservative",
  description: "Only 2 letter guesses, maximize word phase multipliers",

  selectLetter(state: SimGameState): string | null {
    // Only use 2 guesses
    if (state.lettersGuessed.length >= 2) return null;

    // Use top 2 vowels (E, A typically)
    const bestVowels = getVowelsByExpectedValue();

    for (const letter of bestVowels) {
      if (state.availableLetters.includes(letter)) {
        return letter;
      }
    }

    // Fallback to consonants if vowels exhausted
    const bestConsonants = getConsonantsByExpectedValue();
    for (const letter of bestConsonants) {
      if (state.availableLetters.includes(letter)) {
        return letter;
      }
    }

    return null;
  },

  getWordGuessAccuracy(state: WordGuessState): number {
    // Conservative strategy - less info, harder to guess
    // But assumes player chose this knowing they're good at word puzzles
    return calculateBaseAccuracy(state) * 0.95;
  },
};

// ============================================
// MODERATE STRATEGY
// Use 3-4 letters, balanced approach
// ============================================
export const moderateStrategy: Strategy = {
  name: "moderate",
  description: "Use 3-4 letter guesses, balanced approach",

  selectLetter(state: SimGameState): string | null {
    // Use 3-4 guesses (stop at 4)
    if (state.lettersGuessed.length >= 4) return null;

    const canUseVowel = state.vowelsGuessed < 2;
    const bestLetters = getLettersByExpectedValue();

    // First 2 guesses: prioritize vowels
    if (state.lettersGuessed.length < 2 && canUseVowel) {
      const bestVowels = getVowelsByExpectedValue();
      for (const letter of bestVowels) {
        if (state.availableLetters.includes(letter)) {
          return letter;
        }
      }
    }

    // Remaining guesses: best available
    for (const letter of bestLetters) {
      if (state.availableLetters.includes(letter)) {
        if (isVowel(letter) && !canUseVowel) continue;
        return letter;
      }
    }

    return null;
  },

  getWordGuessAccuracy(state: WordGuessState): number {
    return calculateBaseAccuracy(state);
  },
};

// ============================================
// VOWEL-HEAVY STRATEGY
// Use both vowels first, then 2-3 consonants
// ============================================
export const vowelHeavyStrategy: Strategy = {
  name: "vowel-heavy",
  description: "Prioritize vowels (max 2), then top consonants",

  selectLetter(state: SimGameState): string | null {
    // Max 5 guesses
    if (state.lettersGuessed.length >= 5) return null;

    // First: use both vowel slots
    if (state.vowelsGuessed < 2) {
      const bestVowels = getVowelsByExpectedValue();
      for (const letter of bestVowels) {
        if (state.availableLetters.includes(letter)) {
          return letter;
        }
      }
    }

    // Then: top consonants
    const bestConsonants = getConsonantsByExpectedValue();
    for (const letter of bestConsonants) {
      if (state.availableLetters.includes(letter)) {
        return letter;
      }
    }

    return null;
  },

  getWordGuessAccuracy(state: WordGuessState): number {
    // Vowels help a lot with word recognition
    return calculateBaseAccuracy(state) * 1.05;
  },
};

// ============================================
// ADAPTIVE STRATEGY
// Stop when hit rate drops below threshold
// ============================================
export const adaptiveStrategy: Strategy = {
  name: "adaptive",
  description: "Stop guessing when hit rate drops (smart stopping)",

  selectLetter(state: SimGameState): string | null {
    // Minimum 2 guesses
    if (state.lettersGuessed.length < 2) {
      const bestVowels = getVowelsByExpectedValue();
      for (const letter of bestVowels) {
        if (state.availableLetters.includes(letter)) {
          return letter;
        }
      }
    }

    // Max 6 guesses
    if (state.lettersGuessed.length >= 6) return null;

    // After 2 guesses, check hit rate
    // If last letter had poor hits, consider stopping
    if (state.lettersGuessed.length >= 2) {
      const avgHitsPerLetter =
        state.currentScore / 125 / state.lettersGuessed.length;

      // If hitting less than 2 words per letter on average, stop
      if (avgHitsPerLetter < 2 && state.lettersGuessed.length >= 3) {
        return null;
      }

      // If last guess had 0-1 hits, stop
      if (state.letterHitsThisRound <= 1 && state.lettersGuessed.length >= 3) {
        return null;
      }
    }

    // Continue guessing
    const canUseVowel = state.vowelsGuessed < 2;
    const bestLetters = getLettersByExpectedValue();

    for (const letter of bestLetters) {
      if (state.availableLetters.includes(letter)) {
        if (isVowel(letter) && !canUseVowel) continue;
        return letter;
      }
    }

    return null;
  },

  getWordGuessAccuracy(state: WordGuessState): number {
    // Adaptive players are generally skilled
    return calculateBaseAccuracy(state) * 1.05;
  },
};

// ============================================
// RANDOM STRATEGY (Control/Baseline)
// Random letter selection, random stopping
// ============================================
export const randomStrategy: Strategy = {
  name: "random",
  description: "Random letter selection and stopping (baseline)",

  selectLetter(state: SimGameState): string | null {
    // Random number of guesses (2-6)
    const targetGuesses = 2 + Math.floor(Math.random() * 5);
    if (state.lettersGuessed.length >= targetGuesses) return null;

    const canUseVowel = state.vowelsGuessed < 2;

    // Filter available letters
    const validLetters = state.availableLetters.filter(
      (l) => !isVowel(l) || canUseVowel
    );

    if (validLetters.length === 0) return null;

    // Random selection
    return validLetters[Math.floor(Math.random() * validLetters.length)];
  },

  getWordGuessAccuracy(state: WordGuessState): number {
    // Random/unskilled player
    return calculateBaseAccuracy(state) * 0.85;
  },
};

// Export all strategies
export const ALL_STRATEGIES: Strategy[] = [
  aggressiveStrategy,
  conservativeStrategy,
  moderateStrategy,
  vowelHeavyStrategy,
  adaptiveStrategy,
  randomStrategy,
];

// Get strategy by name
export function getStrategy(name: string): Strategy | undefined {
  return ALL_STRATEGIES.find((s) => s.name === name);
}
