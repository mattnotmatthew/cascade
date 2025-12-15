// Main entry point for CASCADE game balance simulation
// Run with: npx ts-node src/simulation/index.ts

import { ALL_STRATEGIES, getStrategy } from "./strategies";
import { runSimulation } from "./simulator";
import {
  printStrategyResults,
  printComparisonTable,
  createComparison,
  printScoreHistogram,
  exportToJSON,
} from "./analytics";
import { printLetterFrequencyTable } from "./letterAnalysis";
import type { SimulationResults } from "./types";

// Parse command line arguments
function parseArgs(): {
  iterations: number;
  strategy: string | null;
  verbose: boolean;
  showFrequencies: boolean;
  showHistograms: boolean;
  exportFile: string | null;
} {
  const args = process.argv.slice(2);
  let iterations = 1000;
  let strategy: string | null = null;
  let verbose = false;
  let showFrequencies = false;
  let showHistograms = false;
  let exportFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--iterations":
      case "-i":
        iterations = parseInt(args[++i], 10);
        break;
      case "--strategy":
      case "-s":
        strategy = args[++i];
        break;
      case "--verbose":
      case "-v":
        verbose = true;
        break;
      case "--frequencies":
      case "-f":
        showFrequencies = true;
        break;
      case "--histograms":
      case "-h":
        showHistograms = true;
        break;
      case "--export":
      case "-e":
        exportFile = args[++i];
        break;
      case "--help":
        printHelp();
        process.exit(0);
    }
  }

  return {
    iterations,
    strategy,
    verbose,
    showFrequencies,
    showHistograms,
    exportFile,
  };
}

function printHelp(): void {
  console.log(`
CASCADE Game Balance Simulation

Usage: npx ts-node src/simulation/index.ts [options]

Options:
  -i, --iterations <n>   Number of iterations per strategy (default: 1000)
  -s, --strategy <name>  Run only a specific strategy
  -v, --verbose          Show detailed game-by-game output (first 3 games)
  -f, --frequencies      Show letter frequency analysis
  -h, --histograms       Show score distribution histograms
  -e, --export <file>    Export results to JSON file
  --help                 Show this help message

Available strategies:
  aggressive    - Use all 6 letter guesses
  conservative  - Only 2 letter guesses, maximize word multipliers
  moderate      - Use 3-4 letter guesses, balanced approach
  vowel-heavy   - Prioritize vowels, then consonants
  adaptive      - Stop when hit rate drops
  random        - Random selection (baseline)

Examples:
  npx ts-node src/simulation/index.ts
  npx ts-node src/simulation/index.ts -i 5000 -s aggressive -v
  npx ts-node src/simulation/index.ts -i 10000 --histograms --export results.json
`);
}

async function main(): Promise<void> {
  const {
    iterations,
    strategy: strategyName,
    verbose,
    showFrequencies,
    showHistograms,
    exportFile,
  } = parseArgs();

  console.log("\n" + "=".repeat(60));
  console.log("CASCADE GAME BALANCE SIMULATION");
  console.log("=".repeat(60));

  // Show letter frequencies if requested
  if (showFrequencies) {
    printLetterFrequencyTable();
  }

  // Determine which strategies to run
  const strategiesToRun = strategyName
    ? [getStrategy(strategyName)].filter(Boolean)
    : ALL_STRATEGIES;

  if (strategiesToRun.length === 0) {
    console.error(`Unknown strategy: ${strategyName}`);
    console.log(
      "Available strategies:",
      ALL_STRATEGIES.map((s) => s.name).join(", ")
    );
    process.exit(1);
  }

  console.log(
    `\nRunning ${iterations.toLocaleString()} iterations per strategy`
  );
  console.log(`Strategies: ${strategiesToRun.map((s) => s!.name).join(", ")}`);

  // Run simulations
  const results: SimulationResults[] = [];

  for (const strategy of strategiesToRun) {
    if (!strategy) continue;

    const result = runSimulation({
      iterations,
      strategy,
      verboseLogging: verbose,
    });

    results.push(result);

    // Print individual results
    printStrategyResults(result);

    // Show histogram if requested
    if (showHistograms) {
      printScoreHistogram(result);
    }
  }

  // Print comparison if multiple strategies
  if (results.length > 1) {
    const comparison = createComparison(results);
    printComparisonTable(comparison);

    // Export if requested
    if (exportFile) {
      const fs = await import("fs");
      fs.writeFileSync(exportFile, exportToJSON(comparison));
      console.log(`\nResults exported to: ${exportFile}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("SIMULATION COMPLETE");
  console.log("=".repeat(60) + "\n");
}

// Run if executed directly
main().catch(console.error);
