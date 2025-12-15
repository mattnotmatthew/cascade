// Letter frequency analysis for CASCADE simulation

import {
  fourLetterWords,
  fiveLetterWords,
  sixLetterWords,
} from "../data/words";
import type { LetterStats } from "./types";

const VOWELS = ["A", "E", "I", "O", "U"];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Analyze letter frequencies across all word lists
export function analyzeLetterFrequencies(): LetterStats[] {
  // Combine all words, uppercase
  const allWords = [
    ...fourLetterWords,
    ...fiveLetterWords,
    ...sixLetterWords,
  ].map((w) => w.toUpperCase());

  const totalWords = allWords.length;

  const stats: LetterStats[] = ALPHABET.map((letter) => {
    // Count words containing this letter (at least once)
    const wordsWithLetter = allWords.filter((word) =>
      word.includes(letter)
    ).length;

    const frequency = wordsWithLetter / totalWords;

    // In a 5-word puzzle, expected words containing this letter
    // This is an approximation - actual depends on word selection
    const avgWordsPerPuzzle = frequency * 5;

    return {
      letter,
      frequencyInWordList: frequency,
      avgWordsPerPuzzle,
      expectedHitBonus: Math.round(avgWordsPerPuzzle * 125),
      isVowel: VOWELS.includes(letter),
    };
  });

  // Sort by frequency descending
  return stats.sort((a, b) => b.frequencyInWordList - a.frequencyInWordList);
}

// Get letters sorted by expected value (best to guess first)
export function getLettersByExpectedValue(): string[] {
  const stats = analyzeLetterFrequencies();
  return stats.map((s) => s.letter);
}

// Get vowels sorted by expected value
export function getVowelsByExpectedValue(): string[] {
  const stats = analyzeLetterFrequencies();
  return stats.filter((s) => s.isVowel).map((s) => s.letter);
}

// Get consonants sorted by expected value
export function getConsonantsByExpectedValue(): string[] {
  const stats = analyzeLetterFrequencies();
  return stats.filter((s) => !s.isVowel).map((s) => s.letter);
}

// Print frequency table for debugging/analysis
export function printLetterFrequencyTable(): void {
  const stats = analyzeLetterFrequencies();

  console.log("\n=== LETTER FREQUENCY ANALYSIS ===");
  console.log("Based on word lists: 4-letter, 5-letter, 6-letter words\n");

  console.log("VOWELS:");
  console.log("┌────────┬───────────┬────────────┬──────────────┐");
  console.log("│ Letter │ Frequency │ Avg/Puzzle │ Expected Pts │");
  console.log("├────────┼───────────┼────────────┼──────────────┤");
  stats
    .filter((s) => s.isVowel)
    .forEach((s) => {
      console.log(
        `│   ${s.letter}    │   ${(s.frequencyInWordList * 100)
          .toFixed(1)
          .padStart(5)}% │    ${s.avgWordsPerPuzzle
          .toFixed(2)
          .padStart(5)}   │     ${s.expectedHitBonus
          .toString()
          .padStart(4)} pts │`
      );
    });
  console.log("└────────┴───────────┴────────────┴──────────────┘");

  console.log("\nCONSONANTS (Top 10):");
  console.log("┌────────┬───────────┬────────────┬──────────────┐");
  console.log("│ Letter │ Frequency │ Avg/Puzzle │ Expected Pts │");
  console.log("├────────┼───────────┼────────────┼──────────────┤");
  stats
    .filter((s) => !s.isVowel)
    .slice(0, 10)
    .forEach((s) => {
      console.log(
        `│   ${s.letter}    │   ${(s.frequencyInWordList * 100)
          .toFixed(1)
          .padStart(5)}% │    ${s.avgWordsPerPuzzle
          .toFixed(2)
          .padStart(5)}   │     ${s.expectedHitBonus
          .toString()
          .padStart(4)} pts │`
      );
    });
  console.log("└────────┴───────────┴────────────┴──────────────┘");

  console.log("\nTOP 6 LETTERS TO GUESS:");
  const top6 = stats.slice(0, 6);
  console.log(top6.map((s) => s.letter).join(", "));
  console.log(
    `Expected total: ${top6.reduce(
      (sum, s) => sum + s.expectedHitBonus,
      0
    )} pts\n`
  );
}

// Calculate actual hit count for a letter in a specific puzzle
export function countLetterHits(letter: string, words: string[]): number {
  const upperLetter = letter.toUpperCase();
  return words.filter((word) => {
    // Only count letters in positions 1+ (excluding key letter at position 0)
    return word.toUpperCase().slice(1).includes(upperLetter);
  }).length;
}
