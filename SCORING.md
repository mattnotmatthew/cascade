# CASCADE Scoring System

## Overview

CASCADE uses a two-phase scoring system that rewards both letter discovery and word-guessing risk-taking.

---

## Phase 1: Letter Guessing

### Letter Hit Bonus

- **+125 points** per word containing your guessed letter
- Only counts letters in positions 1+ (the first letter is always revealed as the key letter)
- Maximum 5 words can be hit per letter guess

### Constraints

- **6 letter guesses** maximum
- **2 vowels** maximum (A, E, I, O, U)
- Can skip to word phase early to preserve blanks

### Example

Guessing "R" that appears in 3 words: `3 × 125 = 375 points`

---

## Phase 2: Word Guessing

### Base Scores by Position

| Word | Letters | Base Score | Multiplier |
| ---- | ------- | ---------- | ---------- |
| 1    | 4       | 100        | ×1         |
| 2    | 5       | 200        | ×1.25      |
| 3    | 5       | 200        | ×1.25      |
| 4    | 5       | 200        | ×1.25      |
| 5    | 6       | 300        | ×2         |

### Word Score Formula

```
Score = (base + 125 × blanks) × blanks × multiplier
```

Where:

- **base** = Base score for word position (100/200/300)
- **blanks** = Number of unrevealed letters when guessing
- **multiplier** = Position multiplier (1 / 1.25 / 2)

### Special Cases

**No blanks (all letters revealed):**

```
Score = base
```

**Auto-complete (word revealed through letter guessing):**

```
Score = base + 50
```

### Scoring Examples

#### Word 1 (4 letters, base 100, ×1 multiplier)

| Blanks   | Calculation         | Score |
| -------- | ------------------- | ----- |
| 0        | 100 base            | 100   |
| 0 (auto) | 100 + 50            | 150   |
| 1        | (100 + 125) × 1 × 1 | 225   |
| 2        | (100 + 250) × 2 × 1 | 700   |
| 3        | (100 + 375) × 3 × 1 | 1,425 |

#### Words 2-4 (5 letters, base 200, ×1.25 multiplier)

| Blanks   | Calculation            | Score |
| -------- | ---------------------- | ----- |
| 0        | 200 base               | 200   |
| 0 (auto) | 200 + 50               | 250   |
| 1        | (200 + 125) × 1 × 1.25 | 406   |
| 2        | (200 + 250) × 2 × 1.25 | 1,125 |
| 3        | (200 + 375) × 3 × 1.25 | 2,156 |
| 4        | (200 + 500) × 4 × 1.25 | 3,500 |

#### Word 5 (6 letters, base 300, ×2 multiplier)

| Blanks   | Calculation         | Score |
| -------- | ------------------- | ----- |
| 0        | 300 base            | 300   |
| 0 (auto) | 300 + 50            | 350   |
| 1        | (300 + 125) × 1 × 2 | 850   |
| 2        | (300 + 250) × 2 × 2 | 2,200 |
| 3        | (300 + 375) × 3 × 2 | 4,050 |
| 4        | (300 + 500) × 4 × 2 | 6,400 |
| 5        | (300 + 625) × 5 × 2 | 9,250 |

---

## Cascade Bonus

### Cascade Word

- A hidden 5-letter word is spelled out by letters in a specific row across all 5 columns
- The cascade row is randomly selected (row 1, 2, or 3)

### Bonus

- **+500 points** if all 5 cascade letters are correct (all 5 words guessed correctly)
- **0 points** if any word in the cascade row is incorrect

---

## Scoring Constants Summary

| Constant              | Value | Description                                |
| --------------------- | ----- | ------------------------------------------ |
| `LETTER_HIT_BONUS`    | 125   | Points per word hit during letter phase    |
| `BLANK_BONUS`         | 125   | Added to base per blank before multiplying |
| `AUTO_COMPLETE_BONUS` | 50    | Extra points for auto-completed words      |
| `CASCADE_BONUS`       | 500   | Bonus for completing cascade word          |

---

## Strategy Considerations

### Aggressive (More Letters)

- ✅ More consistent scores
- ✅ Higher cascade completion rate
- ✅ Easier word guessing
- ❌ Lower maximum potential

### Conservative (Fewer Letters)

- ✅ Higher scoring potential
- ✅ Bigger word phase scores
- ❌ Riskier - may miss words entirely
- ❌ Lower cascade completion rate

### Balanced

- Skip to words after 2-4 letter guesses
- Target high-value consonants (R, S, T, N, L)
- Use vowels strategically (max 2)

---

## Score Breakdown Display

The game shows a detailed breakdown at completion:

```
Letter "R" hit     | 3 words × 125           | +375
Letter "S" hit     | 2 words × 125           | +250
Word 1: ROCK       | 100 base (no blanks)    | +100
Word 2: STORY      | (200 + 125×2) × 2 × 1.25| +1,125
Word 3 (auto): SUN | 200 base + 50 auto      | +250
Word 4: SMART      | (200 + 125×1) × 1 × 1.25| +406
Word 5: STREAM     | (300 + 125×3) × 3 × 2   | +4,050
Cascade: ROSES     | All correct!            | +500
─────────────────────────────────────────────────────
TOTAL                                        | 7,056
```
