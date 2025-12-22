import type { Puzzle, PuzzleWord, CascadeConfig } from "../types/game";
import { getWordLengthForPosition } from "../types/game";
import {
  getRandomKeyWord,
  getRandomWord,
  cascadeWords,
  getWordsWithLetterAt,
} from "../data/words";

const VOWELS = ["A", "E", "I", "O", "U"];

// =============================================================================
// SCORING CONFIGURATION v3 - Rebalanced
// =============================================================================

// Base scores by position (5 columns)
const SCORING_CONFIG = [
  { baseScore: 100 }, // Position 0: 4 letters
  { baseScore: 150 }, // Position 1: 5 letters
  { baseScore: 150 }, // Position 2: 5 letters
  { baseScore: 150 }, // Position 3: 5 letters
  { baseScore: 200 }, // Position 4: 6 letters
];

// Letter Hit Streak Bonuses - reward skilled letter selection from the start
const STREAK_BONUSES = [0, 10, 20, 35, 50, 60, 70]; // Index = streak length, value = bonus
// streak 1: +10 pts (good choice recognized)
// streak 2: +20 pts (reading the board)
// streak 3: +35 pts (good pattern recognition)
// streak 4: +50 pts (skilled play)
// streak 5+: +60-70 pts (mastery)

function getStreakBonus(streakLength: number): number {
  if (streakLength < 0) return 0;
  if (streakLength >= STREAK_BONUSES.length) {
    return STREAK_BONUSES[STREAK_BONUSES.length - 1]; // Cap at max
  }
  return STREAK_BONUSES[streakLength];
}

// Blank multiplier - each blank adds this to the multiplier
// Formula: base × min(MAX_MULTIPLIER, 1 + BLANK_MULTIPLIER × blanks)
const BLANK_MULTIPLIER = 0.4; // Reduced from 0.75 to prevent "skip immediately" strategy
const MAX_BLANK_MULTIPLIER = 2.5; // Cap to ensure letter phase stays valuable

// Auto-complete - rewards skilled letter selection that reveals entire words
const AUTO_COMPLETE_MULTIPLIER = 2.0; // Guaranteed good multiplier
const AUTO_COMPLETE_BONUS = 50; // Plus flat bonus

// Wrong guess penalty - adds stakes to word guessing phase
const WRONG_GUESS_PENALTY = 25;

// Minimum letter guesses before skip is allowed
const MIN_LETTERS_BEFORE_SKIP = 4;

// Escalating Hint Penalties
// First hint is FREE, subsequent hints have escalating costs
const HINT_PENALTIES = [0, 0.35, 0.50]; // Index = hint number (0-indexed), value = penalty

function getHintPenalty(hintNumber: number): number {
  if (hintNumber < 0) return 0;
  if (hintNumber >= HINT_PENALTIES.length) {
    return HINT_PENALTIES[HINT_PENALTIES.length - 1]; // Cap at max penalty
  }
  return HINT_PENALTIES[hintNumber];
}

// Calculate total hint penalty for a word based on how many hints used
function calculateTotalHintPenalty(hintsUsed: number, hintsUsedBefore: number): number {
  let totalPenalty = 0;
  for (let i = 0; i < hintsUsed; i++) {
    // The hint number in the game is hintsUsedBefore + i
    totalPenalty += getHintPenalty(hintsUsedBefore + i);
  }
  return totalPenalty;
}

// Cascade Bonus - flat bonus for completing the cascade word (more visible/exciting)
const CASCADE_FLAT_BONUS = 500;

export function isVowel(letter: string): boolean {
  return VOWELS.includes(letter.toUpperCase());
}

