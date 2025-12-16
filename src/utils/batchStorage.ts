// localStorage helpers for bulk puzzle batch persistence

import type { BulkBatch } from "../types/creator";

const BATCH_STORAGE_KEY = "cascade-bulk-batch";

/**
 * Save batch to localStorage
 */
export function saveBatchToStorage(batch: BulkBatch): void {
  try {
    const data = JSON.stringify(batch);
    localStorage.setItem(BATCH_STORAGE_KEY, data);
  } catch (error) {
    console.error("[BatchStorage] Failed to save batch:", error);
  }
}

/**
 * Load batch from localStorage
 */
export function loadBatchFromStorage(): BulkBatch | null {
  try {
    const data = localStorage.getItem(BATCH_STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as BulkBatch;
  } catch (error) {
    console.error("[BatchStorage] Failed to load batch:", error);
    return null;
  }
}

/**
 * Clear batch from localStorage
 */
export function clearBatchFromStorage(): void {
  try {
    localStorage.removeItem(BATCH_STORAGE_KEY);
  } catch (error) {
    console.error("[BatchStorage] Failed to clear batch:", error);
  }
}

/**
 * Check if there's a saved batch
 */
export function hasSavedBatch(): boolean {
  return localStorage.getItem(BATCH_STORAGE_KEY) !== null;
}
