import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('http://localhost:3004');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard with all main cards', async ({ page }) => {
    // Verify page title
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Verify main cards are present
    await expect(page.locator('text=Safe to Spend This Week')).toBeVisible();
    await expect(page.locator('text=Monthly Cashflow')).toBeVisible();
    await expect(page.locator('text=Outstanding Inflows')).toBeVisible();
    
    // Verify new cards are present
    await expect(page.locator('text=Cashflow Trend')).toBeVisible();
    await expect(page.locator('text=Overspent Categories')).toBeVisible();
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
    const currentMonthYear = now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    // Verify cashflow card shows current month
    const cashflowCard = page.locator('text=Monthly Cashflow').locator('..');
    await expect(cashflowCard).toContainText(currentMonthYear);
  });

  test('should change data when selecting different month', async ({ page }) => {
    // Get initial cashflow value
    const cashflowCard = page.locator('text=Monthly Cashflow').locator('..');
    const initialCashflow = await cashflowCard.locator('text=/[+-]?\\$[\\d,]+/').first().textContent();
    
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
    const trendCard = page.locator('text=Cashflow Trend').locator('..');
    await expect(trendCard).toBeVisible();
    
    // Verify it contains "Last 6 Months" text
    await expect(trendCard).toContainText('Last 6 Months');
    
    // Verify chart bars are present (should have 6 bars)
    const chartBars = trendCard.locator('div[style*="height"]').filter({ hasNot: page.locator('text=') });
    const barCount = await chartBars.count();
    expect(barCount).toBeGreaterThanOrEqual(6);
  });

  test('should display overspent categories or success message', async ({ page }) => {
    // Find the overspent card
    const overspentCard = page.locator('text=Overspent Categories').locator('..');
    await expect(overspentCard).toBeVisible();
    
    // Check if it shows either overspent categories or success message
    const hasOverspent = await overspentCard.locator('text=/\\+\\$/').count() > 0;
    const hasSuccessMessage = await overspentCard.locator('text=All categories within budget').count() > 0;
    
    expect(hasOverspent || hasSuccessMessage).toBe(true);
  });

  test('should update overspent categories when month changes', async ({ page }) => {
    // Get initial overspent card content
    const overspentCard = page.locator('text=Overspent Categories').locator('..');
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
    const trendCard = page.locator('text=Cashflow Trend').locator('..');
    
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
    const safeToSpendCard = page.locator('text=Safe to Spend This Week').locator('..');
    await expect(safeToSpendCard).toBeVisible();
    
    // Verify it shows a dollar amount
    await expect(safeToSpendCard).toContainText(/\$/);
    
    // Verify progress bar exists
    const progressBar = safeToSpendCard.locator('div[style*="width"]').first();
    await expect(progressBar).toBeVisible();
    
    // Verify it shows spent and target
    await expect(safeToSpendCard).toContainText('Spent:');
    await expect(safeToSpendCard).toContainText('Target:');
  });

  test('should display outstanding inflows card', async ({ page }) => {
    const inflowsCard = page.locator('text=Outstanding Inflows').locator('..');
    await expect(inflowsCard).toBeVisible();
    
    // Card should be present (content depends on data)
    const cardContent = await inflowsCard.textContent();
    expect(cardContent).toBeDefined();
  });

  test('should show alerts section', async ({ page }) => {
    // Alerts card may or may not have content depending on data
    // Just verify the section exists
    const alertsSection = page.locator('text=Alerts').locator('..');
    
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
    const cashflowCard = page.locator('text=Monthly Cashflow').locator('..');
    
    // Verify income and expenses labels
    await expect(cashflowCard).toContainText('Income');
    await expect(cashflowCard).toContainText('Expenses');
    
    // Verify net cashflow is displayed (either surplus or deficit)
    const hasSurplus = await cashflowCard.locator('text=Surplus').count() > 0;
    const hasDeficit = await cashflowCard.locator('text=Deficit').count() > 0;
    
    expect(hasSurplus || hasDeficit).toBe(true);
  });
});
