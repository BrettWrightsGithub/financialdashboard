export const AMAZON_MARKETPLACE = "amazon.com" as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeMoney(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
      ? Number(value)
      : NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function normalizePositiveNumber(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null) {
    return fallback;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
      ? Number(value)
      : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 1000) / 1000;
}

function normalizeCurrency(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return "USD";
  }

  return value.trim().toUpperCase().slice(0, 8);
}

export interface AmazonSyncCursor {
  last_order_id: string | null;
  last_order_date: string | null;
  page: number | null;
}

export interface NormalizedAmazonOrderItem {
  title: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
  raw_item_json: UnknownRecord;
}

export interface NormalizedAmazonOrder {
  provider_order_id: string;
  order_date: string;
  order_total: number;
  currency: string;
  merchant_name: string;
  tax_amount: number | null;
  shipping_amount: number | null;
  items: NormalizedAmazonOrderItem[];
  raw_order_json: UnknownRecord;
}

export interface NormalizedAmazonIngestPayload {
  marketplace: typeof AMAZON_MARKETPLACE;
  scraped_at: string;
  sync_cursor: AmazonSyncCursor | null;
  orders: NormalizedAmazonOrder[];
}

export type AmazonPayloadValidationResult =
  | { ok: true; data: NormalizedAmazonIngestPayload }
  | { ok: false; error: string };

