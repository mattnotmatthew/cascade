// Leaderboard page - full leaderboard view

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  fetchDailyLeaderboard,
  fetchAllTimeLeaderboard,
  fetchUserStats,
  type LeaderboardEntry,
  type AllTimeLeaderboardEntry,
  type UserStats,
} from "../services/scoreService";
import { getTodayDateString } from "../services/puzzleService";
import { ThemeToggle } from "../components/ThemeToggle";
import "./Leaderboard.css";

type LeaderboardTab = "daily" | "alltime";
type AllTimeSort = "best" | "total";

export function Leaderboard() {
  const { user, isAuthenticated, isSupabaseAvailable, openAuthModal } = useAuth();

  const [activeTab, setActiveTab] = useState<LeaderboardTab>("daily");
  const [allTimeSort, setAllTimeSort] = useState<AllTimeSort>("best");
  const [dailyEntries, setDailyEntries] = useState<LeaderboardEntry[]>([]);
  const [allTimeEntries, setAllTimeEntries] = useState<AllTimeLeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const today = getTodayDateString();

  // Load data on mount and tab change
  useEffect(() => {
    async function loadData() {
      if (!isSupabaseAvailable) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      if (activeTab === "daily") {
        const result = await fetchDailyLeaderboard(today, 100);
        setDailyEntries(result.entries);
      } else {
        const result = await fetchAllTimeLeaderboard(allTimeSort, 100);
        setAllTimeEntries(result.entries);
      }

      // Load user stats if authenticated
      if (isAuthenticated) {
        const statsResult = await fetchUserStats();
        setUserStats(statsResult.stats);
      }

      setIsLoading(false);
    }

    loadData();
  }, [activeTab, allTimeSort, today, isAuthenticated, isSupabaseAvailable]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="leaderboard-page">
      <header className="leaderboard-header">
        <div className="header-left">
          <Link to="/" className="back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
        <h1>Leaderboard</h1>
        <div className="header-right">
          <ThemeToggle />
        </div>
      </header>

      {/* Offline Message */}
      {!isSupabaseAvailable && (
        <div className="offline-banner">
          Leaderboards are unavailable in offline mode.
        </div>
      )}

      {/* User Stats Card */}
      {isAuthenticated && userStats && (
        <div className="user-stats-card">
          <div className="user-name">{user?.displayName || user?.email}</div>
          <div className="stats-grid">
            <div className="stat">
              <span className="stat-value">{userStats.totalGames}</span>
              <span className="stat-label">Games</span>
            </div>
            <div className="stat">
              <span className="stat-value">{userStats.bestScore}</span>
              <span className="stat-label">Best</span>
            </div>
            <div className="stat">
              <span className="stat-value">{userStats.currentStreak}</span>
              <span className="stat-label">Streak</span>
            </div>
            <div className="stat">
              <span className="stat-value">{userStats.longestStreak}</span>
              <span className="stat-label">Best Streak</span>
            </div>
          </div>
        </div>
      )}

      {/* Sign In Prompt */}
      {!isAuthenticated && isSupabaseAvailable && (
        <div className="signin-card">
          <p>Sign in to track your stats and appear on the leaderboard!</p>
          <button onClick={openAuthModal} className="signin-button">
            Sign In
          </button>
        </div>
      )}

      {/* Tabs */}
      {isSupabaseAvailable && (
        <div className="leaderboard-tabs">
          <button
            className={`tab ${activeTab === "daily" ? "active" : ""}`}
            onClick={() => setActiveTab("daily")}
          >
            Today
          </button>
          <button
            className={`tab ${activeTab === "alltime" ? "active" : ""}`}
            onClick={() => setActiveTab("alltime")}
          >
            All Time
          </button>
        </div>
      )}

      {/* Date Header for Daily */}
      {activeTab === "daily" && (
        <div className="date-header">{formatDate(today)}</div>
      )}

      {/* Sort Options for All Time */}
      {activeTab === "alltime" && (
        <div className="sort-options">
          <span className="sort-label">Sort by:</span>
          <button
            className={`sort-button ${allTimeSort === "best" ? "active" : ""}`}
            onClick={() => setAllTimeSort("best")}
          >
            Best Score
          </button>
          <button
            className={`sort-button ${allTimeSort === "total" ? "active" : ""}`}
            onClick={() => setAllTimeSort("total")}
          >
            Total Score
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
        </div>
      )}

      {/* Daily Leaderboard */}
      {!isLoading && activeTab === "daily" && (
        <div className="leaderboard-table-container">
          {dailyEntries.length === 0 ? (
            <div className="empty-state">
              <p>No scores yet today. Be the first to play!</p>
              <Link to="/" className="play-link">
                Play Now
              </Link>
            </div>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="rank-col">Rank</th>
                  <th className="name-col">Player</th>
                  <th className="score-col">Score</th>
                  <th className="words-col">Words</th>
                </tr>
              </thead>
              <tbody>
                {dailyEntries.map((entry) => (
                  <tr
                    key={entry.userId}
                    className={entry.userId === user?.id ? "highlight" : ""}
                  >
                    <td className="rank-col">
                      {entry.rank === 1 && <span className="medal gold">1</span>}
                      {entry.rank === 2 && <span className="medal silver">2</span>}
                      {entry.rank === 3 && <span className="medal bronze">3</span>}
                      {entry.rank > 3 && entry.rank}
                    </td>
                    <td className="name-col">
                      {entry.displayName}
                      {entry.cascadeAwarded && (
                        <span className="cascade-badge" title="Cascade completed">C</span>
                      )}
                    </td>
                    <td className="score-col">{entry.score}</td>
                    <td className="words-col">{entry.wordsCorrect}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* All Time Leaderboard */}
      {!isLoading && activeTab === "alltime" && (
        <div className="leaderboard-table-container">
          {allTimeEntries.length === 0 ? (
            <div className="empty-state">
              <p>No all-time scores yet.</p>
              <Link to="/" className="play-link">
                Play Now
              </Link>
            </div>
          ) : (
            <table className="leaderboard-table alltime">
              <thead>
                <tr>
                  <th className="rank-col">Rank</th>
                  <th className="name-col">Player</th>
                  <th className="score-col">
                    {allTimeSort === "best" ? "Best" : "Total"}
                  </th>
                  <th className="games-col">Games</th>
                  <th className="streak-col">Streak</th>
                </tr>
              </thead>
              <tbody>
                {allTimeEntries.map((entry) => {
                  const rank =
                    allTimeSort === "best" ? entry.rankByBest : entry.rankByTotal;
                  const score =
                    allTimeSort === "best" ? entry.bestScore : entry.totalScore;

                  return (
                    <tr
                      key={entry.userId}
                      className={entry.userId === user?.id ? "highlight" : ""}
                    >
                      <td className="rank-col">
                        {rank === 1 && <span className="medal gold">1</span>}
                        {rank === 2 && <span className="medal silver">2</span>}
                        {rank === 3 && <span className="medal bronze">3</span>}
                        {rank > 3 && rank}
                      </td>
                      <td className="name-col">{entry.displayName}</td>
                      <td className="score-col">{score.toLocaleString()}</td>
                      <td className="games-col">{entry.totalGames}</td>
                      <td className="streak-col">{entry.longestStreak}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
