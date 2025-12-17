// Puzzle service for loading puzzles from Supabase with JSON fallback

import { supabase, isSupabaseEnabled } from "./supabase";
import type { SavedPuzzle } from "../types/creator";
import { loadPuzzleForDate as loadPuzzleFromJson } from "./puzzleLoader";

export interface SupabasePuzzle {
  id: string;
  puzzleDate: string;
  seedWord: string;
  cascadeWord: string;
  cascadeRow: 1 | 2 | 3;
  columnWords: string[];
  theme: string | null;
  createdAt: string;
}

/**
 * Load a puzzle for a specific date
 * Priority: Supabase > JSON file > null
 */
export async function loadPuzzle(date: string): Promise<SavedPuzzle | null> {
  // Try Supabase first
  if (isSupabaseEnabled() && supabase) {
    const supabasePuzzle = await loadPuzzleFromSupabase(date);
    if (supabasePuzzle) {
      console.log(`[PuzzleService] Loaded puzzle from Supabase for ${date}`);
      return supabasePuzzleToSavedPuzzle(supabasePuzzle);
    }
  }

  // Fall back to JSON file
  console.log(`[PuzzleService] Falling back to JSON for ${date}`);
  const jsonPuzzle = await loadPuzzleFromJson(date);
  if (jsonPuzzle) {
    console.log(`[PuzzleService] Loaded puzzle from JSON for ${date}`);
    return jsonPuzzle;
  }

  // No puzzle available
  console.log(`[PuzzleService] No puzzle found for ${date}`);
  return null;
}

/**
 * Load a puzzle from Supabase
 * RLS policy ensures only today's or past puzzles are returned
 */
async function loadPuzzleFromSupabase(date: string): Promise<SupabasePuzzle | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("puzzles")
    .select("*")
    .eq("puzzle_date", date)
    .maybeSingle();

  if (error) {
    console.error(`[PuzzleService] Supabase error for ${date}:`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    puzzleDate: data.puzzle_date,
    seedWord: data.seed_word,
    cascadeWord: data.cascade_word,
    cascadeRow: data.cascade_row as 1 | 2 | 3,
    columnWords: data.column_words,
    theme: data.theme,
    createdAt: data.created_at,
  };
}

/**
 * Convert Supabase puzzle format to SavedPuzzle format
 */
function supabasePuzzleToSavedPuzzle(puzzle: SupabasePuzzle): SavedPuzzle {
  return {
    seedWord: puzzle.seedWord,
    cascadeWord: puzzle.cascadeWord,
    cascadeRow: puzzle.cascadeRow,
    columnWords: puzzle.columnWords,
    date: puzzle.puzzleDate,
    createdAt: puzzle.createdAt,
    metadata: puzzle.theme ? { theme: puzzle.theme } : undefined,
  };
}

/**
 * Save a puzzle to Supabase (for admin/creator use)
 * Requires authenticated user with appropriate permissions
 */
export async function savePuzzleToSupabase(
  puzzle: SavedPuzzle
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseEnabled() || !supabase) {
    return { success: false, error: "Supabase not available" };
  }

  const { error } = await supabase.from("puzzles").upsert(
    {
      puzzle_date: puzzle.date,
      seed_word: puzzle.seedWord,
      cascade_word: puzzle.cascadeWord,
      cascade_row: puzzle.cascadeRow,
      column_words: puzzle.columnWords,
      theme: puzzle.metadata?.theme || null,
    },
    {
      onConflict: "puzzle_date",
    }
  );

  if (error) {
    console.error("[PuzzleService] Error saving puzzle:", error);
    return { success: false, error: error.message };
  }

  console.log(`[PuzzleService] Saved puzzle for ${puzzle.date} to Supabase`);
  return { success: true, error: null };
}

/**
 * Check if a puzzle exists for a date (in Supabase or JSON)
 */
export async function puzzleExists(date: string): Promise<boolean> {
  // Check Supabase first
  if (isSupabaseEnabled() && supabase) {
    const { data } = await supabase
      .from("puzzles")
      .select("id")
      .eq("puzzle_date", date)
      .maybeSingle();

    if (data) return true;
  }

  // Check JSON file
  try {
    const response = await fetch(`/puzzles/${date}.json`, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get today's date string in YYYY-MM-DD format
 * This is the source of truth for the current puzzle date
 * In dev mode, this can be overridden via devTools
 */
export function getTodayDateString(): string {
  // Check for dev mode override
  if (import.meta.env.DEV) {
    const devDateOverride = localStorage.getItem("cascade_dev_date");
    if (devDateOverride) {
      console.log(`[PuzzleService] Using dev date override: ${devDateOverride}`);
      return devDateOverride;
    }
  }

  const today = new Date();
  return today.toISOString().split("T")[0];
}

/**
 * Load today's puzzle
 */
export async function loadTodaysPuzzle(): Promise<SavedPuzzle | null> {
  return loadPuzzle(getTodayDateString());
}
