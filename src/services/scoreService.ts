// Score service for saving scores and fetching leaderboards from Supabase

import { supabase, isSupabaseEnabled } from "./supabase";
import type { Puzzle } from "../types/game";

export interface DailyAttempt {
  id: string;
  puzzleDate: string;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  wordsCorrect: number | null;
  cascadeAwarded: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  username: string | null;
  score: number;
  wordsCorrect: number;
  cascadeAwarded: boolean;
  completedAt: string;
}

export interface AllTimeLeaderboardEntry {
  rankByBest: number;
  rankByTotal: number;
  userId: string;
  displayName: string;
  username: string | null;
  bestScore: number;
  totalScore: number;
  totalGames: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string;
}

export interface UserStats {
  totalGames: number;
  totalScore: number;
  bestScore: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string | null;
}

/**
 * Start a daily attempt (records that the user began playing today's puzzle)
 * Returns existing attempt if one exists, or creates a new one
 */
export async function startDailyAttempt(
  puzzleDate: string
): Promise<{ attempt: DailyAttempt | null; error: string | null; alreadyCompleted: boolean }> {
  if (!isSupabaseEnabled() || !supabase) {
    return { attempt: null, error: null, alreadyCompleted: false };
  }

  // First, check if an attempt already exists
  const { data: existing, error: fetchError } = await supabase
    .from("daily_attempts")
    .select("*")
    .eq("puzzle_date", puzzleDate)
    .maybeSingle();

  if (fetchError) {
    console.error("[ScoreService] Error checking existing attempt:", fetchError);
    return { attempt: null, error: fetchError.message, alreadyCompleted: false };
  }

  if (existing) {
    // Attempt already exists
    const attempt: DailyAttempt = {
      id: existing.id,
      puzzleDate: existing.puzzle_date,
      startedAt: existing.started_at,
      completedAt: existing.completed_at,
      score: existing.score,
      wordsCorrect: existing.words_correct,
      cascadeAwarded: existing.cascade_awarded,
    };

    return {
      attempt,
      error: null,
      alreadyCompleted: existing.completed_at !== null,
    };
  }

  // Create a new attempt
  const { data, error } = await supabase
    .from("daily_attempts")
    .insert({
      puzzle_date: puzzleDate,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation (race condition)
    if (error.code === "23505") {
      // Another request already created the attempt, fetch it
      const { data: retryData } = await supabase
        .from("daily_attempts")
        .select("*")
        .eq("puzzle_date", puzzleDate)
        .single();

      if (retryData) {
        return {
          attempt: {
            id: retryData.id,
            puzzleDate: retryData.puzzle_date,
            startedAt: retryData.started_at,
            completedAt: retryData.completed_at,
            score: retryData.score,
            wordsCorrect: retryData.words_correct,
            cascadeAwarded: retryData.cascade_awarded,
          },
          error: null,
          alreadyCompleted: retryData.completed_at !== null,
        };
      }
    }
    console.error("[ScoreService] Error creating attempt:", error);
    return { attempt: null, error: error.message, alreadyCompleted: false };
  }

  return {
    attempt: {
      id: data.id,
      puzzleDate: data.puzzle_date,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      score: data.score,
      wordsCorrect: data.words_correct,
      cascadeAwarded: data.cascade_awarded,
    },
    error: null,
    alreadyCompleted: false,
  };
}

/**
 * Submit the final score for a daily attempt
 */
export async function submitScore(
  puzzleDate: string,
  puzzle: Puzzle
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseEnabled() || !supabase) {
    return { success: false, error: "Supabase not available" };
  }

  const wordsCorrect = puzzle.words.filter((w) => w.correct).length;

  const { error } = await supabase
    .from("daily_attempts")
    .update({
      completed_at: new Date().toISOString(),
      score: puzzle.score,
      words_correct: wordsCorrect,
      cascade_awarded: puzzle.cascadeAwarded,
    })
    .eq("puzzle_date", puzzleDate)
    .is("completed_at", null); // Only update if not already completed

  if (error) {
    console.error("[ScoreService] Error submitting score:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Fetch daily leaderboard for a specific date
 */
export async function fetchDailyLeaderboard(
  puzzleDate: string,
  limit: number = 50
): Promise<{ entries: LeaderboardEntry[]; error: string | null }> {
  if (!isSupabaseEnabled() || !supabase) {
    return { entries: [], error: null };
  }

  const { data, error } = await supabase
    .from("daily_leaderboard")
    .select("*")
    .eq("puzzle_date", puzzleDate)
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[ScoreService] Error fetching daily leaderboard:", error);
    return { entries: [], error: error.message };
  }

  const entries: LeaderboardEntry[] = (data || []).map((row) => ({
    rank: row.rank,
    userId: row.user_id,
    displayName: row.display_name || "Anonymous",
    username: row.username,
    score: row.score,
    wordsCorrect: row.words_correct,
    cascadeAwarded: row.cascade_awarded,
    completedAt: row.completed_at,
  }));

  return { entries, error: null };
}

/**
 * Fetch all-time leaderboard
 */
export async function fetchAllTimeLeaderboard(
  sortBy: "best" | "total" = "best",
  limit: number = 50
): Promise<{ entries: AllTimeLeaderboardEntry[]; error: string | null }> {
  if (!isSupabaseEnabled() || !supabase) {
    return { entries: [], error: null };
  }

  const orderColumn = sortBy === "best" ? "rank_by_best" : "rank_by_total";

  const { data, error } = await supabase
    .from("alltime_leaderboard")
    .select("*")
    .order(orderColumn, { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[ScoreService] Error fetching all-time leaderboard:", error);
    return { entries: [], error: error.message };
  }

  const entries: AllTimeLeaderboardEntry[] = (data || []).map((row) => ({
    rankByBest: row.rank_by_best,
    rankByTotal: row.rank_by_total,
    userId: row.user_id,
    displayName: row.display_name || "Anonymous",
    username: row.username,
    bestScore: row.best_score,
    totalScore: row.total_score,
    totalGames: row.total_games,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastPlayedDate: row.last_played_date,
  }));

  return { entries, error: null };
}

/**
 * Fetch current user's stats
 */
export async function fetchUserStats(): Promise<{ stats: UserStats | null; error: string | null }> {
  if (!isSupabaseEnabled() || !supabase) {
    return { stats: null, error: null };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { stats: null, error: null };
  }

  const { data, error } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[ScoreService] Error fetching user stats:", error);
    return { stats: null, error: error.message };
  }

  if (!data) {
    // User has no stats yet
    return {
      stats: {
        totalGames: 0,
        totalScore: 0,
        bestScore: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastPlayedDate: null,
      },
      error: null,
    };
  }

  return {
    stats: {
      totalGames: data.total_games,
      totalScore: data.total_score,
      bestScore: data.best_score,
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
      lastPlayedDate: data.last_played_date,
    },
    error: null,
  };
}

/**
 * Check if user has already played today
 */
export async function hasPlayedToday(
  puzzleDate: string
): Promise<{ played: boolean; completed: boolean; error: string | null }> {
  if (!isSupabaseEnabled() || !supabase) {
    return { played: false, completed: false, error: null };
  }

  const { data, error } = await supabase
    .from("daily_attempts")
    .select("completed_at")
    .eq("puzzle_date", puzzleDate)
    .maybeSingle();

  if (error) {
    console.error("[ScoreService] Error checking if played today:", error);
    return { played: false, completed: false, error: error.message };
  }

  return {
    played: data !== null,
    completed: data?.completed_at !== null,
    error: null,
  };
}

/**
 * Get user's rank for a specific date
 */
export async function getUserRankForDate(
  puzzleDate: string
): Promise<{ rank: number | null; totalPlayers: number; error: string | null }> {
  if (!isSupabaseEnabled() || !supabase) {
    return { rank: null, totalPlayers: 0, error: null };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { rank: null, totalPlayers: 0, error: null };
  }

  // Get user's rank
  const { data: rankData, error: rankError } = await supabase
    .from("daily_leaderboard")
    .select("rank")
    .eq("puzzle_date", puzzleDate)
    .eq("user_id", user.id)
    .maybeSingle();

  if (rankError) {
    console.error("[ScoreService] Error fetching user rank:", rankError);
    return { rank: null, totalPlayers: 0, error: rankError.message };
  }

  // Get total players
  const { count, error: countError } = await supabase
    .from("daily_leaderboard")
    .select("*", { count: "exact", head: true })
    .eq("puzzle_date", puzzleDate);

  if (countError) {
    console.error("[ScoreService] Error counting players:", countError);
  }

  return {
    rank: rankData?.rank || null,
    totalPlayers: count || 0,
    error: null,
  };
}
