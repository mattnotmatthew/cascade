# Puzzle Creator Implementation Plan

## Overview

A web-based puzzle creation tool for curating daily CASCADE puzzles. The workflow is **cascade-first**: start with a 5-letter bonus/cascade word, then build the puzzle around it.

---

## Core Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: Choose Cascade Word                                        │
│  ─────────────────────────────────────────────────────────────────  │
│  Enter theme (optional): [animals]                                  │
│  Suggestions: LIONS, TIGER, HORSE, SNAKE, MOUSE, SHEEP...          │
│  Or enter custom: [_____]                                           │
│  Selected: LIONS                                                    │
├─────────────────────────────────────────────────────────────────────┤
│  STEP 2: Choose Seed Word                                           │
│  ─────────────────────────────────────────────────────────────────  │
│  5-letter words starting with L, I, O, N, S:                        │
│  ● LIGHT  ○ IMAGE  ○ OCEAN  ○ NIGHT  ○ STONE                       │
│  Selected: LIGHT                                                    │
├─────────────────────────────────────────────────────────────────────┤
│  STEP 3: Choose Cascade Row                                         │
│  ─────────────────────────────────────────────────────────────────  │
│  ○ Row 1  ● Row 2  ○ Row 3                                         │
│  Selected: Row 2 (cascade letters appear in row 2 of each column)  │
├─────────────────────────────────────────────────────────────────────┤
│  STEP 4: Build Column Words                                         │
│  ─────────────────────────────────────────────────────────────────  │
│  Col 1 (4 letters, starts with L, has I at row 2):                 │
│    Suggestions: LION, LIEN, LIMA, LIKE, LINE...                    │
│    Selected: LION ✓                                                 │
│                                                                     │
│  Col 2 (5 letters, starts with I, has I at row 2):                 │
│    Suggestions: IMAGE, IGLOO (no I at row 2)... filtering...       │
│    Valid: TIMER → wait, starts with I... PIXIE? No...              │
│    [This is where the algorithm finds valid matches]                │
│    Selected: _____                                                  │
│  ...                                                                │
├─────────────────────────────────────────────────────────────────────┤
│  STEP 5: Preview & Validate                                         │
│  ─────────────────────────────────────────────────────────────────  │
│       L   I   G   H   T       ← Seed Word                          │
│      ┌───┬───┬───┬───┬───┐                                         │
│  1   │ L │ I │ G │ H │ T │   (key letters)                         │
│  2   │ I │ M │ L │ O │ R │                                         │
│  3   │ O │ A │ O │ R │ A │   ← Row 2 = LIONS ✓                     │
│  4   │ N │ G │ W │ S │ I │                                         │
│  5   │   │ E │   │ E │ N │                                         │
│  6   │   │   │   │   │ S │                                         │
│      └───┴───┴───┴───┴───┘                                         │
│  Words: LION, IMAGE, GLOW, HORSE, TRAINS                           │
│  Cascade: LIONS (row 2) ✓                                          │
│  All words valid: ✓                                                │
│  No duplicates: ✓                                                  │
├─────────────────────────────────────────────────────────────────────┤
│  STEP 6: Save                                                       │
│  ─────────────────────────────────────────────────────────────────  │
│  Date: [2025-12-15]                                                │
│  [Save Puzzle]  [Export JSON]  [Start Over]                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### File Structure

```
src/
├── pages/
│   └── PuzzleCreator.tsx          # Main creator page
├── components/
│   └── creator/
│       ├── CascadeWordStep.tsx    # Step 1: Choose cascade word
│       ├── SeedWordStep.tsx       # Step 2: Choose seed word
│       ├── CascadeRowStep.tsx     # Step 3: Choose cascade row
│       ├── ColumnWordsStep.tsx    # Step 4: Build column words
│       ├── PuzzlePreview.tsx      # Step 5: Preview grid
│       ├── SavePuzzle.tsx         # Step 6: Save/export
│       └── WordSuggestions.tsx    # Reusable word list component
├── services/
│   └── wordsApi.ts                # WordsAPI integration
├── utils/
│   └── puzzleValidator.ts         # Validation logic
└── types/
    └── creator.ts                 # Creator-specific types
```