// Helper to get a random item from an array
function randomItem<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Shuffle an array in place
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Find words that start with keyLetter AND have cascadeLetter at cascadeRow
function findMatchingWords(
  keyLetter: string,
  cascadeLetter: string,
  cascadeRow: number,
  wordLength: number
): string[] {
  // Get all words of the right length that have cascadeLetter at cascadeRow
  const candidates = getWordsWithLetterAt(
    cascadeLetter,
    cascadeRow,
    wordLength
  );
  // Filter to only those starting with keyLetter
  return candidates.filter(
    (w) => w[0].toUpperCase() === keyLetter.toUpperCase()
  );
}

export function generatePuzzle(): Puzzle {
  // APPROACH: Pick BOTH key word and cascade word, then find column words that satisfy both

  const possibleRows = [1, 2, 3];
  let bestCascadeRow = 1;
  let bestWords: PuzzleWord[] = [];
  let bestKeyWord = "";
  let cascadeWordStr = "";
  let foundValidPuzzle = false;

  // Shuffle key words and cascade words
  const shuffledKeyWords = shuffle(
    [...cascadeWords].filter((w) => w && w.length === 5)
  ); // Use 5-letter words as key words too
  const shuffledCascadeWords = shuffle(
    [...cascadeWords].filter((w) => w && w.length === 5)
  );

  // Try combinations of key word + cascade word + row
  outer: for (const keyWord of shuffledKeyWords) {
    if (foundValidPuzzle) break;
    if (!keyWord || keyWord.length < 5) continue;
    const keyWordUpper = keyWord.toUpperCase();

    for (const targetCascade of shuffledCascadeWords) {
      if (foundValidPuzzle) break;
      if (!targetCascade || targetCascade.length < 5) continue;
      const targetCascadeUpper = targetCascade.toUpperCase();

      for (const cascadeRow of shuffle([...possibleRows])) {
        // For each column, find words that:
        // 1. Start with the key letter (from keyWord)
        // 2. Have the cascade letter at cascadeRow position

        const columnWords: PuzzleWord[] = [];
        let allColumnsValid = true;

        for (let col = 0; col < 5; col++) {
          const keyLetter = keyWordUpper[col];
          const cascadeLetter = targetCascadeUpper[col];

          // Defensive check
          if (!keyLetter || !cascadeLetter) {
            allColumnsValid = false;
            break;
          }

          const wordLength = getWordLengthForPosition(col);

          // Skip if cascade row is beyond this word's length
          if (cascadeRow >= wordLength) {
            allColumnsValid = false;
            break;
          }

          // Find words that match BOTH constraints
          const candidates = findMatchingWords(
            keyLetter,
            cascadeLetter,
            cascadeRow,
            wordLength
          );

          if (candidates.length === 0) {
            allColumnsValid = false;
            break;
          }

          // Pick a random candidate
          const chosenWord = randomItem(candidates)!.toUpperCase();

          const revealed = new Array(wordLength).fill(false);
          revealed[0] = true; // First letter (key letter) is always revealed

          columnWords.push({
            word: chosenWord,
            revealed,
            guessed: false,
            correct: false,
            autoCompleted: false,
            userInput: new Array(wordLength).fill(""),
            hintsUsed: 0,
            blanksAtWordPhase: 0, // Will be set when entering word phase
          });
        }

        if (allColumnsValid && columnWords.length === 5) {
          // Success! We found a valid combination
          bestKeyWord = keyWordUpper;
          bestCascadeRow = cascadeRow;
          bestWords = columnWords;
          cascadeWordStr = targetCascadeUpper;
          foundValidPuzzle = true;
          break outer;
        }
      }
    }
  }

  // Fallback if no valid puzzle found (shouldn't happen with good word lists)
  if (!foundValidPuzzle) {
    console.warn("Could not find valid cascade puzzle, using fallback");
    const keyWord = getRandomKeyWord().toUpperCase();
    bestKeyWord = keyWord;
    bestCascadeRow = 1;
    bestWords = [];

    for (let i = 0; i < 5; i++) {
      const keyLetter = keyWord[i];
      const length = getWordLengthForPosition(i);
      let word =
        getRandomWord(keyLetter, length) || keyLetter + "x".repeat(length - 1);
      word = word.toUpperCase();

      const revealed = new Array(length).fill(false);
      revealed[0] = true;

      bestWords.push({
        word,
        revealed,
        guessed: false,
        correct: false,
        autoCompleted: false,
        userInput: new Array(length).fill(""),
        hintsUsed: 0,
        blanksAtWordPhase: 0, // Will be set when entering word phase
      });
    }
    cascadeWordStr = bestWords
      .map((w) => w.word[bestCascadeRow] || "X")
      .join("");
  }

  // Build cascade config
  const positions = [];
  for (let col = 0; col < 5; col++) {
    positions.push({ col, row: bestCascadeRow });
  }

  const cascadeWord: CascadeConfig = {
    type: "horizontal",
    row: bestCascadeRow,
    word: cascadeWordStr,
    positions,
  };

  return {
    keyWord: bestKeyWord,
    words: bestWords,
    guessedLetters: [],
    guessedVowels: 0,
    maxLetterGuesses: 7, // Increased from 6 to allow more strategic play
    maxVowels: 3, // Increased from 2 to allow strategic vowel use
    phase: "guessing-letters",
    score: 0,
    selectedWordIndex: null,
    cascadeWord,
    cascadeLocked: false,
    cascadeAwarded: false,
    hintsRemaining: 3,
    maxHints: 3,
    // v3 scoring fields
    currentStreak: 0,
    streakBonusEarned: 0,
    hintsUsedTotal: 0,
  };
}

