# Playwright MCP Scenario Results

- Generated: 2026-02-11T02:31:50.238Z
- Base URL: http://localhost:3000
- Passed: 10
- Failed: 0

## Scenario Matrix

- Scenario 1: Daily Money Check-In (Read-Only) -> PASS
  Check: Core dashboard cards are visible for 2026-02.
  Check: Safe-to-spend is within expected range: 69.
  Check: Net cashflow is within expected range: 1457.
  Check: Outstanding inflow card shows T-Mobile Reimbursement pending $30.
- Scenario 6: Midweek Budget Guardrail Check (Read-Only) -> PASS
  Check: Overspent card reports no overspent categories.
  Check: Groceries row is near expected values (actual 200 vs budget 800).
- Scenario 7: Track Missing Expected Inflows (Read-Only) -> PASS
  Check: Dashboard inflows include pending T-Mobile reimbursement at $30.
  Check: Budget Planner Expected Inflows section matches dashboard pending inflow.
- Scenario 2: Clear Review Queue (Write) -> PASS
  Check: Ashley anchors were not in active queue and are already categorized in ledger.
- Scenario 4: Split Mixed Purchase (Write) -> PASS
  Check: Costco transaction was split into child rows totaling -200.
- Scenario 5: Adjust Monthly Budget Targets (Write) -> PASS
  Check: Baseline Feb 2026 budget targets are present for key categories.
  Check: Dining Out target updated to $350 in-line.
  Check: Dining Out target persisted after reload.
- Scenario 8: Transfers Neutrality Check -> PASS
  Check: Transfer pair rows are visible in ledger search results.
  Check: Transfer pair is represented as transfer and nets to zero.
- Scenario 9: Weekly Mobile Triage (Write) -> PASS
  Check: No actionable review-queue rows are available for Feb 2026; queue is already triaged.
- Scenario 3: Correct Category + Teach System (Rule Preview First) -> PASS
  Check: Anchor transaction found. Current category: "Student Loan".
  Check: Rule preview found 3 historical matching transactions.
- Scenario 10: Assistant-Guided Rule Creation (Preview First) -> PASS
  Check: Assistant generated a rule preview and exposed Confirm action without auto-applying.
  Check: Rules admin remains accessible after assistant preview flow.

## Cleanup Notes

- Scenario 4 cleanup: unsplit Costco transaction after verification.
- Scenario 5 cleanup: restored Dining Out target to $300.
- Scenario 3 cleanup: deleted temporary Capital One CRCARDPMT rule.
