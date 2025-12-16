// Curated theme pairs for bulk puzzle creation
// Each theme has 3-5 cascade/seed word pairs that work well together

import type { ThemeDefinition } from "../types/creator";

export const THEME_LIBRARY: ThemeDefinition[] = [
  {
    id: "ocean",
    name: "Ocean Life",
    icon: "🌊",
    pairs: [
      { cascadeWord: "WHALE", seedWord: "WAVES", description: "Marine giants" },
      { cascadeWord: "CORAL", seedWord: "COAST" },
      { cascadeWord: "SHARK", seedWord: "SHORE" },
      { cascadeWord: "TIDAL", seedWord: "SALTY" },
    ],
  },
  {
    id: "space",
    name: "Space Explorer",
    icon: "🚀",
    pairs: [
      { cascadeWord: "ORBIT", seedWord: "OUTER" },
      { cascadeWord: "COMET", seedWord: "CRASH" },
      { cascadeWord: "LUNAR", seedWord: "LIGHT" },
      { cascadeWord: "SOLAR", seedWord: "STARS" },
      { cascadeWord: "NEBULA", seedWord: "NIGHT" },
    ],
  },
  {
    id: "nature",
    name: "Nature Trails",
    icon: "🌲",
    pairs: [
      { cascadeWord: "FLORA", seedWord: "FRESH" },
      { cascadeWord: "RIVER", seedWord: "ROCKS" },
      { cascadeWord: "MAPLE", seedWord: "MOSSY" },
      { cascadeWord: "FERNS", seedWord: "FIELD" },
    ],
  },
  {
    id: "cooking",
    name: "Kitchen Magic",
    icon: "🍳",
    pairs: [
      { cascadeWord: "ROAST", seedWord: "READY" },
      { cascadeWord: "GRILL", seedWord: "GRAVY" },
      { cascadeWord: "STEAM", seedWord: "SAUCE" },
      { cascadeWord: "BAKED", seedWord: "BREAD" },
    ],
  },
  {
    id: "music",
    name: "Musical Notes",
    icon: "🎵",
    pairs: [
      { cascadeWord: "CHORD", seedWord: "CHANT" },
      { cascadeWord: "PIANO", seedWord: "PITCH" },
      { cascadeWord: "TEMPO", seedWord: "TONES" },
      { cascadeWord: "BEATS", seedWord: "BRASS" },
    ],
  },
  {
    id: "sports",
    name: "Game Day",
    icon: "⚽",
    pairs: [
      { cascadeWord: "SCORE", seedWord: "SPEED" },
      { cascadeWord: "PITCH", seedWord: "POWER" },
      { cascadeWord: "MATCH", seedWord: "MEDAL" },
      { cascadeWord: "COACH", seedWord: "CLIMB" },
    ],
  },
  {
    id: "weather",
    name: "Weather Watch",
    icon: "🌤️",
    pairs: [
      { cascadeWord: "STORM", seedWord: "SUNNY" },
      { cascadeWord: "FROST", seedWord: "FOGGY" },
      { cascadeWord: "WINDS", seedWord: "WISPY" },
      { cascadeWord: "CLOUD", seedWord: "CLEAR" },
    ],
  },
  {
    id: "travel",
    name: "World Travel",
    icon: "✈️",
    pairs: [
      { cascadeWord: "HOTEL", seedWord: "HITCH" },
      { cascadeWord: "TOURS", seedWord: "TRAIN" },
      { cascadeWord: "JETTY", seedWord: "JAUNT" },
      { cascadeWord: "BEACH", seedWord: "BOUND" },
    ],
  },
  {
    id: "tech",
    name: "Digital World",
    icon: "💻",
    pairs: [
      { cascadeWord: "CYBER", seedWord: "CLOUD" },
      { cascadeWord: "PIXEL", seedWord: "PRINT" },
      { cascadeWord: "BYTES", seedWord: "BLOCK" },
      { cascadeWord: "SMART", seedWord: "SPEED" },
    ],
  },
  {
    id: "animals",
    name: "Animal Kingdom",
    icon: "🦁",
    pairs: [
      { cascadeWord: "TIGER", seedWord: "TRAIL" },
      { cascadeWord: "EAGLE", seedWord: "EARTHY" },
      { cascadeWord: "HORSE", seedWord: "HOUND" },
      { cascadeWord: "BEARS", seedWord: "BIRDS" },
    ],
  },
  {
    id: "arts",
    name: "Creative Arts",
    icon: "🎨",
    pairs: [
      { cascadeWord: "PAINT", seedWord: "PASTY" },
      { cascadeWord: "CRAFT", seedWord: "CRISP" },
      { cascadeWord: "BRUSH", seedWord: "BLEND" },
      { cascadeWord: "SHADE", seedWord: "SHAPE" },
    ],
  },
  {
    id: "garden",
    name: "Garden Dreams",
    icon: "🌻",
    pairs: [
      { cascadeWord: "BLOOM", seedWord: "BRISK" },
      { cascadeWord: "PETAL", seedWord: "PLANT" },
      { cascadeWord: "ROOTS", seedWord: "RUSTY" },
      { cascadeWord: "HERBS", seedWord: "HEDGE" },
    ],
  },
];

/**
 * Get a random theme pair from a specific theme
 */
export function getRandomPairFromTheme(themeId: string): ThemeDefinition["pairs"][0] | null {
  const theme = THEME_LIBRARY.find((t) => t.id === themeId);
  if (!theme) return null;
  return theme.pairs[Math.floor(Math.random() * theme.pairs.length)];
}

/**
 * Get a random theme pair from any theme
 */
export function getRandomPair(): { theme: ThemeDefinition; pair: ThemeDefinition["pairs"][0] } {
  const theme = THEME_LIBRARY[Math.floor(Math.random() * THEME_LIBRARY.length)];
  const pair = theme.pairs[Math.floor(Math.random() * theme.pairs.length)];
  return { theme, pair };
}

/**
 * Get multiple unique random pairs (for bulk creation)
 */
export function getRandomPairs(count: number): Array<{ theme: ThemeDefinition; pair: ThemeDefinition["pairs"][0] }> {
  const allPairs: Array<{ theme: ThemeDefinition; pair: ThemeDefinition["pairs"][0] }> = [];

  // Collect all pairs with their theme
  for (const theme of THEME_LIBRARY) {
    for (const pair of theme.pairs) {
      allPairs.push({ theme, pair });
    }
  }

  // Shuffle and take count
  const shuffled = allPairs.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
