# Cashflow Calculations Context

Essential reference for implementing accurate cashflow and Safe-to-Spend calculations.

## Quick Reference

**Key files:**
- `docs/financial-command-center-overview.md` - Section "Cashflow and Safe-to-Spend Logic"
- `lib/cashflow.ts` - Implementation
- `docs/db-schema.md` - Data sources

## Core Concepts

### Included vs Excluded Accounts

**Only include accounts where `include_in_cashflow = TRUE`**

```sql
-- Included accounts (affect cashflow)
SELECT * FROM accounts 
WHERE include_in_cashflow = TRUE
  AND is_active = TRUE;

-- Examples:
-- ✓ AFCU Checking (primary)
-- ✓ Active credit cards
-- ✓ Active loans (debt payments count)
-- ✓ Venmo (if used for regular spending)

-- Excluded accounts (don't affect cashflow)
-- ✗ 401k
-- ✗ HSA investments
-- ✗ Betterment
-- ✗ Property/vehicle assets
-- ✗ Closed/inactive accounts
```

**Why exclude?**
- Investment accounts: Not liquid cashflow
- Property/vehicles: Not cash
- Savings goals: Treated as "spent" (transfers to savings count as expenses)

### Transaction Filtering

**For ALL cashflow calculations, exclude:**
1. Transfers (`is_transfer = TRUE`)
2. Pending transactions (`status = 'pending'`)
3. Accounts not included in cashflow (`accounts.include_in_cashflow = FALSE`)

```typescript
async function getTransactionsForCashflow(startDate: string, endDate: string) {
  return supabase
    .from('transactions')
    .select('*, accounts!inner(include_in_cashflow)')
    .eq('status', 'posted')
    .eq('is_transfer', false)
    .eq('accounts.include_in_cashflow', true)
    .gte('date', startDate)
    .lte('date', endDate);
}
```

## Amount Sign Convention

**In your database (normalized):**
- **Positive** = inflow (income, deposits)
- **Negative** = outflow (expenses, savings)

**Remember:** Plaid uses OPPOSITE convention, so multiply by -1 on import.

## Cashflow Groups

Transactions are grouped for reporting:

```typescript
type CashflowGroup = 
  | 'Income'                // Income sources
  | 'Fixed'                 // Mortgage, phone, insurance
  | 'Variable Essentials'   // Groceries, utilities, gas, healthcare
  | 'Discretionary'         // Restaurants, entertainment, travel
  | 'Debt'                  // Loan payments, interest
  | 'Savings/Investing'     // HSA contributions, emergency fund, extra principal
  | 'Business'              // Rental, Turo expenses
  | 'Transfer'              // Should be excluded from calculations
  | 'Detractors'            // Fees, waste
  | 'Other';                // Uncategorized or misc

// Stored in categories.cashflow_group
// Denormalized to transactions.cashflow_group for performance
```

## Net Cashflow Calculation

### Formula

```
Net Cashflow (month M) = 
  Income 
  + Fixed            (negative values)
  + Variable Essentials (negative values)
  + Discretionary    (negative values)
  + Debt             (negative values)
  + Savings/Investing (negative values)
  + Business         (net of income and expenses)
```

**Result interpretation:**
- **Positive** = surplus (saving money)
- **Negative** = deficit (spending more than earning)
- **Zero** = break-even

### Implementation

```typescript
async function calculateMonthlyNetCashflow(month: string): Promise<number> {
  // month format: "2025-03-01" (first day of month)
  const startDate = month;
  const endDate = lastDayOfMonth(month);
  
  const { data: transactions } = await getTransactionsForCashflow(startDate, endDate);
  
  // Sum by cashflow_group
  const groupTotals = transactions.reduce((acc, txn) => {
    const group = txn.cashflow_group || 'Other';
    acc[group] = (acc[group] || 0) + txn.amount;
    return acc;
  }, {} as Record<CashflowGroup, number>);
  
  // Net = Income + all expenses (expenses are negative)
  const netCashflow = 
    (groupTotals.Income || 0) +
    (groupTotals.Fixed || 0) +
    (groupTotals['Variable Essentials'] || 0) +
    (groupTotals.Discretionary || 0) +
    (groupTotals.Debt || 0) +
    (groupTotals['Savings/Investing'] || 0) +
    (groupTotals.Business || 0);
  
  return netCashflow;
}
```

### Group-by-Group Breakdown

Useful for Dashboard cards:

