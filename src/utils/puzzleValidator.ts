// Puzzle validation logic for creator

import type {
  CreatorPuzzle,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SavedPuzzle,
} from "../types/creator";
import { EXPECTED_LENGTHS } from "../types/creator";
import { wordsApi } from "../services/wordsApi";
import { isValidWord } from "../data/words";

/**
 * Validate a complete puzzle before saving
 */
export async function validatePuzzle(
  puzzle: CreatorPuzzle,
  existingPuzzles: SavedPuzzle[] = []
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Basic structure validation
  if (!puzzle.seedWord || puzzle.seedWord.length !== 5) {
    errors.push({
      type: "length_mismatch",
      message: "Seed word must be exactly 5 letters",
      field: "seedWord",
    });
  }

  if (!puzzle.cascadeWord || puzzle.cascadeWord.length !== 5) {
    errors.push({
      type: "length_mismatch",
      message: "Cascade word must be exactly 5 letters",
      field: "cascadeWord",
    });
  }

  // 2. Verify column word lengths
  for (let i = 0; i < 5; i++) {
    const word = puzzle.columnWords[i];
    const expectedLength = EXPECTED_LENGTHS[i];

    if (!word) {
      errors.push({
        type: "length_mismatch",
        message: `Column ${i + 1} word is required`,
        field: `column${i}`,
      });
    } else if (word.length !== expectedLength) {
      errors.push({
        type: "length_mismatch",
        message: `Column ${i + 1} word must be ${expectedLength} letters, got ${
          word.length
        }`,
        field: `column${i}`,
      });
    }
  }

  // 3. Verify column words start with seed letters
  for (let i = 0; i < 5; i++) {
    const word = puzzle.columnWords[i];
    const seedLetter = puzzle.seedWord[i];

    if (
      word &&
      seedLetter &&
      word[0].toUpperCase() !== seedLetter.toUpperCase()
    ) {
      errors.push({
        type: "seed_mismatch",
        message: `Column ${
          i + 1
        } word "${word}" must start with "${seedLetter}"`,
        field: `column${i}`,
      });
    }
  }

  // 4. Verify cascade word alignment
  if (puzzle.cascadeWord && puzzle.columnWords.every((w) => w)) {
    const cascadeFromColumns = puzzle.columnWords
      .map((word) => word[puzzle.cascadeRow]?.toUpperCase() || "?")
      .join("");

    if (cascadeFromColumns !== puzzle.cascadeWord.toUpperCase()) {
      errors.push({
        type: "cascade_mismatch",
        message: `Cascade row ${
          puzzle.cascadeRow
        } spells "${cascadeFromColumns}", expected "${puzzle.cascadeWord.toUpperCase()}"`,
        field: "cascadeRow",
      });
    }
  }

  // 5. Validate all words exist in dictionary
  const allWords = [
    puzzle.seedWord,
    puzzle.cascadeWord,
    ...puzzle.columnWords,
  ].filter(Boolean);

  // First check against local word list
  const localInvalidWords: string[] = [];
  for (const word of allWords) {
    if (!isValidWord(word)) {
      localInvalidWords.push(word);
    }
  }

  // If we have API access, validate against API too
  if (wordsApi.isConfigured() && localInvalidWords.length > 0) {
    try {
      const apiValidation = await wordsApi.validateWords(localInvalidWords);
      for (const [word, isValid] of apiValidation) {
        if (!isValid) {
          errors.push({
            type: "invalid_word",
            message: `"${word.toUpperCase()}" is not a valid dictionary word`,
            field: word,
          });
        }
      }
    } catch (error) {
      // API error - add warning but don't fail validation
      warnings.push({
        type: "rare_word",
        message: `Could not validate words via API: ${error}. Local validation only.`,
      });

      // Fall back to just reporting local invalid words
      for (const word of localInvalidWords) {
        errors.push({
          type: "invalid_word",
          message: `"${word.toUpperCase()}" is not in the local word list`,
          field: word,
        });
      }
    }
  } else if (localInvalidWords.length > 0) {
    // No API - just use local validation
    for (const word of localInvalidWords) {
      errors.push({
        type: "invalid_word",
        message: `"${word.toUpperCase()}" is not in the local word list`,
        field: word,
      });
    }
  }

  // 6. Check for duplicate puzzles
  const isDuplicate = existingPuzzles.some(
    (existing) =>
      existing.seedWord.toUpperCase() === puzzle.seedWord.toUpperCase() &&
      existing.cascadeWord.toUpperCase() === puzzle.cascadeWord.toUpperCase()
  );

  if (isDuplicate) {
    warnings.push({
      type: "duplicate",
      message:
        "A puzzle with this seed and cascade word combination already exists",
    });
  }

  // Check for similar puzzles (same seed OR same cascade)
  const similarPuzzles = existingPuzzles.filter(
    (existing) =>
      existing.seedWord.toUpperCase() === puzzle.seedWord.toUpperCase() ||
      existing.cascadeWord.toUpperCase() === puzzle.cascadeWord.toUpperCase()
  );

  if (similarPuzzles.length > 0 && !isDuplicate) {
    warnings.push({
      type: "similar_puzzle",
      message: `Found ${similarPuzzles.length} puzzle(s) with same seed or cascade word`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick validation for individual fields (for real-time feedback)
 */
export function validateField(
  _field: "seedWord" | "cascadeWord" | "columnWord",
  value: string,
  options?: {
    expectedLength?: number;
    mustStartWith?: string;
    mustHaveLetterAt?: { letter: string; position: number };
  }
): string | null {
  if (!value) return "Required";

  const upperValue = value.toUpperCase();

  if (options?.expectedLength && upperValue.length !== options.expectedLength) {
    return `Must be ${options.expectedLength} letters`;
  }

  if (
    options?.mustStartWith &&
    upperValue[0] !== options.mustStartWith.toUpperCase()
  ) {
    return `Must start with "${options.mustStartWith}"`;
  }

  if (options?.mustHaveLetterAt) {
    const { letter, position } = options.mustHaveLetterAt;
    if (upperValue[position]?.toUpperCase() !== letter.toUpperCase()) {
      return `Must have "${letter}" at position ${position + 1}`;
    }
  }

  // Check local word list
  if (!isValidWord(value)) {
    return "Not a valid word";
  }

  return null; // Valid
}

/**
 * Generate puzzle preview data for display
 */
export function generatePuzzlePreview(puzzle: CreatorPuzzle): string[][] {
  const grid: string[][] = [];
  const maxLength = Math.max(...puzzle.columnWords.map((w) => w?.length || 0));

  for (let row = 0; row < maxLength; row++) {
    const rowData: string[] = [];
    for (let col = 0; col < 5; col++) {
      const word = puzzle.columnWords[col] || "";
      rowData.push(word[row]?.toUpperCase() || "");
    }
    grid.push(rowData);
  }

  return grid;
}
