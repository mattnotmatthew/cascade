// Developer tools for testing Supabase integration
// Only available in development mode (localhost)

import { supabase, isSupabaseEnabled } from "./supabase";

const DEV_DATE_KEY = "cascade_dev_date";

/**
 * Check if dev tools should be available
 * Only enabled in development mode
 */
export function isDevMode(): boolean {
  return import.meta.env.DEV;
}

/**
 * Get the current test date override, if any
 */
export function getDevDateOverride(): string | null {
  if (!isDevMode()) return null;
  return localStorage.getItem(DEV_DATE_KEY);
}

/**
 * Set a test date override
 * This allows testing puzzles from different dates without waiting
 */
export function setDevDateOverride(date: string): void {
  if (!isDevMode()) {
    console.warn("[DevTools] Cannot set date override in production");
    return;
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error("[DevTools] Invalid date format. Use YYYY-MM-DD");
    return;
  }

  localStorage.setItem(DEV_DATE_KEY, date);
  console.log(`[DevTools] Date override set to: ${date}`);
}

/**
 * Clear the test date override (use real today's date)
 */
export function clearDevDateOverride(): void {
  if (!isDevMode()) return;
  localStorage.removeItem(DEV_DATE_KEY);
  console.log("[DevTools] Date override cleared");
}

/**
 * Delete today's attempt from Supabase
 * This allows re-testing the daily puzzle flow
 * Only works in dev mode
 */
export async function deleteDevAttempt(
  puzzleDate?: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isDevMode()) {
    return { success: false, error: "Dev mode only" };
  }

  if (!isSupabaseEnabled() || !supabase) {
    // Clear localStorage game state as fallback
    clearLocalGameState(puzzleDate);
    return { success: true, error: null };
  }

  const dateToDelete = puzzleDate || getEffectiveDate();

  const { error } = await supabase
    .from("daily_attempts")
    .delete()
    .eq("puzzle_date", dateToDelete);

  if (error) {
    console.error("[DevTools] Error deleting attempt:", error);
    return { success: false, error: error.message };
  }

  // Also clear localStorage
  clearLocalGameState(puzzleDate);

  console.log(`[DevTools] Deleted attempt for ${dateToDelete}`);
  return { success: true, error: null };
}

/**
 * Clear localStorage game state
 */
function clearLocalGameState(puzzleDate?: string): void {
  const date = puzzleDate || getEffectiveDate();
  const key = `cascade_game_${date}`;
  localStorage.removeItem(key);
  console.log(`[DevTools] Cleared localStorage for ${date}`);
}

/**
 * Get the effective date (dev override or real date)
 */
export function getEffectiveDate(): string {
  const override = getDevDateOverride();
  if (override) return override;
  return new Date().toISOString().split("T")[0];
}

/**
 * Get dev tools status for UI display
 */
export interface DevToolsStatus {
  isDevMode: boolean;
  dateOverride: string | null;
  effectiveDate: string;
  supabaseEnabled: boolean;
}

export function getDevToolsStatus(): DevToolsStatus {
  return {
    isDevMode: isDevMode(),
    dateOverride: getDevDateOverride(),
    effectiveDate: getEffectiveDate(),
    supabaseEnabled: isSupabaseEnabled(),
  };
}

/**
 * Reset all dev state
 * Clears date override and all localStorage game states
 */
export function resetAllDevState(): void {
  if (!isDevMode()) return;

  clearDevDateOverride();

  // Clear all cascade game states from localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("cascade_game_")) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  console.log(`[DevTools] Reset all dev state. Cleared ${keysToRemove.length} game states.`);
}

/**
 * Log current dev state for debugging
 */
export function logDevState(): void {
  if (!isDevMode()) {
    console.log("[DevTools] Not in dev mode");
    return;
  }

  const status = getDevToolsStatus();
  console.group("[DevTools] Current State");
  console.log("Dev Mode:", status.isDevMode);
  console.log("Date Override:", status.dateOverride || "(none)");
  console.log("Effective Date:", status.effectiveDate);
  console.log("Supabase Enabled:", status.supabaseEnabled);

  // Log localStorage game states
  const gameStates: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("cascade_game_")) {
      gameStates.push(key.replace("cascade_game_", ""));
    }
  }
  console.log("Stored Game States:", gameStates.length > 0 ? gameStates : "(none)");
  console.groupEnd();
}

// Expose to window for console access in dev mode
if (isDevMode() && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).cascadeDevTools = {
    setDate: setDevDateOverride,
    clearDate: clearDevDateOverride,
    deleteAttempt: deleteDevAttempt,
    resetAll: resetAllDevState,
    status: getDevToolsStatus,
    log: logDevState,
  };
  console.log(
    "[DevTools] Available via window.cascadeDevTools: setDate(), clearDate(), deleteAttempt(), resetAll(), status(), log()"
  );
}