```typescript
interface CashflowBreakdown {
  income: number;              // Positive
  fixed: number;               // Negative (absolute for display)
  variable_essentials: number; // Negative
  discretionary: number;       // Negative
  debt: number;                // Negative
  savings: number;             // Negative
  business: number;            // Net (can be positive or negative)
  net: number;                 // Total
}

async function getCashflowBreakdown(month: string): Promise<CashflowBreakdown> {
  const { data: transactions } = await getTransactionsForCashflow(
    month, 
    lastDayOfMonth(month)
  );
  
  const totals = groupBy(transactions, 'cashflow_group');
  
  return {
    income: sum(totals.Income, 'amount'),
    fixed: sum(totals.Fixed, 'amount'),
    variable_essentials: sum(totals['Variable Essentials'], 'amount'),
    discretionary: sum(totals.Discretionary, 'amount'),
    debt: sum(totals.Debt, 'amount'),
    savings: sum(totals['Savings/Investing'], 'amount'),
    business: sum(totals.Business, 'amount'),
    net: calculateNet(totals)
  };
}
```

## Safe-to-Spend Calculation

**Goal:** Show how much discretionary money is left for the current week.

### Step 1: Get Monthly Discretionary Budget

From `budget_targets` table:

```typescript
async function getMonthlyDiscretionaryBudget(month: string): Promise<number> {
  const { data } = await supabase
    .from('budget_targets')
    .select('amount, categories!inner(cashflow_group)')
    .eq('month', month)
    .eq('categories.cashflow_group', 'Discretionary');
  
  return data?.reduce((sum, item) => sum + item.amount, 0) || 0;
}
```

### Step 2: Convert to Weekly Target

```typescript
const WEEKS_PER_MONTH = 4.33; // 52 weeks / 12 months

function monthlyToWeekly(monthlyBudget: number): number {
  return monthlyBudget / WEEKS_PER_MONTH;
}
```

### Step 3: Calculate Discretionary Spent This Week

Week definition: **Monday through Sunday**

```typescript
async function getDiscretionarySpentThisWeek(): Promise<number> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });     // Sunday
  
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, accounts!inner(include_in_cashflow)')
    .eq('status', 'posted')
    .eq('is_transfer', false)
    .eq('is_pass_through', false) // Exclude reimbursements
    .eq('cashflow_group', 'Discretionary')
    .eq('accounts.include_in_cashflow', true)
    .gte('date', weekStart)
    .lte('date', weekEnd);
  
  // Sum and take absolute value (amounts are negative for expenses)
  const total = transactions?.reduce((sum, txn) => sum + txn.amount, 0) || 0;
  return Math.abs(total);
}
```

### Step 4: Calculate Safe-to-Spend

```typescript
async function calculateSafeToSpend(): Promise<number> {
  const currentMonth = format(new Date(), 'yyyy-MM-01');
  
  const monthlyBudget = await getMonthlyDiscretionaryBudget(currentMonth);
  const weeklyTarget = monthlyToWeekly(monthlyBudget);
  const spentThisWeek = await getDiscretionarySpentThisWeek();
  
  const safeToSpend = weeklyTarget - spentThisWeek;
  
  return safeToSpend;
}
```

**Display logic:**
- **Positive** = "You have $X left to spend this week"
- **Negative** = "You're over budget by $X this week"
- **Color coding:** Green if positive, yellow if < 20%, red if negative

### Alternative: Remaining for Month

Some users prefer seeing monthly remaining:

```typescript
async function calculateMonthlyDiscretionaryRemaining(): Promise<number> {
  const currentMonth = format(new Date(), 'yyyy-MM-01');
  
  const monthlyBudget = await getMonthlyDiscretionaryBudget(currentMonth);
  const spentThisMonth = await getDiscretionarySpentThisMonth();
  
  return monthlyBudget - spentThisMonth;
}
```

## Expected Income Not Received

Tracks outstanding rental payments, T-Mobile reimbursements, etc.

### Data Source

`expected_inflows` table:

```sql
CREATE TABLE expected_inflows (
  id uuid PRIMARY KEY,
  source text NOT NULL,              -- "Stephani Rent", "Rachel Rent", "T-Mobile Fife"
  counterparty_id uuid,               -- FK to counterparties
  expected_amount numeric NOT NULL,
  expected_date date,
  recurrence text,                    -- "monthly", "weekly", "one-time"
  category_id uuid,
  month date NOT NULL,                -- Which month this inflow is for
  status text DEFAULT 'pending'       -- "pending", "received", "partial", "missed"
);
```

### Calculation