// Calculate word score with v3 rebalanced scoring
function calculateWordScore(
  wordIndex: number,
  blanksAtWordPhase: number,
  hintsUsed: number = 0,
  hintsUsedBefore: number = 0, // How many hints were used before this word
  isAutoComplete: boolean = false
): number {
  const config = SCORING_CONFIG[wordIndex];

  // Auto-complete: guaranteed good score for skilled letter play
  if (isAutoComplete) {
    return Math.round(config.baseScore * AUTO_COMPLETE_MULTIPLIER) + AUTO_COMPLETE_BONUS;
  }

  // 0 blanks: just base score (hints don't apply since no multiplier to reduce)
  if (blanksAtWordPhase === 0) {
    return config.baseScore;
  }

  // Calculate escalating hint penalty
  const totalHintPenalty = calculateTotalHintPenalty(hintsUsed, hintsUsedBefore);

  // Formula: base × min(MAX_MULTIPLIER, 1 + 0.4 × blanks) - hint penalties
  const rawMultiplier = 1 + BLANK_MULTIPLIER * blanksAtWordPhase;
  const cappedMultiplier = Math.min(rawMultiplier, MAX_BLANK_MULTIPLIER);
  const finalMultiplier = Math.max(0.1, cappedMultiplier - totalHintPenalty);
  return Math.round(config.baseScore * finalMultiplier);
}

function checkAndAutoComplete(
  words: PuzzleWord[],
  currentScore: number
): { words: PuzzleWord[]; score: number } {
  let score = currentScore;
  const newWords = words.map((puzzleWord, index) => {
    // Skip if already guessed/completed
    if (puzzleWord.guessed || puzzleWord.autoCompleted) {
      return puzzleWord;
    }

    // Check if all letters are revealed
    const allRevealed = puzzleWord.revealed.every((r) => r);
    if (allRevealed) {
      // Auto-complete! Score with 0 blanks + auto-complete bonus
      // Args: wordIndex, blanksAtWordPhase, hintsUsed, hintsUsedBefore, isAutoComplete
      const wordScore = calculateWordScore(index, 0, 0, 0, true);
      score += wordScore;

      return {
        ...puzzleWord,
        autoCompleted: true,
        guessed: true,
        correct: true,
      };
    }
    return puzzleWord;
  });

  return { words: newWords, score };
}

