1) NORMALIZE EACH REPORT
A) ChatGPT Deep Research (A)
Assumptions (explicit or clearly implied)

The product’s “north star” is cashflow clarity excluding transfers/pass-through (“cashflow clarity”). 

research_categorization_chatgpt…

Categorization must have a strict precedence order with user control on top (“Manual override…Always wins”). 

research_categorization_chatgpt…

The system should operationalize confidence → workflow queues (“Confirm / Ambiguous / Verify”). 

research_categorization_chatgpt…

Rules must be auditable with provenance (“preserves auditability”). 

research_categorization_chatgpt…

Atomic findings/claims (one sentence each) + evidence

A clear precedence order is defined: manual override > deterministic rules > confirmed user rules > Plaid > AI/RAG > unknown (“Precedence order”). 

research_categorization_chatgpt…

The pipeline maps confidence levels to distinct review queues (“Confidence → workflow”). 

research_categorization_chatgpt…

The rules concept is assistant-detected pattern → user-confirmed rule (“detects repeatable patterns”). 

research_categorization_chatgpt…

Confirmed rules should backfill history and apply forward (“runs it retroactively…applies it…going forward”). 

research_categorization_chatgpt…

A minimum viable rule schema includes conditions, actions, governance (“Rule schema (minimum viable)”). 

research_categorization_chatgpt…

Rules need drift protection so they don’t become “forever wrong” (“Drift protection”). 

research_categorization_chatgpt…

Retroactive application must exclude locked transactions (“exclude category_locked=true”). 

research_categorization_chatgpt…

Retroactive application must support undo by batch/run (“Undo support”). 

research_categorization_chatgpt…

Amazon purchases are framed as multi-category bundles where splitting is “high-impact” (“multi-category bundles”). 

research_categorization_chatgpt…

The Amazon solution is positioned as an opt-in browser extension with explicit login (“opt-in…install a browser extension”). 

research_categorization_chatgpt…

Receipt photos are described as a flow: capture → OCR → suggest splits/categories → confirm → learn (“Receipt Photos”). 

research_categorization_chatgpt…

A review queue should include a “suspicious” bucket and starter triggers (“unusually large amount”). 

research_categorization_chatgpt…

The report explicitly advises deferring LLM categorization due to cost/volume/privacy (“costly and not fast enough”). 

research_categorization_chatgpt…

Transfer handling should be first-class to remove “noise” from spending (“separate transfers from real spending”). 

research_categorization_chatgpt…

Automation needs safety via idempotent batch processing and previews (“controlled, idempotent batch processing”). 

research_categorization_chatgpt…

Recommendations (from A)

Implement the precedence + confidence queues as the backbone (“Confidence → workflow”). 

research_categorization_chatgpt…

Build a confirmed rules system with backfill + undo + lock-respect (“Retroactive Rule Application”). 

research_categorization_chatgpt…

Treat transfer detection as essential for cashflow clarity (“treat transfers as first-class”). 

research_categorization_chatgpt…

Keep LLM categorization as later (cost/privacy) (“defer…due to complexity”). 

research_categorization_chatgpt…

Risks / open questions (from A)

Rules can drift and may require lifecycle controls (“Rules should not become ‘forever wrong’”). 

research_categorization_chatgpt…

Retroactive changes can be dangerous without undo/audit (“Undo support”). 

research_categorization_chatgpt…

Amazon/receipt enrichment requires explicit consent patterns (“explicit user authorization”). 

research_categorization_chatgpt…

B) Gemini Deep Research (B)
Assumptions (explicit or clearly implied)

A “Command Center” needs hybrid intelligence (deterministic + provider + AI/RAG) (“Hybrid Intelligence”). 

research_categorization_gemini1

The system should use a “Logic Waterfall” prioritizing high certainty first (“Waterfall…reliability”). 

research_categorization_gemini1

Users demand automation + absolute override (“override…absolute precision”). 

research_categorization_gemini1

Privacy requires mitigation when using LLM APIs (“Sending raw transaction logs…carries risk”). 

research_categorization_gemini1

Atomic findings/claims (one sentence each) + evidence

Tier 1 is user deterministic rules that must never be overridden (“must never be overridden”). 

