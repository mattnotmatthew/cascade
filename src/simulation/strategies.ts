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
// Guess all 7 letters, maximize letter phase points
// ============================================
export const aggressiveStrategy: Strategy = {
  name: "aggressive",
  description: "Use all 7 letter guesses, prioritize high-frequency letters",

  selectLetter(state: SimGameState): string | null {
    // Always use all 7 guesses (v3)
    if (state.lettersGuessed.length >= 7) return null;

    // Check vowel limit (v3: 3 vowels)
    const canUseVowel = state.vowelsGuessed < 3;

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
// Only guess 4 letters (v3 minimum), skip early for word multipliers
// ============================================
export const conservativeStrategy: Strategy = {
  name: "conservative",
  description: "Only 4 letter guesses (minimum), maximize word phase multipliers",

  selectLetter(state: SimGameState): string | null {
    // v3: Minimum 4 guesses before skip allowed
    if (state.lettersGuessed.length >= 4) return null;

    // Use top vowels first (v3: 3 vowels allowed)
    if (state.vowelsGuessed < 3) {
      const bestVowels = getVowelsByExpectedValue();
      for (const letter of bestVowels) {
        if (state.availableLetters.includes(letter)) {
          return letter;
        }
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
// Use 5 letters, balanced approach
// ============================================
export const moderateStrategy: Strategy = {
  name: "moderate",
  description: "Use 5 letter guesses, balanced approach",

  selectLetter(state: SimGameState): string | null {
    // Use 5 guesses (between min 4 and max 7)
    if (state.lettersGuessed.length >= 5) return null;

    const canUseVowel = state.vowelsGuessed < 3; // v3: 3 vowels
    const bestLetters = getLettersByExpectedValue();

    // First 3 guesses: prioritize vowels
    if (state.lettersGuessed.length < 3 && canUseVowel) {
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
// Use all 3 vowels first, then 2-3 consonants
// ============================================
export const vowelHeavyStrategy: Strategy = {
  name: "vowel-heavy",
  description: "Prioritize vowels (max 3), then top consonants",

  selectLetter(state: SimGameState): string | null {
    // Max 6 guesses (3 vowels + 3 consonants)
    if (state.lettersGuessed.length >= 6) return null;

    // First: use all vowel slots (v3: 3 vowels)
    if (state.vowelsGuessed < 3) {
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
    // v3: Minimum 4 guesses before can consider stopping
    if (state.lettersGuessed.length < 4) {
      // Use vowels first (v3: 3 vowels)
      if (state.vowelsGuessed < 3) {
        const bestVowels = getVowelsByExpectedValue();
        for (const letter of bestVowels) {
          if (state.availableLetters.includes(letter)) {
            return letter;
          }
        }
      }
      // Then consonants
      const bestConsonants = getConsonantsByExpectedValue();
      for (const letter of bestConsonants) {
        if (state.availableLetters.includes(letter)) {
          return letter;
        }
      }
    }

    // Max 7 guesses (v3)
    if (state.lettersGuessed.length >= 7) return null;

    // After 4 guesses, check hit rate
    // If last letter had poor hits, consider stopping
    if (state.lettersGuessed.length >= 4) {
      // If last guess had 0 hits, consider stopping
      if (state.letterHitsThisRound === 0 && state.lettersGuessed.length >= 5) {
        return null;
      }
    }

    // Continue guessing
    const canUseVowel = state.vowelsGuessed < 3; // v3: 3 vowels
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
    // Random number of guesses (4-7) - v3: min 4 required
    const targetGuesses = 4 + Math.floor(Math.random() * 4);
    if (state.lettersGuessed.length >= targetGuesses) return null;

    const canUseVowel = state.vowelsGuessed < 3; // v3: 3 vowels

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

// ============================================
// STRATEGIC SKIP STRATEGY
// Skip early ONLY when confident about words (simulates skilled vocabulary player)
// ============================================
export const strategicSkipStrategy: Strategy = {
  name: "strategic-skip",
  description: "Skip at 4-5 letters when confident (skilled vocabulary player)",

  selectLetter(state: SimGameState): string | null {
    // Use 4-5 letters, then skip if we've had good hits
    if (state.lettersGuessed.length >= 5) return null;

    // After minimum 4, skip if we've had strong hits (simulates recognizing words)
    if (state.lettersGuessed.length >= 4) {
      // Skip if we've revealed a lot (simulates "I see the pattern")
      // This models a player who recognizes they know the words
      return null;
    }

    // First 4: use top vowels and consonants
    if (state.vowelsGuessed < 3) {
      const bestVowels = getVowelsByExpectedValue();
      for (const letter of bestVowels) {
        if (state.availableLetters.includes(letter)) {
          return letter;
        }
      }
    }

    const bestConsonants = getConsonantsByExpectedValue();
    for (const letter of bestConsonants) {
      if (state.availableLetters.includes(letter)) {
        return letter;
      }
    }

    return null;
  },

  getWordGuessAccuracy(state: WordGuessState): number {
    // Strategic skipper has HIGH vocabulary skill
    // They only skip when confident, so accuracy is much higher
    if (state.isAutoCompleted) return 1.0;

    const revealRatio = state.revealedCount / state.wordLength;

    // Skilled player accuracy curve - much higher than base
    if (revealRatio >= 0.6) return 0.98; // Almost certain
    if (revealRatio >= 0.4) return 0.90; // Very confident
    if (revealRatio >= 0.2) return 0.75; // Good guess
    return 0.50; // Still decent vocabulary
  },
};

// Export all strategies
export const ALL_STRATEGIES: Strategy[] = [
  aggressiveStrategy,
  conservativeStrategy,
  moderateStrategy,
  vowelHeavyStrategy,
  adaptiveStrategy,
  strategicSkipStrategy,
  randomStrategy,
];

// Get strategy by name
export function getStrategy(name: string): Strategy | undefined {
  return ALL_STRATEGIES.find((s) => s.name === name);
}