### Routes

```tsx
// App.tsx or router config
<Route path="/creator" element={<PuzzleCreator />} />
```

---

## WordsAPI Integration

### API Details

- **Base URL**: `https://wordsapiv1.p.rapidapi.com`
- **Auth**: RapidAPI key (header: `X-RapidAPI-Key`)
- **Rate Limit**: Depends on plan (free tier: 2,500 requests/day)

### Endpoints We'll Use

#### 1. Search by Pattern

```
GET /words/?letterPattern=^l....$ &limit=100
```

Find 5-letter words starting with "L"

#### 2. Search by Theme/Category

```
GET /words/?partOfSpeech=noun&hasDetails=typeOf&limit=100
GET /words/{word}/typeOf
```

Find words that are "types of" a category (e.g., types of animals)

#### 3. Validate Word

```
GET /words/{word}
```

Returns word details if valid, 404 if not

#### 4. Get Related Words

```
GET /words/{word}/similarTo
GET /words/{word}/synonyms
```

For theme expansion

### API Service Design

```typescript
// src/services/wordsApi.ts

interface WordsApiConfig {
  apiKey: string;
  baseUrl: string;
}

interface WordResult {
  word: string;
  definitions?: string[];
  partOfSpeech?: string;
  frequency?: number;
}

class WordsApiService {
  // Find words matching a regex pattern
  async findByPattern(pattern: string, limit?: number): Promise<WordResult[]>;

  // Find words by theme/category
  async findByTheme(theme: string, limit?: number): Promise<WordResult[]>;

  // Validate a single word exists
  async validateWord(word: string): Promise<boolean>;

  // Validate multiple words (batched)
  async validateWords(words: string[]): Promise<Map<string, boolean>>;

  // Get words that are "types of" a category
  async getTypesOf(category: string): Promise<WordResult[]>;

  // Find words with specific letter at position
  async findWithLetterAt(
    letter: string,
    position: number,
    length: number,
    startsWith?: string
  ): Promise<WordResult[]>;
}
```

---

## State Management

### Creator State

```typescript
// src/types/creator.ts

interface PuzzleCreatorState {
  // Step tracking
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;

  // Step 1: Cascade word
  theme: string | null;
  cascadeWord: string | null;
  cascadeWordSuggestions: string[];

  // Step 2: Seed word
  seedWord: string | null;
  seedWordSuggestions: string[];

  // Step 3: Cascade row
  cascadeRow: 1 | 2 | 3;

  // Step 4: Column words
  columnWords: (string | null)[]; // [4-letter, 5, 5, 5, 6-letter]
  columnSuggestions: string[][]; // Suggestions per column

  // Step 5: Validation
  validationResult: ValidationResult | null;

  // Step 6: Save
  puzzleDate: string | null;
  savedPath: string | null;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  type: "invalid_word" | "cascade_mismatch" | "duplicate_puzzle";
  message: string;
  field?: string;
}
```

---

## Algorithm: Finding Valid Column Words

This is the core challenge - finding words that:

1. Start with the correct key letter (from seed word)
2. Have the cascade letter at the correct row position
3. Are the correct length (4, 5, 5, 5, 6)

### Algorithm

