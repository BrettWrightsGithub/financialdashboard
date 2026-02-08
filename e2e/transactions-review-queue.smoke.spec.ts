import { expect, test, type Page } from "@playwright/test";

async function stubTransactionsData(page: Page) {
  const categories = [
    {
      id: "cat-rent",
      name: "Rental Income",
      cashflow_group: "Income",
      description: null,
      color: null,
      icon: null,
      sort_order: 1,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  const accounts = [
    {
      id: "acct-1",
      provider: "plaid",
      provider_account_id: "provider-acct-1",
      name: "Checking",
      display_name: "Checking",
      institution_id: null,
      institution_name: "Test Bank",
      currency: "USD",
      status: "active",
      subtype: "checking",
      balance_class: "Asset",
      account_group: "Cash",
      owner: "Joint",
      is_primary_cashflow: true,
      include_in_cashflow: true,
      last_four: null,
      ledger_balance: null,
      available_balance: null,
      current_balance: null,
      credit_limit: null,
      interest_rate_apr: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith("/categories")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(categories),
      });
      return;
    }

    if (url.pathname.endsWith("/accounts")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(accounts),
      });
      return;
    }

    if (url.pathname.endsWith("/v_transactions_with_details")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}

test.describe("Transactions review queue smoke", () => {
  test("redirects /review-queue to /transactions", async ({ page }) => {
    await stubTransactionsData(page);
    await page.route("**/api/review-queue**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ transactions: [] }),
      });
    });

    await page.goto("/review-queue");
    await expect(page).toHaveURL(/\/transactions$/);
  });

  test("uses header confirm flow to save selected queue rows", async ({ page }) => {
    await stubTransactionsData(page);

    await page.route("**/api/review-queue**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transactions: [
            {
              id: "tx-rent",
              provider: "plaid",
              provider_transaction_id: "prov-tx-rent",
              account_id: "acct-1",
              provider_account_id: "provider-acct-1",
              date: "2026-01-10",
              amount: 1200,
              description_raw: "Venmo rent payment",
              description_clean: "Venmo rent payment",
              life_category_id: null,
              cashflow_group: "Income",
              flow_type: "Income",
              category_ai: "rental_income",
              category_ai_conf: 0.12,
              category_locked: false,
              status: "posted",
              provider_type: null,
              processing_status: null,
              counterparty_name: null,
              counterparty_id: null,
              is_transfer: false,
              transfer_pair_id: null,
              transfer_match_confidence: null,
              transfer_match_source: null,
              is_pass_through: false,
              is_business: false,
              category_source: null,
              parent_transaction_id: null,
              is_split_child: false,
              is_split_parent: false,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
              account_name: "Checking",
              institution_name: "Test Bank",
              category_name: null,
              category_confidence: 0.12,
            },
          ],
        }),
      });
    });

    const bulkEditRequest = page.waitForRequest("**/api/transactions/bulk-edit");
    await page.route("**/api/transactions/bulk-edit", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/transactions");
    await expect(page.getByText("Review Queue")).toBeVisible();
    await expect(page.getByText("Venmo rent payment")).toBeVisible();

    const reviewQueue = page.locator("section.card", { hasText: "Review Queue" });
    const row = reviewQueue.locator("div.border").filter({ hasText: "Venmo rent payment" }).first();
    await row.locator('input[type="checkbox"]').check();

    await expect(row).toHaveClass(/border-blue-500/);
    await expect(reviewQueue.getByText("1 selected")).toBeVisible();
    await expect(reviewQueue.locator("select")).toHaveValue("cat-rent");

    await reviewQueue.getByRole("button", { name: "Confirm Selected" }).click();
    const request = await bulkEditRequest;

    expect(request.postDataJSON()).toEqual({
      action: "assign_category",
      transaction_ids: ["tx-rent"],
      category_id: "cat-rent",
      learn_payee: true,
    });

    await expect(reviewQueue.getByText("0 selected")).toBeVisible();
    await reviewQueue.getByRole("button", { name: "Show Processed (1)" }).click();
    await expect(reviewQueue.getByText("Saved")).toBeVisible();
  });
});
