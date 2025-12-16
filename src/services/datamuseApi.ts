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

  /**
   * Find words matching a pattern using Datamuse's spelled-like (sp) parameter
   * Pattern format: use ? for any letter
   * Examples:
   *   - "s?o?" → 4-letter words starting with S, O at position 2
   *   - "to???" → 5-letter words starting with TO
   *   - "m??n??" → 6-letter words starting with M, N at position 3
   */
  async findWordsByPattern(
    pattern: string,
    maxResults = 100
  ): Promise<string[]> {
    const cacheKey = `datamuse:pattern:${pattern}`;
    const cached = getCached<string[]>(cacheKey);
    if (cached) {
      console.log("[Datamuse] Cache hit for pattern:", pattern);
      return cached;
    }

    try {
      console.log("[Datamuse] Fetching pattern:", pattern);
      const params = new URLSearchParams({
        sp: pattern,
        max: String(maxResults),
        md: "f", // Include frequency metadata
      });

      const response = await fetch(`${API_BASE}/words?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Datamuse error: ${response.status}`);
      }

      const data: DatamuseWord[] = await response.json();

      // Filter to exact length match and sort by frequency
      const expectedLength = pattern.length;
      const wordsWithFreq = data
        .map((item) => ({
          word: item.word.toLowerCase(),
          frequency: extractFrequency(item.tags),
        }))
        .filter((item) => {
          // Only single words matching exact length
          if (!/^[a-z]+$/.test(item.word)) return false;
          if (item.word.length !== expectedLength) return false;
          return true;
        })
        .sort((a, b) => b.frequency - a.frequency);

      const words = wordsWithFreq.map((item) => item.word.toUpperCase());

      console.log(
        `[Datamuse] Pattern "${pattern}" returned ${words.length} words`
      );

      setCache(cacheKey, words);
      return words;
    } catch (error) {
      console.error("[Datamuse] Pattern search failed:", error);
      return [];
    }
  }

  /**
   * Build a pattern for finding column words
   * @param seedLetter - First letter of the word (from seed word)
   * @param cascadeLetter - Letter that must appear at cascadeRow position
   * @param cascadeRow - Row position (1, 2, or 3) where cascade letter appears
   * @param wordLength - Total word length (4, 5, or 6)
   */
  buildColumnPattern(
    seedLetter: string,
    cascadeLetter: string,
    cascadeRow: 1 | 2 | 3,
    wordLength: number
  ): string {
    // Build pattern like "s?o?" for seedLetter=S, cascadeLetter=O, row=2, length=4
    let pattern = "";
    for (let i = 0; i < wordLength; i++) {
      if (i === 0) {
        pattern += seedLetter.toLowerCase();
      } else if (i === cascadeRow) {
        pattern += cascadeLetter.toLowerCase();
      } else {
        pattern += "?";
      }
    }
    return pattern;
  }

  /**
   * Get all valid column words for a specific column configuration
   */
  async getColumnWords(
    seedLetter: string,
    cascadeLetter: string,
    cascadeRow: 1 | 2 | 3,
    wordLength: number
  ): Promise<string[]> {
    const pattern = this.buildColumnPattern(
      seedLetter,
      cascadeLetter,
      cascadeRow,
      wordLength
    );
    return this.findWordsByPattern(pattern);
  }
}

export const datamuseApi = new DatamuseService();