```typescript
async function findValidColumnWords(
  keyLetter: string, // e.g., "L" (first letter of seed)
  cascadeLetter: string, // e.g., "I" (from cascade word)
  cascadeRow: number, // e.g., 2 (1-indexed row where cascade letter appears)
  wordLength: number // e.g., 4 (for column 1)
): Promise<string[]> {
  // The cascade letter must be at position (cascadeRow - 1) since row 1 = key letter
  // Wait, let me think about this...

  // Row 0 = key letter (always revealed)
  // Row 1, 2, 3 = subsequent letters
  // If cascadeRow = 2, cascade letter is at index 2 of the word (0-indexed)

  const cascadeIndex = cascadeRow; // Since row 0 is key letter, row 2 = index 2

  // Build regex pattern
  // e.g., keyLetter=L, cascadeIndex=2, cascadeLetter=O, length=4
  // Pattern: L.O. (L at 0, O at 2, any at 1 and 3)

  let pattern = "";
  for (let i = 0; i < wordLength; i++) {
    if (i === 0) pattern += keyLetter;
    else if (i === cascadeIndex) pattern += cascadeLetter;
    else pattern += ".";
  }
  // Result: "L.O." for LION

  // Query WordsAPI with pattern
  const words = await wordsApi.findByPattern(`^${pattern}$`);

  return words.map((w) => w.word.toUpperCase());
}
```

### Optimization: Local Cache + API

To reduce API calls:

1. First check against local word list (existing `words.ts`)
2. Only call API for validation or theme-based search
3. Cache API results in localStorage

---

## UI Components

### Step 1: Cascade Word Selection

```tsx
// CascadeWordStep.tsx
interface Props {
  theme: string;
  onThemeChange: (theme: string) => void;
  suggestions: string[];
  selected: string | null;
  onSelect: (word: string) => void;
  onCustomWord: (word: string) => void;
  isLoading: boolean;
}
```

Features:

- Theme input with autocomplete (animals, food, nature, tech, etc.)
- "Search" button to fetch themed words
- Grid of suggested 5-letter words
- Custom word input with validation
- Selected word highlight

### Step 4: Column Words Builder

```tsx
// ColumnWordsStep.tsx
interface Props {
  seedWord: string;
  cascadeWord: string;
  cascadeRow: number;
  columnWords: (string | null)[];
  suggestions: string[][];
  onSelectWord: (columnIndex: number, word: string) => void;
  onCustomWord: (columnIndex: number, word: string) => void;
}
```

Features:

- 5 columns displayed side-by-side
- Each column shows:
  - Required constraints (starts with X, has Y at row Z, length N)
  - Suggested words
  - Custom input
  - Validation status
- Visual indicator of cascade row alignment

### Step 5: Preview Grid

```tsx
// PuzzlePreview.tsx
interface Props {
  puzzle: CompletePuzzle;
  validationResult: ValidationResult;
  onBack: () => void;
  onSave: () => void;
}
```

Features:

- Visual grid matching game UI
- Cascade row highlighted
- Validation errors/warnings displayed
- Word list with definitions (from API)

---

## Validation Logic

