# CASCADE Game Balance Simulation Plan

## Objective

Build a Monte Carlo simulation to analyze gameplay balance between letter guessing and word guessing phases, helping tune scoring parameters for optimal risk/reward decisions.

---

## Current Game Configuration (as of implementation)

### Scoring Parameters

- **Letter Hit Bonus:** 125 pts per word containing the guessed letter (positions 1+ only, excludes key letter)
- **Max Letter Guesses:** 6
- **Max Vowels:** 2
- **Cascade/Bonus Word:** +500 pts (flat bonus if all cascade row letters correct)

### Word Scoring (Additive Multiplier - Balatro style)

| Position | Letters | Base Score | Multiplier | Formula                            |
| -------- | ------- | ---------- | ---------- | ---------------------------------- |
| 1        | 4       | 100        | ×1         | `base × (mult × blanks)`, min base |
| 2-4      | 5       | 200        | ×1.25      | `base × (mult × blanks)`, min base |
| 5        | 6       | 300        | ×2         | `base × (mult × blanks)`, min base |

**Examples (Word 2, 5-letter, base 200, ×1.25):**

- 0 blanks: 200 (base only)
- 1 blank: 200 × 1.25 = 250
- 2 blanks: 200 × 2.50 = 500
- 3 blanks: 200 × 3.75 = 750
- 4 blanks: 200 × 5.00 = 1000

### Game Structure

- 5-letter seed/key word (top row)
- 5 columns: 4, 5, 5, 5, 6 letters
- Cascade word: 5-letter word across row (one letter per column)
- Auto-complete: Words fully revealed during letter phase get base score only

---

## Simulation Architecture

### File Structure

```
src/simulation/
├── index.ts           # Main entry point, runs simulations
├── strategies.ts      # Different player strategy implementations
├── simulator.ts       # Core simulation engine
├── analytics.ts       # Statistical analysis and reporting
└── types.ts           # Simulation-specific types
```

### Core Components

#### 1. Strategy Profiles (`strategies.ts`)

```typescript
interface Strategy {
  name: string;
  description: string;
  selectLetter: (gameState: SimGameState) => string | null; // null = skip to words
  guessWord: (word: PartialWord, difficulty: number) => string | null;
}
```

**Strategies to Implement:**

| Strategy       | Letters Guessed           | Letter Selection                 | Description                     |
| -------------- | ------------------------- | -------------------------------- | ------------------------------- |
| `aggressive`   | 6 (max)                   | Common letters (E,A,R,T,O,I,N,S) | Maximize letter phase points    |
| `conservative` | 2 (min)                   | Top 2 common letters             | Skip early for word multipliers |
| `moderate`     | 3-4                       | Common letters, then evaluate    | Balanced approach               |
| `vowel-heavy`  | 2 vowels + 2-4 consonants | Prioritize vowels                | Test vowel limit impact         |
| `random`       | Random 2-6                | Random selection                 | Baseline/control                |
| `adaptive`     | Varies                    | Stop when hit rate drops         | Smart stopping                  |

#### 2. Simulation Engine (`simulator.ts`)

```typescript
interface SimulationConfig {
  iterations: number; // Number of games to simulate (10,000+)
  strategy: Strategy;
  wordGuessAccuracy: number; // 0-1, probability of correct word guess given revealed letters
  verboseLogging: boolean;
}

interface SimGameState {
  puzzle: Puzzle;
  letterPhaseScore: number;
  wordPhaseScore: number;
  lettersGuessed: string[];
  wordsGuessed: number;
  wordsCorrect: number;
}
```

**Simulation Flow:**

1. Generate puzzle using actual `generatePuzzle()` function
2. Execute strategy's letter selection until skip or max guesses
3. Calculate letter phase score (actual hits × 125)
4. Simulate word guessing with configurable accuracy
5. Calculate word phase score with multipliers
6. Record all metrics

#### 3. Word Guess Accuracy Model

Model player's ability to guess words based on revealed information:

```typescript
function calculateGuessAccuracy(
  wordLength: number,
  revealedCount: number,
  isCommonWord: boolean
): number {
  // Base accuracy increases with more revealed letters
  const revealRatio = revealedCount / wordLength;

  // Thresholds:
  // 0-25% revealed: 10-20% accuracy (mostly guessing)
  // 25-50% revealed: 30-50% accuracy
  // 50-75% revealed: 60-80% accuracy
  // 75-100% revealed: 85-95% accuracy

  return baseAccuracy * (isCommonWord ? 1.2 : 1.0);
}
```

#### 4. Analytics & Reporting (`analytics.ts`)

**Metrics to Track:**

