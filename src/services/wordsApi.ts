// WordsAPI service for puzzle creator
// API Docs: https://www.wordsapi.com/docs

const API_BASE = "https://wordsapiv1.p.rapidapi.com";

// Rate limiting: free tier is 2,500 requests/day
// We'll add delays between requests to be safe
const REQUEST_DELAY_MS = 500; // 500ms between requests
let lastRequestTime = 0;

interface WordsApiConfig {
  apiKey: string;
  apiHost: string;
}

export interface WordResult {
  word: string;
  frequency?: number;
  definitions?: Array<{
    definition: string;
    partOfSpeech: string;
  }>;
}

interface WordsApiResponse {
  word: string;
  results?: Array<{
    definition: string;
    partOfSpeech: string;
    synonyms?: string[];
    typeOf?: string[];
  }>;
  frequency?: number;
}

interface SearchResponse {
  results: {
    total: number;
    data: string[];
  };
}

// Simple in-memory cache to reduce API calls
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

// Rate limiting helper
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_DELAY_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, REQUEST_DELAY_MS - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();
}

class WordsApiService {
  private config: WordsApiConfig;

  constructor() {
    this.config = {
      apiKey: import.meta.env.VITE_WORDS_API_KEY || "",
      apiHost: "wordsapiv1.p.rapidapi.com",
    };
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    if (!this.config.apiKey) {
      throw new Error(
        "WordsAPI key not configured. Add VITE_WORDS_API_KEY to .env.local"
      );
    }

    const cacheKey = endpoint;
    const cached = getCached<T>(cacheKey);
    if (cached) {
      console.log(`[WordsAPI] Cache hit: ${endpoint}`);
      return cached;
    }

    // Wait for rate limit before making request
    await waitForRateLimit();

    console.log(`[WordsAPI] Fetching: ${endpoint}`);

    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "X-RapidAPI-Key": this.config.apiKey,
        "X-RapidAPI-Host": this.config.apiHost,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Word not found");
      }
      if (response.status === 403) {
        throw new Error(
          "API key invalid or not authorized. Check your RapidAPI key."
        );
      }
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please wait and try again.");
      }
      throw new Error(`WordsAPI error: ${response.status}`);
    }

    const data = await response.json();
    setCache(cacheKey, data);
    return data as T;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Validate a single word exists in the dictionary
   */
  async validateWord(word: string): Promise<boolean> {
    try {
      await this.fetch<WordsApiResponse>(`/words/${word.toLowerCase()}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get word details including definitions
   */
  async getWordDetails(word: string): Promise<WordResult | null> {
    try {
      const data = await this.fetch<WordsApiResponse>(
        `/words/${word.toLowerCase()}`
      );
      return {
        word: data.word,
        frequency: data.frequency,
        definitions: data.results?.map((r) => ({
          definition: r.definition,
          partOfSpeech: r.partOfSpeech,
        })),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get frequency score for a word (higher = more common, typically 1-7 range)
   */
  async getWordFrequency(word: string): Promise<number> {
    try {
      const data = await this.fetch<{
        word: string;
        frequency: { zipf: number };
      }>(`/words/${word.toLowerCase()}/frequency`);
      return data.frequency?.zipf || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get frequencies for multiple words (with rate limiting)
   * Returns map of word -> frequency score
   */
  async getWordFrequencies(words: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();

    // Process sequentially to respect rate limits
    for (const word of words) {
      const freq = await this.getWordFrequency(word);
      results.set(word.toUpperCase(), freq);
    }

    return results;
  }

  /**
   * Search for words matching a letter pattern using regex
   * WordsAPI uses regex format: ^a.{4}$ for 5-letter words starting with 'a'
   * @param pattern - Regex pattern (e.g., "^l.o.$" for 4-letter words starting with l, o at position 3)
   */
  async searchByPattern(pattern: string, limit = 100): Promise<string[]> {
    try {
      const data = await this.fetch<SearchResponse>(
        `/words/?letterPattern=${encodeURIComponent(pattern)}&limit=${limit}`
      );
      return data.results?.data || [];
    } catch (error) {
      console.error("[WordsAPI] Pattern search failed:", error);
      return [];
    }
  }

  /**
   * Search for words with a specific letter at a specific position
   * @param startsWith - First letter (required)
   * @param letterAtPos - Letter that must appear at a position
   * @param position - 0-indexed position for letterAtPos (1, 2, or 3 for cascade row)
   * @param length - Word length
   */
  async findWordsWithConstraints(
    startsWith: string,
    letterAtPos: string,
    position: number,
    length: number
  ): Promise<string[]> {
    // Build regex pattern: e.g., startsWith=L, letterAtPos=O, position=2, length=4
    // Result: "^l.o.$" (start with l, any char, o, any char, end)
    let pattern = "^";
    for (let i = 0; i < length; i++) {
      if (i === 0) {
        pattern += startsWith.toLowerCase();
      } else if (i === position) {
        pattern += letterAtPos.toLowerCase();
      } else {
        pattern += ".";
      }
    }
    pattern += "$";

    return this.searchByPattern(pattern);
  }

  /**
   * Search words by theme using "typeOf" relationship
   * Example: theme="animal" finds words that are types of animals
   */
  async searchByTheme(theme: string, limit = 50): Promise<string[]> {
    try {
      // First, get what the theme word encompasses
      const data = await this.fetch<{ hasTypes?: string[] }>(
        `/words/${theme.toLowerCase()}/hasTypes`
      );

      // Filter to 5-letter words for cascade words
      const fiveLetterWords = (data.hasTypes || [])
        .filter((w) => w.length === 5)
        .slice(0, limit);

      return fiveLetterWords;
    } catch (error) {
      console.error("[WordsAPI] Theme search failed:", error);
      return [];
    }
  }

  /**
   * Get similar words (for expanding theme ideas)
   */
  async getSimilarWords(word: string): Promise<string[]> {
    try {
      const data = await this.fetch<{ similarTo?: string[] }>(
        `/words/${word.toLowerCase()}/similarTo`
      );
      return data.similarTo || [];
    } catch {
      return [];
    }
  }

  /**
   * Search words using regex pattern directly
   * Pattern should be valid regex, e.g., "^l..o.$" for 5-letter words starting with l, o at position 4
   */
  async searchByRegex(pattern: string, limit = 100): Promise<string[]> {
    return this.searchByPattern(pattern, limit);
  }

  /**
   * Batch validate multiple words
   * Returns map of word -> isValid
   */
  async validateWords(words: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // Process in parallel with small batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      const validations = await Promise.all(
        batch.map(async (word) => ({
          word,
          valid: await this.validateWord(word),
        }))
      );
      validations.forEach(({ word, valid }) => results.set(word, valid));
    }

    return results;
  }

  /**
   * Find 5-letter words that start with specific letters (for seed word suggestions)
   * Uses a single API call with alternation to avoid rate limiting
   */
  async findSeedWordCandidates(cascadeWord: string): Promise<string[]> {
    // Get unique letters from cascade word
    const uniqueLetters = [...new Set(cascadeWord.toLowerCase().split(""))];

    // Build a single regex pattern with alternation: ^[phone].{4}$
    // This finds all 5-letter words starting with any of these letters in one call
    const letterClass = uniqueLetters.join("");
    const pattern = `^[${letterClass}].{4}$`;

    try {
      const words = await this.searchByPattern(pattern, 100);

      // Filter to exactly 5 letters and uppercase
      return words.filter((w) => w.length === 5).map((w) => w.toUpperCase());
    } catch (error) {
      console.error("[WordsAPI] Seed word search failed:", error);
      return [];
    }
  }
}

// Export singleton instance
export const wordsApi = new WordsApiService();
