// ZIP export service for bulk puzzle batches

import JSZip from "jszip";
import type { BulkBatch, SavedPuzzle } from "../types/creator";

/**
 * Export a batch of puzzles as a ZIP file
 * Each puzzle is saved as {date}.json
 */
export async function exportBatchAsZip(batch: BulkBatch): Promise<void> {
  const zip = new JSZip();

  // Add each puzzle as individual JSON file
  for (const entry of batch.puzzles) {
    // Skip entries that haven't been generated
    if (entry.status === "pending" || entry.status === "error") {
      continue;
    }

    const savedPuzzle: SavedPuzzle = {
      date: entry.date,
      cascadeWord: entry.cascadeWord,
      seedWord: entry.seedWord,
      cascadeRow: entry.cascadeRow,
      columnWords: entry.columnWords,
      createdAt: new Date().toISOString(),
      metadata: entry.theme ? { theme: entry.theme } : undefined,
    };

    const json = JSON.stringify(savedPuzzle, null, 2);
    zip.file(`${entry.date}.json`, json);
  }

  // Generate ZIP blob
  const blob = await zip.generateAsync({ type: "blob" });

  // Create download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  // Create filename based on date range
  const dates = batch.puzzles
    .filter((p) => p.status !== "pending" && p.status !== "error")
    .map((p) => p.date)
    .sort();

  const startDate = dates[0] || batch.config.startDate;
  const endDate = dates[dates.length - 1] || startDate;

  a.download = `cascade-puzzles-${startDate}-to-${endDate}.zip`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Get count of exportable puzzles in a batch
 */
export function getExportableCount(batch: BulkBatch): number {
  return batch.puzzles.filter(
    (p) => p.status === "generated" || p.status === "reviewed"
  ).length;
}