```typescript
interface OutstandingInflow {
  source: string;
  expected: number;
  actual: number;
  outstanding: number;
}

async function getOutstandingInflows(month: string): Promise<OutstandingInflow[]> {
  // Get all expected inflows for this month
  const { data: expectedInflows } = await supabase
    .from('expected_inflows')
    .select('*, counterparties(name), categories(name)')
    .eq('month', month)
    .in('status', ['pending', 'partial']);
  
  // For each expected inflow, check actual received
  const outstanding = await Promise.all(
    expectedInflows?.map(async (expected) => {
      // Find matching transactions
      const { data: actualTransactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('counterparty_id', expected.counterparty_id)
        .eq('category_id', expected.category_id)
        .gte('date', month)
        .lte('date', lastDayOfMonth(month))
        .eq('status', 'posted');
      
      const actualReceived = actualTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const outstandingAmount = Math.max(expected.expected_amount - actualReceived, 0);
      
      return {
        source: expected.source,
        counterparty: expected.counterparties?.name,
        expected: expected.expected_amount,
        actual: actualReceived,
        outstanding: outstandingAmount
      };
    }) || []
  );
  
  return outstanding.filter(item => item.outstanding > 0);
}

async function getTotalOutstanding(month: string): Promise<number> {
  const outstanding = await getOutstandingInflows(month);
  return outstanding.reduce((sum, item) => sum + item.outstanding, 0);
}
```

### Display

```typescript
// Dashboard card
<OutstandingInflowsCard>
  <h3>Outstanding Income</h3>
  <div className="total">${totalOutstanding}</div>
  <ul>
    {outstandingInflows.map(item => (
      <li key={item.source}>
        {item.source}: ${item.outstanding}
        <span className="detail">
          Expected ${item.expected}, received ${item.actual}
        </span>
      </li>
    ))}
  </ul>
</OutstandingInflowsCard>
```

## Common Calculations

### Month-over-Month Trend

```typescript
async function getCashflowTrend(months: number = 6): Promise<CashflowTrendData[]> {
  const trend = [];
  
  for (let i = months - 1; i >= 0; i--) {
    const month = subMonths(new Date(), i);
    const monthStr = format(month, 'yyyy-MM-01');
    
    const netCashflow = await calculateMonthlyNetCashflow(monthStr);
    
    trend.push({
      month: format(month, 'MMM yyyy'),
      net: netCashflow,
      date: monthStr
    });
  }
  
  return trend;
}
```

### Budget vs Actual by Category

```typescript
interface BudgetVsActual {
  category_id: string;
  category_name: string;
  budgeted: number;
  actual: number;
  variance: number;
  percent_used: number;
}

async function getBudgetVsActual(month: string): Promise<BudgetVsActual[]> {
  // Get budget targets
  const { data: budgets } = await supabase
    .from('budget_targets')
    .select('*, categories(name, cashflow_group)')
    .eq('month', month);
  
  // Get actual spending by category
  const { data: transactions } = await getTransactionsForCashflow(
    month,
    lastDayOfMonth(month)
  );
  
  const actualsByCategory = groupBy(transactions, 'life_category_id');
  
  return budgets?.map(budget => {
    const actual = sum(actualsByCategory[budget.category_id] || [], 'amount');
    const variance = budget.amount - Math.abs(actual); // For expenses
    
    return {
      category_id: budget.category_id,
      category_name: budget.categories.name,
      budgeted: Math.abs(budget.amount),
      actual: Math.abs(actual),
      variance: variance,
      percent_used: Math.abs(actual) / Math.abs(budget.amount) * 100
    };
  }) || [];
}
```

### Top Spending Categories

```typescript
async function getTopSpendingCategories(
  month: string, 
  limit: number = 5
): Promise<CategorySpending[]> {
  const { data: transactions } = await getTransactionsForCashflow(
    month,
    lastDayOfMonth(month)
  );
  
  // Group by category and sum (take absolute for expenses)
  const byCategory = groupBy(transactions.filter(t => t.amount < 0), 'life_category_id');
  
  const categoryTotals = Object.entries(byCategory).map(([categoryId, txns]) => ({
    category_id: categoryId,
    category_name: txns[0].category_name,
    total: Math.abs(sum(txns, 'amount')),
    transaction_count: txns.length
  }));
  
  // Sort by total descending
  return categoryTotals
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
```

## Performance Optimization

### Indexes

```sql
-- Essential indexes for cashflow queries
CREATE INDEX idx_txn_date_status ON transactions(date, status);
CREATE INDEX idx_txn_cashflow_group ON transactions(cashflow_group);
CREATE INDEX idx_txn_category ON transactions(life_category_id);
CREATE INDEX idx_txn_account ON transactions(account_id);

-- Composite for common filter combinations
CREATE INDEX idx_txn_cashflow_filters 
ON transactions(status, is_transfer, date) 
WHERE status = 'posted' AND is_transfer = false;
```

