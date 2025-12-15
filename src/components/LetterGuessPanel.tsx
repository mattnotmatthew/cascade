import "./LetterGuessPanel.css";

const VOWELS = ["A", "E", "I", "O", "U"];

interface LetterGuessPanelProps {
  guessedLetters: string[];
  maxGuesses: number;
  guessedVowels: number;
  maxVowels: number;
  onGuessLetter: (letter: string) => void;
  onSkipToWords: () => void;
  disabled: boolean;
}

export function LetterGuessPanel({
  guessedLetters,
  maxGuesses,
  guessedVowels,
  maxVowels,
  onGuessLetter,
  onSkipToWords,
  disabled,
}: LetterGuessPanelProps) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const remainingGuesses = maxGuesses - guessedLetters.length;
  const remainingVowels = maxVowels - guessedVowels;

  const isVowel = (letter: string) => VOWELS.includes(letter);

  const isLetterDisabled = (letter: string) => {
    if (disabled) return true;
    if (guessedLetters.includes(letter)) return true;
    if (isVowel(letter) && guessedVowels >= maxVowels) return true;
    return false;
  };

  const handleLetterClick = (letter: string) => {
    if (!isLetterDisabled(letter)) {
      onGuessLetter(letter);
    }
  };

  return (
    <div className="letter-guess-panel">
      <div className="guess-info">
        <span className="remaining-guesses">
          Letter Guesses Remaining: <strong>{remainingGuesses}</strong>
        </span>
        <span className="remaining-vowels">
          Vowels Remaining: <strong>{remainingVowels}</strong>
        </span>
        <div className="guessed-letters">
          Guessed:{" "}
          {guessedLetters.length > 0 ? guessedLetters.join(", ") : "None"}
        </div>
      </div>

      <div className="alphabet-grid">
        {alphabet.map((letter) => (
          <button
            key={letter}
            className={`letter-button ${
              guessedLetters.includes(letter) ? "used" : ""
            } ${isVowel(letter) ? "vowel" : ""} ${
              isVowel(letter) &&
              guessedVowels >= maxVowels &&
              !guessedLetters.includes(letter)
                ? "vowel-disabled"
                : ""
            }`}
            onClick={() => handleLetterClick(letter)}
            disabled={isLetterDisabled(letter)}
          >
            {letter}
          </button>
        ))}
      </div>

      {!disabled && remainingGuesses > 0 && guessedLetters.length >= 2 && (
        <button className="skip-button" onClick={onSkipToWords}>
          Skip to Word Guessing ({remainingGuesses} guesses unused)
        </button>
      )}
    </div>
  );
}
