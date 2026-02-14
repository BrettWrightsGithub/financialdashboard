# Playwright MCP Runbook For Gold-Standard Scenarios

Companion document to `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/docs/user-scenarios.md`.

This runbook gives Codex-ready instructions for executing each scenario with Playwright MCP against the app in this repo.

## Baseline

- Scenario data references come from the same live snapshot used in the scenarios doc (`2026-02-09`, latest posted transaction date `2026-02-03`).
- Base URL assumed in examples: `http://localhost:3000`.
- Run these in Codex with Playwright MCP enabled.

## One-Time Setup In Codex

1. Add Playwright MCP server (official Codex command):
```bash
codex mcp add playwright npx "@playwright/mcp@latest"
```
2. Optional `~/.codex/config.toml` config tuned for repeatable local testing:
```toml
[mcp_servers.playwright]
command = "npx"
args = [
  "@playwright/mcp@latest",
  "--isolated",
  "--viewport-size=1440x1000",
  "--output-dir=.playwright-mcp-output",
  "--save-trace"
]
```
3. Start app in repo root:
```bash
npm run dev
```
4. In Codex, confirm Playwright MCP tools are visible (`browser_navigate`, `browser_snapshot`, etc.).

## Recommended MCP Tool Flow

Use this order in each scenario:

1. `browser_navigate` to page.
2. `browser_snapshot` to get element refs.
3. Interact using refs (`browser_click`, `browser_type`, `browser_select_option`, `browser_press_key`).
4. Assert via `browser_verify_text_visible` / `browser_verify_element_visible` (or `browser_evaluate` fallback).
5. Capture proof with `browser_take_screenshot`.

If your MCP setup does not expose `browser_verify_*` tools, use `browser_evaluate` for assertions.

## Codex Prompt Template

Use this template each time:

```text
Use Playwright MCP only (no code edits, no unit tests). Run Scenario <N> from docs/user-scenarios-playwright-mcp.md against http://localhost:3000. 
Follow the exact steps, report each assertion pass/fail, and include one final screenshot filename.
```

## Scenario Instructions

### Scenario 1: Daily Money Check-In (Read-Only)

1. Navigate to `/`.
2. Set month selector to `2026-02`.
3. Verify visible text:
- `Safe to Spend This Week`
- `Monthly Cashflow`
- `Outstanding Inflows`
- `Overspent Categories`
4. Verify expected values for `2026-02`:
- Safe-to-spend around `$69.28`
- Net cashflow around `+$1,841`
- Outstanding inflow includes `T-Mobile Reimbursement` and `$30`
5. Take screenshot `scenario-01-dashboard-2026-02.png`.

Pass criteria:
- All four cards present and values match expected range/labels.

Codex prompt snippet:
```text
Run Scenario 1 with Playwright MCP. Use browser_snapshot refs, set month to 2026-02, verify safe-to-spend ~69.28, net cashflow ~+1841, and pending inflow $30 for T-Mobile Reimbursement.
```

### Scenario 2: Clear Review Queue (Write)

Data anchors:
- `6d86b99c-9e5c-4abe-be21-d593cdf50ce1` (`Ashley Wright "Adalynn preschool"`, `-184`)
- `6a90e8f6-6415-4ec7-9c9a-f458044250fc` (`Ashley Wright "February dates"`, `-200`)

1. Navigate to `/transactions`.
2. In global date filters, set range including `2026-02-01`.
3. In `Review Queue`, verify both Ashley rows are visible.
4. Select both rows.
5. Pick categories (for test repeatability, use `Household` and `Dining Out`, or your preferred known-correct categories).
6. Click `Confirm Selected`.
7. Verify selected count returns to `0` and rows are marked processed/saved.
8. Screenshot `scenario-02-review-queue-cleared.png`.

Pass criteria:
- Rows are processed and no longer active in queue for that date range.

Cleanup:
- If needed, locate both txns in ledger and set categories back to original intended values for your dataset.

### Scenario 3: Correct Category + Teach System (Rule Preview First)

Data anchor:
- `877f20f3-7fdc-46d9-b18b-5d33eeecfeb9` (`AUTOMATIC WITHDRAWAL, CAPITAL ONE CRCARDPMT WEB (S)`, `-249.64`)

Preview-only path:

1. Navigate to `/transactions`, find tx id or description, confirm current category.
2. Navigate to `/admin/rules`.
3. Create draft rule:
- Name: `Capital One CRCARDPMT`
- Match contains: `CAPITAL ONE CRCARDPMT`
- Assign category: `Credit Card Payment`
4. Run rule preview only.
5. Verify preview finds matching historical transactions.
6. Screenshot `scenario-03-rule-preview.png`.

Optional write path:
- Apply rule and retroactive backfill.

Pass criteria:
- Preview shows expected impacted rows before applying.

Cleanup (if write path used):
- Delete the rule after test, or revert impacted rows/categories.

### Scenario 4: Split Mixed Purchase (Write)

Data anchor:
- Parent candidate: `74b7a9fd-08d1-4c8e-8372-f5b99318d04c` (`Costco`, `-200`)

1. Navigate to `/transactions`.
2. Find `Costco` transaction on `2026-02-01` for `-200`.
3. Open split action.
4. Create child rows:
- `-140` -> `Groceries`
- `-60` -> `Household`
5. Save split.
6. Verify:
- Parent marked split parent.
- Child sum equals `-200`.
7. Screenshot `scenario-04-split-costco.png`.

