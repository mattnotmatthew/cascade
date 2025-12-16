// Types for Puzzle Creator

export interface CreatorPuzzle {
  seedWord: string;
  cascadeWord: string;
  cascadeRow: 1 | 2 | 3;
  columnWords: string[]; // [4-letter, 5, 5, 5, 6-letter]
}

export interface SavedPuzzle extends CreatorPuzzle {
  date: string; // YYYY-MM-DD format
  createdAt: string; // ISO timestamp
  metadata?: {
    theme?: string;
    difficulty?: "easy" | "medium" | "hard";
    notes?: string;
  };
}

export interface PuzzleCreatorState {
  // Navigation
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;

  // Step 1: Cascade word
  theme: string;
  cascadeWord: string;
  cascadeWordSuggestions: string[];
  cascadeWordLoading: boolean;

  // Step 2: Seed word
  seedWord: string;
  seedWordSuggestions: string[];
  seedWordLoading: boolean;

  // Step 3: Cascade row
  cascadeRow: 1 | 2 | 3;

  // Step 4: Column words
  columnWords: [string, string, string, string, string];
  columnSuggestions: [string[], string[], string[], string[], string[]];
  columnLoading: [boolean, boolean, boolean, boolean, boolean];

  // Step 5: Validation
  validationResult: ValidationResult | null;
  isValidating: boolean;

  // Step 6: Save
  puzzleDate: string;
  isSaving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type:
    | "invalid_word"
    | "cascade_mismatch"
    | "seed_mismatch"
    | "length_mismatch"
    | "api_error";
  message: string;
  field?: string;
}

export interface ValidationWarning {
  type: "duplicate" | "rare_word" | "similar_puzzle";
  message: string;
}

// Column configuration
export const COLUMN_CONFIG = [
  { index: 0, length: 4, label: "Column 1" },
  { index: 1, length: 5, label: "Column 2" },
  { index: 2, length: 5, label: "Column 3" },
  { index: 3, length: 5, label: "Column 4" },
  { index: 4, length: 6, label: "Column 5" },
] as const;

export const EXPECTED_LENGTHS = [4, 5, 5, 5, 6] as const;

// ==========================================
// Bulk Puzzle Creator Types
// ==========================================

export type ReviewMode = "full" | "quick" | "auto";

export interface BulkBatchConfig {
  startDate: string; // YYYY-MM-DD
  numberOfDays: number; // 1-31
  reviewMode: ReviewMode;
}

export interface BulkPuzzleEntry {
  date: string; // YYYY-MM-DD
  cascadeWord: string;
  seedWord: string;
  cascadeRow: 1 | 2 | 3;
  columnWords: string[];
  columnOptions: string[][]; // All options per column for swapping
  status: "pending" | "generating" | "generated" | "reviewed" | "error";
  errorMessage?: string;
  theme?: string;
}

export interface BulkBatch {
  id: string;
  config: BulkBatchConfig;
  puzzles: BulkPuzzleEntry[];
  currentPuzzleIndex: number; // For full review navigation
  createdAt: string;
  lastModified: string;
}

export interface ThemePair {
  cascadeWord: string;
  seedWord: string;
  description?: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  icon: string;
  pairs: ThemePair[];
}

// Helper to create initial state
export function createInitialCreatorState(): PuzzleCreatorState {
  return {
    currentStep: 1,
    theme: "",
    cascadeWord: "",
    cascadeWordSuggestions: [],
    cascadeWordLoading: false,
    seedWord: "",
    seedWordSuggestions: [],
    seedWordLoading: false,
    cascadeRow: 2,
    columnWords: ["", "", "", "", ""],
    columnSuggestions: [[], [], [], [], []],
    columnLoading: [false, false, false, false, false],
    validationResult: null,
    isValidating: false,
    puzzleDate: new Date().toISOString().split("T")[0],
    isSaving: false,
    saveError: null,
    saveSuccess: false,
  };
}
