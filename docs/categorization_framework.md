# Financial Command Center — Categorization Canvas
Status: living spec (edit freely)
Primary goal: cashflow clarity — where money comes from and where it goes, excluding transfers/pass-through noise:contentReference[oaicite:0]{index=0}.

---

## 1) North Star Outcomes
| Outcome | Definition | Why it matters |
|---|---|---|
| True cashflow clarity | Income − expenses, excluding transfers/pass-through by default:contentReference[oaicite:1]{index=1} | Eliminates “analysis garbage” from internal money movement |
| Minimal manual burden | Most transactions categorized correctly with light confirmation | Avoid YNAB-level tedium; preserve accuracy |
| Trust + auditability | Every change has provenance (source + history):contentReference[oaicite:2]{index=2} | User believes the numbers |

---

## 2) Categorization Pipeline
### 2.1 Precedence order
| Priority | Source | Notes |
|---:|---|---|
| 1 | Manual override | Always wins; auditable + can be locked:contentReference[oaicite:3]{index=3} |
| 2 | Deterministic rules | Only obvious: deposits, cash withdrawals, same-owner transfers |
| 3 | User rules engine (suggested + confirmed) | Dynamic, chat-built rules; retroactive apply |
| 4 | Provider signal (Plaid) | Weak/medium prior; never “final truth” |
| 5 | AI + RAG | Uses history, counterparties, optional enrichment |
| 6 | Unknown | Review queue + chat clarification |

### 2.2 Confidence → workflow
| Confidence | System action | User interaction |
|---|---|---|
| High | Auto-apply + “Confirm” queue | 1-tap confirm / bulk confirm |
| Medium | Suggest + confirm | quick confirm/reject |
| Low | “Ambiguous” queue | chat explanation required |
| Suspicious | “Verify” queue | legitimacy + out-of-norm check |

---

## 3) Feature: User-Generated Rules Engine (Chat-Built)
### 3.1 Product concept
The assistant detects repeatable patterns and proposes a rule:
> “You have purchases from McDonald’s and Wendy’s every Saturday morning around $8–$14, and you’ve categorized 3 of them as Fun Money. Want me to make a rule for that?”

If user confirms, the system:
1) saves the rule to DB  
2) runs it retroactively on historical transactions  
3) applies it to new transactions going forward  
4) preserves auditability (what changed, why, and when):contentReference[oaicite:4]{index=4}

### 3.2 Rule proposal UX (in chat)
| Step | UX requirement |
|---|---|
| Pattern detection | Show evidence: sample txns + frequency + user’s past categorization |
| Draft rule preview | Render “IF conditions THEN category/flags” in plain English + editable form |
| Impact preview | “This will update 23 past transactions (none that are locked).” |
| Confirm | User confirms “Create rule” (and optionally “Lock category for matches”) |
| Backfill execution | System runs retro apply job; shows summary; user can undo |

### 3.3 Rule schema (minimum viable)
**Conditions** (AND/OR):
- merchant/counterparty: exact or normalized match (incl. alias set)
- day-of-week/time window (optional)
- amount range and/or tolerance (e.g., $10 ± 20%)
- direction: debit/credit
- account or account_type
- description keywords
- recurrence signal (weekly/monthly)

**Actions**
- set `category_name`
- set `cashflow_group`, `flow_type`
- set flags: `is_transfer`, `is_pass_through`, `is_business`
- optional: set `needs_review=false` if high confidence

**Governance**
- `enabled` toggle
- `effective_from` date
- `expires_at` optional (for drift protection)
- `confidence` (rule confidence can be derived from evidence count)
- `created_from`: transaction ids used as evidence

### 3.4 Drift protection (required)
Rules should not become “forever wrong” (Mint-style drift).
| Mechanism | Behavior |
|---|---|
| Context constraints | Rules can include account, direction, amount window, day-of-week to prevent overreach |
| Decay (optional V1.5) | If rule has high reject/override rate recently → downgrade confidence or prompt review |
| Safe mode | If merchant semantics shift (e.g., Venmo changes meaning), rule stops auto-apply and goes to confirm queue |

---

## 4) Retroactive Rule Application Requirements
When a rule is created/edited:
1) identify historical matches
2) exclude `category_locked=true` transactions:contentReference[oaicite:5]{index=5}
3) apply updates
4) write an audit record for each changed transaction
5) store a run summary for debugging + metrics