research_categorization_gemini1

The rule engine should support regex + boolean logic (“supports Regex…boolean logic”). 

research_categorization_gemini1

Tier 2 is history-based RAG “memory” via embeddings + semantic search (“vector embedding…semantic search”). 

research_categorization_gemini1

Tier 3 is provider baseline using Plaid’s v2 taxonomy (“personal_finance_category (v2 taxonomy)”). 

research_categorization_gemini1

Tier 4 is LLM fallback for the long tail (“Priority: Low (Fallback)”). 

research_categorization_gemini1

UI should show confidence/source badges (“Confidence Badges…source”). 

research_categorization_gemini1

Corrections should reinforce the memory layer (“positive reinforcement signal”). 

research_categorization_gemini1

Privacy strategies include PII redaction, local embeddings, self-hosted models (“Strategy 1…Strategy 3”). 

research_categorization_gemini1

The DB schema must store categorization provenance (“track the provenance”). 

research_categorization_gemini1

Schema should include pending_transaction_id for syncing (“Link to original pending record”). 

research_categorization_gemini1

Sync should use Plaid’s webhook + /transactions/sync cursor delta (“SYNC_UPDATES_AVAILABLE…cursor”). 

research_categorization_gemini1

The report includes optional enrichments like carbon footprints and sentiment (“carbon footprints…sentiment”). 

research_categorization_gemini1

Recommendations (from B)

Implement the Logic Waterfall with deterministic-first ordering (“maximize accuracy…high-certainty methods first”). 

research_categorization_gemini1

Use Plaid’s v2 taxonomy as the global default (“v2 taxonomy”). 

research_categorization_gemini1

Track source + confidence in DB and UI (“source…confidence”). 

research_categorization_gemini1

Use a privacy posture: redaction + optional local compute (“PII Redaction…Local Embeddings”). 

research_categorization_gemini1

Risks / open questions (from B)

LLM usage has privacy risk unless mitigated (“carries risk”). 

research_categorization_gemini1

RAG requires storing embeddings and managing “memory” integrity (“embeddingVector…For RAG search”). 

research_categorization_gemini1

Webhook/cursor sync correctness becomes a reliability dependency (“only fetches the delta”). 

research_categorization_gemini1

C) Perplexity Deep Research (C)
Assumptions (explicit or clearly implied)

A layered approach solves the “broken loop” of repeated corrections (“Broken Loop”). 

research_categorization_perplex…

MVP should focus on “core categorization” first (“Phase 1: MVP”). 

research_categorization_perplex…

Bulk review actions reduce ongoing effort (“Basic bulk categorization”). 

research_categorization_perplex…

Atomic findings/claims (one sentence each) + evidence

The MVP scope listed includes Plaid sync, programmatic rules, Plaid pass-through, user override, monthly cash flow dashboard, and bulk categorization (“Phase 1…Scope”). 

research_categorization_perplex…

The report proposes a multi-layer correction feedback loop (rules, ML, RAG, user rules) (“corrections feed back into”). 

research_categorization_perplex…

The report explicitly includes ML training in Phase 2 (“ML model training”). 

research_categorization_perplex…

It suggests “batch categorization” as a key time-saver (“Batch categorization”). 

research_categorization_perplex…

It recommends showing confidence scores and “ask me” fallback (“Confidence scores…‘Ask me’ mode”). 

research_categorization_perplex…

It suggests multiple categorization schemes as a differentiator (“Multiple categorization schemes”). 

research_categorization_perplex…

It describes storing the categorization layer per transaction (“categorization_layer”). 

research_categorization_perplex…

Recommendations (from C)

For MVP, implement rules + Plaid baseline + overrides + bulk (“Programmatic rules engine…User override”). 

research_categorization_perplex…

Use a phased roadmap with AI/ML later (“Phase 2: AI Layer”). 

research_categorization_perplex…

Risks / open questions (from C)

The Phase 2 plan relies on ML training which may conflict with “no custom ML” MVP constraint (“ML model training”). 

research_categorization_perplex…

Multiple schemes increase complexity and may dilute MVP focus (“Multiple categorization schemes”). 

research_categorization_perplex…

