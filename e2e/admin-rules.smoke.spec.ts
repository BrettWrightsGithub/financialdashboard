import { expect, test } from "@playwright/test";

test.describe("Admin rules smoke", () => {
  test("loads rules page and baseline controls", async ({ page }) => {
    await page.route("**/api/categorization/rules**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rules: [] }),
      });
    });

    await page.route("**/api/categories**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ categories: [] }),
      });
    });

    await page.goto("/admin/rules");

    await expect(page.getByRole("heading", { name: "Categorization Rules" })).toBeVisible();
    await expect(page.getByRole("button", { name: /\+ Add Rule|Add Rule/ })).toBeVisible();
    await expect(page.getByText("No rules configured yet.")).toBeVisible();
  });
});
