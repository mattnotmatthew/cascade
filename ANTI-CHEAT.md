# CASCADE Anti-Cheat Options

## Overview

This document outlines potential cheating vectors and countermeasures for the CASCADE word puzzle game.

**Status:** With Supabase integration, most cheating vectors are addressed at the database level.

---

## Cheating Vectors & Status

### 1. Page Refresh / Restart

**The Problem:** Player refreshes the page to restart the puzzle after seeing some letters or making wrong guesses.

**Status:** PARTIAL - Hybrid approach recommended

**Solution:**
- Use localStorage for in-progress game state (simpler, faster)
- Supabase records when a game is started and completed
- On page load, check localStorage first, then verify against Supabase

**Why hybrid:** Writing every move to Supabase adds latency and API calls. localStorage handles mid-game state; Supabase enforces the one-attempt rule.

---

### 2. Multiple Attempts

**The Problem:** Player completes the puzzle, doesn't like their score, clears localStorage, and tries again.

**Status:** SOLVED by Supabase

**Solution:** `UNIQUE(user_id, puzzle_date)` constraint in the `daily_attempts` table. The database physically cannot accept a second attempt for the same user on the same day.

---

### 3. Incognito / Clear Storage

**The Problem:** Player uses incognito mode or clears browser storage to bypass localStorage checks.

**Status:** SOLVED by Supabase

**Solution:** User accounts. The restriction is tied to authenticated `user_id`, not browser storage. Same account = same restriction regardless of device or browser mode.

---

### 4. Inspecting Network/Source for Answers

**The Problem:** Puzzle JSON files are publicly accessible at `/puzzles/YYYY-MM-DD.json`. A player can simply fetch the file and see all answers.

**Status:** SOLVED by Supabase puzzles table

**Solution:** Puzzles stored in Supabase `puzzles` table with Row Level Security:
- RLS policy: `puzzle_date <= CURRENT_DATE`
- Future puzzles are completely hidden
- No public URL to inspect

**Note:** Players can still see today's answers if they inspect the network response, but they can only use that knowledge once (one attempt per day). This is an acceptable trade-off.

---

### 5. Manipulating localStorage Scores

**The Problem:** Player opens DevTools, modifies their score in localStorage, claims a high score.

**Status:** MOSTLY SOLVED by Supabase

**Solution:** Scores are stored in Supabase `daily_attempts` table, not just localStorage. The leaderboard reads from the database.

**Remaining gap:** Client still calculates and submits the score. A determined cheater could submit a fake score (once). The optional Edge Function (Step 5 in SUPABASE_SETUP.md) would fully close this gap by recalculating scores server-side.

---

### 6. Console/DevTools Manipulation

**The Problem:** Player opens console, directly calls game functions like `guessWord()`, or modifies the `puzzle` object in memory.

**Status:** MOSTLY SOLVED by Supabase

**Solution:** Same as #5 - scores go to the database. Manipulating local state doesn't affect the leaderboard unless they submit.

**Remaining gap:** Same as #5 - client submits the score. Edge Function would fully solve.

---

## Implementation Status

| Measure | Status | Notes |
|---------|--------|-------|
| User accounts | Supabase Auth | Required for all protections |
| One attempt per day | Database constraint | `UNIQUE(user_id, puzzle_date)` |
| Server-side leaderboard | Supabase views | `daily_leaderboard`, `alltime_leaderboard` |
| Puzzle storage in DB | Documented | `puzzles` table with RLS - hides future puzzles |
| Server-side scoring | Optional | Edge Function for full cheat-proofing |
| localStorage for UX | Still needed | Mid-game state persistence |

---

## Honest Assessment

With Supabase:
- **One attempt per day is bulletproof** (database-enforced)
- **Incognito/clear storage is irrelevant** (tied to user account)
- **Leaderboards are server-authoritative** (can't fake localStorage scores)
- **Viewing future answers is blocked** (puzzles table with RLS)
- **Submitting fake scores is possible once** (without Edge Function)

For a casual daily puzzle game, this is more than sufficient. The Edge Function is optional for full cheat-proofing if needed later.

---

## Implementation Checklist

- [x] User accounts (Supabase Auth)
- [x] One attempt per day (database constraint)
- [x] Server-side leaderboards (Supabase views)
- [x] Store puzzles in Supabase (hides future answers via RLS)
- [ ] localStorage for in-progress game state
- [ ] Server-side score validation (Edge Function - optional)
