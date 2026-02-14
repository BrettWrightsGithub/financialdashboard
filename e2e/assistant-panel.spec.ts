import { expect, test } from "@playwright/test";

test.describe("assistant panel v2", () => {
  test("open/close and panel controls are interactive", async ({ page }) => {
    await page.goto("/");

    const openButton = page
      .locator("button", { hasText: "Assistant" })
      .filter({ hasNotText: "Close" })
      .first();
    await expect(openButton).toBeVisible();
    await openButton.click();

    const panel = page.locator("[data-assistant-panel-v2]");
    await expect(panel).toBeVisible();

    const closeButton = panel.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible();

    const newChatButton = panel.getByRole("button", { name: "New chat" }).first();
    await expect(newChatButton).toBeVisible();
    await newChatButton.click();

    const reconnectButton = panel.getByRole("button", { name: "Reconnect" });
    if (await reconnectButton.isVisible()) {
      await reconnectButton.click();
    }

    const historySelect = panel.locator("select");
    await expect(historySelect).toBeVisible();

    const messageInput = panel.locator("textarea").first();
    await expect(messageInput).toBeVisible();
    await expect(messageInput).toBeEnabled();
    await messageInput.fill("playwright button test");

    const sendButton = panel.getByRole("button", { name: "Send" });
    await expect(sendButton).toBeVisible();
    if (await sendButton.isEnabled()) {
      await sendButton.click();
    }

    await closeButton.click();
    await expect(panel).toBeHidden();
  });
});
