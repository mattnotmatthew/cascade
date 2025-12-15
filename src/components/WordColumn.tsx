import type { PuzzleWord } from "../types/game";
import "./WordColumn.css";

interface WordColumnProps {
  puzzleWord: PuzzleWord;
  position: number;
  keyLetter: string;
  isWordGuessingPhase: boolean;
  isSelected: boolean;
  onSelectWord: () => void;
  cascadeRow?: number; // Row index for cascade word highlight
  showResults?: boolean; // Show correct/incorrect after puzzle submission
  selectedCellIndex?: number | null; // Which cell is currently selected for input
  onSelectCell?: (cellIndex: number) => void; // Callback when a cell is clicked
  hintsRemaining?: number; // Number of hints remaining
  onUseHint?: (letterIndex: number) => void; // Callback to use a hint on a letter
}

export function WordColumn({
  puzzleWord,
  position: _position,
  keyLetter,
  isWordGuessingPhase,
  isSelected,
  onSelectWord,
  cascadeRow,
  showResults = false,
  selectedCellIndex,
  onSelectCell,
  hintsRemaining = 0,
  onUseHint,
}: WordColumnProps) {
  void _position; // Reserved for future use (e.g., animations)
  const { word, revealed, guessed, correct, autoCompleted, userInput } =
    puzzleWord;

  const handleColumnClick = () => {
    // Allow clicking during word guessing phase (before submission)
    if (isWordGuessingPhase && !showResults) {
      onSelectWord();
    }
  };

  const handleCellClick = (cellIndex: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger column click
    if (
      isWordGuessingPhase &&
      !showResults &&
      !revealed[cellIndex] &&
      onSelectCell
    ) {
      onSelectWord(); // Make sure this column is selected
      onSelectCell(cellIndex);
    }
  };

  const handleCellRightClick = (cellIndex: number, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent context menu
    e.stopPropagation();
    // Use hint on right-click if available
    if (
      isWordGuessingPhase &&
      !showResults &&
      !revealed[cellIndex] &&
      hintsRemaining > 0 &&
      onUseHint
    ) {
      onUseHint(cellIndex);
    }
  };

  return (
    <div
      className={`word-column ${
        showResults && guessed ? (correct ? "correct" : "incorrect") : ""
      } ${isSelected && !showResults ? "selected" : ""} ${
        autoCompleted ? "auto-completed" : ""
      } ${isWordGuessingPhase && !showResults ? "clickable" : ""}`}
      onClick={handleColumnClick}
    >
      {/* Key letter at the top - acts as first letter of the word */}
      <div className="key-letter">{keyLetter}</div>

      {/* Letter cells - skip index 0 since key letter above is the first letter */}
      <div className="letter-cells">
        {word
          .split("")
          .slice(1)
          .map((char, index) => {
            const actualIndex = index + 1;
            const isRevealed = revealed[actualIndex];
            const hasUserInput = userInput[actualIndex] !== "";
            const isCascadeRow = cascadeRow === actualIndex;
            const isCellSelected =
              isSelected && selectedCellIndex === actualIndex;
            const isEditable =
              isWordGuessingPhase && !showResults && !isRevealed;
            const canUseHint =
              isWordGuessingPhase &&
              !showResults &&
              !isRevealed &&
              hintsRemaining > 0;

            // After submission: show user's input (or empty) - don't reveal correct answer in cells
            // For correct words or revealed letters, show the actual letter
            // For incorrect guesses, keep showing what the user typed
            let displayChar = "";
            if (isRevealed) {
              displayChar = char; // Always show revealed letters
            } else if (showResults && guessed) {
              // After submission - keep user's input visible (don't replace with correct answer)
              displayChar = userInput[actualIndex] || "";
            } else if (hasUserInput) {
              displayChar = userInput[actualIndex];
            }

            return (
              <div
                key={actualIndex}
                className={`letter-cell ${isRevealed ? "revealed" : "hidden"} ${
                  hasUserInput && !isRevealed ? "user-input" : ""
                } ${isCascadeRow ? "cascade-highlight" : ""} ${
                  isCellSelected ? "cell-selected" : ""
                } ${isEditable ? "editable" : ""} ${
                  canUseHint ? "can-hint" : ""
                } ${
                  showResults && guessed && !correct && !isRevealed
                    ? "wrong-guess"
                    : ""
                }`}
                onClick={(e) => handleCellClick(actualIndex, e)}
                onContextMenu={(e) => handleCellRightClick(actualIndex, e)}
                title={canUseHint ? "Right-click to use a hint" : undefined}
              >
                {displayChar}
              </div>
            );
          })}
      </div>

      {/* Show correct word below column if guess was wrong */}
      {showResults && guessed && !correct && (
        <div className="correct-word-reveal">
          <span className="correct-word-label">Answer:</span>
          <span className="correct-word-text">{word}</span>
        </div>
      )}
    </div>
  );
}
