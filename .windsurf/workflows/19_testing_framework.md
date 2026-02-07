---
description: Implement comprehensive testing framework (Vitest, Playwright, React Testing Library) with CI/CD pipeline to ensure Safe-to-Spend and cashflow accuracy. Extends workflows 05 and 14.
auto_execution_mode: 1
---

## Phase 1: Foundation of Trust – Feature #13

**Context:** Extends workflow 05 (Data Validation) and workflow 14 (Stored Procedures).  
**Research Alignment:** "Legacy systems failed due to passive aggregation." Active verification is required to ensure the "Command Center" metrics (Net Cashflow, Safe-to-Spend) are always trustworthy.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Testing Pyramid                          │
├─────────────────────────────────────────────────────────────────┤
│  E2E (Playwright)     │ Critical user paths, visual regression │
│  Integration          │ Supabase RPC, API routes               │
│  Unit (Vitest)        │ lib/cashflow.ts, rule engine logic     │
└─────────────────────────────────────────────────────────────────┘
```

## Steps

### 1. Setup Testing Infrastructure

1. Install testing dependencies:
   ```bash
   npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @playwright/test
   ```

2. Create `vitest.config.ts` at project root:
   ```typescript
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'
   import path from 'path'

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       globals: true,
       setupFiles: ['./tests/setup.ts'],
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html'],
         include: ['lib/**/*.ts', 'components/**/*.tsx'],
         exclude: ['**/*.test.ts', '**/*.d.ts'],
         thresholds: {
           'lib/cashflow.ts': { lines: 100, functions: 100, branches: 100 }
         }
       }
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './')
       }
     }
   })
   ```

3. Create `tests/setup.ts`:
   ```typescript
   import '@testing-library/jest-dom'
   import { beforeAll, afterAll, afterEach } from 'vitest'

   beforeAll(() => {
     // Global setup
   })

   afterEach(() => {
     // Clean up after each test
   })

   afterAll(() => {
     // Global teardown
   })
   ```

4. Create `playwright.config.ts`:
   ```typescript
   import { defineConfig, devices } from '@playwright/test'

   export default defineConfig({
     testDir: './tests/e2e',
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     reporter: 'html',
     use: {
       baseURL: 'http://localhost:3000',
       trace: 'on-first-retry',
       screenshot: 'only-on-failure'
     },
     projects: [
       { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
       { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } }
     ],
     webServer: {
       command: 'npm run dev',
       url: 'http://localhost:3000',
       reuseExistingServer: !process.env.CI
     }
   })
   ```

### 2. Unit Tests – Cashflow Logic (lib/cashflow.ts)

Create `tests/unit/cashflow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  calculateNetCashflow,
  calculateSafeToSpend,
  calculateWeeklySafeToSpend
} from '@/lib/cashflow'

