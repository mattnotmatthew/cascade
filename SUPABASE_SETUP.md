# CASCADE - Supabase Setup Guide

This guide walks through setting up Supabase as the backend for CASCADE to enable:
- User accounts
- One puzzle attempt per day per user
- Global leaderboards
- Server-side score validation

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/log in
2. Click **"New Project"**
3. Fill in:
   - **Name:** `cascade` (or whatever you prefer)
   - **Database Password:** Generate a strong one and save it somewhere secure
   - **Region:** Choose closest to your users
4. Click **"Create new project"** and wait ~2 minutes for provisioning

---

## Step 2: Get Your API Keys

Once the project is ready:

1. Go to **Settings** → **API** (in the left sidebar)
2. Note down these values (you'll need them for the React app):
   - **Project URL:** `https://xxxxxxxxxxxx.supabase.co`
   - **anon/public key:** `eyJhbG...` (safe to expose in frontend)
   - **service_role key:** Keep this SECRET (only for server-side operations)

---

## Step 3: Set Up Authentication

### Enable Auth Providers

1. Go to **Authentication** → **Providers**
2. Enable the providers you want:

| Provider | Recommended | Notes |
|----------|-------------|-------|
| Email | Yes | Basic email/password signup |
| Google | Yes | Easy social login, most users have Google |
| Anonymous | Optional | Let users play without signup, convert later |

### Configure Email Auth (if using)

1. Go to **Authentication** → **Email Templates**
2. Customize the confirmation email if desired
3. Go to **Authentication** → **URL Configuration**
4. Set **Site URL** to your production URL (e.g., `https://cascade.yourdomain.com`)
5. Add localhost to **Redirect URLs** for development: `http://localhost:5173`

### Configure Google Auth (if using)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Set application type to **Web application**
6. Add authorized redirect URI: `https://xxxxxxxxxxxx.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**
8. Back in Supabase, go to **Authentication** → **Providers** → **Google**
9. Paste the Client ID and Client Secret
10. Enable the provider

---

## Step 4: Create Database Tables

Go to **SQL Editor** in Supabase and run the following SQL:

### User Profiles Table

```sql
-- Extends Supabase auth.users with game-specific profile data
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles (for leaderboard display names)
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Player'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Daily Attempts Table

```sql
-- Tracks each user's daily puzzle attempt
CREATE TABLE public.daily_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  puzzle_date DATE NOT NULL,

  -- Game state
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Results (null until completed)
  score INTEGER,
  words_correct INTEGER,
  cascade_awarded BOOLEAN DEFAULT FALSE,

  -- Move history for validation
  move_history JSONB,

  -- Ensure one attempt per user per day
  UNIQUE(user_id, puzzle_date)
);

-- Enable RLS
ALTER TABLE public.daily_attempts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own attempts
CREATE POLICY "Users can view own attempts"
  ON public.daily_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own attempts
CREATE POLICY "Users can create own attempts"
  ON public.daily_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own incomplete attempts
CREATE POLICY "Users can update own incomplete attempts"
  ON public.daily_attempts FOR UPDATE
  USING (auth.uid() = user_id AND completed_at IS NULL);

-- Create index for fast lookups
CREATE INDEX idx_daily_attempts_user_date
  ON public.daily_attempts(user_id, puzzle_date);

CREATE INDEX idx_daily_attempts_leaderboard
  ON public.daily_attempts(puzzle_date, score DESC)
  WHERE completed_at IS NOT NULL;
```

### Daily Leaderboard View

```sql
-- View for daily leaderboard (rankings for a specific puzzle date)
CREATE OR REPLACE VIEW public.daily_leaderboard AS
SELECT
  da.puzzle_date,
  da.user_id,
  p.display_name,
  p.username,
  da.score,
  da.words_correct,
  da.cascade_awarded,
  da.completed_at,
  RANK() OVER (
    PARTITION BY da.puzzle_date
    ORDER BY da.score DESC, da.completed_at ASC
  ) as rank
FROM public.daily_attempts da
JOIN public.profiles p ON da.user_id = p.id
WHERE da.completed_at IS NOT NULL;

-- Allow anyone to read the leaderboard
GRANT SELECT ON public.daily_leaderboard TO anon, authenticated;
```

**Usage:** Query with `WHERE puzzle_date = '2025-01-15'` to get that day's rankings.

---

### All-Time Stats Table

```sql
-- Aggregated stats per user (updated via trigger)
CREATE TABLE public.user_stats (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  total_games INTEGER DEFAULT 0,
  total_score BIGINT DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_played_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can view stats (for all-time leaderboard)
CREATE POLICY "Stats are viewable by everyone"
  ON public.user_stats FOR SELECT
  USING (true);

-- Only system can update (via trigger)
CREATE POLICY "System updates stats"
  ON public.user_stats FOR ALL
  USING (false);

-- Function to update stats when a game is completed
CREATE OR REPLACE FUNCTION public.update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if game was just completed
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    INSERT INTO public.user_stats (user_id, total_games, total_score, best_score, current_streak, longest_streak, last_played_date)
    VALUES (
      NEW.user_id,
      1,
      COALESCE(NEW.score, 0),
      COALESCE(NEW.score, 0),
      1,
      1,
      NEW.puzzle_date
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_games = user_stats.total_games + 1,
      total_score = user_stats.total_score + COALESCE(NEW.score, 0),
      best_score = GREATEST(user_stats.best_score, COALESCE(NEW.score, 0)),
      current_streak = CASE
        WHEN user_stats.last_played_date = NEW.puzzle_date - INTERVAL '1 day'
        THEN user_stats.current_streak + 1
        ELSE 1
      END,
      longest_streak = GREATEST(
        user_stats.longest_streak,
        CASE
          WHEN user_stats.last_played_date = NEW.puzzle_date - INTERVAL '1 day'
          THEN user_stats.current_streak + 1
          ELSE 1
        END
      ),
      last_played_date = NEW.puzzle_date,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_game_completed
  AFTER UPDATE ON public.daily_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats();
```

### All-Time Leaderboard View

```sql
-- View for all-time leaderboard (best scores across all days)
CREATE OR REPLACE VIEW public.alltime_leaderboard AS
SELECT
  us.user_id,
  p.display_name,
  p.username,
  us.best_score,
  us.total_score,
  us.total_games,
  us.current_streak,
  us.longest_streak,
  us.last_played_date,
  RANK() OVER (ORDER BY us.best_score DESC) as rank_by_best,
  RANK() OVER (ORDER BY us.total_score DESC) as rank_by_total
FROM public.user_stats us
JOIN public.profiles p ON us.user_id = p.id
WHERE us.total_games > 0;

-- Allow anyone to read the all-time leaderboard
GRANT SELECT ON public.alltime_leaderboard TO anon, authenticated;
```

**Usage options:**
- `ORDER BY rank_by_best` - Rank by highest single-game score
- `ORDER BY rank_by_total` - Rank by cumulative score across all games
- `ORDER BY longest_streak DESC` - Rank by best streak

---

## Step 5: Create Server-Side Score Validation (Edge Function)

This is crucial for preventing score manipulation. Supabase Edge Functions run on the server.

1. Install Supabase CLI (if not installed):
   ```bash
   npm install -g supabase
   ```

2. Initialize in your project:
   ```bash
   supabase init
   supabase login
   supabase link --project-ref your-project-ref
   ```

3. Create the validation function:
   ```bash
   supabase functions new validate-score
   ```

4. Edit `supabase/functions/validate-score/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Your scoring logic (must match client exactly)
function calculateScore(moveHistory: any, puzzleData: any): number {
  // TODO: Implement your exact scoring algorithm here
  // This validates that the moves produce the claimed score
  return 0;
}

serve(async (req) => {
  try {
    const { puzzle_date, move_history, claimed_score } = await req.json()

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // Load the puzzle for that date (from your puzzles table or static file)
    // const puzzleData = await loadPuzzle(puzzle_date)

    // Validate the score
    // const validatedScore = calculateScore(moveHistory, puzzleData)

    // For now, trust the client (replace with real validation)
    const validatedScore = claimed_score

    // Update the attempt with validated score
    const { error: updateError } = await supabase
      .from('daily_attempts')
      .update({
        score: validatedScore,
        completed_at: new Date().toISOString(),
        move_history: move_history
      })
      .eq('user_id', user.id)
      .eq('puzzle_date', puzzle_date)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400 })
    }

    return new Response(JSON.stringify({
      success: true,
      validated_score: validatedScore
    }))

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

5. Deploy the function:
   ```bash
   supabase functions deploy validate-score
   ```

---

## Step 6: Test Your Setup

### Test in Supabase Dashboard

1. Go to **Table Editor**
2. You should see your tables: `profiles`, `daily_attempts`, `user_stats`
3. Go to **Authentication** → **Users** to see registered users

### Test with SQL

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Test inserting a profile manually (will fail due to FK, but shows RLS works)
INSERT INTO public.profiles (id, display_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'Test');

-- View leaderboard
SELECT * FROM public.daily_leaderboard
WHERE puzzle_date = CURRENT_DATE
LIMIT 10;
```

---

## Step 7: Environment Variables for React App

Create a `.env.local` file in your React project:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:**
- Never commit `.env.local` to git
- The anon key is safe to expose (it's designed for client-side use)
- Row Level Security protects your data, not the key

---

## Database Schema Summary

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   auth.users    │────▶│    profiles      │     │   user_stats    │
│   (Supabase)    │     │                  │     │                 │
│                 │     │ - display_name   │     │ - total_games   │
│ - id            │     │ - username       │     │ - best_score    │
│ - email         │     │                  │     │ - total_score   │
└────────┬────────┘     └──────────────────┘     │ - streaks       │
         │                                       └────────┬────────┘
         │                                                │
         ▼                                                ▼
┌─────────────────────┐                    ┌───────────────────────┐
│   daily_attempts    │                    │ alltime_leaderboard   │ (VIEW)
│                     │                    │                       │
│ - puzzle_date       │                    │ - rank_by_best        │
│ - score             │                    │ - rank_by_total       │
│ - move_history      │                    │ - display_name        │
│ - completed_at      │                    │ - best_score          │
│                     │                    │ - total_score         │
│ UNIQUE(user, date)  │◀── One per day     └───────────────────────┘
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  daily_leaderboard  │  (VIEW)
│                     │
│ - puzzle_date       │
│ - rank              │
│ - display_name      │
│ - score             │
└─────────────────────┘
```

---

## Next Steps

Once this is set up, we'll integrate with the React app:
1. Install `@supabase/supabase-js`
2. Create auth context/hooks
3. Add login/signup UI
4. Modify game flow to check/create daily attempts
5. Submit scores through the Edge Function
6. Display leaderboard

---

## Estimated Costs

| Usage Level | Monthly Cost |
|-------------|--------------|
| < 50K MAU | **Free** |
| 50K - 100K MAU | $25 (Pro tier) |
| 100K+ MAU | Custom pricing |

The free tier includes:
- 500 MB database
- 5 GB bandwidth
- 50,000 monthly active users
- Unlimited API requests
- Edge Functions (500K invocations)

This is more than enough for a daily puzzle game to grow significantly before needing to pay anything.
