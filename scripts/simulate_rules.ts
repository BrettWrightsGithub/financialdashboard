/**
 * Simulate Rules Script
 * 
 * Applies the 10 pilot rules to transactions and measures post-rule accuracy.
 * 
 * Usage: npx tsx scripts/simulate_rules.ts
 */

import * as fs from "fs";
import * as path from "path";

interface RuleConditions {
  merchant_contains: string[] | null;
  amount_min: number | null;
  amount_max: number | null;
  account_type: string | null;
  direction: "inflow" | "outflow" | null;
}

interface RuleAction {
  target_category: string;
  is_transfer: boolean;
  is_pass_through: boolean;
}

interface Rule {
  id: string;
  name: string;
  description: string;
  priority: number;
  conditions: RuleConditions;
  action: RuleAction;
  notes?: string;
}

interface RulesFile {
  _instructions: string;
  rules: Rule[];
}

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

interface SimulationResult {
  transaction_id: string;
  description_raw: string;
  amount: number;
  plaid_category: string | null;
  rule_category: string | null;
  matched_rule: string | null;
  final_category: string;
  correct_category: string;
  is_correct: boolean;
  source: "plaid" | "rule" | "none";
}

function loadRules(): Rule[] {
  const filePath = path.join(process.cwd(), "data", "pilot_rules.json");
  
  if (!fs.existsSync(filePath)) {
    console.error("Rules file not found at data/pilot_rules.json");
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(content) as RulesFile;
  
  // Sort by priority (highest first)
  return data.rules.sort((a, b) => b.priority - a.priority);
}

function loadGroundTruth(): GroundTruthTransaction[] {
  const filePath = path.join(process.cwd(), "data", "pilot_ground_truth.json");
  
  if (!fs.existsSync(filePath)) {
    console.error("Ground truth file not found at data/pilot_ground_truth.json");
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(content) as GroundTruthFile;
  return data.transactions.filter((t) => t.correct_category && t.correct_category.trim() !== "");
}

function matchesRule(transaction: GroundTruthTransaction, rule: Rule): boolean {
  const { conditions } = rule;
  const description = (transaction.description_raw || "").toUpperCase();
  const amount = transaction.amount;

  // Check merchant_contains
  if (conditions.merchant_contains && conditions.merchant_contains.length > 0) {
    const matches = conditions.merchant_contains.some((pattern) =>
      description.includes(pattern.toUpperCase())
    );
    if (!matches) return false;
  }

  // Check amount_min
  if (conditions.amount_min !== null) {
    const absAmount = Math.abs(amount);
    if (absAmount < conditions.amount_min) return false;
  }

  // Check amount_max
  if (conditions.amount_max !== null) {
    const absAmount = Math.abs(amount);
    if (absAmount > conditions.amount_max) return false;
  }

  // Check direction
  if (conditions.direction) {
    const isOutflow = amount < 0;
    if (conditions.direction === "outflow" && !isOutflow) return false;
    if (conditions.direction === "inflow" && isOutflow) return false;
  }

  return true;
}

function findMatchingRule(transaction: GroundTruthTransaction, rules: Rule[]): Rule | null {
  for (const rule of rules) {
    if (matchesRule(transaction, rule)) {
      return rule;
    }
  }
  return null;
}

function categoriesMatch(cat1: string, cat2: string): boolean {
  const c1 = cat1.toLowerCase().trim();
  const c2 = cat2.toLowerCase().trim();
  return c1 === c2 || c1.includes(c2) || c2.includes(c1);
}

function simulate(transactions: GroundTruthTransaction[], rules: Rule[]): SimulationResult[] {
  return transactions.map((t) => {
    const matchedRule = findMatchingRule(t, rules);
    const ruleCategory = matchedRule?.action.target_category || null;
    
    // Determine final category: rule wins over Plaid if matched
    let finalCategory: string;
    let source: "plaid" | "rule" | "none";
    
    if (ruleCategory) {
      finalCategory = ruleCategory;
      source = "rule";
    } else if (t.plaid_category) {
      finalCategory = t.plaid_category;
      source = "plaid";
    } else {
      finalCategory = "(uncategorized)";
      source = "none";
    }

    const isCorrect = categoriesMatch(finalCategory, t.correct_category);

    return {
      transaction_id: t.transaction_id,
      description_raw: t.description_raw,
      amount: t.amount,
      plaid_category: t.plaid_category,
      rule_category: ruleCategory,
      matched_rule: matchedRule?.name || null,
      final_category: finalCategory,
      correct_category: t.correct_category,
      is_correct: isCorrect,
      source,
    };
  });
}

function printResults(results: SimulationResult[], rules: Rule[]) {
  console.log("=== RULE SIMULATION RESULTS ===\n");

  const total = results.length;
  const correct = results.filter((r) => r.is_correct).length;
  const accuracy = (correct / total) * 100;

  // Breakdown by source
  const byRule = results.filter((r) => r.source === "rule");
  const byPlaid = results.filter((r) => r.source === "plaid");
  const uncategorized = results.filter((r) => r.source === "none");

  const ruleCorrect = byRule.filter((r) => r.is_correct).length;
  const plaidCorrect = byPlaid.filter((r) => r.is_correct).length;

  console.log(`Total transactions: ${total}`);
  console.log(`Categorized by rules: ${byRule.length} (${((byRule.length / total) * 100).toFixed(1)}%)`);
  console.log(`Categorized by Plaid: ${byPlaid.length} (${((byPlaid.length / total) * 100).toFixed(1)}%)`);
  console.log(`Uncategorized: ${uncategorized.length}`);
  console.log("");
  console.log(`Rule accuracy: ${byRule.length > 0 ? ((ruleCorrect / byRule.length) * 100).toFixed(1) : "N/A"}%`);
  console.log(`Plaid accuracy (fallback): ${byPlaid.length > 0 ? ((plaidCorrect / byPlaid.length) * 100).toFixed(1) : "N/A"}%`);
  console.log("");
  console.log(`📊 COMBINED ACCURACY: ${accuracy.toFixed(1)}%`);
  console.log("");

  // Rule usage stats
  console.log("=== RULE USAGE STATISTICS ===\n");
  
  const ruleUsage: Map<string, { matched: number; correct: number }> = new Map();
  rules.forEach((r) => ruleUsage.set(r.name, { matched: 0, correct: 0 }));

  byRule.forEach((r) => {
    if (r.matched_rule) {
      const stats = ruleUsage.get(r.matched_rule)!;
      stats.matched++;
      if (r.is_correct) stats.correct++;
    }
  });

  Array.from(ruleUsage.entries())
    .sort((a, b) => b[1].matched - a[1].matched)
    .forEach(([name, stats]) => {
      const ruleAcc = stats.matched > 0 ? ((stats.correct / stats.matched) * 100).toFixed(0) : "N/A";
      console.log(`${name.padEnd(30)} Matched: ${stats.matched.toString().padStart(3)} | Accuracy: ${ruleAcc}%`);
    });

  // Transactions still needing review
  const needsReview = results.filter((r) => !r.is_correct || r.source === "none");
  
  console.log("\n=== TRANSACTIONS NEEDING REVIEW ===\n");
  console.log(`Total needing review: ${needsReview.length} (${((needsReview.length / total) * 100).toFixed(1)}%)`);
  
  if (needsReview.length > 0 && needsReview.length <= 20) {
    console.log("\nDetails:");
    needsReview.forEach((r) => {
      console.log(`  ${r.description_raw?.substring(0, 40).padEnd(40)} | ${r.final_category.padEnd(20)} → ${r.correct_category}`);
    });
  } else if (needsReview.length > 20) {
    console.log("\n(Showing first 20)");
    needsReview.slice(0, 20).forEach((r) => {
      console.log(`  ${r.description_raw?.substring(0, 40).padEnd(40)} | ${r.final_category.padEnd(20)} → ${r.correct_category}`);
    });
  }

  // Save detailed results
  const outputPath = path.join(process.cwd(), "data", "simulation_results.json");
  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      total: total,
      correct: correct,
      accuracy_percent: accuracy,
      by_rule: byRule.length,
      by_plaid: byPlaid.length,
      uncategorized: uncategorized.length,
      rule_accuracy_percent: byRule.length > 0 ? (ruleCorrect / byRule.length) * 100 : null,
      plaid_accuracy_percent: byPlaid.length > 0 ? (plaidCorrect / byPlaid.length) * 100 : null,
      needs_review: needsReview.length,
    },
    rule_usage: Object.fromEntries(ruleUsage),
    transactions: results,
    needs_review: needsReview.map((r) => ({
      transaction_id: r.transaction_id,
      description: r.description_raw,
      assigned: r.final_category,
      correct: r.correct_category,
      source: r.source,
    })),
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✓ Detailed results saved to ${outputPath}`);

  // Final recommendation
  console.log("\n=== RECOMMENDATION ===\n");
  
  if (accuracy >= 80) {
    console.log("✅ Combined accuracy meets the 80% threshold!");
    console.log("   GO: Proceed with categorization feature build.");
  } else if (accuracy >= 70) {
    console.log("⚠️  Accuracy is between 70-80%.");
    console.log("   Consider adding more rules or refining existing ones.");
    console.log("   Review the 'needs review' transactions for patterns.");
  } else {
    console.log("❌ Accuracy is below 70%.");
    console.log("   More rules needed, or Plaid data quality may be an issue.");
    console.log("   Analyze miscategorization patterns before proceeding.");
  }
}

// Main
const rules = loadRules();
const transactions = loadGroundTruth();

if (transactions.length === 0) {
  console.error("No labeled transactions found in ground truth file.");
  console.error("Please fill in correct_category values in data/pilot_ground_truth.json");
  process.exit(1);
}

console.log(`Loaded ${rules.length} rules and ${transactions.length} labeled transactions.\n`);

const results = simulate(transactions, rules);
printResults(results, rules);
