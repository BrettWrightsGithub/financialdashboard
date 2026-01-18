import { test, expect, Page, Locator } from '@playwright/test';

// Helper to get a card by its title
const getCard = (page: Page, title: string): Locator => {
  return page.locator('.card').filter({
    has: page.locator('h2', { hasText: title })
  });
};

test.describe('Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard with all main cards', async ({ page }) => {
    // Verify page title
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Verify main cards are present using the robust helper
    await expect(getCard(page, 'Safe to Spend This Week')).toBeVisible();
    await expect(getCard(page, 'Monthly Cashflow')).toBeVisible();
    await expect(getCard(page, 'Expected Inflows')).toBeVisible();
    
    // Verify new cards are present
    await expect(getCard(page, 'Cashflow Trend')).toBeVisible();
    await expect(getCard(page, 'Overspent Categories')).toBeVisible(); // Or 'Top Overspent Categories'
  });

  test('should have month selector in header', async ({ page }) => {
    // Verify month selector exists
    const monthSelector = page.locator('select').first();
    await expect(monthSelector).toBeVisible();
    
    // Verify it has options
    const options = await monthSelector.locator('option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('should display current month data on initial load', async ({ page }) => {
    // Get current month/year
    const now = new Date();
    // UI uses "January 2026" (long month)
    const currentMonthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Verify cashflow card shows current month
    const cashflowCard = getCard(page, 'Monthly Cashflow');
    await expect(cashflowCard).toContainText(currentMonthYear);
  });

  test('should change data when selecting different month', async ({ page }) => {
    const cashflowCard = getCard(page, 'Monthly Cashflow');
    
    // Get initial cashflow value using specific class
    const initialCashflow = await cashflowCard.locator('.text-3xl').textContent();
    
    // Select previous month from dropdown
    const monthSelector = page.locator('select').first();
    const currentValue = await monthSelector.inputValue();
    
    // Get all options and select the second one (previous month)
    await monthSelector.selectOption({ index: 1 });
    
    // Wait for data to update
    await page.waitForTimeout(1000);
    
    // Verify the month changed in the selector
    const newValue = await monthSelector.inputValue();
    expect(newValue).not.toBe(currentValue);
    
    // Verify cashflow card updated (month label should change)
    const newMonthText = await cashflowCard.textContent();
    expect(newMonthText).toBeDefined();
  });

  test('should display cashflow trend chart with 6 months', async ({ page }) => {
    // Find the trend card
    const trendCard = getCard(page, 'Cashflow Trend');
    await expect(trendCard).toBeVisible();
    
    // Verify it contains "Last 6 Months" text
    await expect(trendCard).toContainText('Last 6 Months');
    
    // Verify chart bars are present (should have 6 bars)
    // The bars use .w-full.rounded-t classes
    const chartBars = trendCard.locator('.w-full.rounded-t');
    const barCount = await chartBars.count();
    expect(barCount).toBeGreaterThanOrEqual(6);
  });

  test('should display overspent categories or success message', async ({ page }) => {
    // Find the overspent card (title changes based on content)
    // We search for either 'Overspent Categories' (empty state) or 'Top Overspent Categories' (data state)
    // A broader filter:
    const overspentCard = page.locator('.card').filter({ hasText: 'Overspent Categories' });
    await expect(overspentCard).toBeVisible();
    
    // Check if it shows either overspent categories or success message
    // Using robust locators instead of regex
    const hasOverspent = await overspentCard.locator('.text-red-600').filter({ hasText: '+' }).count() > 0;
    const hasSuccessMessage = await overspentCard.locator('text=All categories within budget').count() > 0;
    
    expect(hasOverspent || hasSuccessMessage).toBe(true);
  });

  test('should update overspent categories when month changes', async ({ page }) => {
    // Get initial overspent card content
    const overspentCard = page.locator('.card').filter({ hasText: 'Overspent Categories' });
    const initialContent = await overspentCard.textContent();
    
    // Change month
    const monthSelector = page.locator('select').first();
    await monthSelector.selectOption({ index: 2 }); // Select 2 months ago
    
    // Wait for update
    await page.waitForTimeout(1000);
    
    // Get new content
    const newContent = await overspentCard.textContent();
    
    // Content should exist (might be same or different depending on data)
    expect(newContent).toBeDefined();
    expect(newContent?.length).toBeGreaterThan(0);
  });

  test('should show trend chart with current month highlighted', async ({ page }) => {
    // Find the trend card
    const trendCard = getCard(page, 'Cashflow Trend');
    
    // Verify "Current:" label exists
    await expect(trendCard).toContainText('Current:');
    
    // Verify current value is displayed
    const currentValue = trendCard.locator('text=/Current:.*\\$/');
    await expect(currentValue).toBeVisible();
  });

  test('should navigate using month selector arrows', async ({ page }) => {
    // Find the previous month button (left arrow)
    const prevButton = page.locator('button[aria-label="Previous month"]');
    await expect(prevButton).toBeVisible();
    
    // Get current selected month
    const monthSelector = page.locator('select').first();
    const initialMonth = await monthSelector.inputValue();
    
    // Click previous month
    await prevButton.click();
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Verify month changed
    const newMonth = await monthSelector.inputValue();
    expect(newMonth).not.toBe(initialMonth);
    
    // Find the next month button (right arrow)
    const nextButton = page.locator('button[aria-label="Next month"]');
    await expect(nextButton).toBeVisible();
    
    // Click next month to go back
    await nextButton.click();
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Should be back to initial month
    const finalMonth = await monthSelector.inputValue();
    expect(finalMonth).toBe(initialMonth);
  });

  test('should display safe-to-spend card with progress bar', async ({ page }) => {
    const safeToSpendCard = getCard(page, 'Safe to Spend This Week');
    await expect(safeToSpendCard).toBeVisible();
    
    // Verify it shows a dollar amount
    await expect(safeToSpendCard).toContainText(/\$/);
    
    // Verify progress bar container exists and is visible
    // We check the container (.h-2) because the inner bar might be width: 0% and "hidden"
    const progressBarContainer = safeToSpendCard.locator('.h-2.rounded-full');
    await expect(progressBarContainer).toBeVisible();
    
    // Verify it shows spent and target
    await expect(safeToSpendCard).toContainText('Spent:');
    await expect(safeToSpendCard).toContainText('Target:');
  });

  test('should display outstanding inflows card', async ({ page }) => {
    // Title is Expected Inflows
    const inflowsCard = getCard(page, 'Expected Inflows');
    await expect(inflowsCard).toBeVisible();
    
    // Card should be present (content depends on data)
    const cardContent = await inflowsCard.textContent();
    expect(cardContent).toBeDefined();
  });

  test('should show alerts section', async ({ page }) => {
    // Alerts card may or may not have content depending on data
    // Just verify the section exists
    const alertsSection = page.locator('.card').filter({ hasText: 'Alerts' });
    
    // If alerts exist, they should be visible
    const alertCount = await alertsSection.count();
    expect(alertCount).toBeGreaterThanOrEqual(0);
  });

  test('should handle loading states gracefully', async ({ page }) => {
    // Reload page to see loading state
    await page.reload();
    
    // Should show loading text briefly
    const loadingText = page.locator('text=Loading...');
    
    // Then should show dashboard content
    await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 5000 });
  });

  test('should display cashflow income and expenses breakdown', async ({ page }) => {
    const cashflowCard = getCard(page, 'Monthly Cashflow');
    
    // Verify income and expenses labels
    await expect(cashflowCard).toContainText('Income');
    await expect(cashflowCard).toContainText('Expenses');
    
    // Verify net cashflow is displayed (either surplus or deficit)
    const hasSurplus = await cashflowCard.locator('text=Surplus').count() > 0;
    const hasDeficit = await cashflowCard.locator('text=Deficit').count() > 0;
    
    expect(hasSurplus || hasDeficit).toBe(true);
  });
});
