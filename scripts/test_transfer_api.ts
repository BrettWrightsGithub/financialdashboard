import { createServerSupabaseClient } from "../lib/supabase";
import fs from "fs";
import path from "path";

// Manually load .env.local
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, ""); // Remove quotes
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.error("Error loading .env.local:", e);
}

async function testTransferFlow() {
  console.log("🧪 Starting Transfer Flow Test...");

  // 1. Detect Transfers
  console.log("\n1️⃣  Calling Detection API...");
  try {
    const supabase = createServerSupabaseClient();
    
    // Check if we have any unlinked transactions that LOOK like transfers
    const { data: candidates } = await supabase
      .from("transactions")
      .select("id, amount, description_raw, date, account_id")
      .is("transfer_pair_id", null)
      .limit(50);
      
    if (!candidates || candidates.length === 0) {
      console.log("⚠️ No candidate transactions found to test with.");
      return;
    }
    
    console.log(`Found ${candidates.length} candidates. Manual check for potential pairs...`);
    
    // Simple manual check for display
    const potentialPairs = [];
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const t1 = candidates[i];
        const t2 = candidates[j];
        
        // Simple heuristic: amount match + different ID
        if (Math.abs(t1.amount + t2.amount) < 0.1 && t1.id !== t2.id) {
           potentialPairs.push({ t1, t2 });
        }
      }
    }
    
    if (potentialPairs.length > 0) {
      console.log(`✅ Found ${potentialPairs.length} potential pairs in sample data!`);
      const pair = potentialPairs[0];
      console.log(`   Sample: ${pair.t1.description_raw} ($${pair.t1.amount}) <-> ${pair.t2.description_raw} ($${pair.t2.amount})`);
    } else {
      console.log("ℹ️ No obvious exact-amount pairs found in this small sample.");
    }

  } catch (err) {
    console.error("❌ Error during test:", err);
  }
}

testTransferFlow();