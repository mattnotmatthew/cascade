// Analytics and reporting for CASCADE simulation results

import type { SimulationResults, StrategyComparison } from "./types";

// Print detailed results for a single strategy
export function printStrategyResults(results: SimulationResults): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`STRATEGY: ${results.strategyName.toUpperCase()}`);
  console.log(`Iterations: ${results.iterations.toLocaleString()}`);
  console.log("=".repeat(60));

  console.log("\nSCORE SUMMARY:");
  console.log(
    `  Average Total Score:  ${Math.round(
      results.avgTotalScore
    ).toLocaleString()}`
  );
  console.log(
    `  Standard Deviation:   ${Math.round(
      results.scoreStdDev
    ).toLocaleString()}`
  );
  console.log(
    `  Min / Max:            ${results.minScore.toLocaleString()} / ${results.maxScore.toLocaleString()}`
  );

  console.log("\nSCORE BREAKDOWN:");
  console.log(
    `  Letter Phase:         ${Math.round(
      results.avgLetterPhaseScore
    ).toLocaleString()} pts (${(
      (results.avgLetterPhaseScore / results.avgTotalScore) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `  Word Phase:           ${Math.round(
      results.avgWordPhaseScore
    ).toLocaleString()} pts (${(
      (results.avgWordPhaseScore / results.avgTotalScore) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `  Cascade Bonus:        ${Math.round(
      results.avgCascadeBonus
    ).toLocaleString()} pts (${(
      (results.avgCascadeBonus / results.avgTotalScore) *
      100
    ).toFixed(1)}%)`
  );

  console.log("\nLETTER PHASE STATS:");
  console.log(
    `  Avg Letters Guessed:  ${results.avgLettersGuessed.toFixed(1)}`
  );
  console.log(
    `  Avg Hit Rate:         ${results.avgLetterHitRate.toFixed(
      2
    )} words/letter`
  );

  console.log("\nWORD PHASE STATS:");
  console.log(
    `  Avg Words Correct:    ${results.avgWordsCorrect.toFixed(1)} / 5`
  );
  console.log(
    `  Avg Auto-Completed:   ${results.avgWordsAutoCompleted.toFixed(1)}`
  );
  console.log(
    `  Avg Blanks at Start:  ${results.avgBlanksAtWordPhase.toFixed(1)}`
  );
  console.log(
    `  Cascade Earned Rate:  ${(results.cascadeEarnedRate * 100).toFixed(1)}%`
  );

  console.log("\nSCORE PERCENTILES:");
  console.log(`  10th: ${results.scorePercentiles.p10.toLocaleString()}`);
  console.log(`  25th: ${results.scorePercentiles.p25.toLocaleString()}`);
  console.log(
    `  50th: ${results.scorePercentiles.p50.toLocaleString()} (median)`
  );
  console.log(`  75th: ${results.scorePercentiles.p75.toLocaleString()}`);
  console.log(`  90th: ${results.scorePercentiles.p90.toLocaleString()}`);
}

// Print comparison table across multiple strategies
export function printComparisonTable(comparison: StrategyComparison): void {
  console.log("\n" + "=".repeat(100));
  console.log("STRATEGY COMPARISON");
  console.log("=".repeat(100));

  // Header
  console.log(
    "\n┌─────────────────┬───────────┬────────────┬────────────┬──────────┬───────────┬──────────┬──────────┐"
  );
  console.log(
    "│ Strategy        │ Avg Score │ Letter Pts │ Word Pts   │ Cascade  │ Std Dev   │ Words OK │ Cascade% │"
  );
  console.log(
    "├─────────────────┼───────────┼────────────┼────────────┼──────────┼───────────┼──────────┼──────────┤"
  );

  // Data rows
  for (const results of comparison.strategies) {
    const name = results.strategyName.padEnd(15);
    const avgScore = Math.round(results.avgTotalScore).toString().padStart(9);
    const letterPts = Math.round(results.avgLetterPhaseScore)
      .toString()
      .padStart(10);
    const wordPts = Math.round(results.avgWordPhaseScore)
      .toString()
      .padStart(10);
    const cascade = Math.round(results.avgCascadeBonus).toString().padStart(8);
    const stdDev = Math.round(results.scoreStdDev).toString().padStart(9);
    const wordsOk = results.avgWordsCorrect.toFixed(1).padStart(8);
    const cascadeRate = (
      (results.cascadeEarnedRate * 100).toFixed(0) + "%"
    ).padStart(8);

    console.log(
      `│ ${name} │ ${avgScore} │ ${letterPts} │ ${wordPts} │ ${cascade} │ ${stdDev} │ ${wordsOk} │ ${cascadeRate} │`
    );
  }

  console.log(
    "└─────────────────┴───────────┴────────────┴────────────┴──────────┴───────────┴──────────┴──────────┘"
  );

  // Insights
  if (comparison.insights.length > 0) {
    console.log("\nKEY INSIGHTS:");
    comparison.insights.forEach((insight, i) => {
      console.log(`  ${i + 1}. ${insight}`);
    });
  }
}

// Generate insights from comparison
export function generateInsights(strategies: SimulationResults[]): string[] {
  const insights: string[] = [];

  // Sort by average score
  const byScore = [...strategies].sort(
    (a, b) => b.avgTotalScore - a.avgTotalScore
  );
  const best = byScore[0];
  const worst = byScore[byScore.length - 1];

  insights.push(
    `Best strategy: '${best.strategyName}' with avg score ${Math.round(
      best.avgTotalScore
    )}`
  );

  // Check variance
  const byVariance = [...strategies].sort(
    (a, b) => a.scoreStdDev - b.scoreStdDev
  );
  const mostConsistent = byVariance[0];
  const mostVariable = byVariance[byVariance.length - 1];

  insights.push(
    `Most consistent: '${mostConsistent.strategyName}' (σ=${Math.round(
      mostConsistent.scoreStdDev
    )})`
  );
  insights.push(
    `Most variable: '${mostVariable.strategyName}' (σ=${Math.round(
      mostVariable.scoreStdDev
    )})`
  );

  // Letter vs word phase balance
  const letterHeavy = strategies.find(
    (s) => s.avgLetterPhaseScore > s.avgWordPhaseScore
  );
  const wordHeavy = strategies.find(
    (s) => s.avgWordPhaseScore > s.avgLetterPhaseScore * 1.5
  );

  if (letterHeavy) {
    insights.push(
      `'${letterHeavy.strategyName}' earns more from letter phase than word phase`
    );
  }
  if (wordHeavy) {
    insights.push(
      `'${wordHeavy.strategyName}' relies heavily on word phase multipliers`
    );
  }

  // Cascade rate analysis
  const byCascade = [...strategies].sort(
    (a, b) => b.cascadeEarnedRate - a.cascadeEarnedRate
  );
  insights.push(
    `Highest cascade rate: '${byCascade[0].strategyName}' at ${(
      byCascade[0].cascadeEarnedRate * 100
    ).toFixed(0)}%`
  );

  // Check if strategies are well-balanced (no dominant strategy)
  const scoreDiff = best.avgTotalScore - worst.avgTotalScore;
  const avgScore =
    strategies.reduce((sum, s) => sum + s.avgTotalScore, 0) / strategies.length;
  const diffPercent = (scoreDiff / avgScore) * 100;

  if (diffPercent < 15) {
    insights.push("✓ Strategies are well-balanced (< 15% score difference)");
  } else if (diffPercent < 25) {
    insights.push("⚠ Moderate strategy imbalance (15-25% score difference)");
  } else {
    insights.push("✗ Significant strategy imbalance (> 25% score difference)");
  }

  return insights;
}

// Create a comparison report
export function createComparison(
  strategies: SimulationResults[]
): StrategyComparison {
  return {
    strategies,
    insights: generateInsights(strategies),
  };
}

// Export results to JSON
export function exportToJSON(comparison: StrategyComparison): string {
  // Remove raw results to keep export manageable
  const exportData = {
    ...comparison,
    strategies: comparison.strategies.map((s) => ({
      ...s,
      allResults: undefined, // Exclude raw data
    })),
  };
  return JSON.stringify(exportData, null, 2);
}

// Print score distribution histogram
export function printScoreHistogram(results: SimulationResults): void {
  const scores = results.allResults.map((r) => r.totalScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const bucketSize = Math.ceil((max - min) / 10);

  console.log(`\nSCORE DISTRIBUTION (${results.strategyName}):`);
  console.log(`Range: ${min} - ${max}, Bucket size: ${bucketSize}`);

  const buckets: number[] = new Array(10).fill(0);
  scores.forEach((score) => {
    const bucket = Math.min(9, Math.floor((score - min) / bucketSize));
    buckets[bucket]++;
  });

  const maxBucket = Math.max(...buckets);
  const barScale = 40 / maxBucket;

  buckets.forEach((count, i) => {
    const rangeStart = min + i * bucketSize;
    const rangeEnd = rangeStart + bucketSize - 1;
    const bar = "█".repeat(Math.round(count * barScale));
    const pct = ((count / scores.length) * 100).toFixed(1);
    console.log(
      `${rangeStart.toString().padStart(5)}-${rangeEnd
        .toString()
        .padStart(5)} │ ${bar} ${pct}%`
    );
  });
}
