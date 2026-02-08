import { describe, expect, it } from "vitest";
import { AMAZON_MARKETPLACE, parseAmazonIngestPayload } from "@/lib/intake/amazon/contracts";

describe("parseAmazonIngestPayload", () => {
  it("normalizes a valid payload", () => {
    const result = parseAmazonIngestPayload({
      marketplace: "amazon.com",
      scraped_at: "2026-02-08T12:00:00.000Z",
      sync_cursor: {
        last_order_id: "111-2222222-3333333",
        last_order_date: "2026-02-07",
        page: 2,
      },
      orders: [
        {
          provider_order_id: "111-2222222-3333333",
          order_date: "2026-02-07",
          order_total: "48.99",
          currency: "usd",
          merchant_name: "Amazon Marketplace",
          items: [
            {
              title: "Protein Bars",
              quantity: "2",
              unit_price: "12.99",
              line_total: "25.98",
            },
            {
              title: "Shampoo",
              line_total: 23.01,
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.marketplace).toBe(AMAZON_MARKETPLACE);
    expect(result.data.orders).toHaveLength(1);
    expect(result.data.orders[0].currency).toBe("USD");
    expect(result.data.orders[0].items[0].quantity).toBe(2);
    expect(result.data.orders[0].items[1].quantity).toBe(1);
    expect(result.data.sync_cursor?.page).toBe(2);
  });

  it("rejects non-amazon.com marketplaces in V1", () => {
    const result = parseAmazonIngestPayload({
      marketplace: "amazon.co.uk",
      orders: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toContain("amazon.com");
  });

  it("rejects invalid item payloads", () => {
    const result = parseAmazonIngestPayload({
      orders: [
        {
          provider_order_id: "111-2222222-3333333",
          order_date: "2026-02-07",
          order_total: 10,
          items: [
            {
              title: "",
              line_total: 10,
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toContain("title is required");
  });
});