describe('Net Cashflow Calculation', () => {
  const baseTransaction = {
    id: '1',
    amount: 0,
    is_transfer: false,
    is_pass_through: false,
    is_business: false,
    status: 'posted',
    cashflow_group: 'Income'
  }

  describe('is_transfer flag handling', () => {
    it('excludes transactions with is_transfer = TRUE from net cashflow', () => {
      const transactions = [
        { ...baseTransaction, amount: 1000, cashflow_group: 'Income' },
        { ...baseTransaction, amount: -500, is_transfer: true, cashflow_group: 'Transfer' },
        { ...baseTransaction, amount: -200, cashflow_group: 'Discretionary' }
      ]
      const result = calculateNetCashflow(transactions)
      expect(result).toBe(800) // 1000 - 200, transfer excluded
    })

    it('handles credit card payment transfers correctly', () => {
      const transactions = [
        { ...baseTransaction, amount: -1000, is_transfer: true }, // CC payment
        { ...baseTransaction, amount: 1000, is_transfer: true }   // Checking debit
      ]
      const result = calculateNetCashflow(transactions)
      expect(result).toBe(0) // Both excluded
    })
  })

  describe('is_pass_through flag handling', () => {
    it('excludes pass-through expenses from net cashflow', () => {
      const transactions = [
        { ...baseTransaction, amount: 1000, cashflow_group: 'Income' },
        { ...baseTransaction, amount: -150, is_pass_through: true }, // T-Mobile fronted
        { ...baseTransaction, amount: 150, is_pass_through: true }   // T-Mobile reimbursed
      ]
      const result = calculateNetCashflow(transactions)
      expect(result).toBe(1000) // Pass-throughs net to zero
    })
  })

  describe('cashflow_group aggregation', () => {
    it('correctly aggregates Income - all expense groups', () => {
      const transactions = [
        { ...baseTransaction, amount: 5000, cashflow_group: 'Income' },
        { ...baseTransaction, amount: -1500, cashflow_group: 'Fixed' },
        { ...baseTransaction, amount: -800, cashflow_group: 'Variable Essentials' },
        { ...baseTransaction, amount: -400, cashflow_group: 'Discretionary' },
        { ...baseTransaction, amount: -300, cashflow_group: 'Debt' },
        { ...baseTransaction, amount: -500, cashflow_group: 'Savings/Investing' },
        { ...baseTransaction, amount: -200, cashflow_group: 'Business' }
      ]
      const result = calculateNetCashflow(transactions)
      expect(result).toBe(1300) // 5000 - 1500 - 800 - 400 - 300 - 500 - 200
    })
  })
})

describe('Safe-to-Spend Calculation', () => {
  describe('weekly budget derivation', () => {
    it('converts monthly discretionary budget to weekly (÷ 4.33)', () => {
      const monthlyBudget = 1000
      const weeklyTarget = monthlyBudget / 4.33
      expect(weeklyTarget).toBeCloseTo(230.95, 2)
    })
  })

  describe('date boundary handling', () => {
    it('correctly handles week spanning month boundary', () => {
      // Week: Jan 28 (Mon) - Feb 3 (Sun)
      const transactions = [
        { date: '2025-01-28', amount: -50, cashflow_group: 'Discretionary' },
        { date: '2025-01-31', amount: -75, cashflow_group: 'Discretionary' },
        { date: '2025-02-01', amount: -25, cashflow_group: 'Discretionary' },
        { date: '2025-02-03', amount: -50, cashflow_group: 'Discretionary' }
      ]
      const weekStart = new Date('2025-01-28')
      const weekEnd = new Date('2025-02-03')
      const spent = calculateWeeklySpent(transactions, weekStart, weekEnd)
      expect(spent).toBe(200) // All 4 transactions in week
    })

    it('excludes transactions outside the week', () => {
      const transactions = [
        { date: '2025-01-27', amount: -100, cashflow_group: 'Discretionary' }, // Before
        { date: '2025-01-28', amount: -50, cashflow_group: 'Discretionary' },  // In week
        { date: '2025-02-04', amount: -100, cashflow_group: 'Discretionary' }  // After
      ]
      const weekStart = new Date('2025-01-28')
      const weekEnd = new Date('2025-02-03')
      const spent = calculateWeeklySpent(transactions, weekStart, weekEnd)
      expect(spent).toBe(50) // Only Jan 28 transaction
    })
  })

  describe('SafeToSpend formula', () => {
    it('SafeToSpend = WeeklyTarget - DiscretionarySpent', () => {
      const weeklyTarget = 230.95
      const spent = 150
      const safeToSpend = weeklyTarget - spent
      expect(safeToSpend).toBeCloseTo(80.95, 2)
    })

    it('returns negative when overspent', () => {
      const weeklyTarget = 230.95
      const spent = 300
      const safeToSpend = weeklyTarget - spent
      expect(safeToSpend).toBeCloseTo(-69.05, 2)
    })
  })
})
```

### 3. Unit Tests – Rule Engine (lib/categorization/)

Create `tests/unit/ruleEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { evaluateRule, findMatchingRule } from '@/lib/categorization/ruleEngine'

