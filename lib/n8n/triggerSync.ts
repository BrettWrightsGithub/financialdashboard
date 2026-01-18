export async function triggerPlaidSync(accountId?: string) {
  if (!process.env.N8N_WEBHOOK_URL) {
    console.warn("N8N_WEBHOOK_URL is not defined. Skipping sync trigger.");
    return { success: false, error: "N8n configuration missing" };
  }

  const baseUrl = process.env.N8N_WEBHOOK_URL.replace(/\/$/, "");
  const url = `${baseUrl}/trigger-sync`;

  console.log(`[Sync] Triggering N8n webhook: ${url}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: accountId }),
    });

    if (!response.ok) {
      throw new Error(`N8n responded with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to trigger Plaid sync:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function triggerRetroactiveRules(batchId: string, transactionIds: string[]) {
  if (!process.env.N8N_WEBHOOK_URL) {
    console.warn("N8N_WEBHOOK_URL is not defined. Skipping rule application.");
    return { success: false, error: "N8n configuration missing" };
  }

  const baseUrl = process.env.N8N_WEBHOOK_URL.replace(/\/$/, "");
  const url = `${baseUrl}/apply-rules-retroactive`;

  console.log(`[Sync] Triggering retroactive rules webhook: ${url}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batchId, transaction_ids: transactionIds }),
    });

    if (!response.ok) {
      throw new Error(`N8n responded with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to trigger retroactive rules:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
