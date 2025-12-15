import { useState, useRef } from "react";
import "./CascadeWordInput.css";

interface CascadeWordInputProps {
  cascadeRow: number;
  revealedLetters: boolean[];
  actualLetters: string[];
  input: string;
  onInputChange: (input: string) => void;
  onSubmit: () => void;
  guessed: boolean;
  correct: boolean;
  cascadeWord: string;
}

export function CascadeWordInput({
  cascadeRow,
  revealedLetters,
  actualLetters,
  input,
  onInputChange,
  onSubmit,
  guessed,
  correct,
  cascadeWord,
}: CascadeWordInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
    if (value.length <= 6) {
      onInputChange(value);
    }
  };

  // Handle key press for submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.length === 6 && !guessed) {
      onSubmit();
    }
  };

  // Focus input when clicking the display
  const handleDisplayClick = () => {
    if (!guessed && inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`cascade-word-container ${guessed ? "guessed" : ""}`}>
      <div className="cascade-word-header">
        <span className="cascade-label">
          🎯 Cascade Bonus (Row {cascadeRow + 1})
        </span>
        <span className="cascade-score">+500 pts</span>
      </div>

      <div
        className={`cascade-word-display ${isFocused ? "focused" : ""} ${
          guessed ? (correct ? "correct" : "incorrect") : ""
        }`}
        onClick={handleDisplayClick}
      >
        {Array.from({ length: 6 }).map((_, index) => {
          // Determine what to show in this cell
          let displayChar = "";
          let cellClass = "cascade-letter";

          if (guessed) {
            // Show the actual cascade word
            displayChar = cascadeWord[index];
            cellClass += correct ? " revealed" : " missed";
          } else if (revealedLetters[index]) {
            // Letter revealed from column word
            displayChar = actualLetters[index];
            cellClass += " revealed";
          } else if (input[index]) {
            // User typed this letter
            displayChar = input[index];
            cellClass += " user-input";
          } else {
            // Empty slot
            cellClass += " empty";
          }

          return (
            <div key={index} className={cellClass}>
              {displayChar || "_"}
            </div>
          );
        })}
      </div>

      {!guessed && (
        <div className="cascade-input-row">
          <input
            ref={inputRef}
            type="text"
            className="cascade-hidden-input"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            maxLength={6}
            placeholder=""
            autoComplete="off"
          />
          <button
            className="cascade-submit-btn"
            onClick={onSubmit}
            disabled={input.length !== 6}
          >
            Guess Cascade
          </button>
        </div>
      )}

      {guessed && (
        <div className={`cascade-result ${correct ? "correct" : "incorrect"}`}>
          {correct
            ? "✓ Correct! +500 points"
            : `✗ The word was: ${cascadeWord}`}
        </div>
      )}
    </div>
  );
}
