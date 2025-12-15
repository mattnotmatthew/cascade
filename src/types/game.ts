export interface PuzzleWord {
  word: string;
  revealed: boolean[]; // Which letters have been revealed
  guessed: boolean; // Has the user attempted to guess this word
  correct: boolean; // Was their guess correct
  autoCompleted: boolean; // Was the word completed during letter guess phase
  userInput: string[]; // User's typed input for each non-revealed position
  hintsUsed: number; // Number of hints used on this word (reduces multiplier by 0.25 each)
  blanksAtWordPhase: number; // Blanks when word phase started (locked for scoring)
}

// Cascade word configuration - horizontal row or diagonal
export interface CascadeConfig {
  type: "horizontal" | "diagonal-right" | "diagonal-left";
  row: number; // Starting row for horizontal, starting row for diagonals
  word: string; // The cascade word itself
  positions: Array<{ col: number; row: number }>; // Exact positions in the grid
}

export interface Puzzle {
  keyWord: string; // The 5-letter word at the top
  words: PuzzleWord[]; // The 5 hidden words
  guessedLetters: string[]; // Letters the user has guessed
  guessedVowels: number; // Count of vowels guessed (max 2)
  maxLetterGuesses: number; // Max letter guesses allowed (6)
  maxVowels: number; // Max vowels allowed (2)
  phase: "guessing-letters" | "guessing-words" | "complete";
  score: number;
  selectedWordIndex: number | null; // Which word is selected for input during word guessing
  // Cascade/Bonus word
  cascadeWord: CascadeConfig; // The hidden cascade word
  cascadeLocked: boolean; // Is bonus word locked out (wrong letter guessed in bonus position)
  cascadeAwarded: boolean; // Has the bonus been awarded (all 6 letters correct)
  // Hints
  hintsRemaining: number; // Hints left to use (starts at 3)
  maxHints: number; // Maximum hints allowed (3)
}

export interface GameState {
  puzzle: Puzzle | null;
  isLoading: boolean;
  error: string | null;
}

// Word lengths based on position (0-indexed) - 5 columns total
// Position 0: 4 letters
// Positions 1-3: 5 letters
// Position 4: 6 letters
export function getWordLengthForPosition(position: number): number {
  if (position === 0) return 4;
  if (position < 4) return 5;
  return 6;
}