| Metric                 | Description                                 |
| ---------------------- | ------------------------------------------- |
| `avgTotalScore`        | Average final score                         |
| `avgLetterPhaseScore`  | Points from letter hits                     |
| `avgWordPhaseScore`    | Points from word guesses                    |
| `scoreStdDev`          | Score variance/consistency                  |
| `avgLettersGuessed`    | How many letters used                       |
| `avgLetterHitRate`     | Hits per letter guessed                     |
| `avgWordsCorrect`      | Words guessed correctly                     |
| `avgBlanksAtWordPhase` | Unrevealed letters when entering word phase |
| `scoreDistribution`    | Histogram of scores                         |
| `strategyComparison`   | Side-by-side strategy results               |

**Output Format:**

```
=== CASCADE SIMULATION RESULTS ===
Iterations: 10,000 per strategy
Word Guess Accuracy Model: Standard (skill-based)

STRATEGY COMPARISON
┌─────────────┬───────────┬────────────┬────────────┬──────────┬───────────┐
│ Strategy    │ Avg Score │ Letter Pts │ Word Pts   │ Std Dev  │ Words Got │
├─────────────┼───────────┼────────────┼────────────┼──────────┼───────────┤
│ aggressive  │ 4,125     │ 2,850      │ 1,275      │ 450      │ 5.2/6     │
│ conservative│ 3,890     │ 875        │ 3,015      │ 890      │ 4.1/6     │
│ moderate    │ 4,050     │ 1,650      │ 2,400      │ 620      │ 4.8/6     │
│ adaptive    │ 4,280     │ 1,920      │ 2,360      │ 540      │ 5.0/6     │
└─────────────┴───────────┴────────────┴────────────┴──────────┴───────────┘

KEY INSIGHTS:
- Aggressive strategy has lowest variance (safer)
- Conservative strategy has highest ceiling but more risk
- Sweet spot appears to be 3-4 letter guesses
```

---

## Letter Frequency Analysis

Pre-compute letter frequencies from actual word lists:

```typescript
interface LetterStats {
  letter: string;
  frequency: number; // How often it appears in word list
  avgWordsContaining: number; // Expected words containing letter in a puzzle
  expectedHitBonus: number; // avgWordsContaining × 125
}

// Example output:
// E: appears in 68% of words, ~4.1 words/puzzle, expected +512 pts
// A: appears in 52% of words, ~3.1 words/puzzle, expected +387 pts
// Z: appears in 2% of words, ~0.1 words/puzzle, expected +12 pts
```

---

## Configuration Parameters to Test

Run simulations with different scoring configs to find balance:

| Parameter          | Current     | Test Range                 |
| ------------------ | ----------- | -------------------------- |
| `LETTER_HIT_BONUS` | 125         | 50, 75, 100, 125, 150, 200 |
| `BASE_SCORES`      | 100/200/300 | Various combinations       |
| `MULTIPLIERS`      | 1/1.25/2    | 0.5-3.0 range              |
| `MAX_VOWELS`       | 2           | 1, 2, 3                    |
| `MAX_LETTERS`      | 6           | 4, 5, 6, 7                 |

---

## Implementation Steps

### Phase 1: Core Infrastructure

1. [ ] Create simulation directory structure
2. [ ] Define TypeScript interfaces
3. [ ] Build letter frequency analyzer from word lists
4. [ ] Create basic simulation loop

### Phase 2: Strategies

5. [ ] Implement `aggressive` strategy
6. [ ] Implement `conservative` strategy
7. [ ] Implement `moderate` strategy
8. [ ] Implement `adaptive` strategy
9. [ ] Implement word guess accuracy model

### Phase 3: Analytics

10. [ ] Build metrics collection
11. [ ] Create comparison reports
12. [ ] Generate score distribution histograms
13. [ ] Export results to JSON/CSV

### Phase 4: Parameter Tuning

14. [ ] Run baseline simulations
15. [ ] Test different `LETTER_HIT_BONUS` values
16. [ ] Test different multiplier values
17. [ ] Document optimal configuration

---

## Running the Simulation

```bash
# Run all strategies with default config
npx ts-node src/simulation/index.ts

# Run specific strategy
npx ts-node src/simulation/index.ts --strategy aggressive

# Run with custom iterations
npx ts-node src/simulation/index.ts --iterations 50000

# Test different scoring params
npx ts-node src/simulation/index.ts --letter-bonus 100

# Export results
npx ts-node src/simulation/index.ts --output results.json
```

---

## Success Criteria

The scoring is balanced when:

1. **No dominant strategy** - Multiple approaches are viable
2. **Meaningful decisions** - Player choices significantly impact outcome
3. **Reasonable variance** - Skill matters more than luck
4. **Score ranges** - Typical scores fall in satisfying range (2,000-6,000?)
5. **Risk/reward tradeoff** - Conservative = consistent, Aggressive = high variance

---

## Notes

- Simulation uses actual word lists from `src/data/words.ts`
- Word guess accuracy is the hardest variable to model - may need real player data
- Consider A/B testing with real users after simulation tuning