2) INSIGHT LEDGER (dedupe + conflicts)

Evidence strength rubric:

High = explicitly supported by 2–3 reports

Med = explicit in 1 report or implied across multiple

Low = mentioned but underspecified / mostly aspirational

Claim (atomic)	Why it matters to goal	Evidence strength	Source (A/B/C)	Duplicate Group ID	Conflicts/notes	Keep/Maybe/Cut	What would validate?
Enforce a deterministic precedence/waterfall where user control outranks AI (“Always wins”, “must never be overridden”).	Prevents repeated recategorization, builds trust.	High	A 

research_categorization_chatgpt…

; B 

research_categorization_gemini1

	DG1	None.	Keep	Measure override rate decreases over 2–4 weeks.
Use confidence-driven queues (“Confirm/Ambiguous/Verify”, “Confidence Badges”).	Reduces effort by focusing attention.	High	A 

research_categorization_chatgpt…

; B 

research_categorization_gemini1

; C 

research_categorization_perplex…

	DG2	None.	Keep	Time-to-inbox-zero per week; satisfaction per queue.
Treat transfers as first-class and exclude them from spend (“separate transfers from real spending”).	Cashflow accuracy depends on transfer removal.	Med	A 

research_categorization_chatgpt…

; A 

research_categorization_chatgpt…

	DG3	B implies taxonomy can distinguish transfers, but doesn’t detail heuristics. 

research_categorization_gemini1

	Keep	False transfer rate (user reverts) + cashflow reconciliation checks.
Use Plaid personal_finance_category v2 as baseline (“v2 taxonomy”).	Better defaults for new merchants/users.	High	B 

research_categorization_gemini1

; C 

research_categorization_perplex…

	DG4	A calls Plaid a “weak/medium prior.” 

research_categorization_chatgpt…

	Keep	Compare satisfaction vs v1/category_id baseline on same dataset.
Store provenance/source for every categorization (“provenance”, “source enum”).	Explainability + debugging + trust.	High	A 

research_categorization_chatgpt…

; B 

research_categorization_gemini1

; C 

research_categorization_perplex…

	DG5	None.	Keep	Can every category be traced to rule/user/plaid? (audit queries).
Support user deterministic rules with rich conditions (“Rule schema”, “Regex…boolean logic”).	Converts repeated corrections into automation.	High	A 

research_categorization_chatgpt…

; B 

research_categorization_gemini1

; C 

research_categorization_perplex…

	DG6	A suggests chat-built; B suggests rule engine; C suggests merchant matching.	Keep (simplify in MVP)	Acceptance rate of suggested “always categorize” rules; conflict rate.
Rules should backfill history, respect locks, and allow undo (“exclude locked”, “Undo support”).	Prevents “runaway” incorrect automation.	High	A 

research_categorization_chatgpt…

	DG7	Only A specifies undo/lock acceptance criteria.	Keep	Backfill job correctness tests + undo restores prior values.
Add drift protection so rules don’t become wrong (“forever wrong”).	Keeps automation trustworthy over time.	Med	A 

research_categorization_chatgpt…

	DG8	B/C don’t specify drift mechanics.	Maybe (post-MVP)	Track “rule override rate” and trigger review thresholds.
Implement RAG “memory” via embeddings (“semantic search”).	Reduces manual work for recurring patterns.	Med	B 

research_categorization_gemini1

; A 

research_categorization_chatgpt…

	DG9	MVP complexity vs benefit uncertain; C frames AI layer later. 

research_categorization_perplex…

	Maybe	A/B test: exact-merchant memory vs embeddings on satisfaction/effort.
Defer LLM categorization due to cost/privacy/volume (“costly…not fast enough”).	Keeps MVP buildable + safer.	High	A 

research_categorization_chatgpt…

; B 

research_categorization_gemini1

	DG10	B still includes LLM tier; A suggests “later.”	Keep as “later”	Cost model + privacy review; pilot on small subset only.
Add bulk categorization actions (“bulk confirm”, “select multiple”).	Directly reduces minutes/week.	High	A 

research_categorization_chatgpt…

; C 

research_categorization_perplex…

	DG11	None.	Keep	Measure time per week + items per bulk action.
