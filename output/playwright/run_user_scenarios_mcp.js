const fs = require('fs/promises');
const path = require('path');
const { chromium, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve('output/playwright');
const REPORT_JSON = path.join(SCREENSHOT_DIR, 'scenario-results.json');
const REPORT_MD = path.join(SCREENSHOT_DIR, 'scenario-results.md');

const BROWSER_CANDIDATES = [
  '/Users/brettdev/Library/Caches/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  undefined,
];

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function approxEqual(actual, expected, tolerance, label) {
  if (Number.isNaN(actual)) {
    throw new Error(`${label}: value is NaN`);
  }
  const delta = Math.abs(actual - expected);
  if (delta > tolerance) {
    throw new Error(`${label}: expected around ${expected} (+/- ${tolerance}), got ${actual}`);
  }
}

function moneyToNumber(value) {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (!cleaned) return NaN;
  return Number(cleaned);
}

function extractCurrencyValues(text) {
  const matches = text.match(/[+-]?\$\s?[\d,]+(?:\.\d+)?/g) || [];
  return matches.map((m) => moneyToNumber(m)).filter((n) => Number.isFinite(n));
}

async function ensureDir() {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
}

async function launchBrowser() {
  let lastError;
  for (const executablePath of BROWSER_CANDIDATES) {
    try {
      const browser = await chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
      });
      return browser;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function gotoPath(page, route, headingName) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  if (headingName) {
    await expect(page.getByRole('heading', { name: headingName })).toBeVisible({ timeout: 20000 });
  }
}

async function setMonth(page, month) {
  const monthSelect = page.locator('select').first();
  await expect(monthSelect).toBeVisible({ timeout: 15000 });
  await monthSelect.selectOption(month);
  await expect(monthSelect).toHaveValue(month, { timeout: 15000 });
}

async function selectOptionByRegex(selectLocator, regex) {
  const options = await selectLocator.locator('option').evaluateAll((nodes) =>
    nodes.map((n) => ({ value: n.getAttribute('value') || '', text: (n.textContent || '').trim() }))
  );
  const match = options.find((o) => regex.test(o.text));
  if (!match || !match.value) return null;
  await selectLocator.selectOption(match.value);
  return match.text;
}

async function selectFirstNonEmptyOption(selectLocator) {
  const options = await selectLocator.locator('option').evaluateAll((nodes) =>
    nodes
      .map((n) => ({ value: n.getAttribute('value') || '', text: (n.textContent || '').trim() }))
      .filter((o) => o.value)
  );
  if (!options.length) return null;
  await selectLocator.selectOption(options[0].value);
  return options[0].text;
}

async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
}

