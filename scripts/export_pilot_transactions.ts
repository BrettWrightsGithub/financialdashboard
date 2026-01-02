/**
 * Export Pilot Transactions Script
 * 
 * Exports 200 recent transactions with Plaid categorization data
 * for manual review and ground truth labeling.
 * 
 * Usage: npx tsx scripts/export_pilot_transactions.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("  SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✓" : "✗");
  console.error("\nPlease ensure .env.local is configured properly.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

async function exportTransactions() {
  console.log("Fetching 200 recent transactions with Plaid data...\n");

  // Query transactions with category details
  // We want transactions that have some categorization data to analyze
  const { data: transactions, error } = await supabase
    .from("v_transactions_with_details")
    .select(`
      id,
      date,
      amount,
      description_raw,
      description_clean,
      account_name,
      account_type,
      provider,
      category_ai,
      category_ai_conf,
      category_name,
      is_transfer,
      is_pass_through,
      flow_type
    `)
    .order("date", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Error fetching transactions:", error.message);
    process.exit(1);
  }

  if (!transactions || transactions.length === 0) {
    console.log("No transactions found. Please ensure data exists in the database.");
    process.exit(0);
  }

  console.log(`Found ${transactions.length} transactions.\n`);

  // Transform to export format
  const exportData: ExportedTransaction[] = transactions.map((t) => ({
    transaction_id: t.id,
    date: t.date,
    amount: t.amount,
    description_raw: t.description_raw,
    description_clean: t.description_clean,
    account_name: t.account_name,
    account_type: t.account_type,
    provider: t.provider,
    plaid_category: t.category_ai, // AI category from Plaid enrichment
    plaid_confidence: t.category_ai_conf,
    current_category: t.category_name,
    is_transfer: t.is_transfer ?? false,
    is_pass_through: t.is_pass_through ?? false,
    flow_type: t.flow_type,
  }));

  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Export to JSON
  const jsonPath = path.join(dataDir, "pilot_transactions.json");
  fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
  console.log(`✓ Exported to ${jsonPath}`);

  // Export to CSV for spreadsheet review
  const csvPath = path.join(dataDir, "pilot_transactions.csv");
  const csvHeaders = [
    "transaction_id",
    "date",
    "amount",
    "description_raw",
    "description_clean",
    "account_name",
    "account_type",
    "provider",
    "plaid_category",
    "plaid_confidence",
    "current_category",
    "is_transfer",
    "is_pass_through",
    "flow_type",
  ];

  const csvRows = exportData.map((t) =>
    csvHeaders
      .map((h) => {
        const value = t[h as keyof ExportedTransaction];
        // Escape quotes and wrap in quotes if contains comma
        const str = String(value ?? "");
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(",")
  );

  const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");
  fs.writeFileSync(csvPath, csvContent);
  console.log(`✓ Exported to ${csvPath}`);

  // Print summary statistics
  console.log("\n--- Summary ---");
  console.log(`Total transactions: ${exportData.length}`);
  
  const withPlaidCategory = exportData.filter((t) => t.plaid_category).length;
  console.log(`With Plaid category: ${withPlaidCategory} (${((withPlaidCategory / exportData.length) * 100).toFixed(1)}%)`);
  
  const transfers = exportData.filter((t) => t.is_transfer).length;
  console.log(`Marked as transfers: ${transfers}`);
  
  const passThrough = exportData.filter((t) => t.is_pass_through).length;
  console.log(`Marked as pass-through: ${passThrough}`);

  // Category distribution
  const categoryDist: Record<string, number> = {};
  exportData.forEach((t) => {
    const cat = t.plaid_category || "(uncategorized)";
    categoryDist[cat] = (categoryDist[cat] || 0) + 1;
  });

  console.log("\n--- Plaid Category Distribution (Top 10) ---");
  Object.entries(categoryDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });

  console.log("\n✓ Export complete. Next step: Create ground truth in data/pilot_ground_truth.json");
}

exportTransactions().catch(console.error);