Provide a review queue with suspicious triggers (“unusually large amount”).	Prevents high-impact errors.	Med	A 

research_categorization_chatgpt…

	DG12	C/B don’t detail trigger set.	Maybe	Precision/recall of “Verify” flags vs user confirmations.
Use Plaid webhook + cursor delta sync (“SYNC_UPDATES_AVAILABLE…cursor”).	Avoids full history refetch; improves performance.	High	B 

research_categorization_gemini1

	DG13	A/C don’t specify mechanics.	Keep	Load test + data integrity checks on incremental sync.
Track pending_transaction_id to connect pending→posted (“Link to original pending”).	Preserves user corrections across state changes.	High	B 

research_categorization_gemini1

	DG14	A references pending concept indirectly via audit/locking; not explicit.	Keep	Test: user edits pending, verify posted inherits.
Amazon order splitting via opt-in extension (“multi-category bundles”, “opt-in”).	Big reduction in manual splitting for Amazon-heavy users.	Med	A 

research_categorization_chatgpt…

; A 

research_categorization_chatgpt…

	DG15	Heavy scope; auth + matching complexity.	Maybe (parking lot)	Prototype matching accuracy on 50 Amazon txns.
Receipt photo OCR pipeline (“OCR + line-item parsing”).	Enables item-level categorization for mixed baskets.	Med	A 

research_categorization_chatgpt…

	DG16	Adds OCR cost + UX complexity.	Parking Lot	Prototype on 20 receipts: extraction accuracy + user effort.
Include ML model training (XGBoost/federated) in near-term roadmap (“ML model training”).	Potential long-term accuracy gains.	Low for MVP	C 

research_categorization_perplex…

	DG17	Conflicts with MVP constraint: “no custom ML models.”	Cut (MVP), Park (later)	Revisit once you have N labeled txns + clear ROI.
Support multiple categorization schemes (“Multiple categorization schemes”).	Could improve satisfaction across user mental models.	Low/Med	C 

research_categorization_perplex…

	DG18	High product complexity; unclear MVP need.	Parking Lot	User interviews: do users request alternative schemes?
Enrichment vectors like carbon/sentiment (“carbon footprints…sentiment”).	Interesting but not needed for cashflow MVP.	Low	B 

research_categorization_gemini1

	DG19	Outside stated MVP goals.	Parking Lot	Only if users explicitly want “values” overlays.
3) GAP CHECK (decision blockers)
Missing information required to make MVP decisions

Category taxonomy definition you will actually ship (names, hierarchy, and which are “cashflow groups”) is not concretely specified (“category_id…Foreign Key to Categories table” but no taxonomy). 

research_categorization_gemini1

Clear spec for transfer/reimbursement/pass-through semantics is referenced as essential, but the operational ruleset is not fully enumerated (“treat transfers as first-class”). 

research_categorization_chatgpt…

The minimal rule UX choice is undecided: chat-built vs form builder vs “always categorize merchant” quick action (“chat-built rules”). 

research_categorization_chatgpt…

The minimal review experience shape (where queues live, what “Ambiguous” asks from user) is not fully specified (“Ambiguous…chat explanation required”). 

research_categorization_chatgpt…

Questions that must be answered

What is your MVP category set (e.g., 15–30 categories), and do you also need cashflow_group / flow_type day 1 (“set cashflow_group, flow_type”). 

research_categorization_chatgpt…

When a user overrides a pending transaction, how exactly should it attach to the posted transaction (“pending_transaction_id”). 

research_categorization_gemini1

What is “satisfactorily categorized” in UI terms: a thumbs-up per transaction, implicit acceptance, or only corrections (“user reviews, confirm, and correct”). 

research_categorization_chatgpt…

How will you prevent automation damage: previews, caps, undo, idempotence (“preview…idempotent”). 

research_categorization_chatgpt…

Suggested fast validations (to de-risk MVP)

Taxonomy smoke test: pick 30 random recent transactions; try to fit them into your proposed categories; record “does this feel right?” (“True cashflow clarity”). 

research_categorization_chatgpt…

Transfer heuristic test: label 50 likely transfers manually; implement heuristics; measure false positives/negatives (“Auto-marked…undo?”). 