```typescript
// src/utils/puzzleValidator.ts

interface CompletePuzzle {
  seedWord: string;
  cascadeWord: string;
  cascadeRow: number;
  columnWords: string[];
  date?: string;
}

async function validatePuzzle(
  puzzle: CompletePuzzle
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Validate all words exist in dictionary
  const allWords = [puzzle.seedWord, puzzle.cascadeWord, ...puzzle.columnWords];
  const validationMap = await wordsApi.validateWords(allWords);

  for (const [word, isValid] of validationMap) {
    if (!isValid) {
      errors.push({
        type: "invalid_word",
        message: `"${word}" is not a valid dictionary word`,
        field: word,
      });
    }
  }

  // 2. Verify cascade word alignment
  const cascadeFromColumns = puzzle.columnWords
    .map((word, i) => word[puzzle.cascadeRow])
    .join("");

  if (cascadeFromColumns !== puzzle.cascadeWord) {
    errors.push({
      type: "cascade_mismatch",
      message: `Cascade row spells "${cascadeFromColumns}", expected "${puzzle.cascadeWord}"`,
    });
  }

  // 3. Verify column words start with seed letters
  for (let i = 0; i < 5; i++) {
    if (puzzle.columnWords[i][0] !== puzzle.seedWord[i]) {
      errors.push({
        type: "seed_mismatch",
        message: `Column ${i + 1} word "${
          puzzle.columnWords[i]
        }" should start with "${puzzle.seedWord[i]}"`,
      });
    }
  }

  // 4. Verify word lengths
  const expectedLengths = [4, 5, 5, 5, 6];
  for (let i = 0; i < 5; i++) {
    if (puzzle.columnWords[i].length !== expectedLengths[i]) {
      errors.push({
        type: "length_mismatch",
        message: `Column ${i + 1} should be ${
          expectedLengths[i]
        } letters, got ${puzzle.columnWords[i].length}`,
      });
    }
  }

  // 5. Check for duplicate puzzles (compare against saved puzzles)
  const isDuplicate = await checkDuplicatePuzzle(puzzle);
  if (isDuplicate) {
    warnings.push({
      type: "duplicate",
      message: "A similar puzzle already exists",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
```

---

## Puzzle Storage Format

```typescript
// puzzles/2025-12-15.json
{
  "date": "2025-12-15",
  "createdAt": "2025-12-11T14:30:00Z",
  "seedWord": "LIGHT",
  "cascadeWord": "LIONS",
  "cascadeRow": 2,
  "columnWords": [
    { "word": "LION", "length": 4 },
    { "word": "IMAGE", "length": 5 },
    { "word": "GLOW", "length": 5 },
    { "word": "HORSE", "length": 5 },
    { "word": "TRAINS", "length": 6 }
  ],
  "metadata": {
    "theme": "animals",
    "difficulty": "medium"
  }
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (MVP)

- [ ] Set up WordsAPI service with basic endpoints
- [ ] Create `/creator` route with step navigation
- [ ] Implement Step 1: Cascade word input (no theme yet, just manual entry)
- [ ] Implement Step 2: Seed word selection from cascade letters
- [ ] Implement Step 3: Cascade row selection
- [ ] Implement Step 4: Column word builder with local word list
- [ ] Implement Step 5: Preview grid
- [ ] Implement Step 6: Save to JSON file

### Phase 2: WordsAPI Integration

- [ ] Integrate theme-based word search
- [ ] Add word suggestions from API
- [ ] Implement word validation via API
- [ ] Add caching layer for API responses

### Phase 3: Polish & UX

- [ ] Add loading states
- [ ] Improve suggestion algorithms
- [ ] Add keyboard navigation
- [ ] Add "similar puzzles" warning
- [ ] Add difficulty estimation

### Phase 4: Advanced Features

- [ ] Bulk puzzle generation
- [ ] Puzzle queue management
- [ ] Analytics on word difficulty
- [ ] Import/export puzzle packs

---

## Environment Setup

### Required Environment Variables

```env
# .env.local
VITE_WORDS_API_KEY=your_rapidapi_key_here
VITE_WORDS_API_HOST=wordsapiv1.p.rapidapi.com
```

### API Key Setup

1. Sign up at [RapidAPI](https://rapidapi.com)
2. Subscribe to [WordsAPI](https://rapidapi.com/dpventures/api/wordsapi)
3. Copy API key to `.env.local`

---

## Open Questions

1. **Local-first or API-first?**

   - Should we prioritize local word list for speed, using API only for validation/themes?
   - Or go API-first for better word coverage?

2. **Puzzle storage location?**

   - `public/puzzles/` folder (static, requires rebuild)?
   - Separate API/backend?
   - LocalStorage for now, export to file?

3. **Authentication for creator?**
   - Password-protected route?
   - Just rely on it being a dev tool for now?

---

## Next Steps

1. Get WordsAPI key and test basic endpoints
2. Create the route and step navigation shell
3. Build out each step component
4. Integrate with existing word validation
5. Add save/export functionality
