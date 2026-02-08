import type { NormalizedAmazonIngestPayload, NormalizedAmazonOrder } from "@/lib/intake/amazon/contracts";

type SupabaseLike = {
  from: (table: string) => any;
};

async function requireSingleId(
  queryResult: PromiseLike<{ data: { id: string } | null; error: { message: string } | null }>,
  context: string
): Promise<string> {
  const { data, error } = await queryResult;
  if (error || !data?.id) {
    throw new Error(`${context}: ${error?.message || "missing id"}`);
  }
  return data.id;
}

async function ensureNoError(
  queryResult: PromiseLike<{ error: { message: string } | null }>,
  context: string
): Promise<void> {
  const { error } = await queryResult;
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function upsertOrder(
  supabase: SupabaseLike,
  marketplace: string,
  order: NormalizedAmazonOrder,
  now: string
): Promise<{ artifactId: string; extractionId: string; externalOrderId: string }> {
  const artifactId = await requireSingleId(
    supabase
      .from("intake_artifacts")
      .upsert(
        {
          source_type: "amazon_extension",
          marketplace,
          provider_order_id: order.provider_order_id,
          status: "parsed",
          raw_payload_json: order.raw_order_json,
          received_at: now,
          processed_at: now,
          updated_at: now,
        },
        { onConflict: "source_type,marketplace,provider_order_id" }
      )
      .select("id")
      .single(),
    `Failed to upsert intake artifact for order ${order.provider_order_id}`
  );

  const extractionId = await requireSingleId(
    supabase
      .from("intake_extractions")
      .upsert(
        {
          artifact_id: artifactId,
          merchant_name: order.merchant_name,
          transaction_date: order.order_date,
          currency: order.currency,
          total_amount: order.order_total,
          tax_amount: order.tax_amount,
          shipping_amount: order.shipping_amount,
          raw_extraction_json: order.raw_order_json,
          extraction_confidence: 1,
          updated_at: now,
        },
        { onConflict: "artifact_id" }
      )
      .select("id")
      .single(),
    `Failed to upsert extraction for order ${order.provider_order_id}`
  );

  await ensureNoError(
    supabase.from("intake_line_items").delete().eq("extraction_id", extractionId),
    `Failed to clear old line items for order ${order.provider_order_id}`
  );

  await ensureNoError(
    supabase.from("intake_matches").upsert(
      {
        extraction_id: extractionId,
        status: "unmatched",
        updated_at: now,
      },
      { onConflict: "extraction_id", ignoreDuplicates: true }
    ),
    `Failed to ensure intake match row for order ${order.provider_order_id}`
  );

  if (order.items.length > 0) {
    await ensureNoError(
      supabase.from("intake_line_items").insert(
        order.items.map((item, lineIndex) => ({
          extraction_id: extractionId,
          line_index: lineIndex,
          description: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          raw_item_json: item.raw_item_json,
          updated_at: now,
        }))
      ),
      `Failed to insert line items for order ${order.provider_order_id}`
    );
  }

  const externalOrderId = await requireSingleId(
    supabase
      .from("external_orders")
      .upsert(
        {
          intake_artifact_id: artifactId,
          marketplace,
          provider_order_id: order.provider_order_id,
          order_date: order.order_date,
          order_total: order.order_total,
          currency: order.currency,
          raw_payload_json: order.raw_order_json,
          updated_at: now,
        },
        { onConflict: "marketplace,provider_order_id" }
      )
      .select("id")
      .single(),
    `Failed to upsert external order row for ${order.provider_order_id}`
  );

  await ensureNoError(
    supabase.from("external_order_items").delete().eq("external_order_id", externalOrderId),
    `Failed to clear old external items for order ${order.provider_order_id}`
  );

  if (order.items.length > 0) {
    await ensureNoError(
      supabase.from("external_order_items").insert(
        order.items.map((item, lineIndex) => ({
          external_order_id: externalOrderId,
          line_index: lineIndex,
          item_title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          raw_item_json: item.raw_item_json,
          updated_at: now,
        }))
      ),
      `Failed to insert external order items for ${order.provider_order_id}`
    );
  }

  return {
    artifactId,
    extractionId,
    externalOrderId,
  };
}

export interface AmazonIngestResult {
  received_orders: number;
  upserted_orders: number;
  upserted_items: number;
  marketplace: string;
  sync_cursor: NormalizedAmazonIngestPayload["sync_cursor"];
}

export async function ingestAmazonPayload(
  supabase: SupabaseLike,
  payload: NormalizedAmazonIngestPayload
): Promise<AmazonIngestResult> {
  const now = new Date().toISOString();
  let upsertedOrders = 0;
  let upsertedItems = 0;

  for (const order of payload.orders) {
    await upsertOrder(supabase, payload.marketplace, order, now);
    upsertedOrders += 1;
    upsertedItems += order.items.length;
  }

  return {
    received_orders: payload.orders.length,
    upserted_orders: upsertedOrders,
    upserted_items: upsertedItems,
    marketplace: payload.marketplace,
    sync_cursor: payload.sync_cursor,
  };
}
