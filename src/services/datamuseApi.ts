// Datamuse API service for theme-based word retrieval
// API Docs: https://www.datamuse.com/api/
// No API key required, ~100k queries/day allowed

const API_BASE = "https://api.datamuse.com";

// Cache for Datamuse results
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

interface DatamuseWord {
  word: string;
  score: number; // relevance/association strength to query
  tags?: string[]; // includes "f:123.45" for frequency
}

/**
 * Extract frequency from Datamuse tags array
 * Format: "f:158.776520" -> 158.776520
 */
function extractFrequency(tags?: string[]): number {
  if (!tags) return 0;
  const freqTag = tags.find((t) => t.startsWith("f:"));
  if (!freqTag) return 0;
  return parseFloat(freqTag.substring(2)) || 0;
}

class DatamuseService {
  /**
   * Search for words related to a theme
   * Uses "means like" (ml) and "topics" for semantic matching
   */
  async searchByTheme(
    theme: string,
    options: {
      length?: number;
      maxResults?: number;
      additionalTopics?: string[];
    } = {}
  ): Promise<string[]> {
    const { length, maxResults = 100, additionalTopics = [] } = options;

    // Build topics string (theme + additional related topics)
    const topics = [theme, ...additionalTopics].join(",");

    // Build spelled-like pattern for length constraint
    // e.g., "?????" for 5-letter words
    const spelledLike = length ? "?".repeat(length) : undefined;

    const params = new URLSearchParams({
      ml: theme, // "means like" - semantic similarity
      topics: topics, // topic bias
      max: String(maxResults),
      md: "pf", // metadata: parts of speech and frequency
    });

    if (spelledLike) {
      params.set("sp", spelledLike);
    }

    const cacheKey = `datamuse:theme:${params.toString()}`;
    const cached = getCached<string[]>(cacheKey);
    if (cached) {
      console.log("[Datamuse] Cache hit:", theme);
      return cached;
    }

    try {
      console.log("[Datamuse] Fetching theme:", theme);
      const response = await fetch(`${API_BASE}/words?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Datamuse error: ${response.status}`);
      }

      const data: DatamuseWord[] = await response.json();

      // Filter, extract frequency, and sort by frequency (highest first)
      const wordsWithFreq = data
        .map((item) => ({
          word: item.word.toLowerCase(),
          frequency: extractFrequency(item.tags),
          score: item.score,
        }))
        .filter((item) => {
          // Only single words (no spaces/hyphens)
          if (!/^[a-z]+$/.test(item.word)) return false;
          // Check length if specified
          if (length && item.word.length !== length) return false;
          return true;
        })
        // Remove duplicates
        .filter(
          (item, idx, arr) => arr.findIndex((x) => x.word === item.word) === idx
        )
        // Sort by frequency (highest first), then by score as tiebreaker
        .sort((a, b) => {
          if (b.frequency !== a.frequency) return b.frequency - a.frequency;
          return b.score - a.score;
        });

      const words = wordsWithFreq.map((item) => item.word.toUpperCase());

      console.log(
        "[Datamuse] Top results by frequency:",
        wordsWithFreq
          .slice(0, 5)
          .map((w) => `${w.word}(f:${w.frequency.toFixed(1)})`)
          .join(", ")
      );

      setCache(cacheKey, words);
      return words;
    } catch (error) {
      console.error("[Datamuse] Theme search failed:", error);
      return [];
    }
  }

  /**
   * Get related/similar words (synonyms, related concepts)
   */
  async getRelatedWords(word: string, maxResults = 50): Promise<string[]> {
    const cacheKey = `datamuse:related:${word}`;
    const cached = getCached<string[]>(cacheKey);
    if (cached) return cached;

    try {
      // ml = means like (semantic similarity)
      const response = await fetch(
        `${API_BASE}/words?ml=${encodeURIComponent(word)}&max=${maxResults}`
      );

      if (!response.ok) return [];

      const data: DatamuseWord[] = await response.json();
      const words = data
        .map((item) => item.word.toLowerCase())
        .filter((word) => /^[a-z]+$/.test(word))
        .map((w) => w.toUpperCase());

      setCache(cacheKey, words);
      return words;
    } catch {
      return [];
    }
  }

  /**
   * Get 5-letter cascade word suggestions for a theme
   * Returns words sorted by frequency (most common first)
   */
  async getCascadeWordsForTheme(theme: string): Promise<string[]> {
    // Get theme-related 5-letter words (already sorted by frequency)
    const themeWords = await this.searchByTheme(theme, {
      length: 5,
      maxResults: 50,
    });

    // Theme words are already frequency-sorted, so return them directly
    // Limit to top 25 high-frequency words
    return themeWords.slice(0, 25);
  }
}

export const datamuseApi = new DatamuseService();