export function guessLetter(puzzle: Puzzle, letter: string): Puzzle {
  const upperLetter = letter.toUpperCase();

  // Don't allow duplicate guesses
  if (puzzle.guessedLetters.includes(upperLetter)) {
    return puzzle;
  }

  // Don't allow more guesses if max reached
  if (puzzle.guessedLetters.length >= puzzle.maxLetterGuesses) {
    return puzzle;
  }

  // Check vowel limit
  if (isVowel(upperLetter) && puzzle.guessedVowels >= puzzle.maxVowels) {
    return puzzle;
  }

  const newGuessedLetters = [...puzzle.guessedLetters, upperLetter];
  const newGuessedVowels =
    puzzle.guessedVowels + (isVowel(upperLetter) ? 1 : 0);

  // Check if letter is a HIT (appears in any word, excluding position 0)
  let isHit = false;
  for (const puzzleWord of puzzle.words) {
    // Check if letter appears anywhere EXCEPT position 0 (the key letter)
    const wordWithoutKeyLetter = puzzleWord.word.slice(1);
    if (wordWithoutKeyLetter.includes(upperLetter)) {
      isHit = true;
      break;
    }
  }

  // Calculate streak bonus based on v2 scoring
  let newStreak = puzzle.currentStreak;
  let streakBonus = 0;

  if (isHit) {
    newStreak = puzzle.currentStreak + 1;
    streakBonus = getStreakBonus(newStreak);
  } else {
    // Miss - reset streak
    newStreak = 0;
  }

  const newStreakBonusEarned = puzzle.streakBonusEarned + streakBonus;

  // Reveal the letter in all words
  let newWords = puzzle.words.map((puzzleWord) => {
    const newRevealed = [...puzzleWord.revealed];

    for (let i = 0; i < puzzleWord.word.length; i++) {
      if (puzzleWord.word[i] === upperLetter) {
        newRevealed[i] = true;
      }
    }

    return {
      ...puzzleWord,
      revealed: newRevealed,
    };
  });

  // Check for auto-completions
  const { words: wordsAfterAutoComplete, score: newScore } =
    checkAndAutoComplete(newWords, puzzle.score + streakBonus);
  newWords = wordsAfterAutoComplete;

  // Check if we should move to word guessing phase
  const newPhase =
    newGuessedLetters.length >= puzzle.maxLetterGuesses
      ? ("guessing-words" as const)
      : ("guessing-letters" as const);

  // If transitioning to word phase, lock in blanksAtWordPhase for scoring
  if (newPhase === "guessing-words") {
    newWords = newWords.map((word) => ({
      ...word,
      blanksAtWordPhase: word.revealed.filter((r) => !r).length,
    }));
  }

  let updatedPuzzle: Puzzle = {
    ...puzzle,
    guessedLetters: newGuessedLetters,
    guessedVowels: newGuessedVowels,
    words: newWords,
    phase: newPhase,
    score: newScore,
    currentStreak: newStreak,
    streakBonusEarned: newStreakBonusEarned,
  };

  // Check cascade/bonus word status (might be awarded if all cascade letters revealed)
  updatedPuzzle = checkAndAwardCascade(updatedPuzzle);

  return updatedPuzzle;
}

