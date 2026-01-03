/**
 * Generate Ground Truth Template Script
 * 
 * Reads exported transactions and creates a ground truth template
 * for manual categorization.
 * 
 * Usage: npx tsx scripts/generate_ground_truth.ts
 */

import * as fs from "fs";
import * as path from "path";

interface ExportedTransaction {
  transaction_id: string;
  date: string;
  amount: number;
  description_raw: string | null;
  description_clean: string | null;
  account_name: string | null;
  account_type: string | null;
  provider: string;
  plaid_category: string | null;
  plaid_confidence: number | null;
  current_category: string | null;
  is_transfer: boolean;
  is_pass_through: boolean;
  flow_type: string | null;
}

interface GroundTruthEntry {
  transaction_id: string;
  description_raw: string;
  amount: number;
  account_name: string;
  plaid_category: string | null;
  correct_category: string;
  is_transfer: boolean;
  is_pass_through: boolean;
  notes: string;
}

function loadExportedTransactions(): ExportedTransaction[] {
  const filePath = path.join(process.cwd(), "data", "pilot_transactions.json");
  
  if (!fs.existsSync(filePath)) {
    console.error("Exported transactions not found at data/pilot_transactions.json");
    console.error("Please run: npm run pilot:export");
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as ExportedTransaction[];
}

function generateGroundTruth(transactions: ExportedTransaction[]) {
  const groundTruth: GroundTruthEntry[] = transactions.map((t) => ({
    transaction_id: t.transaction_id,
    description_raw: t.description_raw || "",
    amount: t.amount,
    account_name: t.account_name || "",
    plaid_category: t.plaid_category,
    correct_category: "", // To be filled manually
    is_transfer: t.is_transfer,
    is_pass_through: t.is_pass_through,
    notes: "",
  }));

  const output = {
    _instructions: "For each transaction, fill in 'correct_category'. Use categories from the reference list. Mark is_transfer=true for internal account transfers. Add notes for edge cases.",
    _categories_reference: [
      "Income",
      "Salary",
      "Rent Income",
      "Dividend",
      "Interest",
      "Groceries",
      "Restaurants",
      "Coffee",
      "Gas",
      "Utilities",
      "Insurance",
      "Subscriptions",
      "Shopping",
      "Entertainment",
      "Travel",
      "Healthcare",
      "Personal Care",
      "Gifts",
      "Transfer",
      "Credit Card Payment",
      "Savings Transfer",
      "Investment",
      "Business Expense",
      "Other"
    ],
    _stats: {
      total_transactions: transactions.length,
      date_range: {
        earliest: transactions[transactions.length - 1]?.date,
        latest: transactions[0]?.date,
      },
      accounts: [...new Set(transactions.map((t) => t.account_name))],
    },
    transactions: groundTruth,
  };

  const outputPath = path.join(process.cwd(), "data", "pilot_ground_truth.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`✓ Generated ground truth template at ${outputPath}`);
  console.log(`\nTotal transactions: ${transactions.length}`);
  console.log(`Date range: ${output._stats.date_range.earliest} to ${output._stats.date_range.latest}`);
  console.log(`\nAccounts included:`);
  output._stats.accounts.forEach((acc) => console.log(`  - ${acc}`));
  console.log(`\nNext step: Open data/pilot_ground_truth.json and fill in 'correct_category' for each transaction.`);
}

// Main
const transactions = loadExportedTransactions();
generateGroundTruth(transactions);
