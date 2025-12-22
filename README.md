# CASCADE

A daily word puzzle game where players reveal letters strategically to uncover five themed words, with a hidden CASCADE word running across them for bonus points.

## Game Overview

CASCADE is a two-phase word puzzle:

1. **Letter Phase**: Guess up to 7 letters to reveal them across all 5 words
   - 3 vowels maximum
   - Build streak bonuses for consecutive hits
   - Minimum 4 letters before skipping to word phase

2. **Word Phase**: Fill in the blanks to complete each word
   - More blanks = higher score multiplier (up to 2.5x)
   - Wrong guesses cost -25 points
   - Auto-completed words (all letters revealed) get 2x multiplier + 50 bonus

3. **Cascade Bonus**: Complete the hidden word running across row 3 for +500 points!

## Features

- Daily curated puzzles with themes
- Practice mode with random puzzles
- User authentication (email/password)
- Global leaderboards (daily and all-time)
- Light/dark mode
- Puzzle creator tools for content generation
- Game balance simulation tools

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: CSS with CSS Variables (no framework)
- **Backend**: Supabase (Auth, Database, Row Level Security)
- **APIs**: Datamuse API for word data

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (for full features)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/cascade.git
cd cascade

# Install dependencies
npm install

# Start development server
npm run dev
```

The game will run at `http://localhost:5173`

### Environment Setup

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed Supabase configuration.

## Project Structure

```
src/
├── components/        # React components
│   ├── GameBoard.tsx     # Main game interface
│   ├── WordColumn.tsx    # Individual word display
│   ├── AuthModal.tsx     # Authentication UI
│   └── ...
├── pages/            # Route pages
│   ├── Leaderboard.tsx   # Leaderboard page
│   ├── PuzzleCreator.tsx # Puzzle creation tool
│   └── ...
├── services/         # API and business logic
│   ├── supabase.ts       # Supabase client
│   ├── authService.ts    # Authentication
│   ├── scoreService.ts   # Score submission
│   └── ...
├── simulation/       # Game balance simulation
│   ├── simulator.ts      # Core simulation engine
│   ├── strategies.ts     # Player behavior models
│   └── ...
├── utils/            # Utilities
│   └── gameLogic.ts      # Core game mechanics
├── data/             # Static data
│   └── words.ts          # Word lists
└── types/            # TypeScript types
```

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Running Simulations

Analyze game balance with different player strategies:

```bash
npx tsx src/simulation/index.ts                    # Run all strategies
npx tsx src/simulation/index.ts -i 5000            # 5000 iterations
npx tsx src/simulation/index.ts -s aggressive -v   # Single strategy, verbose
npx tsx src/simulation/index.ts -f                 # Show letter frequencies
npx tsx src/simulation/index.ts --histograms       # Show score distributions
```

## Scoring System (v3)

| Component | Points |
|-----------|--------|
| Word base scores | 100 / 150 / 150 / 150 / 200 |
| Blank multiplier | +0.4x per blank (max 2.5x) |
| Streak bonuses | 0, 10, 20, 35, 50, 60, 70 |
| Auto-complete | 2x base + 50 bonus |
| Wrong guess | -25 penalty |
| Cascade bonus | +500 flat |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Run `npm run build` before committing to catch type errors
- Follow existing code style and patterns
- Test both light and dark modes
- Test on mobile viewport sizes

## License

MIT