describe('Rule Engine', () => {
  describe('regex matching', () => {
    it('matches case-insensitive patterns', () => {
      const rule = { merchant_match: 'starbucks', merchant_match_type: 'contains' }
      const transaction = { description_clean: 'STARBUCKS #12345' }
      expect(evaluateRule(rule, transaction)).toBe(true)
    })

    it('handles regex special characters safely', () => {
      const rule = { merchant_match: 'costco.com', merchant_match_type: 'contains' }
      const transaction = { description_clean: 'COSTCO.COM Purchase' }
      expect(evaluateRule(rule, transaction)).toBe(true)
    })

    it('exact match requires full string match', () => {
      const rule = { merchant_match: 'Netflix', merchant_match_type: 'exact' }
      expect(evaluateRule(rule, { description_clean: 'Netflix' })).toBe(true)
      expect(evaluateRule(rule, { description_clean: 'Netflix Inc' })).toBe(false)
    })
  })

  describe('amount range logic', () => {
    it('matches when amount within range', () => {
      const rule = { amount_min: 10, amount_max: 50 }
      expect(evaluateRule(rule, { amount: -25 })).toBe(true) // Uses ABS
      expect(evaluateRule(rule, { amount: 25 })).toBe(true)
    })

    it('excludes amounts outside range', () => {
      const rule = { amount_min: 10, amount_max: 50 }
      expect(evaluateRule(rule, { amount: -5 })).toBe(false)
      expect(evaluateRule(rule, { amount: -100 })).toBe(false)
    })

    it('handles open-ended ranges', () => {
      const minOnly = { amount_min: 100, amount_max: null }
      const maxOnly = { amount_min: null, amount_max: 50 }
      expect(evaluateRule(minOnly, { amount: -150 })).toBe(true)
      expect(evaluateRule(minOnly, { amount: -50 })).toBe(false)
      expect(evaluateRule(maxOnly, { amount: -25 })).toBe(true)
      expect(evaluateRule(maxOnly, { amount: -100 })).toBe(false)
    })
  })

  describe('priority collision handling', () => {
    it('higher priority rule wins when both match', () => {
      const rules = [
        { id: 'A', priority: 50, merchant_match: 'starbucks', merchant_match_type: 'contains', assign_category_id: 'coffee' },
        { id: 'B', priority: 100, merchant_match: 'starbucks', merchant_match_type: 'contains', amount_max: 15, assign_category_id: 'small-coffee' }
      ]
      const transaction = { description_clean: 'Starbucks', amount: -10 }
      const match = findMatchingRule(rules, transaction)
      expect(match?.id).toBe('B') // Higher priority
    })

    it('falls through to lower priority when higher does not match', () => {
      const rules = [
        { id: 'A', priority: 50, merchant_match: 'starbucks', merchant_match_type: 'contains', assign_category_id: 'coffee' },
        { id: 'B', priority: 100, merchant_match: 'starbucks', merchant_match_type: 'contains', amount_max: 15, assign_category_id: 'small-coffee' }
      ]
      const transaction = { description_clean: 'Starbucks', amount: -25 } // Over $15
      const match = findMatchingRule(rules, transaction)
      expect(match?.id).toBe('A') // Falls through
    })
  })
})
```

### 4. Integration Tests – Supabase RPC

Create `tests/integration/supabase-rpc.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('fn_run_categorization_waterfall', () => {
  let testBatchId: string
  let testTransactionIds: string[]

  beforeAll(async () => {
    // Create test transactions
    const { data } = await supabase
      .from('transactions')
      .insert([
        { description_clean: 'Test Merchant', amount: -50, category_locked: false },
        { description_clean: 'Locked Merchant', amount: -50, category_locked: true }
      ])
      .select('id')
    testTransactionIds = data?.map(t => t.id) || []
    
    // Create batch
    const { data: batch } = await supabase
      .from('rule_application_batches')
      .insert({ operation_type: 'waterfall' })
      .select('id')
      .single()
    testBatchId = batch?.id
  })

  afterAll(async () => {
    // Cleanup
    await supabase.from('transactions').delete().in('id', testTransactionIds)
    await supabase.from('rule_application_batches').delete().eq('id', testBatchId)
  })

  it('updates category_id and logs to category_audit_log', async () => {
    const { data, error } = await supabase.rpc('fn_run_categorization_waterfall', {
      p_batch_id: testBatchId,
      p_transaction_ids: testTransactionIds
    })

    expect(error).toBeNull()
    expect(data.processed).toBe(2)
    expect(data.skipped_locked).toBe(1)

    // Verify audit log entry
    const { data: auditLogs } = await supabase
      .from('category_audit_log')
      .select('*')
      .eq('batch_id', testBatchId)
    
    expect(auditLogs?.length).toBeGreaterThan(0)
  })
})

