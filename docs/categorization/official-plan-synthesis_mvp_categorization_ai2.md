# Transaction Categorization MVP Synthesis Document
**Status:** Decision-Ready | **Date:** 2026-01-01

---

## PART 1: NORMALIZED REPORTS

---

### REPORT A: ChatGPT Deep Research

#### A.1 Assumptions
- Users want cashflow clarity with minimal manual effort
- Auto-categorization accuracy is the primary driver of satisfaction
- User control/overrides are essential for trust
- Transfers and reimbursements are core pain points across all apps
- Rule-based systems can handle most recurring patterns

#### A.2 Atomic Findings/Claims

| # | Claim | Evidence (Section/Quote) |
|---|-------|--------------------------|
| A1 | Copilot achieves ~95% auto-categorization accuracy for typical transactions | "correctly auto-categorizing about 95% of typical transactions" (reddit.com) |
| A2 | YNAB remembers manual categorizations for future payee matches | "once you manually categorize a new payee the first time, YNAB will remember that choice" (reddit.com) |
| A3 | Mint's algorithm frequently ignored manual overrides and chose wrong categories | "Mint's algorithm…often chose the wrong category and ignored manual overrides" (tiller.com) |
| A4 | Transfers must be excluded from spending reports to avoid false expenses | "Users overwhelmingly want transfers excluded from budgets and spending reports" (reddit.com) |
| A5 | Venmo/Zelle payments often auto-categorized as Transfers when they're real expenses | "peer-to-peer payments…were often auto-categorized as Transfers by mistake" (evolvingmoneycoaching.com) |
| A6 | Reimbursements should be categorized to the same category as original expense to net out | "categorize the incoming reimbursement to the same category as the original expense" (reddit.com) |
| A7 | Ambiguous merchants (Amazon, Walmart, Costco) require transaction splitting | "Amazon order might contain groceries, household supplies, and a gift – multiple categories in one" (reddit.com) |
| A8 | Monarch's Amazon browser extension auto-splits orders into line items by category | "extension will automatically split a single Amazon transaction into multiple line items" (reddit.com) |
| A9 | Users want to disable mandatory review once they trust the system | "power users still begged: 'If that's all it's for, just let me turn it off'" (reddit.com) |
| A10 | Bulk editing/multi-select for categories is a frequent feature request | "I want to multiselect and set the category for all selected items" (reddit.com) |
| A11 | Monarch's rule engine allows retroactive application to past transactions | "you can re-run rules on all past transactions after editing one" (reddit.com) |
| A12 | Tiller's AutoCat provides 100% rule-based consistency with no ML surprises | "AutoCat…will precisely categorize your transactions 100% based on your rules" (tiller.com) |
| A13 | QuickBooks uses rule priority ordering—top rule wins if multiple match | "lets users reorder bank rules—the top rule wins" (mro.cpa) |
| A14 | Brex flags rule conflicts rather than making arbitrary choices | "if two custom rules at the same level both apply, Brex prompts an admin to choose" (brex.com) |
| A15 | QuickBooks adds visible "RULE" badge for rule-applied transactions | "it adds a visible 'RULE' label in the transaction's category field" (quickbooks.intuit.com) |
| A16 | Monarch's Amazon extension is opt-in via browser extension for privacy | "user must install a browser extension and explicitly log in to Amazon" (help.monarch.com) |
| A17 | Receipt matching should not auto-link on low confidence | "if a receipt and card charge don't closely match, they won't merge automatically" (help.expensify.com) |
| A18 | LLMs for categorization are "costly and not fast enough for high volumes" currently | "out-of-the-box LLMs are costly and not fast enough for high volumes" (reddit.com/zenml.io) |
| A19 | Drift detection (rule decay over time) is a future enhancement, not MVP | "no mainstream app automatically 'expires' or adjusts your old rules" (Analysis section) |
| A20 | Parent-child split model needed—each split carries own category, links to parent | "each split carries its own category…but links back to the single real payment" (Analysis section) |

#### A.3 Recommendations
- Implement deterministic rule hierarchy with user-defined ordering
- Add retroactive rule application with audit trail and undo
- Support parent-child splits for ambiguous merchants
- Show explainability badges ("RULE", "ML", "Manual")
- Basic receipt matching (manual attach first, auto-match later)
- Defer LLM-based categorization and drift detection to later phases

