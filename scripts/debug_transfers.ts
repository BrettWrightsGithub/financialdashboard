import { createServerSupabaseClient } from "../lib/supabase";
import { autoDetectTransfers } from "../lib/categorization";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function debugTransfers() {
  try {
    const supabase = createServerSupabaseClient();
    
    console.log("Fetching recent transactions...");
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select(`
        *,
        accounts (
          name
        )
      `)
      .order("date", { ascending: false })
      .limit(100);

    if (error) throw error;

    console.log(`Found ${transactions?.length || 0} transactions.`);

    const flattened = transactions?.map(tx => ({
      ...tx,
      account_name: tx.accounts?.name
    })) || [];

    console.log("Running transfer detection...");
    const pairs = autoDetectTransfers(flattened as any, undefined, 0.5); // Lower confidence for debug

    if (pairs.length === 0) {
      console.log("No potential transfers found in the last 100 transactions.");
    } else {
      console.log(`\nFound ${pairs.length} potential transfer pairs:\n`);
      pairs.forEach((pair, i) => {
        const outflow = flattened.find(t => t.id === pair.outflowId);
        const inflow = flattened.find(t => t.id === pair.inflowId);
        
        console.log(`Pair #${i + 1} (Confidence: ${(pair.confidence * 100).toFixed(1)}%)`);
        console.log(`  OUT: ${outflow.date} | ${outflow.amount.toFixed(2)} | ${outflow.description_raw} [${outflow.account_name}]`);
        console.log(`  IN : ${inflow.date} | ${inflow.amount.toFixed(2)} | ${inflow.description_raw} [${inflow.account_name}]`);
        console.log('---');
      });
    }

  } catch (err) {
    console.error("Error:", err);
  }
}

debugTransfers();
