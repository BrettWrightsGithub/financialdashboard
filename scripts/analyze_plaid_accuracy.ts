/**
 * Analyze Plaid Accuracy Script
 * 
 * Compares Plaid categories to ground truth and outputs accuracy metrics.
 * 
 * Usage: npx tsx scripts/analyze_plaid_accuracy.ts
 */

import * as fs from "fs";
import * as path from "path";

interface GroundTruthTransaction {
  transaction_id: string;
  description_raw: string;
  amount: number;
  plaid_category: string | null;
  correct_category: string;
  is_transfer: boolean;
  is_pass_through: boolean;
  notes: string;
}

interface GroundTruthFile {
  _instructions: string;
  _categories_reference: string[];
  transactions: GroundTruthTransaction[];
}

interface MiscategorizationPattern {
  plaid_category: string;
  correct_category: string;
  count: number;
  examples: string[];
}

function loadGroundTruth(): GroundTruthFile {
  const filePath = path.join(process.cwd(), "data", "pilot_ground_truth.json");
  
  if (!fs.existsSync(filePath)) {
    console.error("Ground truth file not found at data/pilot_ground_truth.json");
    console.error("Please run export_pilot_transactions.ts first, then manually fill in correct_category values.");
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as GroundTruthFile;
}

function analyzeAccuracy(transactions: GroundTruthTransaction[]) {
  // Filter to only transactions with ground truth filled in
  const labeled = transactions.filter((t) => t.correct_category && t.correct_category.trim() !== "");
  
  if (labeled.length === 0) {
    console.error("No transactions have correct_category filled in.");
    console.error("Please manually label transactions in data/pilot_ground_truth.json");
    process.exit(1);
  }

  console.log(`Analyzing ${labeled.length} labeled transactions...\n`);

  // Calculate accuracy
  let correct = 0;
  let incorrect = 0;
  let noPlaidCategory = 0;

  const miscategorizations: Map<string, MiscategorizationPattern> = new Map();

  labeled.forEach((t) => {
    const plaid = (t.plaid_category || "").toLowerCase().trim();
    const truth = t.correct_category.toLowerCase().trim();

    if (!plaid) {
      noPlaidCategory++;
      return;
    }

    // Check if categories match (case-insensitive, allowing partial matches)
    const isMatch = plaid === truth || 
                    plaid.includes(truth) || 
                    truth.includes(plaid);

    if (isMatch) {
      correct++;
    } else {
      incorrect++;
      
      // Track miscategorization pattern
      const key = `${t.plaid_category || "(none)"}→${t.correct_category}`;
      const existing = miscategorizations.get(key);
      
      if (existing) {
        existing.count++;
        if (existing.examples.length < 3) {
          existing.examples.push(t.description_raw || t.transaction_id);
        }
      } else {
        miscategorizations.set(key, {
          plaid_category: t.plaid_category || "(none)",
          correct_category: t.correct_category,
          count: 1,
          examples: [t.description_raw || t.transaction_id],
        });
      }
    }
  });

  const totalWithPlaid = correct + incorrect;
  const accuracy = totalWithPlaid > 0 ? (correct / totalWithPlaid) * 100 : 0;

  // Output results
  console.log("=== PLAID ACCURACY ANALYSIS ===\n");
  console.log(`Total labeled transactions: ${labeled.length}`);
  console.log(`Transactions with Plaid category: ${totalWithPlaid}`);
  console.log(`Transactions without Plaid category: ${noPlaidCategory}`);
  console.log("");
  console.log(`✓ Correct: ${correct}`);
  console.log(`✗ Incorrect: ${incorrect}`);
  console.log("");
  console.log(`📊 OVERALL ACCURACY: ${accuracy.toFixed(1)}%`);
  console.log("");

  // Top miscategorization patterns
  const sortedPatterns = Array.from(miscategorizations.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  console.log("=== TOP 10 MISCATEGORIZATION PATTERNS ===\n");
  
  if (sortedPatterns.length === 0) {
    console.log("No miscategorizations found! 🎉");
  } else {
    sortedPatterns.forEach((pattern, i) => {
      console.log(`${i + 1}. "${pattern.plaid_category}" → "${pattern.correct_category}" (${pattern.count} occurrences)`);
      pattern.examples.forEach((ex) => {
        console.log(`   Example: ${ex.substring(0, 50)}${ex.length > 50 ? "..." : ""}`);
      });
      console.log("");
    });
  }

  // Category-level accuracy breakdown
  const categoryAccuracy: Map<string, { correct: number; total: number }> = new Map();
  
  labeled.forEach((t) => {
    if (!t.plaid_category) return;
    
    const plaid = t.plaid_category;
    const truth = t.correct_category.toLowerCase().trim();
    const isMatch = plaid.toLowerCase().trim() === truth || 
                    plaid.toLowerCase().includes(truth) || 
                    truth.includes(plaid.toLowerCase());

    const existing = categoryAccuracy.get(plaid) || { correct: 0, total: 0 };
    existing.total++;
    if (isMatch) existing.correct++;
    categoryAccuracy.set(plaid, existing);
  });

  console.log("=== ACCURACY BY PLAID CATEGORY ===\n");
  
  Array.from(categoryAccuracy.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([cat, stats]) => {
      const catAccuracy = (stats.correct / stats.total) * 100;
      const bar = "█".repeat(Math.round(catAccuracy / 10)) + "░".repeat(10 - Math.round(catAccuracy / 10));
      console.log(`${cat.padEnd(25)} ${bar} ${catAccuracy.toFixed(0)}% (${stats.correct}/${stats.total})`);
    });

  // Save results to file
  const results = {
    timestamp: new Date().toISOString(),
    summary: {
      total_labeled: labeled.length,
      with_plaid_category: totalWithPlaid,
      without_plaid_category: noPlaidCategory,
      correct: correct,
      incorrect: incorrect,
      accuracy_percent: accuracy,
    },
    top_miscategorizations: sortedPatterns,
    category_accuracy: Object.fromEntries(
      Array.from(categoryAccuracy.entries()).map(([cat, stats]) => [
        cat,
        {
          correct: stats.correct,
          total: stats.total,
          accuracy_percent: (stats.correct / stats.total) * 100,
        },
      ])
    ),
  };

  const resultsPath = path.join(process.cwd(), "data", "plaid_accuracy_results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Results saved to ${resultsPath}`);

  // Recommendation
  console.log("\n=== RECOMMENDATION ===\n");
  if (accuracy >= 80) {
    console.log("✅ Plaid accuracy meets the 80% threshold.");
    console.log("   Proceed with rule engine to address remaining gaps.");
  } else if (accuracy >= 60) {
    console.log("⚠️  Plaid accuracy is below 80% but above 60%.");
    console.log("   Programmatic rules should help close the gap.");
    console.log("   Review top miscategorization patterns for rule candidates.");
  } else {
    console.log("❌ Plaid accuracy is below 60%.");
    console.log("   Consider whether Plaid data is being properly enriched.");
    console.log("   May need more aggressive rule-based categorization.");
  }
}

// Main
const groundTruth = loadGroundTruth();
analyzeAccuracy(groundTruth.transactions);