research_categorization_chatgpt…

Rule UX test: prototype 2 flows (quick “always categorize merchant” vs chat-built proposal); measure time + confidence (“proposes a rule…Want me to make a rule?”). 

research_categorization_chatgpt…

Queue design test: mock Confirm/Ambiguous/Verify and run a 10-minute weekly workflow (“Confirm…Ambiguous…Verify”). 

research_categorization_chatgpt…

4) FINAL OUTPUT (Hybrid: Decision Brief + MVP PRD-lite)
A) Executive summary (5–8 bullets)

Build MVP on a deterministic precedence/waterfall where explicit user intent outranks provider/AI (“Always wins”, “must never be overridden”). 

research_categorization_chatgpt…

 

research_categorization_gemini1

Drive user effort down with confidence-based queues (Confirm/Ambiguous/Verify + badges) (“Confidence → workflow”, “Confidence Badges”). 

research_categorization_chatgpt…

 

research_categorization_gemini1

Make transfer detection a first-class classification so cashflow is not polluted (“separate transfers from real spending”). 

research_categorization_chatgpt…

Use Plaid’s v2 category baseline + incremental sync mechanics (webhook + cursor) (“v2 taxonomy”, “cursor”). 

research_categorization_gemini1

 

research_categorization_gemini1

Implement a rules system that can be confirmed, backfilled, audited, and undone (“runs it retroactively”, “Undo support”). 

research_categorization_chatgpt…

 

research_categorization_chatgpt…

Defer LLM categorization in MVP for cost/privacy/volume reasons (“costly…not fast enough”). 

research_categorization_chatgpt…

Include bulk categorization to reduce weekly minutes spent (“bulk confirm”, “select multiple”). 

research_categorization_chatgpt…

 

research_categorization_perplex…

B) Recommended MVP scope (what’s in / out)
In scope (MVP)

P0 — Core categorization + feedback loop

Precedence waterfall with top layers: manual override + deterministic rules + confirmed user rules + Plaid baseline (“Precedence order”). 

research_categorization_chatgpt…

Confidence workflow: Confirm, Ambiguous, Verify with bulk confirm actions (“Confidence → workflow”). 

research_categorization_chatgpt…

Rule creation MVP: “always categorize this merchant as X” plus basic conditions (merchant/keywords, debit/credit, amount range) (“Rule schema (minimum viable)”). 

research_categorization_chatgpt…

Retroactive backfill with lock-respect + undo (“exclude…locked”, “Undo support”). 

research_categorization_chatgpt…

Transfer classification and exclusion from spend summaries (“treat transfers as first-class”). 

research_categorization_chatgpt…

Store provenance per transaction: category source + confidence (“track the provenance”). 

research_categorization_gemini1

Plaid sync reliability: webhook + /transactions/sync cursor delta (“SYNC_UPDATES_AVAILABLE…cursor”). 

research_categorization_gemini1

Handle pending→posted continuity using pending_transaction_id (“Link to original pending record”). 

research_categorization_gemini1

Basic bulk categorization (multi-select → assign category) (“Basic bulk categorization”). 

research_categorization_perplex…

P1 — Minimal “cashflow view” to prove value

A monthly cashflow summary view (income/expense totals excluding transfers) (“Monthly cash flow dashboard”). 

research_categorization_perplex…

Out of scope (MVP)

LLM categorization and online search agent fallback (“Priority: Low (Fallback)” but deferred). 

research_categorization_gemini1

 

research_categorization_chatgpt…

Embedding-based RAG semantic memory (kept for later) (“vector embedding…semantic search”). 

research_categorization_gemini1

ML training pipelines (XGBoost/federated) (“ML model training”). 

research_categorization_perplex…

Amazon splitting extension & receipt OCR (parking lot) (“multi-category bundles”, “OCR + line-item parsing”). 

research_categorization_chatgpt…

 

research_categorization_chatgpt…

Multiple categorization schemes (parking lot) (“Multiple categorization schemes”). 

research_categorization_perplex…

C) MVP user flow (high-level)

User links accounts via Plaid; system syncs incrementally (“cursor ensures…delta”). 

research_categorization_gemini1

