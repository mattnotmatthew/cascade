// Bulk puzzle generation service
// Handles the business logic for generating puzzles in bulk

import { datamuseApi } from "./datamuseApi";
import type { BulkPuzzleEntry } from "../types/creator";

// Column word lengths
const COLUMN_LENGTHS = [4, 5, 5, 5, 6] as const;

/**
 * Generate a single puzzle by finding viable row and column words
 * Returns partial puzzle data or null if no viable configuration found
 */
export async function generateSinglePuzzle(
  cascadeWord: string,
  seedWord: string
): Promise<Pick<BulkPuzzleEntry, "cascadeRow" | "columnWords" | "columnOptions"> | null> {
  const cascade = cascadeWord.toUpperCase();
  const seed = seedWord.toUpperCase();

  // Try each cascade row (1, 2, 3) to find viable one
  for (const row of [1, 2, 3] as const) {
    const columnWords: string[] = [];
    const columnOptions: string[][] = [];
    let viable = true;

    for (let col = 0; col < 5; col++) {
      const wordLength = COLUMN_LENGTHS[col];
      const words = await datamuseApi.getColumnWords(
        seed[col],
        cascade[col],
        row,
        wordLength
      );

      if (words.length === 0) {
        viable = false;
        break;
      }

      columnWords.push(words[0]);
      columnOptions.push(words);
    }

    if (viable) {
      return {
        cascadeRow: row,
        columnWords,
        columnOptions,
      };
    }
  }

  return null;
}

/**
 * Generate dates array from start date and count
 * Uses string manipulation to avoid timezone issues
 */
export function generateDates(start: string, count: number): string[] {
  const dates: string[] = [];

  // Parse the start date components
  const [year, month, day] = start.split("-").map(Number);

  for (let i = 0; i < count; i++) {
    // Create date using UTC to avoid timezone issues
    const date = new Date(Date.UTC(year, month - 1, day + i));

    // Format as YYYY-MM-DD
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");

    dates.push(`${y}-${m}-${d}`);
  }

  return dates;
}

/**
 * Get puzzle statistics from a list of puzzles
 */
export function getPuzzleStats(puzzles: BulkPuzzleEntry[]) {
  return {
    successful: puzzles.filter(
      (p) => p.status === "generated" || p.status === "reviewed"
    ).length,
    errors: puzzles.filter((p) => p.status === "error").length,
    pending: puzzles.filter((p) => p.status === "pending").length,
    total: puzzles.length,
  };
}

/**
 * Determine which step to resume at based on puzzle states
 */
export type Step = "config" | "assign" | "generating" | "review" | "download";

export function determineResumeStep(puzzles: BulkPuzzleEntry[]): Step {
  const allGenerated = puzzles.every((p) => p.status !== "pending");
  if (allGenerated) return "review";

  const hasGenerated = puzzles.some(
    (p) => p.status === "generated" || p.status === "reviewed"
  );
  if (hasGenerated) return "generating";

  return "assign";
}

/**
 * Get CSS class for step progress indicator
 */
export function getStepClass(targetStep: Step, currentStep: Step): string {
  const stepOrder: Step[] = ["config", "assign", "generating", "review", "download"];
  const currentIndex = stepOrder.indexOf(currentStep);
  const targetIndex = stepOrder.indexOf(targetStep);

  if (currentStep === targetStep) return "step-item active";
  if (currentIndex > targetIndex) return "step-item complete";
  return "step-item";
}
