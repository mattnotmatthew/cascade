// Leaderboard panel shown post-game

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchDailyLeaderboard,
  getUserRankForDate,
  type LeaderboardEntry,
} from "../services/scoreService";
import "./LeaderboardPanel.css";

interface LeaderboardPanelProps {
  puzzleDate: string;
  userScore: number;
}

export function LeaderboardPanel({ puzzleDate, userScore }: LeaderboardPanelProps) {
  const { isAuthenticated, isSupabaseAvailable, openAuthModal } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      if (!isSupabaseAvailable) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const [leaderboardResult, rankResult] = await Promise.all([
        fetchDailyLeaderboard(puzzleDate, 10),
        isAuthenticated ? getUserRankForDate(puzzleDate) : Promise.resolve({ rank: null, totalPlayers: 0, error: null }),
      ]);

      setEntries(leaderboardResult.entries);
      setUserRank(rankResult.rank);
      setTotalPlayers(rankResult.totalPlayers);
      setIsLoading(false);
    }

    loadLeaderboard();
  }, [puzzleDate, isAuthenticated, isSupabaseAvailable]);

  // Not available - show sign in prompt
  if (!isSupabaseAvailable) {
    return (
      <div className="leaderboard-panel offline">
        <h3>Leaderboard</h3>
        <p className="offline-message">
          Leaderboards are unavailable in offline mode.
        </p>
      </div>
    );
  }

  // Not signed in - show prompt
  if (!isAuthenticated) {
    return (
      <div className="leaderboard-panel unauthenticated">
        <h3>Leaderboard</h3>
        <p className="signin-prompt">
          Your score: <strong>{userScore}</strong>
        </p>
        <p className="signin-message">
          Sign in to save your score and see how you rank!
        </p>
        <button className="signin-button" onClick={openAuthModal}>
          Sign In to Save Score
        </button>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="leaderboard-panel loading">
        <h3>Leaderboard</h3>
        <div className="loading-spinner small"></div>
      </div>
    );
  }

  // Empty leaderboard
  if (entries.length === 0) {
    return (
      <div className="leaderboard-panel empty">
        <h3>Today's Leaderboard</h3>
        <p className="empty-message">Be the first to complete today's puzzle!</p>
        {userRank && (
          <p className="your-rank">
            Your score: <strong>{userScore}</strong>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="leaderboard-panel">
      <h3>Today's Leaderboard</h3>

      {/* User's rank summary */}
      {userRank && (
        <div className="your-rank-summary">
          <span className="rank-number">#{userRank}</span>
          <span className="rank-text">
            of {totalPlayers} player{totalPlayers !== 1 ? "s" : ""} today
          </span>
        </div>
      )}

      {/* Top entries */}
      <div className="leaderboard-list">
        {entries.map((entry) => (
          <div
            key={entry.userId}
            className={`leaderboard-entry ${entry.rank === userRank ? "highlight" : ""}`}
          >
            <span className="entry-rank">
              {entry.rank === 1 && <span className="medal gold">1</span>}
              {entry.rank === 2 && <span className="medal silver">2</span>}
              {entry.rank === 3 && <span className="medal bronze">3</span>}
              {entry.rank > 3 && entry.rank}
            </span>
            <span className="entry-name">{entry.displayName}</span>
            <span className="entry-score">{entry.score}</span>
            {entry.cascadeAwarded && (
              <span className="cascade-badge" title="Cascade completed">C</span>
            )}
          </div>
        ))}
      </div>

      {/* Link to full leaderboard */}
      <a href="/leaderboard" className="view-all-link">
        View Full Leaderboard
      </a>
    </div>
  );
}