New/updated transactions run through precedence waterfall (“Precedence order”). 

research_categorization_chatgpt…

Transactions are assigned category + source + confidence and placed into queues (“confidence…drives ‘Needs Review’ UI”). 

research_categorization_gemini1

User processes “Confirm” quickly (bulk confirm) (“bulk confirm”). 

research_categorization_chatgpt…

User corrects miscategorized items; system offers a rule when repeated (“detects repeatable patterns”). 

research_categorization_chatgpt…

On rule creation, user sees impact preview and backfill runs with undo (“Impact preview…Undo”). 

research_categorization_chatgpt…

 

research_categorization_chatgpt…

Monthly cashflow view updates excluding transfers (“excluding transfers/pass-through”). 

research_categorization_chatgpt…

D) Functional requirements (prioritized)
P0 (must have)

Precedence engine implementing manual override > deterministic > confirmed rule > Plaid baseline (“Precedence order”). 

research_categorization_chatgpt…

Confidence routing into Confirm/Ambiguous/Verify queues (“Confidence → workflow”). 

research_categorization_chatgpt…

User override: edit category; mark as locked to prevent overwrite (“can be locked”). 

research_categorization_chatgpt…

Rule creation from correction: “always categorize merchant as X” with minimal conditions (“Conditions…Actions”). 

research_categorization_chatgpt…

Backfill job on rule create/edit that excludes locked txns and writes audit (“exclude category_locked=true…audit record”). 

research_categorization_chatgpt…

Undo for a backfill run (“Undo support”). 

research_categorization_chatgpt…

Transfer labeling that excludes from spending totals (“excluded from spending totals”). 

research_categorization_chatgpt…

Bulk categorization: select multiple transactions, apply category (“Basic bulk categorization”). 

research_categorization_perplex…

Pending→posted continuity via pending_transaction_id (“Link to original pending record”). 

research_categorization_gemini1

Incremental sync: webhook trigger + cursor-based delta fetch (“SYNC_UPDATES_AVAILABLE…cursor”). 

research_categorization_gemini1

P1 (should have)

Review queue triggers for suspicious items (“unusually large amount”). 

research_categorization_chatgpt…

Rule governance fields: enabled toggle, effective dates (“Governance…enabled toggle”). 

research_categorization_chatgpt…

P2 (later)

Chat-built rule proposals with pattern detection and impact preview (“assistant detects repeatable patterns”). 

research_categorization_chatgpt…

Drift detection / rule lifecycle management (“Rules should not become ‘forever wrong’”). 

research_categorization_chatgpt…

E) Non-functional requirements (privacy, explainability, reliability)

Explainability: show why a category was chosen and whether it’s rule vs AI guess (“distinguishing between a hard user rule and an AI guess”). 

research_categorization_gemini1

Auditability: store provenance and change history (“Every change has provenance”). 

research_categorization_chatgpt…

Reliability/safety: idempotent batch ops, previews, undo (“idempotent batch processing”). 

research_categorization_chatgpt…

Privacy posture (for future AI): redaction + local embeddings + optional self-hosted models (“Strategy 1…Strategy 3”). 

research_categorization_gemini1

F) Data requirements (inputs needed + outputs stored)
Inputs needed (from providers + system)

Plaid transaction fields including pending_transaction_id (“pending_transaction_id…for syncing”). 

research_categorization_gemini1

Plaid v2 personal_finance_category baseline (“v2 taxonomy”). 

research_categorization_gemini1

Raw description / merchant identifiers for rules (“Description CONTAINS…”). 

research_categorization_gemini1

Outputs stored (minimum)

category_id, source, confidence (“sourceEnum…confidenceFloat”). 

research_categorization_gemini1

Rule metadata + evidence txns (“created_from…transaction ids used as evidence”). 

research_categorization_chatgpt…

Backfill run summaries + audit trail (“store a run summary”, “audit record”). 

research_categorization_chatgpt…

G) Categorization approaches considered (options + tradeoffs)
Option	Description	Pros	Cons	MVP fit
1) Plaid-only baseline	Use provider category as “truth” (“Plaid…baseline”). 

research_categorization_gemini1

	Fastest to ship	Trust issues; overrides don’t generalize; ignores “Always wins” principle. 