describe('fn_undo_batch', () => {
  it('cleanly reverses a bad batch update', async () => {
    // Setup: Create batch and apply changes
    const { data: batch } = await supabase
      .from('rule_application_batches')
      .insert({ operation_type: 'test_undo' })
      .select('id')
      .single()

    const { data: tx } = await supabase
      .from('transactions')
      .insert({ description_clean: 'Undo Test', amount: -100, category_id: 'original-cat' })
      .select('id, category_id')
      .single()

    // Simulate categorization
    await supabase
      .from('transactions')
      .update({ category_id: 'new-cat' })
      .eq('id', tx.id)

    await supabase
      .from('category_audit_log')
      .insert({
        transaction_id: tx.id,
        previous_category_id: 'original-cat',
        new_category_id: 'new-cat',
        batch_id: batch.id,
        change_source: 'rule'
      })

    // Execute undo
    const { data: undoResult, error } = await supabase.rpc('fn_undo_batch', {
      p_batch_id: batch.id
    })

    expect(error).toBeNull()
    expect(undoResult.reverted).toBe(1)

    // Verify transaction reverted
    const { data: revertedTx } = await supabase
      .from('transactions')
      .select('category_id')
      .eq('id', tx.id)
      .single()

    expect(revertedTx?.category_id).toBe('original-cat')

    // Verify batch marked undone
    const { data: undoBatch } = await supabase
      .from('rule_application_batches')
      .select('is_undone')
      .eq('id', batch.id)
      .single()

    expect(undoBatch?.is_undone).toBe(true)

    // Cleanup
    await supabase.from('transactions').delete().eq('id', tx.id)
    await supabase.from('rule_application_batches').delete().eq('id', batch.id)
  })
})
```

### 5. E2E Tests – Critical User Paths (Playwright)

Create `tests/e2e/dashboard-safe-to-spend.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Dashboard Safe-to-Spend Verification', () => {
  test('Safe-to-Spend matches database calculation', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Wait for data to load
    await page.waitForSelector('[data-testid="safe-to-spend-value"]')
    
    // Get displayed value
    const displayedValue = await page.locator('[data-testid="safe-to-spend-value"]').textContent()
    const uiAmount = parseFloat(displayedValue?.replace(/[$,]/g, '') || '0')

    // Fetch from API
    const response = await page.request.get('/api/dashboard/safe-to-spend')
    const apiData = await response.json()
    
    expect(uiAmount).toBeCloseTo(apiData.safeToSpend, 2)
  })

  test('Net Cashflow displays correctly', async ({ page }) => {
    await page.goto('/dashboard')
    
    await page.waitForSelector('[data-testid="net-cashflow-value"]')
    
    const displayedValue = await page.locator('[data-testid="net-cashflow-value"]').textContent()
    expect(displayedValue).not.toBe('$0.00') // Should have data
  })
})