### Caching

Cache monthly calculations since historical months don't change:

```typescript
const cashflowCache = new Map<string, number>();

async function calculateMonthlyNetCashflowCached(month: string): Promise<number> {
  // Don't cache current month (still changing)
  const currentMonth = format(new Date(), 'yyyy-MM-01');
  if (month === currentMonth) {
    return calculateMonthlyNetCashflow(month);
  }
  
  // Check cache
  if (cashflowCache.has(month)) {
    return cashflowCache.get(month)!;
  }
  
  // Calculate and cache
  const result = await calculateMonthlyNetCashflow(month);
  cashflowCache.set(month, result);
  
  return result;
}
```

### Materialized Views

For frequently accessed calculations:

```sql
-- Create materialized view for monthly cashflow summary
CREATE MATERIALIZED VIEW mv_monthly_cashflow AS
SELECT 
  date_trunc('month', date) as month,
  cashflow_group,
  SUM(amount) as total_amount,
  COUNT(*) as transaction_count
FROM transactions t
JOIN accounts a ON t.account_id = a.id
WHERE t.status = 'posted'
  AND t.is_transfer = false
  AND a.include_in_cashflow = true
GROUP BY date_trunc('month', date), cashflow_group;

-- Refresh daily or after bulk imports
REFRESH MATERIALIZED VIEW mv_monthly_cashflow;
```

## Validation & Testing

### Test Cases

```typescript
describe('Cashflow Calculations', () => {
  it('excludes transfer transactions', async () => {
    // Setup: Create transfer transaction
    // Assert: Not included in net cashflow
  });
  
  it('excludes pending transactions', async () => {
    // Setup: Create pending transaction
    // Assert: Not included in net cashflow
  });
  
  it('excludes accounts not in cashflow', async () => {
    // Setup: 401k transaction with include_in_cashflow = false
    // Assert: Not included in net cashflow
  });
  
  it('calculates net cashflow correctly', async () => {
    // Setup: $5000 income, $3000 expenses
    // Assert: Net = $2000
  });
  
  it('handles negative cashflow', async () => {
    // Setup: $3000 income, $5000 expenses
    // Assert: Net = -$2000
  });
  
  it('calculates safe-to-spend for current week', async () => {
    // Setup: $200 weekly budget, $50 spent
    // Assert: Safe-to-spend = $150
  });
  
  it('identifies outstanding expected income', async () => {
    // Setup: Expected $1200 rent, received $0
    // Assert: Outstanding = $1200
  });
});
```

### Manual Validation

**Monthly net cashflow should equal:**
```
Account balance change + transfers out - transfers in
```

Example:
- Jan 1 balance: $5,000
- Jan 31 balance: $6,500
- Transfers out (to savings): $500
- Transfers in: $0

**Net cashflow = ($6,500 - $5,000) + $500 - $0 = $2,000**

## Edge Cases

### Mid-Month Account Opening
- Only include transactions from activation date forward
- Don't include initial deposit as income (it's a transfer)

### Reimbursements
- Mark with `is_pass_through = true`
- Exclude from cashflow (use `is_pass_through = false` filter)
- OR net against original expense in same category

### Split Transactions
- Each child has its own category and cashflow_group
- Sum all children, not parent
- Filter: `WHERE parent_transaction_id IS NULL OR is_split_child = true`

### Refunds
- Positive amount in expense category
- Shows as "negative expense" = income
- Correctly reduces net spending for that category

## Common Mistakes

1. **Including transfers** → Inflates both income and expenses
2. **Including pending** → Counts same transaction twice
3. **Wrong amount signs** → Plaid convention vs yours
4. **Not filtering accounts** → Includes 401k, property, etc.
5. **Including pass-through** → Inflates cashflow (T-Mobile family plan)
6. **Double-counting splits** → Parent + children
7. **Wrong week boundaries** → Week should be Mon-Sun

## References

- **Overview doc:** `docs/financial-command-center-overview.md` (Section: Cashflow and Safe-to-Spend Logic)
- **Schema:** `docs/db-schema.md` (Tables: transactions, accounts, categories, budget_targets, expected_inflows)
- **Implementation:** `lib/cashflow.ts`
- **UI components:** `components/dashboard/CashflowCard.tsx`, `components/dashboard/SafeToSpendCard.tsx`