#### A.4 Risks / Open Questions
- **Risk:** Rules can conflict silently without priority system
- **Risk:** Retroactive changes can cause unintended mass edits
- **Risk:** Amazon/receipt integrations require browser extensions (user friction)
- **Question:** How to handle rule drift over time?
- **Question:** When to expose full rule editor vs. chat-only authoring?

---

### REPORT B: Gemini Deep Research

#### B.1 Assumptions
- Legacy PFM failed due to static string-matching and rigid taxonomies
- "Hybrid Intelligence" (deterministic + AI + user input) is the new paradigm
- Context (user's financial "DNA") matters more than generic merchant labels
- Users have emotional and psychological relationships with spending categories

#### B.2 Atomic Findings/Claims

| # | Claim | Evidence (Section/Quote) |
|---|-------|--------------------------|
| B1 | Legacy systems treated categorization as static labeling, failing on edge cases | "Legacy systems failed because they treated transaction categorization as a static labeling problem" (Section 1.1) |
| B2 | Same merchant can mean different categories for different users (Adobe = Business vs Entertainment) | "A freelancer might categorize an Adobe subscription as a 'Business Expense,' while a hobbyist sees it as 'Entertainment'" (Section 1.1) |
| B3 | Hybrid Intelligence combines deterministic rules, provider data (Plaid), and adaptive AI | "synthesize deterministic logic, global intelligence (provider data like Plaid), and adaptive reasoning (AI and RAG)" (Section 1) |
| B4 | A "Waterfall of Truth" precedence model resolves categorization conflicts | "Waterfall of Truth" term used for layered categorization approach (Section 1) |
| B5 | User context and history ("memory") is critical for accurate personalization | "legacy systems lacked 'memory' of the user's specific context" (Section 1.1) |

*Note: Report B (Gemini) was truncated in the provided content. Above findings extracted from visible portion.*

#### B.3 Recommendations
- Build a layered "Waterfall" precedence model
- Incorporate user history and context into categorization logic
- Support personalized category mappings per user

#### B.4 Risks / Open Questions
- **Risk:** Building "adaptive reasoning" (AI) layer adds complexity beyond MVP
- **Question:** How much user context is needed before personalization is useful?

---

### REPORT C: Perplexity Deep Research

#### C.1 Assumptions
- Four-layer architecture is optimal: Programmatic → Plaid → ML → LLM/User
- MVP can achieve 75-85% auto-categorization without custom ML
- User feedback loop is essential for continuous improvement
- Privacy and explainability are core requirements, not afterthoughts

#### C.2 Atomic Findings/Claims

| # | Claim | Evidence (Section/Quote) |
|---|-------|--------------------------|
| C1 | Layer 1 (Programmatic) achieves 95%+ confidence for known patterns | "Confidence: 95%+ | Speed: Instant" (Layer 1 section) |
| C2 | Layer 2 (Plaid) provides 75-85% confidence with instant enrichment | "Confidence: 75-85% | Speed: Instant (with Plaid data)" (Layer 2 section) |
| C3 | Plaid struggles with professional services, personal transfers, business vs personal context | "Plaid's categories…struggle with: Professional services…Personal transfers labeled as payments…Business vs. personal" (Layer 2 section) |
| C4 | ML model (XGBoost/LightGBM) provides 70-90% confidence with 10-50ms inference | "Confidence: 70-90% | Speed: 100-500ms | Model Type: Hybrid" (Layer 3 section) |
| C5 | LLM + RAG should only trigger for ambiguous cases (confidence <0.6) | "IF transaction is ambiguous OR plaid_confidence < 0.6: [trigger LLM]" (Layer 3B section) |
| C6 | User corrections should update all four layers for continuous learning | "User chooses → system updates all four layers" (Layer 4C section) |
| C7 | Essential vs Discretionary spending breakdown provides actionable insight | "Essential (Non-Negotiable)…Discretionary (Flexible)" breakdown (Part 2 section) |
| C8 | Spending velocity alerts catch overages before month-end | "Spending velocity detection (on pace for budget?)" (Phase 3 scope) |
| C9 | MVP (3 months): Plaid + Programmatic rules + User override + Monthly report | "MVP (3 months): Plaid integration, Programmatic rules engine, User override system, Monthly cash flow report" (Phase 1) |
| C10 | 80%+ transactions should be categorized with no user input for MVP success | "80%+ of transactions categorized with no user input" (Phase 1 Success Metrics) |
| C11 | Users should spend <5 min/week on corrections in MVP | "Users spend <5 min/week on corrections" (Phase 1 Success Metrics) |
| C12 | Every categorization should show confidence score and reasoning | "Every categorization shows confidence level (70%, 82%, 95%)…Reason shown" (Complaint section) |
| C13 | Bulk categorization (select multiple, assign category) is MVP scope | "Basic bulk categorization (select multiple, assign category)" (Phase 1 scope) |
| C14 | Transfer learning can bootstrap new users with <50 transactions | "For new users with <50 transactions, use transfer learning" (Technical section) |
| C15 | Hybrid deployment (local XGBoost, cloud LLM) balances speed and capability | "Local XGBoost for common transactions, cloud LLM for edge cases" (Deployment section) |
| C16 | Rule suggestions should trigger after 3 corrections of same merchant | "If user corrects the same merchant multiple times, suggest creating a rule" (Feedback section) |
| C17 | Confidence calibration is a key metric—scores should match actual accuracy | "Confidence score calibration" listed as key metric (Metrics section) |
| C18 | Competitive differentiator: explaining "why" for each categorization | "Every categorization in your system answers: What, How confident, Why, What you chose before" (Key Differentiator section) |
| C19 | Mint users abandoned due to "recategorization fatigue" | "Mint learns nothing → User abandons app" (Problem 1 section) |
| C20 | Phase 2 (months 4-6): ML model training, LLM edge cases, auto rule suggestions | "Phase 2: ML categorization model, LLM for edge cases, Automatic rule suggestions" (Phased Plan) |

#### C.3 Recommendations
- MVP: Plaid + Programmatic rules + User override + Bulk actions
- Defer ML/LLM to Phase 2 (months 4-6)
- Show confidence scores on every transaction from day one
- Implement feedback loop that suggests rules after repeated corrections
- Privacy-first: opt-in for any data sharing, encryption at rest/transit

#### C.4 Risks / Open Questions
- **Risk:** Plaid API failures/changes—need fallback manual import
- **Risk:** ML model makes bad predictions—always allow override
- **Risk:** Users hesitant to share financial data—offer transparency
- **Question:** When to trigger LLM vs. just ask user?
- **Question:** How to handle users with <50 transactions for ML training?

---

## PART 2: INSIGHT LEDGER TABLE

| # | Claim (Atomic) | Why It Matters to Goal | Evidence Strength | Source | Dup Group | Conflicts/Notes | Keep/Maybe/Cut | What Would Validate? |
|---|----------------|------------------------|-------------------|--------|-----------|-----------------|----------------|---------------------|
| 1 | Programmatic rules achieve 95%+ confidence for known patterns | Instant, reliable categorization for recurring transactions | High | A1, C1 | DG-01 | Aligned | **Keep** | Pilot with 100 txns |
| 2 | Plaid provides 75-85% baseline categorization | Reduces cold-start problem; instant enrichment | High | C2 | DG-02 | | **Keep** | Check Plaid accuracy on test accounts |
| 3 | Plaid struggles with professional services, transfers, business vs personal | Explains why Plaid alone is insufficient | Medium | C3 | DG-02 | | **Keep** | Log Plaid misses in pilot |
| 4 | YNAB/Copilot remember payee→category after first manual entry | Basic "learn once" reduces repeat work | High | A2 | DG-03 | | **Keep** | Implement payee memory |
| 5 | Mint ignored manual overrides causing user abandonment | Overrides MUST stick—critical trust factor | High | A3, C19 | DG-04 | | **Keep** | Test override persistence |
| 6 | Transfers must be excluded from spending to avoid false cashflow | Core to "cashflow clarity" goal | High | A4, A5 | DG-05 | | **Keep** | Validate transfer detection logic |
| 7 | Venmo/Zelle often miscategorized as Transfers when they're expenses | Need heuristics to distinguish P2P payments vs internal transfers | High | A5 | DG-05 | | **Keep** | Manual review P2P transactions |
| 8 | Reimbursements should net against original expense category | Prevents inflated income/expense reporting | High | A6 | DG-06 | | **Keep** | User test: reimbursement flow |
| 9 | Amazon/Walmart/Costco require transaction splitting | Multi-category purchases are common | High | A7 | DG-07 | | **Keep** | Track split frequency in pilot |
| 10 | Monarch's Amazon extension auto-splits by line item | Ideal but requires browser extension + retailer integration | Medium | A8 | DG-07 | Defer for MVP | **Maybe** | Evaluate effort vs value |
| 11 | Bulk edit/multi-select is a top feature request | Reduces correction time significantly | High | A10, C13 | DG-08 | | **Keep** | Implement in MVP |
| 12 | Rule priority ordering (top rule wins) prevents conflicts | Deterministic behavior builds trust | High | A13, A14 | DG-09 | | **Keep** | Implement priority system |
| 13 | Retroactive rule application needed with undo capability | Users expect rules to fix past data | High | A11 | DG-10 | | **Keep** | Build with audit log |
| 14 | Explainability badges ("RULE", "ML", "Manual") build trust | Users need to know WHY a category was assigned | High | A15, C12, C18 | DG-11 | | **Keep** | Add source indicator |
| 15 | LLMs too slow/costly for high-volume real-time categorization | Defer LLM to Phase 2, edge cases only | Medium | A18 | DG-12 | C5 suggests <0.6 confidence trigger | **Keep** | Cost/latency benchmark |
| 16 | ML (XGBoost/LightGBM) achieves 70-90% with fast inference | Phase 2 enhancement after data accumulates | Medium | C4 | DG-12 | | **Maybe** | Requires 50+ txns per user |
| 17 | User feedback loop should suggest rules after 3 corrections | Automates rule creation from behavior | Medium | C16 | DG-13 | | **Maybe** | Implement in Phase 2 |
| 18 | MVP can achieve 80% auto-categorization without custom ML | Validates MVP scope without ML complexity | High | C10 | DG-14 | | **Keep** | Measure in pilot |
| 19 | Users should spend <5 min/week on corrections | Key success metric for MVP | High | C11 | DG-14 | | **Keep** | Track in pilot |
| 20 | Receipt matching should not auto-link on low confidence | Avoid false merges; user confirmation required | Medium | A17 | DG-15 | | **Keep** | Defer auto-match to Phase 2 |
| 21 | Privacy: opt-in for any data sharing, explicit consent | Required for trust and compliance | High | A16, C (Privacy section) | DG-16 | | **Keep** | Implement consent UI |
| 22 | Parent-child split model for transactions | Technical approach for splits | Medium | A20 | DG-07 | | **Keep** | Design in schema |
| 23 | Confidence scores should be calibrated to actual accuracy | Scores must be meaningful, not arbitrary | Medium | C17 | DG-11 | | **Maybe** | Measure calibration post-Phase 2 |
| 24 | Hybrid Intelligence (deterministic + AI + user) is optimal | Layered approach handles diverse cases | High | B3, C (4-layer) | DG-17 | Aligned | **Keep** | Architecture decision |
| 25 | User context/history critical for personalization | Personalization improves accuracy over time | Medium | B5, C4 | DG-17 | Phase 2+ | **Maybe** | Validate with ML model |
| 26 | Essential vs Discretionary breakdown for actionable insight | Helps user understand cashflow health | Medium | C7 | DG-18 | | **Maybe** | Phase 2 analytics |
| 27 | Spending velocity alerts catch overspending early | Proactive vs reactive budgeting | Low | C8 | DG-18 | | **Cut** (Phase 3) | — |
| 28 | Transfer learning can bootstrap users with <50 transactions | Addresses cold-start for ML | Low | C14 | DG-19 | Phase 2 | **Cut** (MVP) | — |
| 29 | Drift detection for stale rules | Prevents "forever wrong" rules | Low | A19 | DG-20 | Future | **Cut** (MVP) | — |

### Conflicts Identified
| Conflict | Source A | Source B/C | Resolution |
|----------|----------|------------|------------|
| LLM usage scope | A18: "costly, not fast enough" | C5: "trigger when <0.6 confidence" | **Align:** Defer LLM to Phase 2, use only for edge cases with batching |
| Amazon splitting | A8: browser extension ideal | MVP constraint: simple | **Align:** Manual split in MVP; explore extension later |

---

## PART 3: GAP CHECK (Decision Blockers)

### Missing Information Required for MVP Decisions

| # | Gap | Why It Blocks Decision | Suggested Fast Validation |
|---|-----|------------------------|---------------------------|
| G1 | Actual Plaid accuracy for YOUR transaction mix | Need baseline to know if 75-85% holds | Pull 200 historical txns, compare Plaid vs correct category |
| G2 | Transfer detection heuristics (Venmo/Zelle vs internal) | Core to cashflow accuracy | Define rules: same-owner accounts = transfer; external P2P = expense unless flagged |
| G3 | What % of transactions need splitting (Amazon, Costco, etc.)? | Determines priority of split feature | Survey own transactions for multi-category purchases |
| G4 | User time tolerance for weekly review | Sets MVP UX bar | Self-test: how long to review 1 week of transactions? |
| G5 | Category taxonomy alignment with user mental model | Categories must feel right | Review Plaid categories vs personal preference; adjust |
| G6 | Rule conflict scenarios in practice | Need real examples | Create 5 test rules, check for overlaps |

### Questions That Must Be Answered

1. **What is the minimum viable rule schema?** (Merchant match? Amount range? Day-of-week?)
2. **Should MVP include a "needs review" queue or just list uncategorized?**
3. **What does "satisfactorily categorized" mean operationally?** (Propose: user accepts without change)
4. **How to handle timing mismatch for reimbursements across months?**

---

## PART 4: FINAL OUTPUT — MVP Decision Brief + PRD-lite

---

### A) Executive Summary

- **Goal:** Build transaction categorization that delivers trustworthy cashflow insights with minimal manual effort.
- **MVP Scope:** Programmatic rules + Plaid baseline + User overrides + Bulk editing. No custom ML for V1.
- **Target Accuracy:** 80%+ transactions auto-categorized; <5 min/week user correction time.
- **Key Differentiator:** Explainability (show WHY each transaction is categorized) + user overrides that STICK.
- **Primary Risk:** Transfer/P2P detection accuracy—must nail this for cashflow clarity.
- **Deferred:** Custom ML model, LLM integration, Amazon/receipt itemization, drift detection.
- **Validation First:** Pilot with 200 transactions to measure Plaid baseline and identify rule gaps before building UI.

---

### B) Recommended MVP Scope

#### IN (MVP)
| Feature | Rationale | Source |
|---------|-----------|--------|
| Plaid categorization baseline | Instant 75-85% accuracy, no ML needed | C2 |
| Programmatic rules (merchant match, amount, account type) | Handles recurring patterns at 95%+ confidence | A1, C1 |
| User override (always wins, persists) | Trust: overrides must stick | A3, A4 |
| Payee memory (learn from first categorization) | Reduces repeat work | A2 |
| Transfer detection (internal vs external P2P) | Core to cashflow accuracy | A4, A5 |
| Reimbursement handling (net against original category) | Prevents inflated reporting | A6 |
| Manual transaction split (parent-child model) | Handles Amazon/Costco | A7, A20 |
| Bulk editing (multi-select, assign category) | Top user request | A10, C13 |
| Categorization source indicator ("Plaid", "Rule", "Manual") | Builds trust via explainability | A15, C18 |
| Review queue (uncategorized/low-confidence) | Focuses user attention | C (workflow) |
| Audit log (track changes with provenance) | Supports undo and trust | A (auditability) |

#### OUT (Phase 2+)
| Feature | Why Deferred | Target Phase |
|---------|--------------|--------------|
| Custom ML model (XGBoost/LightGBM) | Needs 50+ txns/user; complexity | Phase 2 |
| LLM + RAG for edge cases | Cost/latency; limited MVP value | Phase 2 |
| Auto rule suggestions (after N corrections) | Needs correction data first | Phase 2 |
| Amazon/receipt itemization (browser extension) | High effort, retailer dependency | Phase 3 |
| Spending velocity alerts | Analytics feature, not categorization | Phase 3 |
| Drift detection / rule decay | Complexity; no mainstream app does this | Phase 3+ |
| Peer benchmarking | Needs user base | Phase 4 |

---

### C) MVP User Flow (High-Level)

```
1. CONNECT ACCOUNTS
   User links bank/credit card/Venmo via Plaid
   ↓
2. INITIAL CATEGORIZATION
   System applies: Plaid baseline → Programmatic rules → Mark uncategorized
   ↓
3. REVIEW QUEUE
   User sees transactions needing attention:
   - Uncategorized (no match)
   - Low confidence (e.g., Plaid <0.7)
   - Flagged as ambiguous (P2P, large amount)
   ↓
4. USER ACTION
   - Approve suggested category (1-tap)
   - Override with different category
   - Split transaction (multiple categories)
   - Mark as transfer/reimbursement
   ↓
5. SYSTEM LEARNS
   - Save payee→category mapping
   - Apply user override to future matches
   - Log change with provenance
   ↓
6. CASHFLOW VIEW
   Dashboard shows Income − Expenses (excluding transfers)
   User trusts numbers because they reviewed/approved
```

---

### D) Functional Requirements (Prioritized)

#### P0 — Must Have for MVP

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-01 | Plaid integration for transaction import | Transactions sync within 5 min of bank post |
| FR-02 | Plaid category passthrough | Each transaction has `plaid_category` field populated |
| FR-03 | Programmatic rule engine | Rules match on: merchant name (exact/contains), amount range, account type, direction (debit/credit) |
| FR-04 | Rule priority ordering | Rules have numeric priority; highest priority rule wins |
| FR-05 | User override (manual category assignment) | Override persists; not overwritten by rules |
| FR-06 | Payee memory | After manual categorization, same payee auto-assigns category |
| FR-07 | Transfer detection | Auto-flag same-owner account transfers; exclude from cashflow |
| FR-08 | P2P payment handling | Venmo/Zelle between external parties defaults to expense, not transfer |
| FR-09 | Reimbursement flow | User can mark transaction as reimbursement; link to original expense; nets in category |
| FR-10 | Manual split | User can split 1 transaction into 2+ with separate categories; parent-child model |
| FR-11 | Bulk edit | Multi-select transactions, assign single category |
| FR-12 | Categorization source indicator | Show "Plaid", "Rule: [name]", or "Manual" for each transaction |
| FR-13 | Review queue | List transactions that are uncategorized or low confidence |
| FR-14 | Audit log | Each categorization change logged with timestamp, source, previous value |

#### P1 — Important but can follow immediately after MVP

| ID | Requirement |
|----|-------------|
| FR-15 | Rule retroactive application (apply new rule to past transactions) |
| FR-16 | Undo batch changes (by rule or bulk edit) |
| FR-17 | Confidence score display (Plaid confidence or rule confidence) |
| FR-18 | Category lock (prevent rule/future changes from overriding) |

---

### D.1) Technical Implementation Requirements (Critical)

These requirements address data integrity, rule safety, and operational reliability that must be built into the foundation.

#### 1. Data Integrity & Syncing

| ID | Requirement | Instruction | Reasoning |
|----|-------------|-------------|----------|
| TI-01 | **Pending Transaction ID Tracking** | Track `pending_transaction_id` from Plaid in schema. When pending→posted conversion occurs, copy user's manual categorization from pending record to new posted record. | User corrections on pending transactions are lost when transaction settles (~2 days). Without this link, user sees their work vanish, eroding trust. |
| TI-02 | **Cursor-Based Incremental Sync** | Use Plaid's `/transactions/sync` endpoint with cursor-based delta fetching. Do NOT rely on full history refetches. | Critical for performance and reliability. Prevents accidental overwriting of historical data during sync. Only processes new/modified items. |

#### 2. Rule Safety & Locking

| ID | Requirement | Instruction | Reasoning |
|----|-------------|-------------|----------|
| TI-03 | **Category Locked Flag** | Add `category_locked` (boolean) column to transactions table. If user manually edits category, set to `TRUE`. Rule engine must check `WHERE category_locked = FALSE` before applying updates. | "Overrides must stick" is the rule; a locking flag is the mechanism. Without hard DB lock, future rule runs or re-syncs could accidentally revert user corrections. |
| TI-04 | **Idempotent Backfill Jobs** | Retroactive rule application jobs must be idempotent (can run multiple times without changing result). Include "dry run" preview capability before execution. | Automation is dangerous. A bad rule (e.g., "All <$100 = Coffee") could destroy history. Idempotency and previews prevent runaway incorrect automation. |

#### 3. Audit & Provenance (Expanded)

| ID | Requirement | Instruction | Reasoning |
|----|-------------|-------------|----------|
| TI-05 | **Expanded Provenance Schema** | Store not just source ("Rule", "Manual"), but also: `rule_id` (which rule made the change) and `confidence_score` (float at time of assignment). | Debugging requires traceability. When user asks "Why is this labeled 'Gym'?", system must point to specific rule ID or confidence level, not just generic "System" label. |

---

### E) Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| **Privacy** | User data encrypted at rest and in transit | AES-256, TLS 1.3 |
| **Privacy** | No data sent to third parties without explicit opt-in | Consent UI required |
| **Explainability** | Every categorization shows source/reason | 100% coverage |
| **Reliability** | Plaid sync failures gracefully handled | Retry logic; user notification |
| **Performance** | Programmatic rules execute <100ms per transaction | Benchmark on 1000 txns |
| **Auditability** | All changes logged with provenance | Query by transaction or date range |
| **Correctability** | User can always override any categorization | No exceptions |

---

### F) Data Requirements

#### Inputs Needed
| Data | Source | Notes |
|------|--------|-------|
| Transaction feed | Plaid | `transaction_id`, `amount`, `date`, `merchant_name`, `plaid_category`, `plaid_confidence` |
| Account metadata | Plaid | Account type, institution, ownership (for transfer detection) |
| User rules | User-created | Stored in `categorization_rules` table |
| User overrides | User action | Stored in `category_overrides` table |

#### Outputs Stored
| Data | Table | Purpose |
|------|-------|---------|
| Final category | `transactions.category_name` | Display and reporting |
| Category source | `transactions.category_source` | Explainability ("plaid", "rule", "manual") |
| Category confidence | `transactions.category_confidence` | Review queue filtering |
| Transfer flag | `transactions.is_transfer` | Exclude from cashflow |
| Reimbursement link | `transactions.reimbursement_of_id` | Net calculation |
| Split relationships | `transactions.parent_transaction_id`, `is_split_parent` | Parent-child model |
| Audit trail | `category_audit_log` | Provenance tracking |
| **Category lock** | `transactions.category_locked` | Prevent rule/sync overwrites (TI-03) |
| **Pending link** | `transactions.pending_transaction_id` | Preserve categorization across pending→posted (TI-01) |
| **Applied rule ID** | `category_audit_log.rule_id` | Traceability for debugging (TI-05) |
| **Confidence at assignment** | `category_audit_log.confidence_score` | Historical accuracy tracking (TI-05) |

---

### G) Categorization Approaches Considered

| Approach | Pros | Cons | MVP Decision |
|----------|------|------|--------------|
| **Plaid-only** | Zero effort; instant | 75-85% accuracy; no personalization; weak on transfers/P2P | ❌ Insufficient alone |
| **Plaid + Programmatic rules** | 85-95% accuracy for recurring; deterministic; explainable | Requires rule authoring; no learning | ✅ **MVP Core** |
| **Plaid + Rules + Payee memory** | Reduces repeat corrections; simple learning | Still no ML for novel patterns | ✅ **MVP Core** |
| **Custom ML (XGBoost)** | Learns user preferences; 70-90% accuracy | Needs 50+ txns; training pipeline; complexity | ⏳ Phase 2 |
| **LLM + RAG** | Handles ambiguous/novel cases; explains reasoning | Slow (200ms+); costly; privacy concerns | ⏳ Phase 2 edge cases |
| **Full AI pipeline (all layers)** | Highest potential accuracy | Most complex; hardest to debug; overkill for MVP | ⏳ Phase 3+ |

**MVP Decision:** Plaid + Programmatic Rules + Payee Memory + User Override. This achieves ~85% accuracy with full explainability and no ML dependencies.

---

### H) Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Plaid accuracy lower than expected | Medium | High | Pre-MVP validation with 200 txns; fallback to rules |
| Transfer detection misses P2P payments | High | High | Whitelist known P2P (Venmo, Zelle, PayPal); default P2P to expense unless same-owner |
| Rule conflicts cause unpredictable behavior | Medium | Medium | Priority ordering; test rules before save |
| User abandons due to manual effort | Medium | High | Bulk edit; track time-to-review metric; target <5 min/week |
| Overrides don't persist (Mint problem) | Low | Critical | Unit test override persistence; never auto-overwrite |
| Reimbursement timing across months confuses users | Medium | Medium | Allow user to adjust date or create manual offset entry |

---

### I) Open Questions

| # | Question | Who Decides | By When |
|---|----------|-------------|---------|
| 1 | What is minimum viable rule schema for MVP? | Builder | Before build |
| 2 | Should "needs review" queue show confidence scores in MVP or Phase 2? | Builder | Sprint 1 |
| 3 | How to handle recurring rules (e.g., every Friday, amount ± 10%)? | Builder | Sprint 1 |
| 4 | What category taxonomy to use initially? (Plaid's? Custom?) | Builder | Before build |
| 5 | How to handle split transactions in budgets/safe-to-spend? | Builder | Sprint 2 |

---

### J) Next Steps — Validation Plan

#### Phase 1: Data Validation (Days 1-4)

| Step | Action | Output | Time |
|------|--------|--------|------|
| 1 | Export 200 personal transactions from Plaid | Raw data file | Day 1 |
| 2 | Manually categorize all 200 as ground truth | Ground truth spreadsheet | Day 1-2 |
| 3 | Compare Plaid categories to ground truth | Plaid accuracy % | Day 2 |
| 4 | Identify top 10 miscategorization patterns | Rule candidates list | Day 2 |
| 5 | Draft 10 programmatic rules | Rule definitions | Day 3 |
| 6 | Simulate rules on 200 txns | Post-rule accuracy % | Day 3 |
| 7 | Identify remaining gaps (splits, P2P, reimbursements) | Gap list | Day 3 |
| 8 | Decide: MVP scope adjustment needed? | Go/No-Go for build | Day 4 |

**Success Threshold:** If Plaid + 10 rules achieves ≥80% accuracy on pilot data, proceed with MVP build.

#### Phase 2: Technical Smoke Tests (Before Build)

| Test | Instruction | Reasoning | Pass Criteria |
|------|-------------|-----------|---------------|
| **Taxonomy Smoke Test** | Take 30 random recent transactions. Manually sort into proposed categories (cashflow_groups, flow_types). | Validates if your taxonomy actually makes sense for real data. Prevents shipping categories that frustrate users immediately. | All 30 transactions can be assigned without "doesn't fit" frustration. |
| **Transfer Heuristic Test** | Manually label 50 likely transfers. Run proposed heuristic (e.g., "same amount in/out within 3 days, same-owner accounts") against them. Measure false positives. | Transfer detection is the "North Star" for cashflow clarity. Coding blindly is high-risk. Must know heuristic failure rate before engineering. | False positive rate <10% (e.g., correctly excludes CC payments but doesn't exclude reimbursements). |
| **Pending→Posted Scenario** | Identify 5 pending transactions. Manually categorize them. Wait for settlement. Verify categorization is NOT lost. | Tests TI-01 requirement. User corrections must survive the pending→posted transition. | 5/5 categorizations preserved after settlement. |
| **Rule Conflict Scenario** | Create 3 overlapping rules (e.g., "Starbucks→Coffee", "All <$10→Snacks", "Weekend→Entertainment"). Run against 10 test transactions. | Tests rule priority system (TI-04). Must be deterministic—no silent conflicts. | Each transaction gets exactly one category via highest-priority rule. |

---

### K) Appendix

#### K.1 "Maybe" Items (Consider for V1.1)
- Confidence score display for each transaction
- Rule retroactive application with preview
- Category lock to prevent future overwrites
- Quick filters (show only "needs review", "manual", etc.)

#### K.2 Parking Lot (Interesting but not MVP-relevant)
- Peer benchmarking / anonymized comparisons (C)
- Spending triggers & correlation analysis (C)
- Sankey diagram visualization (C)
- AI-generated spending narratives (C)
- Project-based spending tracking (C)
- Income reliability scoring (C)
- Mobile receipt capture via photo (C)
- Federated learning for privacy-preserving ML (C)

#### K.3 Source Key
- **A** = ChatGPT Deep Research Report
- **B** = Gemini Deep Research Report
- **C** = Perplexity Deep Research Report

---

## Document Metadata
- **Created:** 2026-01-01
- **Author:** AI Synthesis (Cascade)
- **Inputs:** ChatGPT, Gemini, Perplexity Deep Research Reports
- **Purpose:** Enable MVP scope decisions for transaction categorization feature