Pass criteria:
- Split persists and parent/child math is exact.

Cleanup:
- Revert split if you need to restore original state.

### Scenario 5: Adjust Monthly Budget Targets (Write)

Data anchors for `2026-02` budget:
- Salary `6385`
- Rental Income `2950`
- Groceries `800`
- Dining Out `300`
- Gas/Fuel `200`
- Subscriptions `150`
- Healthcare `0`

1. Navigate to `/budget-planner`.
2. Select month `2026-02`.
3. Verify each baseline target above exists.
4. Edit `Dining Out` from `300` to `350`.
5. Trigger save (blur/enter as required by inline editor).
6. Refresh page and confirm value persisted at `350`.
7. Screenshot `scenario-05-budget-edit.png`.

Pass criteria:
- Updated target persists after reload.

Cleanup:
- Reset `Dining Out` to original value (`300`) if you want baseline unchanged.

### Scenario 6: Midweek Budget Guardrail Check (Read-Only + Optional Trigger)

Read-only path:

1. Navigate to `/` with month `2026-02`.
2. Verify `Overspent Categories` shows no overspent entries.
3. Navigate to `/budget-planner` month `2026-02`.
4. Verify `Groceries` actual around `200` against budget `800`.
5. Screenshot `scenario-06-no-overspend.png`.

Optional trigger path (write):

1. In budget planner, lower `Groceries` target to `150`.
2. Return to dashboard.
3. Verify overspent indicator appears for Groceries (about `$50`).
4. Screenshot `scenario-06-triggered-overspend.png`.

Cleanup:
- Restore `Groceries` target to original (`800`).

### Scenario 7: Track Missing Expected Inflows (Read-Only)

Expected `2026-02` inflow anchor:
- `T-Mobile Reimbursement`, pending, `$30`

1. Navigate to `/` and set month `2026-02`.
2. Confirm outstanding inflow card includes pending `$30`.
3. Navigate to `/budget-planner`, same month.
4. In expected inflows section, confirm matching pending entry.
5. Screenshot `scenario-07-expected-inflows.png`.

Pass criteria:
- Dashboard and budget planner both show consistent pending inflow value.

### Scenario 8: Transfers Neutrality Check (Write Optional)

Anchors:
- `f92c6701-237c-4b02-ba84-0efe41080b28` (`FUNDS TRANSFER TO MONEY MARKET`, `-300`)
- `f402fe01-800d-49bd-b763-a0b9d3e20f23` (`FUNDS TRANSFER FROM CHECKING`, `+300`)

1. Navigate to `/transactions`.
2. Search for `FUNDS TRANSFER`.
3. Confirm transfer-category rows are present.
4. Verify transfer flags on selected rows (some current rows may be category=Transfer but `is_transfer=false`).
5. Optional: correct transfer flag/category on mismatched rows.
6. Verify dashboard net cashflow does not show artificial change from paired transfers.
7. Screenshot `scenario-08-transfer-neutrality.png`.

Pass criteria:
- Internal transfers are consistently represented as neutral in cashflow logic.

### Scenario 9: Weekly Mobile Triage (Write)

1. Navigate to `/transactions`.
2. Resize viewport to mobile (`browser_resize`, e.g. `390x844`).
3. In review queue, confirm pending items for `2026-02` are actionable from mobile layout.
4. Process 1-2 queued items via mobile controls/sheets.
5. Verify queue count decreases and UI remains usable.
6. Screenshot `scenario-09-mobile-triage.png`.

Pass criteria:
- Queue can be triaged end-to-end in mobile viewport without desktop-only controls.

Cleanup:
- Revert categories if you changed rows only for test.

### Scenario 10: Assistant-Guided Rule Creation (Preview First)

Anchors:
- `Quickbooks Deposit` appears frequently (16 rows in dataset), with uncategorized examples:
  - `e8d48082-2b27-4208-89dd-fa5ff30ccf60`
  - `2a0f4751-2d32-401f-8420-dab3c39e0ee3`
  - `bd7abbf8-5f25-4aeb-a961-367ea6a19302`
  - `715c5459-955f-497d-93a5-9cd85094951d`

1. Navigate to `/transactions`.
2. Open `Assistant` drawer/button.
3. Prompt assistant: `Create a categorization rule for Quickbooks Deposit inflows to Side Income`.
4. Verify assistant shows rule preview intent before final confirm.
5. Confirm rule creation only if you want write-mode test.
6. Navigate to `/admin/rules`, preview/backfill the new rule.
7. Verify affected rows are listed and (if applied) recategorized.
8. Screenshot `scenario-10-assistant-rule-flow.png`.

Pass criteria:
- Assistant generates a coherent rule preview and rule/admin flows are consistent.

Cleanup:
- Remove test rule if it was only for validation.

## Suggested Execution Order In Codex

1. Run read-only scenarios first: `1`, `6` (read-only path), `7`.
2. Run write scenarios in controlled order: `2`, `4`, `5`, `8`, `9`.
3. Run rule/assistant scenarios last: `3`, `10`.
4. Restore modified data if you need to keep your baseline unchanged.

## References

- Playwright MCP README: [https://github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- Existing project MCP testing notes: `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/docs/testing/playwright_mcp_testing_guidelines.md`
- Scenario definitions and DB anchors: `/Volumes/ORICO/Projects/financialdashboard/financialdashboard/docs/user-scenarios.md`