export function guessWord(
  puzzle: Puzzle,
  wordIndex: number,
  guess: string
): Puzzle {
  const upperGuess = guess.toUpperCase().trim();
  const targetWord = puzzle.words[wordIndex];

  // Already guessed this word
  if (targetWord.guessed) {
    return puzzle;
  }

  const isCorrect = upperGuess === targetWord.word;

  const newWords = puzzle.words.map((word, index) => {
    if (index === wordIndex) {
      return {
        ...word,
        guessed: true,
        correct: isCorrect,
        // Reveal all letters if guessed correctly
        revealed: isCorrect
          ? new Array(word.word.length).fill(true)
          : word.revealed,
      };
    }
    return word;
  });

  // Calculate score for this guess using new scoring system
  let scoreChange = 0;
  if (isCorrect) {
    // Calculate hints used before this word for escalating penalty
    let hintsUsedBefore = 0;
    for (let i = 0; i < wordIndex; i++) {
      hintsUsedBefore += puzzle.words[i].hintsUsed;
    }

    // Use blanksAtWordPhase (locked when entering word phase) and hintsUsed
    scoreChange = calculateWordScore(
      wordIndex,
      targetWord.blanksAtWordPhase,
      targetWord.hintsUsed,
      hintsUsedBefore
    );
  } else {
    // Wrong guess penalty - adds stakes to word guessing
    scoreChange = -WRONG_GUESS_PENALTY;
  }

  // Check if all words have been guessed
  const allGuessed = newWords.every((w) => w.guessed);
  const newPhase = allGuessed ? ("complete" as const) : puzzle.phase;

  let updatedPuzzle: Puzzle = {
    ...puzzle,
    words: newWords,
    score: Math.max(0, puzzle.score + scoreChange), // Score can't go negative
    phase: newPhase,
    selectedWordIndex: null,
  };

  // Check cascade/bonus word status after each word guess
  updatedPuzzle = checkAndAwardCascade(updatedPuzzle);

  return updatedPuzzle;
}

// Submit all words at once - check all guesses and tally scoring
export function submitAllWords(puzzle: Puzzle): Puzzle {
  let totalScoreChange = 0;
  let hintsUsedBefore = 0;

  const newWords = puzzle.words.map((word, index) => {
    // Skip auto-completed words (already scored)
    if (word.autoCompleted) {
      hintsUsedBefore += word.hintsUsed;
      return word;
    }

    // Build the full guess from revealed letters + user input
    const guess = word.word
      .split("")
      .map((char, i) => (word.revealed[i] ? char : word.userInput[i] || ""))
      .join("")
      .toUpperCase();

    const isCorrect = guess === word.word;

    // Calculate score for this word using blanksAtWordPhase and hintsUsed
    if (isCorrect) {
      totalScoreChange += calculateWordScore(
        index,
        word.blanksAtWordPhase,
        word.hintsUsed,
        hintsUsedBefore
      );
    } else {
      // Wrong guess penalty
      totalScoreChange -= WRONG_GUESS_PENALTY;
    }

    // Track hints for escalating penalty calculation
    hintsUsedBefore += word.hintsUsed;

    return {
      ...word,
      guessed: true,
      correct: isCorrect,
      // Only reveal all letters if the guess was correct
      // For incorrect guesses, keep the original revealed state to preserve user's wrong input display
      revealed: isCorrect
        ? new Array(word.word.length).fill(true)
        : word.revealed,
    };
  });

  let updatedPuzzle: Puzzle = {
    ...puzzle,
    words: newWords,
    score: Math.max(0, puzzle.score + totalScoreChange), // Score can't go negative
    phase: "complete" as const,
    selectedWordIndex: null,
  };

  // Check cascade/bonus word status
  updatedPuzzle = checkAndAwardCascade(updatedPuzzle);

  return updatedPuzzle;
}

export function selectWord(puzzle: Puzzle, wordIndex: number): Puzzle {
  // Can't select completed words
  if (puzzle.words[wordIndex].guessed) {
    return puzzle;
  }

  return {
    ...puzzle,
    selectedWordIndex: wordIndex,
  };
}

export function updateWordInput(
  puzzle: Puzzle,
  wordIndex: number,
  input: string[]
): Puzzle {
  const newWords = puzzle.words.map((word, index) => {
    if (index === wordIndex) {
      return {
        ...word,
        userInput: input,
      };
    }
    return word;
  });

  return {
    ...puzzle,
    words: newWords,
  };
}

export function canSkipToWordGuessing(puzzle: Puzzle): boolean {
  return puzzle.guessedLetters.length >= MIN_LETTERS_BEFORE_SKIP;
}