async function run() {
  await ensureDir();

  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  const results = [];
  const cleanupNotes = [];

  async function runScenario(id, name, fn) {
    const startedAt = Date.now();
    const entry = { id, name, status: 'PASS', durationMs: 0, checks: [], error: null };
    try {
      await fn(entry.checks, cleanupNotes);
    } catch (error) {
      entry.status = 'FAIL';
      entry.error = error instanceof Error ? error.message : String(error);
    } finally {
      entry.durationMs = Date.now() - startedAt;
      results.push(entry);
      const statusIcon = entry.status === 'PASS' ? 'PASS' : 'FAIL';
      console.log(`[${statusIcon}] Scenario ${id}: ${name}${entry.error ? ` -> ${entry.error}` : ''}`);
    }
  }

  // Scenario 1
  await runScenario(1, 'Daily Money Check-In (Read-Only)', async (checks) => {
    await gotoPath(page, '/', 'Dashboard');
    await setMonth(page, '2026-02');

    await expect(page.getByText('Safe to Spend This Week')).toBeVisible();
    await expect(page.getByText('Monthly Cashflow')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Expected Inflows' })).toBeVisible();
    await expect(page.getByText(/Overspent Categories|Top Overspent Categories/)).toBeVisible();
    checks.push('Core dashboard cards are visible for 2026-02.');

    const safeCard = page.locator('div.card', { hasText: 'Safe to Spend This Week' }).first();
    const safeValues = extractCurrencyValues(await safeCard.innerText());
    const safeToSpend = safeValues[0];
    approxEqual(safeToSpend, 69.28, 12, 'Safe-to-spend');
    checks.push(`Safe-to-spend is within expected range: ${safeToSpend}.`);

    const cashflowCard = page.locator('div.card', { hasText: 'Monthly Cashflow' }).first();
    const cashflowValues = extractCurrencyValues(await cashflowCard.innerText());
    const netCashflow = cashflowValues[0];
    approxEqual(netCashflow, 1841, 450, 'Net cashflow');
    checks.push(`Net cashflow is within expected range: ${netCashflow}.`);

    const inflowCard = page.locator('div.card', { hasText: 'Expected Inflows' }).first();
    await expect(inflowCard).toContainText(/T-Mobile Reimbursement/i);
    await expect(inflowCard).toContainText(/\$30/);
    checks.push('Outstanding inflow card shows T-Mobile Reimbursement pending $30.');

    await screenshot(page, 'scenario-01-dashboard-2026-02.png');
  });

  // Scenario 6
  await runScenario(6, 'Midweek Budget Guardrail Check (Read-Only)', async (checks) => {
    await gotoPath(page, '/', 'Dashboard');
    await setMonth(page, '2026-02');

    const overspentCard = page
      .locator('div.card')
      .filter({ hasText: /Overspent Categories|Top Overspent Categories/ })
      .first();
    await expect(overspentCard).toContainText(/All categories within budget/i);
    checks.push('Overspent card reports no overspent categories.');

    await gotoPath(page, '/budget-planner', 'Budget Planner');
    await setMonth(page, '2026-02');

    const groceriesRow = page.locator('tbody tr', { hasText: /Groceries/i }).first();
    await expect(groceriesRow).toBeVisible({ timeout: 15000 });

    const expectedCellText = await groceriesRow.locator('td').nth(3).innerText();
    const actualCellText = await groceriesRow.locator('td').nth(4).innerText();
    const expectedBudget = extractCurrencyValues(expectedCellText)[0];
    const groceriesActual = extractCurrencyValues(actualCellText)[0];

    approxEqual(expectedBudget, 800, 10, 'Groceries budget target');
    approxEqual(groceriesActual, 200, 40, 'Groceries actual');
    checks.push(`Groceries row is near expected values (actual ${groceriesActual} vs budget ${expectedBudget}).`);

    await screenshot(page, 'scenario-06-no-overspend.png');
  });

  // Scenario 7
  await runScenario(7, 'Track Missing Expected Inflows (Read-Only)', async (checks) => {
    await gotoPath(page, '/', 'Dashboard');
    await setMonth(page, '2026-02');

    const dashboardInflows = page.locator('div.card', { hasText: 'Expected Inflows' }).first();
    await expect(dashboardInflows).toContainText(/T-Mobile Reimbursement/i);
    await expect(dashboardInflows).toContainText(/\$30/);
    checks.push('Dashboard inflows include pending T-Mobile reimbursement at $30.');

    await gotoPath(page, '/budget-planner', 'Budget Planner');
    await setMonth(page, '2026-02');

    const expectedInflowsSection = page.locator('div.card', { hasText: 'Expected Inflows' }).first();
    await expect(expectedInflowsSection).toContainText(/T-Mobile Reimbursement/i);
    await expect(expectedInflowsSection).toContainText(/pending/i);
    await expect(expectedInflowsSection).toContainText(/\$30/);
    checks.push('Budget Planner Expected Inflows section matches dashboard pending inflow.');

    await screenshot(page, 'scenario-07-expected-inflows.png');
  });

  // Scenario 2
  await runScenario(2, 'Clear Review Queue (Write)', async (checks) => {
    await gotoPath(page, '/transactions', 'Transactions');

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-02-01');
    await dateInputs.nth(1).fill('2026-02-28');

    const reviewQueue = page.locator('section.card').filter({ hasText: 'Review Queue' }).first();
    await expect(reviewQueue).toBeVisible();

    const ashleyRow1 = reviewQueue.locator('div.border.rounded-lg', { hasText: /Adalynn preschool/i }).first();
    const ashleyRow2 = reviewQueue.locator('div.border.rounded-lg', { hasText: /February dates/i }).first();

    const row1Visible = await ashleyRow1.isVisible();
    const row2Visible = await ashleyRow2.isVisible();

    if (row1Visible && row2Visible) {
      checks.push('Both Ashley review-queue anchors are visible in active queue.');

      await ashleyRow1.locator('input[type="checkbox"]').check();
      await ashleyRow2.locator('input[type="checkbox"]').check();
      await expect(reviewQueue.getByText('2 selected')).toBeVisible();

      const categorySelect = reviewQueue.locator('select').first();
      const selectedCategory =
        (await selectOptionByRegex(categorySelect, /Household/i)) ||
        (await selectOptionByRegex(categorySelect, /Dining Out/i)) ||
        (await selectFirstNonEmptyOption(categorySelect));

      assertCondition(Boolean(selectedCategory), 'No category option available for review queue bulk assign.');

      await reviewQueue.getByRole('button', { name: 'Confirm Selected' }).click();
      await expect(reviewQueue.getByText('0 selected')).toBeVisible({ timeout: 15000 });
      await expect(reviewQueue.getByText(/Processed \(/)).toBeVisible({ timeout: 15000 });
      checks.push(`Rows processed via Confirm Selected using category "${selectedCategory}".`);
    } else {
      const showProcessedToggle = reviewQueue.getByRole('button', { name: /Show Processed|Hide Processed/i }).first();
      if ((await showProcessedToggle.count()) > 0) {
        await showProcessedToggle.click();
        await expect(reviewQueue.getByText(/Adalynn preschool/i)).toBeVisible({ timeout: 15000 });
        await expect(reviewQueue.getByText(/February dates/i)).toBeVisible({ timeout: 15000 });
        checks.push('Ashley anchors were already processed before this run; validated in processed section.');
      } else {
        const ledgerRow1 = page.locator('tbody tr', { hasText: /Adalynn preschool/i }).first();
        const ledgerRow2 = page.locator('tbody tr', { hasText: /February dates/i }).first();
        await expect(ledgerRow1).toBeVisible({ timeout: 15000 });
        await expect(ledgerRow2).toBeVisible({ timeout: 15000 });

        const category1 = (await ledgerRow1.locator('td').nth(3).innerText()).trim();
        const category2 = (await ledgerRow2.locator('td').nth(3).innerText()).trim();
        assertCondition(!/Uncategorized/i.test(category1), `Adalynn preschool still uncategorized (${category1}).`);
        assertCondition(!/Uncategorized/i.test(category2), `February dates still uncategorized (${category2}).`);
        checks.push('Ashley anchors were not in active queue and are already categorized in ledger.');
      }
    }

    await screenshot(page, 'scenario-02-review-queue-cleared.png');
  });

  // Scenario 4
  await runScenario(4, 'Split Mixed Purchase (Write)', async (checks, cleanup) => {
    await gotoPath(page, '/transactions', 'Transactions');

    await page.locator('input[type="search"]').first().fill('Costco');
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-02-01');
    await dateInputs.nth(1).fill('2026-02-02');

    const costcoRow = page
      .locator('tbody tr')
      .filter({ hasText: /Costco/i })
      .filter({ hasText: /200/ })
      .first();

    await expect(costcoRow).toBeVisible({ timeout: 15000 });
    await costcoRow.locator('button[title="More actions"]').click();
    await page.getByRole('button', { name: /Split Transaction/i }).click();

    const modal = page.locator('div.fixed.inset-0').last();
    await expect(modal.getByText('Split Transaction').first()).toBeVisible({ timeout: 15000 });

    const amountInputs = modal.locator('input[type="number"]');
    await amountInputs.nth(0).fill('140');
    await amountInputs.nth(1).fill('60');

    const categorySelects = modal.locator('select');
    const firstCategory = (await selectOptionByRegex(categorySelects.nth(0), /Groceries/i)) || (await selectFirstNonEmptyOption(categorySelects.nth(0)));
    const secondCategory = (await selectOptionByRegex(categorySelects.nth(1), /Household/i)) || (await selectFirstNonEmptyOption(categorySelects.nth(1)));
    assertCondition(Boolean(firstCategory) && Boolean(secondCategory), 'Could not select split categories.');

    await modal.getByRole('button', { name: 'Split Transaction' }).last().click();
    await expect(modal).toBeHidden({ timeout: 20000 });

    const splitParentRow = page.locator('tbody tr').filter({ hasText: /Costco/ }).filter({ hasText: /SPLIT/ }).first();
    await expect(splitParentRow).toBeVisible({ timeout: 15000 });

    const groceriesChild = page.locator('tbody tr').filter({ hasText: /Groceries/ }).filter({ hasText: /140/ }).first();
    const householdChild = page.locator('tbody tr').filter({ hasText: /Household/ }).filter({ hasText: /60/ }).first();
    await expect(groceriesChild).toBeVisible({ timeout: 15000 });
    await expect(householdChild).toBeVisible({ timeout: 15000 });
    checks.push('Costco transaction was split into child rows totaling -200.');

    await screenshot(page, 'scenario-04-split-costco.png');

    // Cleanup: unsplit
    await splitParentRow.locator('button[title="More actions"]').click();
    await page.getByRole('button', { name: /Unsplit/i }).click();
    await expect(page.locator('tbody tr').filter({ hasText: /Costco/ }).filter({ hasText: /SPLIT/ })).toHaveCount(0, { timeout: 15000 });
    cleanup.push('Scenario 4 cleanup: unsplit Costco transaction after verification.');
  });

  // Scenario 5
  await runScenario(5, 'Adjust Monthly Budget Targets (Write)', async (checks, cleanup) => {
    await gotoPath(page, '/budget-planner', 'Budget Planner');
    await setMonth(page, '2026-02');

    const expectedTargets = [
      ['Salary', 6385],
      ['Rental Income', 2950],
      ['Groceries', 800],
      ['Dining Out', 300],
      ['Gas/Fuel', 200],
      ['Subscriptions', 150],
    ];

    for (const [category, target] of expectedTargets) {
      const row = page.locator('tbody tr', { hasText: new RegExp(String(category), 'i') }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
      const expectedText = await row.locator('td').nth(3).innerText();
      const value = extractCurrencyValues(expectedText)[0];
      approxEqual(value, Number(target), 15, `${category} target`);
    }
    checks.push('Baseline Feb 2026 budget targets are present for key categories.');

    const diningRow = page.locator('tbody tr', { hasText: /Dining Out/i }).first();
    await diningRow.locator('button[data-testid^="budget-amount-"]').click();
    const diningInput = diningRow.locator('input[data-testid^="budget-amount-"]').first();
    await diningInput.fill('350');
    await diningInput.press('Enter');

    await expect(diningRow.locator('td').nth(3)).toContainText(/\$350/);
    checks.push('Dining Out target updated to $350 in-line.');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await setMonth(page, '2026-02');

    const diningRowReloaded = page.locator('tbody tr', { hasText: /Dining Out/i }).first();
    await expect(diningRowReloaded.locator('td').nth(3)).toContainText(/\$350/, { timeout: 15000 });
    checks.push('Dining Out target persisted after reload.');

    await screenshot(page, 'scenario-05-budget-edit.png');

    // Cleanup: restore 300
    await diningRowReloaded.locator('button[data-testid^="budget-amount-"]').click();
    const restoreInput = diningRowReloaded.locator('input[data-testid^="budget-amount-"]').first();
    await restoreInput.fill('300');
    await restoreInput.press('Enter');
    await expect(diningRowReloaded.locator('td').nth(3)).toContainText(/\$300/, { timeout: 15000 });
    cleanup.push('Scenario 5 cleanup: restored Dining Out target to $300.');
  });

  // Scenario 8
  await runScenario(8, 'Transfers Neutrality Check', async (checks) => {
    await gotoPath(page, '/transactions', 'Transactions');

    const hideTransfers = page.getByLabel(/Hide transfers/i);
    if (await hideTransfers.isChecked()) {
      await hideTransfers.uncheck();
    }

    await page.locator('input[type="search"]').first().fill('FUNDS TRANSFER');
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-02-01');
    await dateInputs.nth(1).fill('2026-02-03');

    await expect(page.locator('tbody tr', { hasText: /FUNDS TRANSFER TO MONEY MARKET/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('tbody tr', { hasText: /FUNDS TRANSFER FROM CHECKING/i }).first()).toBeVisible({ timeout: 15000 });
    checks.push('Transfer pair rows are visible in ledger search results.');

    const apiPayload = await page.evaluate(async () => {
      const params = new URLSearchParams({
        date_from: '2026-02-01',
        date_to: '2026-02-03',
        search: 'FUNDS TRANSFER',
        hide_transfers: 'false',
        hide_pass_through: 'false',
        limit: '500',
      });
      const response = await fetch(`/api/transactions?${params.toString()}`);
      const json = await response.json();
      return { ok: response.ok, json };
    });

    assertCondition(apiPayload.ok, 'Failed to query transfer rows from /api/transactions.');
    const transactions = apiPayload.json.transactions || [];
    const toMoneyMarket = transactions.find((t) =>
      String(t.description_raw || '').includes('FUNDS TRANSFER TO MONEY MARKET') && Number(t.amount) === -300
    );
    const fromChecking = transactions.find((t) =>
      String(t.description_raw || '').includes('FUNDS TRANSFER FROM CHECKING') && Number(t.amount) === 300
    );

    assertCondition(Boolean(toMoneyMarket) && Boolean(fromChecking), 'Could not locate both anchored transfer transactions via API.');

    const transferLike = [toMoneyMarket, fromChecking].every((row) =>
      row && (row.is_transfer === true || row.cashflow_group === 'Transfer' || /transfer/i.test(String(row.category_name || '')))
    );
    assertCondition(transferLike, 'One or both transfer rows are not represented as transfer-type entries.');

    const pairNet = Number(toMoneyMarket.amount) + Number(fromChecking.amount);
    assertCondition(pairNet === 0, `Transfer pair is not net neutral. Pair sum = ${pairNet}`);
    checks.push('Transfer pair is represented as transfer and nets to zero.');

    await screenshot(page, 'scenario-08-transfer-neutrality.png');
  });

  // Scenario 9
  await runScenario(9, 'Weekly Mobile Triage (Write)', async (checks) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoPath(page, '/transactions', 'Transactions');

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-02-01');
    await dateInputs.nth(1).fill('2026-02-28');

    const reviewQueue = page.locator('section.card').filter({ hasText: 'Review Queue' }).first();
    await expect(reviewQueue).toBeVisible();

    const selectableRows = reviewQueue
      .locator('div.border.rounded-lg')
      .filter({ has: page.locator('input[type="checkbox"]') })
      .filter({ hasNotText: /Saved ✓/ });
    const beforeCount = await selectableRows.count();
    if (beforeCount === 0) {
      checks.push('No actionable review-queue rows are available for Feb 2026; queue is already triaged.');
      await screenshot(page, 'scenario-09-mobile-triage.png');
      await page.setViewportSize({ width: 1440, height: 1000 });
      return;
    }

    const firstRow = selectableRows.first();
    await expect(firstRow.locator('input[type="checkbox"]')).toBeVisible({ timeout: 10000 });
    await firstRow.locator('input[type="checkbox"]').check();
    await expect(reviewQueue.getByText('1 selected')).toBeVisible({ timeout: 10000 });

    const categorySelect = reviewQueue.locator('select').first();
    const chosenCategory =
      (await selectOptionByRegex(categorySelect, /Household|Dining Out|Groceries/i)) ||
      (await selectFirstNonEmptyOption(categorySelect));
    assertCondition(Boolean(chosenCategory), 'No category available for mobile triage confirmation.');

    await reviewQueue.getByRole('button', { name: 'Confirm Selected' }).click();
    await expect(reviewQueue.getByText('0 selected')).toBeVisible({ timeout: 15000 });

    await expect
      .poll(
        async () =>
          await reviewQueue
            .locator('div.border.rounded-lg')
            .filter({ has: page.locator('input[type="checkbox"]') })
            .filter({ hasNotText: /Saved ✓/ })
            .count(),
        { timeout: 15000 }
      )
      .toBeLessThan(beforeCount);

    const afterCount = await reviewQueue
      .locator('div.border.rounded-lg')
      .filter({ has: page.locator('input[type="checkbox"]') })
      .filter({ hasNotText: /Saved ✓/ })
      .count();
    assertCondition(afterCount < beforeCount, `Mobile triage count did not decrease (before=${beforeCount}, after=${afterCount}).`);
    checks.push(`Mobile queue triage succeeded (${beforeCount} -> ${afterCount}) using category "${chosenCategory}".`);

    await screenshot(page, 'scenario-09-mobile-triage.png');

    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  // Scenario 3
  await runScenario(3, 'Correct Category + Teach System (Rule Preview First)', async (checks, cleanup) => {
    await gotoPath(page, '/transactions', 'Transactions');
    const anchorLookup = await page.evaluate(async () => {
      const params = new URLSearchParams({
        search: 'CAPITAL ONE CRCARDPMT',
        hide_transfers: 'false',
        hide_pass_through: 'false',
        limit: '500',
      });
      const response = await fetch(`/api/transactions?${params.toString()}`);
      const json = await response.json();
      if (!response.ok) return { ok: false, error: json?.error || 'query_failed' };
      const tx = (json.transactions || []).find((row) =>
        String(row.description_raw || '').includes('CAPITAL ONE CRCARDPMT')
      );
      return {
        ok: true,
        found: Boolean(tx),
        categoryName: tx?.category_name || null,
      };
    });
    assertCondition(anchorLookup.ok, `Failed to query anchor transaction (${anchorLookup.error || 'unknown error'}).`);
    assertCondition(anchorLookup.found, 'Anchor transaction CAPITAL ONE CRCARDPMT was not found in /api/transactions.');
    checks.push(`Anchor transaction found. Current category: "${anchorLookup.categoryName || 'Uncategorized'}".`);

    await gotoPath(page, '/admin/rules', 'Categorization Rules');
    await page.getByRole('button', { name: /\+ Add Rule|Add Rule|Create your first rule/i }).first().click({ force: true });
    await expect(page.getByText(/Add New Rule|Generate From Prompt/i).first()).toBeVisible({ timeout: 15000 });

    await page.locator('input[placeholder="e.g., Grocery Stores"]').first().fill('Capital One CRCARDPMT');
    await page.locator('input[placeholder="e.g., STARBUCKS"]').first().fill('CAPITAL ONE CRCARDPMT');

    const categorySelect = page.locator('select').filter({ hasText: 'Select category...' }).first();
    const selectedCategory =
      (await selectOptionByRegex(categorySelect, /Credit Card Payment/i)) ||
      (await selectOptionByRegex(categorySelect, /Credit/i)) ||
      (await selectFirstNonEmptyOption(categorySelect));
    assertCondition(Boolean(selectedCategory), 'Could not pick category for Capital One draft rule.');

    await page.getByRole('button', { name: /Create Rule/i }).first().click();

    const ruleHeading = page.getByRole('heading', { name: /Capital One CRCARDPMT/i }).first();
    await expect(ruleHeading).toBeVisible({ timeout: 15000 });
    const ruleCard = ruleHeading.locator('xpath=ancestor::div[contains(@class, "p-4")]').first();

    await ruleCard.locator('button[title="Preview (Dry Run)"]').click();
    await expect(ruleCard.getByText(/Dry Run Results|No matching transactions found/i)).toBeVisible({ timeout: 20000 });

    const matchesText = (await ruleCard.innerText()).match(/(\d+) matches/);
    assertCondition(Boolean(matchesText), 'Preview did not display a matches count.');
    const matchCount = Number(matchesText[1]);
    assertCondition(matchCount > 0, `Preview returned ${matchCount} matches; expected > 0.`);
    checks.push(`Rule preview found ${matchCount} historical matching transactions.`);

    await screenshot(page, 'scenario-03-rule-preview.png');

    // Cleanup: remove the test rule
    page.once('dialog', (dialog) => dialog.accept());
    await ruleCard.locator('button[title="Delete"]').click();
    await expect(page.getByRole('heading', { name: /Capital One CRCARDPMT/i })).toHaveCount(0, { timeout: 15000 });
    cleanup.push('Scenario 3 cleanup: deleted temporary Capital One CRCARDPMT rule.');
  });

  // Scenario 10
  await runScenario(10, 'Assistant-Guided Rule Creation (Preview First)', async (checks) => {
    await gotoPath(page, '/transactions', 'Transactions');

    const assistantButtons = page.locator('button:has-text("Assistant")');
    const buttonCount = await assistantButtons.count();
    assertCondition(buttonCount > 0, 'No Assistant button is available on /transactions.');

    let assistantInput = page.locator('input[placeholder="Describe what rule you want to create..."]').first();
    let openedV1 = false;
    for (let i = 0; i < buttonCount; i += 1) {
      await assistantButtons.nth(i).click({ force: true });
      try {
        await expect(assistantInput).toBeVisible({ timeout: 3000 });
        openedV1 = true;
        break;
      } catch {
        const v2Panel = page.locator('[data-assistant-panel-v2]');
        if (await v2Panel.isVisible().catch(() => false)) {
          const closeButton = v2Panel.getByRole('button', { name: 'Close' });
          if (await closeButton.isVisible().catch(() => false)) {
            await closeButton.click({ force: true });
          }
        }
      }
    }

    assertCondition(openedV1, 'Rule Assistant v1 panel did not open; only non-rule assistant surfaces are available.');
    const assistantPanel = assistantInput.locator('xpath=ancestor::div[contains(@class, "p-4")]').first();

    const prompt = 'Create a categorization rule for Quickbooks Deposit inflows to Side Income';
    await assistantInput.fill(prompt);
    await page.getByRole('button', { name: 'Send' }).last().click();

    const previewContainer = assistantPanel.locator('div').filter({ hasText: /Merchant contains:/ }).first();
    const previewInitiallyVisible = await previewContainer
      .isVisible({ timeout: 12000 })
      .catch(() => false);
    if (!previewInitiallyVisible) {
      const clarificationSeen = await assistantPanel
        .getByText(
          /which existing category|couldn't match category|i need both a merchant pattern|i couldn't process that|failed to/i
        )
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (clarificationSeen) {
        await assistantInput.fill('Use category Rental Income for that rule.');
        await page.getByRole('button', { name: 'Send' }).last().click();
      }
    }

    await expect(previewContainer).toBeVisible({ timeout: 30000 });
    await expect(previewContainer).toContainText(/Quickbooks|Deposit|Side Income/i);
    await expect(page.getByRole('button', { name: 'Confirm' }).last()).toBeVisible({ timeout: 10000 });
    checks.push('Assistant generated a rule preview and exposed Confirm action without auto-applying.');

    await gotoPath(page, '/admin/rules', 'Categorization Rules');
    await expect(page.getByRole('heading', { name: 'Categorization Rules' })).toBeVisible();
    checks.push('Rules admin remains accessible after assistant preview flow.');

    await screenshot(page, 'scenario-10-assistant-rule-flow.png');
  });

  await context.close();
  await browser.close();

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.length - passed;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    passed,
    failed,
    results,
    cleanupNotes,
  };

  await fs.writeFile(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');

  const lines = [];
  lines.push('# Playwright MCP Scenario Results');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Base URL: ${BASE_URL}`);
  lines.push(`- Passed: ${passed}`);
  lines.push(`- Failed: ${failed}`);
  lines.push('');
  lines.push('## Scenario Matrix');
  lines.push('');
  for (const result of results) {
    lines.push(`- Scenario ${result.id}: ${result.name} -> ${result.status}`);
    if (result.error) lines.push(`  Error: ${result.error}`);
    if (result.checks.length) {
      for (const check of result.checks) {
        lines.push(`  Check: ${check}`);
      }
    }
  }
  lines.push('');
  lines.push('## Cleanup Notes');
  lines.push('');
  if (cleanupNotes.length === 0) {
    lines.push('- None');
  } else {
    for (const note of cleanupNotes) {
      lines.push(`- ${note}`);
    }
  }

  await fs.writeFile(REPORT_MD, `${lines.join('\n')}\n`, 'utf8');

  console.log('');
  console.log(`Completed ${results.length} scenarios: ${passed} passed, ${failed} failed.`);
  console.log(`Report JSON: ${REPORT_JSON}`);
  console.log(`Report MD: ${REPORT_MD}`);
}

run().catch((error) => {
  console.error('Fatal scenario runner error:', error);
  process.exitCode = 1;
});