research_categorization_chatgpt…

	No
2) Deterministic waterfall (recommended)	Manual override + deterministic + confirmed rules + Plaid (“Precedence order”). 

research_categorization_chatgpt…

	Explainable; user-correctable; low cost	Needs rule UX + backfill/undo	Yes
3) Add RAG memory (later)	Embeddings + semantic search (“vector embedding…semantic search”). 

research_categorization_gemini1

	Reduces manual work further	More infra + privacy considerations	Post-MVP
4) Add LLM fallback (later)	Long-tail reasoning (“Priority: Low (Fallback)”). 

research_categorization_gemini1

	Handles cryptic merchants	Cost/latency/privacy; A recommends defer. 

research_categorization_chatgpt…

	Post-MVP
5) Train ML models (not MVP)	User-specific classifier (“ML model training”). 

research_categorization_perplex…

	Potential accuracy gains	Violates MVP constraint; heavy pipeline	No
H) Risks & mitigations

Runaway automation / wrong backfills → Require previews, lock-respect, undo (“Undo support”, “idempotent”). 

research_categorization_chatgpt…

 

research_categorization_chatgpt…

Transfer misclassification → Make classifications reversible and track false positives (“undo?”). 

research_categorization_chatgpt…

Pending→posted category loss → Use pending_transaction_id mapping tests (“pending_transaction_id”). 

research_categorization_gemini1

Scope creep into AI layers → Explicitly defer LLM/ML to later (“defer…due to complexity”). 

research_categorization_chatgpt…

I) Open questions

What is the MVP category taxonomy (names + hierarchy) and do you ship cashflow_group/flow_type immediately (“set cashflow_group, flow_type”). 

research_categorization_chatgpt…

What is the default behavior for ambiguous transactions: force user answer in-chat vs “uncategorized bucket” (“chat explanation required”). 

research_categorization_chatgpt…

Rule UX: do you start with quick rules or chat-built proposals (“Rule proposal UX (in chat)”). 

research_categorization_chatgpt…

J) Next steps (validation plan)

Define taxonomy + cashflow semantics: create category list + which are excluded as transfers (“excluding transfers/pass-through”). 

research_categorization_chatgpt…

Prototype P0 UI: Confirm/Ambiguous/Verify queues + bulk actions (“Buckets…Confirm/Ambiguous/Verify”). 

research_categorization_chatgpt…

Implement P0 engine: precedence waterfall + provenance fields (“Precedence order”, “sourceEnum”). 

research_categorization_chatgpt…

 

research_categorization_gemini1

Rule MVP: create/enable rule from correction; backfill + undo (“runs it retroactively”, “Undo support”). 

research_categorization_chatgpt…

 

research_categorization_chatgpt…

Metrics instrumentation: % satisfactorily categorized + correction rate + minutes/week; slice by source layer (“categorization_layer”). 

research_categorization_perplex…

K) Appendix: “Maybe” items + Parking Lot
Maybe (revisit after MVP proves value)

Drift protection signals and rule expiry/review prompts (“Rules should not become ‘forever wrong’”). 

research_categorization_chatgpt…

Suspicious triggers/Verify queue tuning (“unusually large amount”). 

research_categorization_chatgpt…

RAG semantic memory (embeddings) (“semantic search”). 

research_categorization_gemini1

Parking Lot (explicitly not MVP)

Amazon splitting extension (“multi-category bundles”, “opt-in”). 

research_categorization_chatgpt…

 

research_categorization_chatgpt…

Receipt photo OCR and line-item extraction (“OCR + line-item parsing”). 

research_categorization_chatgpt…

LLM categorization + online search (“Fallback”, “costly…not fast enough”). 

research_categorization_gemini1

 

research_categorization_chatgpt…

ML training pipelines (“ML model training”). 

research_categorization_perplex…

Multiple categorization schemes (“Multiple categorization schemes”). 

research_categorization_perplex…

Carbon footprint / sentiment enrichment (“carbon footprints…sentiment”). 

research_categorization_gemini1

One new word (as requested)

Parsimonious (frugal): a parsimonious MVP keeps the first release intentionally minimal so you can validate value before adding complexity.