export function skipToWordGuessing(puzzle: Puzzle): Puzzle {
  // Require minimum letters before allowing skip
  if (!canSkipToWordGuessing(puzzle)) {
    return puzzle;
  }

  // Lock in blanksAtWordPhase for each word (used for scoring)
  const wordsWithLockedBlanks = puzzle.words.map((word) => ({
    ...word,
    blanksAtWordPhase: word.revealed.filter((r) => !r).length,
  }));

  return {
    ...puzzle,
    words: wordsWithLockedBlanks,
    phase: "guessing-words",
    selectedWordIndex: null,
  };
}

// Export for UI to show minimum requirement
export const MIN_LETTERS_TO_SKIP = MIN_LETTERS_BEFORE_SKIP;

// Reveal a letter using a hint during word guessing phase
// Returns the updated puzzle, or the same puzzle if hint can't be used
export function revealHint(
  puzzle: Puzzle,
  wordIndex: number,
  letterIndex: number
): Puzzle {
  // Can only use hints during word guessing phase
  if (puzzle.phase !== "guessing-words") {
    return puzzle;
  }

  // Check if hints are available
  if (puzzle.hintsRemaining <= 0) {
    return puzzle;
  }

  const word = puzzle.words[wordIndex];

  // Can't hint on already revealed letters
  if (word.revealed[letterIndex]) {
    return puzzle;
  }

  // Can't hint on auto-completed or already guessed words
  if (word.autoCompleted || word.guessed) {
    return puzzle;
  }

  // Reveal the letter and track hint usage
  const newRevealed = [...word.revealed];
  newRevealed[letterIndex] = true;

  const newWords = puzzle.words.map((w, i) => {
    if (i === wordIndex) {
      return {
        ...w,
        revealed: newRevealed,
        hintsUsed: w.hintsUsed + 1,
      };
    }
    return w;
  });

  return {
    ...puzzle,
    words: newWords,
    hintsRemaining: puzzle.hintsRemaining - 1,
    hintsUsedTotal: puzzle.hintsUsedTotal + 1,
  };
}

// Check if bonus word should be awarded (all 5 cascade letters are correct)
// Returns: { awarded: boolean, locked: boolean }
export function checkCascadeStatus(puzzle: Puzzle): {
  awarded: boolean;
  locked: boolean;
} {
  const cascadeRow = puzzle.cascadeWord.row;
  let allCorrect = true;
  let anyLocked = false;

  // 5 columns now
  for (let col = 0; col < 5; col++) {
    const word = puzzle.words[col];
    const expectedLetter = puzzle.cascadeWord.word[col];

    // Check if this position is revealed
    if (cascadeRow < word.revealed.length && word.revealed[cascadeRow]) {
      // Letter is revealed - check if it matches
      if (word.word[cascadeRow] === expectedLetter) {
        // Correct! This cascade letter is good
        continue;
      } else {
        // This shouldn't happen if puzzle is generated correctly
        allCorrect = false;
      }
    } else if (word.guessed) {
      // Word was guessed - check if the user's input at cascade position is correct
      const userLetter = word.userInput[cascadeRow] || "";
      if (word.correct) {
        // Word was correct, so cascade letter is correct too
        continue;
      } else {
        // Word was wrong - check if cascade letter specifically was correct
        if (userLetter.toUpperCase() === expectedLetter) {
          // Cascade letter was correct even though word was wrong
          continue;
        } else {
          // Cascade letter was wrong - lock out bonus
          anyLocked = true;
          allCorrect = false;
        }
      }
    } else {
      // Position not yet revealed and word not guessed
      allCorrect = false;
    }
  }

  return {
    awarded: allCorrect && !anyLocked,
    locked: anyLocked,
  };
}
// Award bonus if all cascade letters are correct
// v3: Cascade is now a flat +500 bonus (more visible and exciting)
function checkAndAwardCascade(puzzle: Puzzle): Puzzle {
  // Already awarded or locked
  if (puzzle.cascadeAwarded || puzzle.cascadeLocked) {
    return puzzle;
  }

  const { awarded, locked } = checkCascadeStatus(puzzle);

  if (locked) {
    return {
      ...puzzle,
      cascadeLocked: true,
    };
  }

  if (awarded) {
    // Flat cascade bonus - visible and exciting
    return {
      ...puzzle,
      cascadeAwarded: true,
      score: puzzle.score + CASCADE_FLAT_BONUS,
    };
  }

  return puzzle;
}