test.describe('Transaction Category Edit Flow', () => {
  test('Category edit updates audit log and recalculates cashflow', async ({ page }) => {
    await page.goto('/transactions')
    
    // Select first transaction
    const firstRow = page.locator('table tbody tr').first()
    await firstRow.click()
    
    // Open category dropdown
    await page.locator('[data-testid="category-select"]').click()
    
    // Select new category
    await page.locator('[data-testid="category-option-dining"]').click()
    
    // Wait for save
    await page.waitForResponse(resp => resp.url().includes('/api/transactions') && resp.status() === 200)
    
    // Verify audit log updated (via API)
    const auditResponse = await page.request.get('/api/audit-log?limit=1')
    const auditData = await auditResponse.json()
    expect(auditData[0].change_source).toBe('manual')
    
    // Navigate to dashboard and verify recalculation
    await page.goto('/dashboard')
    await page.waitForSelector('[data-testid="net-cashflow-value"]')
    
    // Take screenshot for verification
    await page.screenshot({ path: 'tests/screenshots/after-category-edit.png' })
  })
})
```

### 6. CI/CD Pipeline – GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests with coverage
        run: npm run test:unit -- --coverage
      
      - name: Check coverage thresholds
        run: |
          # Verify lib/cashflow.ts has 100% coverage
          npm run test:coverage -- --coverage.thresholds.lines=100

      - name: Upload coverage report
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      supabase:
        image: supabase/postgres:15.1.0.117
        ports:
          - 54322:5432
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npx supabase db push --local
      
      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Build application
        run: npm run build
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### 7. Add npm scripts to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch"
  }
}
```

### 8. Create Test Data Factories

Create `tests/factories/index.ts`:

```typescript
import { v4 as uuid } from 'uuid'

export const createTransaction = (overrides = {}) => ({
  id: uuid(),
  provider: 'test',
  provider_transaction_id: `test-${uuid()}`,
  account_id: uuid(),
  date: new Date().toISOString().split('T')[0],
  amount: -50,
  description_raw: 'Test Transaction',
  description_clean: 'Test Transaction',
  status: 'posted',
  is_transfer: false,
  is_pass_through: false,
  is_business: false,
  category_locked: false,
  cashflow_group: 'Discretionary',
  ...overrides
})

export const createRule = (overrides = {}) => ({
  id: uuid(),
  name: 'Test Rule',
  priority: 50,
  is_active: true,
  merchant_match: 'test',
  merchant_match_type: 'contains',
  assign_category_id: uuid(),
  ...overrides
})

export const createBudgetTarget = (overrides = {}) => ({
  id: uuid(),
  category_id: uuid(),
  month: '2025-01-01',
  amount: 500,
  ...overrides
})
```

### 9. Document Testing Strategy

Create `docs/testing/testing_strategy.md`:

```markdown
# Testing Strategy

## Coverage Targets

| Area | Target | Rationale |
|------|--------|-----------|
| `lib/cashflow.ts` | 100% | Core financial calculations must be bulletproof |
| `supabase/migrations/` | 100% | Schema integrity |
| `lib/categorization/` | 90% | Rule engine accuracy |
| `components/` | 80% | UI rendering |

## Test Categories

### Unit Tests (Vitest)
- Pure functions in `lib/`
- React component rendering
- No external dependencies

### Integration Tests
- Supabase RPC calls
- API route handlers
- Database operations

### E2E Tests (Playwright)
- Critical user journeys
- Cross-page workflows
- Visual regression

## Running Tests

```bash
# All tests
npm test

# Unit only (fast feedback)
npm run test:unit

# With coverage
npm run test:coverage

# E2E (requires app running)
npm run test:e2e
```

## CI/CD

Tests run on every PR:
1. Unit tests (must pass)
2. Integration tests (must pass)
3. E2E tests (must pass)
4. Coverage check (must meet thresholds)
```

### 10. Puppeteer Verification

Use the Puppeteer MCP server to:
- Navigate to http://localhost:3000/dashboard
- Take screenshot verifying Safe-to-Spend card displays correctly
- Navigate to http://localhost:3000/transactions
- Test category edit and verify toast notification
- Verify audit log updates via API call