### Acceptance criteria
| ID | Requirement | Pass condition |
|---|---|---|
| RR-01 | Backfill updates past txns | Matching txns update within a single job run |
| RR-02 | No override of locked txns | Locked transactions remain unchanged:contentReference[oaicite:6]{index=6} |
| RR-03 | Full provenance | Each change records source=rule + rule_id + timestamp |
| RR-04 | Undo support | Ability to revert the backfill batch by run_id |

---

## 5) Amazon Splitting Chrome Extension (External Context Enrichment)
### 5.1 Purpose
Amazon purchases are “multi-category bundles.” Splitting is high-impact for reducing manual toil and improving category fidelity.

### 5.2 Capabilities
| Capability | Requirement |
|---|---|
| Order detail retrieval | Extension fetches order items + prices + dates |
| Match to bank transaction | Match on amount/date/order id heuristics (with user confirmation if uncertain) |
| Split transaction | Create child line-items with their own categories; parent becomes a container |
| User confirmation | User can approve split + categories; edits are remembered via rules/history |
| Storage | Save order metadata + line items for audit + future ML/RAG |

### 5.3 Data model notes
- `transactions` supports parent/child splits:
  - `is_split_parent`, `parent_transaction_id`, `split_group_id`
- `external_order_sources` (amazon):
  - order_id, merchant, order_date, total, raw_items_json
- `order_line_items`:
  - name, price, qty, suggested_category, confirmed_category

---

## 6) Receipt Photos (Capture → OCR → Categorize → Confirm)
### 6.1 User story
User uploads receipt photo (mobile or web). System extracts merchant + line items, proposes categorization (and splits if needed), user confirms, system learns.

### 6.2 Requirements
| Stage | Requirement |
|---|---|
| Upload | Attach 1+ receipt images to a transaction or “unmatched receipt” bucket |
| Extraction | OCR + line-item parsing → structured items |
| Matching | Suggest match to a transaction (amount/date/merchant) |
| Categorization | Suggest categories per line item; enable split transaction generation |
| Confirmation | User approves; on rejection user explains; system proposes alternatives |
| Learning | Confirmed receipt items improve future categorization + rules engine |

### 6.3 Data model notes
- `receipts`:
  - id, created_at, source, image_url, extracted_json, match_status, matched_transaction_id
- `receipt_items`:
  - receipt_id, description, qty, price, suggested_category, confirmed_category
- `transactions.receipt_id` optional reference

---

## 7) Review Queue (Assistant Workflow)
Buckets:
- Confirm (high confidence)
- Ambiguous (needs chat explanation)
- Verify (suspicious/out-of-norm)

### Suspicious triggers (starter set)
- unusually large amount vs historical distribution
- new merchant category at high amount
- unusual frequency spike
- “transfer-like” description but external counterparty (transfer false-positive risk)

---

## 8) Telemetry + Success Metrics
| Metric | Target direction | Why |
|---|---|---|
| % transactions auto-classified high confidence | up | less manual work |
| Confirm queue average time-to-zero | down | low friction |
| Override rate by merchant | down | model/rules improving |
| False transfer rate | down | protects cashflow clarity:contentReference[oaicite:7]{index=7} |
| Split adoption rate (Amazon/receipts) | up | solves “bundle merchant” pain |
| Drift events detected | up (detection), then down (incidents) | prevents silent degradation |

---

## 9) Implementation Notes (Separation of Concerns)
- Categorization logic stays outside the web app (n8n subflow or microservice):contentReference[oaicite:8]{index=8}
- UI consumes results + supports overrides + review workflow:contentReference[oaicite:9]{index=9}
- Overrides are auditable and learnable via `category_overrides`:contentReference[oaicite:10]{index=10}

---

## 10) Open Questions
| Topic | Question |
|---|---|
| Rule edits | Allow direct editing in UI vs chat-only authoring? |
| Split accounting | How do splits affect “safe-to-spend” and budget rollups? |
| Receipt privacy | Store images encrypted? retention policy? |
| Amazon auth | How is Amazon access granted safely (per-user token flow)? |

---

## 11) Change Log
- 2026-01-01: Added chat-built rules engine + retroactive apply + Amazon split extension + receipt photo workflow
