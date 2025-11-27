# Transaction Categorizer – v1 Prompt Spec

Goal: Given a single transaction JSON plus some context, return a structured classification object used to populate the `transactions` table.

---

## Input

The service receives JSON like:

'''
{
  "description_raw": "Automatic Withdrawal, T-mobile Pcs Svc Web (r)",
  "amount": -402.15,
  "date": "2025-03-10",
  "provider": "plaid",
  "provider_type": "card_payment",
  "account_name": "AFCU Checking",
  "counterparty_name": null,
  "notes": "",
  "recent_similar_examples": []
}
'''

You may also pass high-level hints (e.g., known Venmo usernames → tenants).

---

## Output Shape

The model should return **only** JSON in this format:

'''
{
  "category_name": "Phone",
  "cashflow_group": "Fixed",
  "flow_type": "Expense",
  "is_transfer": false,
  "is_pass_through": true,
  "is_business": false,
  "counterparty_type": null,
  "notes": "T-Mobile full bill; mostly reimbursed by family"
}
'''

Field definitions:

- `category_name`: one of the entries in the `categories` table.
- `cashflow_group`: one of: `Income`, `Fixed`, `Variable Essentials`, `Discretionary`, `Debt`, `Savings/Investing`, `Business`, `Transfer`, `Detractors`, `Other`.
- `flow_type`: `Income`, `Expense`, or `Transfer`.
- `is_transfer`: `true` if this is an internal money move that should not impact net cashflow.
- `is_pass_through`: `true` if funds are primarily reimbursed or forwarded (e.g., T-Mobile reimbursements).
- `is_business`: `true` for rental / Turo / business expenses or income.
- `counterparty_type`: optional hint like `"tenant"`, `"tmobile_family"`, `"other"`, or `null`.
- `notes`: short explanation for debugging.

---

## Rules

1. **Income vs Expense vs Transfer**
   - `Transfer` for internal moves:
     - Checking → savings
     - Venmo cashouts
     - Transfers to Money Market or HSA when clearly labeled as such.
   - Do **not** use `Transfer` for:
     - Rent, loan payments, card payments, utilities, subscriptions, etc.
   - Positive amounts into AFCU checking labelled “Payroll”, “Quickbooks Co: Barbara…” → `Paycheck`, `Income`.

2. **Rent and Rental Income**
   - Descriptions like:
     - `Rent part 1 for March`
     - `Rent part 2 for March`
     - `January Rent`, `February Rent`, `March rent`, `Rent for January`
     - Venmo from tenants with “rent” in the note
   - → `category_name = "Home Rental Income"`, `cashflow_group = "Income"`, `flow_type = "Income"`.

3. **T-Mobile**
   - Bank debits with descriptions matching `T-mobile Pcs Svc` or similar:
     - `category_name = "Phone"`
     - `cashflow_group = "Fixed"`
     - `flow_type = "Expense"`
     - `is_pass_through = true` (because family reimburses most of it).
   - Venmo inflows from known family usernames:
     - Fife → `Jared-Fife-1`
     - Worwood → `Daniel-Worwood`
     - Carpenter → `Gary-Carpenter-4`
     - Steck → `SteckDEV`
     - → `category_name = "Reimbursable"` or `TMobile Reimbursement` (mapped in categories to `Business` or `Other`),
       `is_pass_through = true`, `flow_type = "Income"`.

4. **Groceries vs Restaurants vs Travel**
   - `Smith's Food`, `Publix`, grocery chain descriptors → `Groceries` (`Variable Essentials`).
   - `McDonald's`, `Chick-fil-a`, `New York Pizza`, `Smashburger`, `Doordash` food orders →
     `Restaurants` (`Discretionary`).
   - `Uber Eats` / food in another city / clearly trip-related → `Travel` or `Restaurants` depending on context.
   - Travel-coded merchants like airport parking, hotels, Uber/Lyft on trips → `Travel` (`Discretionary`).

5. **Car Rentals and Turo**
   - `Turo x2901`, `Turo x6673` inflows → `Car Rental Income` (`Income`, `Primary Income` group in life_group).
   - `Lyft`, `Uber`, `Quickquack` (car wash), parking, Masabi UTA, etc. connected to Turo expenses →
     `Car Rental Expenses` or `Reimbursable` with `is_business = true`.

6. **Debt and Loans**
   - `Dept Education Student Ln`, `Student Loan Servicer` → `Loan Payment` (`Debt`).
   - `Wells Fargo Autodraft`, `Automatic Loan Payment`, `Car Loan` → `Car Payment` (`Debt`).
   - Mortgage descriptors like `Pnc Mtg Payment`, `Nsm Dbamr.cooper`, etc. → `Mortgage` (`Debt` or `Fixed`).

7. **Subscriptions and Detractors**
   - `Netflix`, `Spotify`, `Patreon`, `OpenAI`, `Codeium`, etc. → `Subscriptions` or `Work Projects` depending on label and context.
   - Obvious “unneeded” or wasteful subs may be mapped to `Unneeded Subscriptions` (cashflow_group `Detractors`).

8. **Transfers and Investment Moves**
   - Descriptions like `Funds Transfer From Checking`, `Funds Transfer to Money Market`, `Deposit Ach Venm Type: Cashout Co: Venmo` →
     `category_name = "Transfer"`, `cashflow_group = "Transfer"`, `flow_type = "Transfer"`, `is_transfer = true`.

9. **Manual Overrides**
   - If provided with override patterns in `OVERRIDES_JSON`, **respect those first** and never contradict them.
   - When you see a transaction that matches an existing override pattern, use the overridden category and flags.

---

## Examples (from real data)

Use these as **few-shot examples** in the prompt.

1. Groceries

'''
{
  "input": {
    "description_raw": "Smith's Food #4207",
    "amount": -124.30
  },
  "output": {
    "category_name": "Groceries",
    "cashflow_group": "Variable Essentials",
    "flow_type": "Expense",
    "is_transfer": false,
    "is_pass_through": false,
    "is_business": false,
    "counterparty_type": null,
    "notes": "Grocery store"
  }
}
'''

2. Venmo rent

'''
{
  "input": {
    "description_raw": "Stephani Walker paid you $60.00",
    "amount": 60.0
  },
  "output": {
    "category_name": "Home Rental Income",
    "cashflow_group": "Income",
    "flow_type": "Income",
    "is_transfer": false,
    "is_pass_through": false,
    "is_business": true,
    "counterparty_type": "tenant",
    "notes": "Partial rent payment from tenant"
  }
}
'''

3. Venmo cashout

'''
{
  "input": {
    "description_raw": "Deposit Ach Venm Type: Cashout Co: Venmo, Entry Class Code: Ppd",
    "amount": 1200.0
  },
  "output": {
    "category_name": "Transfer",
    "cashflow_group": "Transfer",
    "flow_type": "Transfer",
    "is_transfer": true,
    "is_pass_through": false,
    "is_business": false,
    "counterparty_type": null,
    "notes": "Moving money from Venmo to bank, income already counted at Venmo level"
  }
}
'''

You can extend this file later with more examples from your CSV.