export function parseAmazonIngestPayload(body: unknown): AmazonPayloadValidationResult {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const marketplaceRaw =
    typeof body.marketplace === "string" && body.marketplace.trim()
      ? body.marketplace.trim().toLowerCase()
      : AMAZON_MARKETPLACE;

  if (marketplaceRaw !== AMAZON_MARKETPLACE) {
    return {
      ok: false,
      error: `V1 only supports marketplace '${AMAZON_MARKETPLACE}'`,
    };
  }

  if (!Array.isArray(body.orders)) {
    return { ok: false, error: "orders must be an array" };
  }

  const normalizedOrders: NormalizedAmazonOrder[] = [];

  for (let orderIndex = 0; orderIndex < body.orders.length; orderIndex += 1) {
    const rawOrder = body.orders[orderIndex];
    if (!isRecord(rawOrder)) {
      return { ok: false, error: `orders[${orderIndex}] must be an object` };
    }

    const providerOrderId =
      typeof rawOrder.provider_order_id === "string" ? rawOrder.provider_order_id.trim() : "";
    if (!providerOrderId) {
      return { ok: false, error: `orders[${orderIndex}].provider_order_id is required` };
    }

    const orderDate = normalizeDate(rawOrder.order_date);
    if (!orderDate) {
      return { ok: false, error: `orders[${orderIndex}].order_date must be a valid date` };
    }

    const orderTotal = normalizeMoney(rawOrder.order_total);
    if (orderTotal === null || orderTotal <= 0) {
      return { ok: false, error: `orders[${orderIndex}].order_total must be greater than 0` };
    }

    if (!Array.isArray(rawOrder.items) || rawOrder.items.length === 0) {
      return { ok: false, error: `orders[${orderIndex}].items must contain at least one item` };
    }

    const normalizedItems: NormalizedAmazonOrderItem[] = [];

    for (let itemIndex = 0; itemIndex < rawOrder.items.length; itemIndex += 1) {
      const rawItem = rawOrder.items[itemIndex];
      if (!isRecord(rawItem)) {
        return {
          ok: false,
          error: `orders[${orderIndex}].items[${itemIndex}] must be an object`,
        };
      }

      const title = typeof rawItem.title === "string" ? rawItem.title.trim() : "";
      if (!title) {
        return {
          ok: false,
          error: `orders[${orderIndex}].items[${itemIndex}].title is required`,
        };
      }

      const quantity = normalizePositiveNumber(rawItem.quantity, 1);
      if (quantity === null) {
        return {
          ok: false,
          error: `orders[${orderIndex}].items[${itemIndex}].quantity must be greater than 0`,
        };
      }

      const lineTotal = normalizeMoney(rawItem.line_total);
      if (lineTotal === null || lineTotal <= 0) {
        return {
          ok: false,
          error: `orders[${orderIndex}].items[${itemIndex}].line_total must be greater than 0`,
        };
      }

      let unitPrice: number | null = null;
      if (rawItem.unit_price !== undefined && rawItem.unit_price !== null) {
        unitPrice = normalizeMoney(rawItem.unit_price);
        if (unitPrice === null || unitPrice < 0) {
          return {
            ok: false,
            error: `orders[${orderIndex}].items[${itemIndex}].unit_price must be a valid number`,
          };
        }
      }

      normalizedItems.push({
        title,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        raw_item_json: isRecord(rawItem.raw_item_json) ? rawItem.raw_item_json : rawItem,
      });
    }

    const taxAmount =
      rawOrder.tax_amount === undefined || rawOrder.tax_amount === null
        ? null
        : normalizeMoney(rawOrder.tax_amount);
    if (rawOrder.tax_amount !== undefined && rawOrder.tax_amount !== null && taxAmount === null) {
      return { ok: false, error: `orders[${orderIndex}].tax_amount must be a valid number` };
    }

    const shippingAmount =
      rawOrder.shipping_amount === undefined || rawOrder.shipping_amount === null
        ? null
        : normalizeMoney(rawOrder.shipping_amount);
    if (
      rawOrder.shipping_amount !== undefined &&
      rawOrder.shipping_amount !== null &&
      shippingAmount === null
    ) {
      return {
        ok: false,
        error: `orders[${orderIndex}].shipping_amount must be a valid number`,
      };
    }

    normalizedOrders.push({
      provider_order_id: providerOrderId,
      order_date: orderDate,
      order_total: orderTotal,
      currency: normalizeCurrency(rawOrder.currency),
      merchant_name:
        typeof rawOrder.merchant_name === "string" && rawOrder.merchant_name.trim().length > 0
          ? rawOrder.merchant_name.trim()
          : "Amazon",
      tax_amount: taxAmount,
      shipping_amount: shippingAmount,
      items: normalizedItems,
      raw_order_json: isRecord(rawOrder.raw_order_json) ? rawOrder.raw_order_json : rawOrder,
    });
  }

  let syncCursor: AmazonSyncCursor | null = null;
  if (body.sync_cursor !== undefined && body.sync_cursor !== null) {
    if (!isRecord(body.sync_cursor)) {
      return { ok: false, error: "sync_cursor must be an object" };
    }

    const lastOrderId =
      typeof body.sync_cursor.last_order_id === "string" && body.sync_cursor.last_order_id.trim().length > 0
        ? body.sync_cursor.last_order_id.trim()
        : null;

    let lastOrderDate: string | null = null;
    if (body.sync_cursor.last_order_date !== undefined && body.sync_cursor.last_order_date !== null) {
      lastOrderDate = normalizeDate(body.sync_cursor.last_order_date);
      if (!lastOrderDate) {
        return { ok: false, error: "sync_cursor.last_order_date must be a valid date" };
      }
    }

    let page: number | null = null;
    if (body.sync_cursor.page !== undefined && body.sync_cursor.page !== null) {
      const parsedPage = Number(body.sync_cursor.page);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        return { ok: false, error: "sync_cursor.page must be a positive integer" };
      }
      page = parsedPage;
    }

    syncCursor = {
      last_order_id: lastOrderId,
      last_order_date: lastOrderDate,
      page,
    };
  }

  const scrapedAt =
    typeof body.scraped_at === "string" && !Number.isNaN(new Date(body.scraped_at).getTime())
      ? new Date(body.scraped_at).toISOString()
      : new Date().toISOString();

  return {
    ok: true,
    data: {
      marketplace: AMAZON_MARKETPLACE,
      scraped_at: scrapedAt,
      sync_cursor: syncCursor,
      orders: normalizedOrders,
    },
  };
}
