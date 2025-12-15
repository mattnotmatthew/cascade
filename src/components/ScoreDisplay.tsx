import "./ScoreDisplay.css";

interface ScoreDisplayProps {
  score: number;
  phase: "guessing-letters" | "guessing-words" | "complete";
  correctWords: number;
  totalWords: number;
}

export function ScoreDisplay({
  score,
  phase,
  correctWords,
  totalWords,
}: ScoreDisplayProps) {
  return (
    <div className="score-display">
      <div className="score-value">
        Score: <span className="score-number">{score}</span>
      </div>

      {phase === "complete" && (
        <div className="final-results">
          <div className="words-correct">
            Words Correct: {correctWords} / {totalWords}
          </div>
          {correctWords === totalWords && (
            <div className="perfect-score">🎉 Perfect! 🎉</div>
          )}
        </div>
      )}
    </div>
  );
}
