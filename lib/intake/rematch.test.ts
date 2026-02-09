/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";

function makeMatchableSupabase(transactionRows: any[]) {
  const artifactRows = [
    {
      id: "artifact-1",
      source_type: "amazon_extension",
      status: "parsed",
      provider_order_id: "114-1111111-1111111",
    },
  ];

  const extractionRows = [
    {
      id: "extraction-1",
      artifact_id: "artifact-1",
      transaction_date: "2026-02-01",
      total_amount: 42.19,
      merchant_name: "Amazon",
    },
  ];

  const matchesRows: any[] = [];
  const rematchRuns: any[] = [];

  return {
    from(table: string) {
      if (table === "intake_rematch_runs") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => {
                const run = { id: `run-${rematchRuns.length + 1}`, started_at: new Date().toISOString() };
                rematchRuns.push(run);
                return { data: run, error: null } as any;
              },
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null } as any),
          }),
        } as any;
      }

      if (table === "intake_artifacts") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: async () => ({ data: artifactRows, error: null } as any),
                }),
              }),
            }),
          }),
          update: () => ({ eq: async () => ({ error: null } as any) }),
        } as any;
      }

      if (table === "intake_extractions") {
        return {
          select: () => ({
            in: async () => ({ data: extractionRows, error: null } as any),
          }),
        } as any;
      }

      if (table === "intake_matches") {
        return {
          select: () => ({ in: async () => ({ data: matchesRows, error: null } as any) }),
          upsert: async () => ({ error: null } as any),
        } as any;
      }

      if (table === "transactions") {
        return {
          select: () => ({
            eq: () => ({
              neq: async () => ({ count: transactionRows.length, error: null } as any),
              gte: () => ({
                lte: async () => ({ data: transactionRows, error: null } as any),
              }),
            }),
            maybeSingle: async () => ({ data: null, error: null } as any),
          }),
          update: () => ({
            eq: () => ({
              eq: async () => ({ error: null } as any),
            }),
          }),
        } as any;
      }

      throw new Error(`Unhandled table: ${table}`);
    },
  };
}

// Import lazily so test-local fake supabase shape can stay minimal.
import { runIntakeRematch } from "@/lib/intake/rematch";

describe("runIntakeRematch", () => {
  it("marks extraction as suggested when a high-confidence candidate exists", async () => {
    const supabase = makeMatchableSupabase([
      {
        id: "txn-1",
        amount: -42.19,
        date: "2026-02-01",
        description_raw: "AMAZON MKTPLACE PMTS",
        status: "posted",
        is_split_child: false,
        is_split_parent: false,
        provider: "plaid",
      },
    ]);

    const result = await runIntakeRematch(supabase as any, {
      sourceType: "amazon_extension",
      limit: 10,
    });

    expect(result.source_type).toBe("amazon_extension");
    expect(result.processed_count).toBe(1);
    expect(result.suggested_count).toBe(1);
    expect(result.unmatched_count).toBe(0);
  });

  it("marks extraction unmatched when there are no synced transactions", async () => {
    const supabase = makeMatchableSupabase([]);

    const result = await runIntakeRematch(supabase as any, {
      sourceType: "amazon_extension",
      limit: 10,
    });

    expect(result.processed_count).toBe(1);
    expect(result.unmatched_count).toBe(1);
  });
});