export function calculateFinalScore(puzzle: Puzzle): number {
  // Final score is just the accumulated score - no additional bonuses
  return puzzle.score;
}

// Scoring breakdown for display
export interface ScoreBreakdownItem {
  label: string;
  points: number;
  detail?: string;
}

export function getScoreBreakdown(puzzle: Puzzle): ScoreBreakdownItem[] {
  const breakdown: ScoreBreakdownItem[] = [];

  // Streak bonus (if any earned during letter phase)
  if (puzzle.streakBonusEarned > 0) {
    breakdown.push({
      label: "🔥 Letter Streak Bonus",
      points: puzzle.streakBonusEarned,
      detail: "Consecutive letter hits",
    });
  }

  // Track hints used before each word for escalating penalty calculation
  let hintsUsedBefore = 0;
  let wordScoreTotal = 0;

  // Word scoring - use blanksAtWordPhase and hintsUsed with escalating penalties
  puzzle.words.forEach((word, index) => {
    if (word.correct) {
      const config = SCORING_CONFIG[index];
      const blanks = word.blanksAtWordPhase;
      const hints = word.hintsUsed;

      let wordScore: number;
      let detail: string;

      if (word.autoCompleted) {
        wordScore = Math.round(config.baseScore * AUTO_COMPLETE_MULTIPLIER) + AUTO_COMPLETE_BONUS;
        detail = `${config.baseScore} × ${AUTO_COMPLETE_MULTIPLIER} + ${AUTO_COMPLETE_BONUS} auto bonus`;
      } else if (blanks === 0) {
        wordScore = config.baseScore;
        detail = `${config.baseScore} × 1.00`;
      } else {
        // Calculate escalating hint penalty with capped multiplier
        const totalHintPenalty = calculateTotalHintPenalty(hints, hintsUsedBefore);
        const rawMultiplier = 1 + BLANK_MULTIPLIER * blanks;
        const cappedMultiplier = Math.min(rawMultiplier, MAX_BLANK_MULTIPLIER);
        const finalMultiplier = Math.max(0.1, cappedMultiplier - totalHintPenalty);
        wordScore = Math.round(config.baseScore * finalMultiplier);

        if (hints > 0) {
          detail = `${config.baseScore} × ${finalMultiplier.toFixed(2)} (${hints} hint${hints > 1 ? "s" : ""})`;
        } else {
          detail = `${config.baseScore} × ${finalMultiplier.toFixed(2)}`;
        }
      }

      wordScoreTotal += wordScore;

      const wordLabel = word.autoCompleted
        ? `Word ${index + 1} (auto)`
        : `Word ${index + 1}`;

      breakdown.push({
        label: `${wordLabel}: ${word.word}`,
        points: wordScore,
        detail,
      });

      hintsUsedBefore += hints;
    } else if (word.guessed) {
      // Wrong guess - show penalty
      breakdown.push({
        label: `Word ${index + 1}: ${word.word}`,
        points: -WRONG_GUESS_PENALTY,
        detail: "Incorrect (-25)",
      });
    }
  });

  // Cascade Bonus (v3: flat bonus)
  if (puzzle.cascadeAwarded) {
    breakdown.push({
      label: `🎯 Cascade Bonus: ${puzzle.cascadeWord.word}`,
      points: CASCADE_FLAT_BONUS,
      detail: "Cascade word complete!",
    });
  } else if (puzzle.cascadeLocked) {
    breakdown.push({
      label: `Cascade: ${puzzle.cascadeWord.word}`,
      points: 0,
      detail: "Incorrect guess - no bonus",
    });
  }

  return breakdown;
}
