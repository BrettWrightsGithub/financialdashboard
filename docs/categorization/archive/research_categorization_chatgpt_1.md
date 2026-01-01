User Experiences with Transaction Categorization in Popular Finance Apps
Automatic Categorization – Convenience vs. Frustration

Many personal finance apps attempt to auto-categorize transactions to save users time. When it works, users appreciate the convenience. For example, some Copilot users report that Copilot’s machine learning is remarkably accurate, correctly auto-categorizing about 95% of typical transactions and requiring very little manual intervention
reddit.com
. Copilot’s engaging UI even encourages users to review and correct any mis-categorized items, building good habits of awareness
reddit.com
. YNAB users note that once you manually categorize a new payee the first time, YNAB will remember that choice for the future, reducing repetitive work
reddit.com
. This basic “learn as you go” approach means recurring transactions (like a monthly Netflix bill) typically default to the right category after the initial setup.

However, frustrations with auto-categorization are widespread. Mint’s algorithm in particular “often chose the wrong category and ignored manual overrides,” as one analysis noted
tiller.com
. Many Mint users found themselves constantly fixing categories that Mint mis-guessed, turning budgeting into a chore rather than a convenience
tiller.com
. A common complaint is that Mint will mislabel transactions – for instance, auto-categorizing a paycheck as a “Transfer” (because the description contained “ACH Transfer”), causing the income to be hidden from budget totals
reddit.com
. Users had to manually recategorize those deposits to an Income category to get an accurate picture. YNAB users have also reported annoyance when the app’s “guess” based on a past payee mapping is wrong. One new YNAB user noted that many automatically imported transactions were “categorized wrong (YNAB is guessing based on how I last categorized a similar transaction)”, forcing them to manually re-enter or recategorize transactions to maintain accuracy
reddit.com
. In community forums, it’s not uncommon to see complaints that auto-categorization “gets it wrong” a lot – one Mr. Money Mustache commenter even said Mint’s misfires were so frequent that “it was becoming a chore to fix half [the transactions]”
tiller.com
.

Handling Transfers and Internal Movements

Transfers (moving money between accounts you own) are a special case of transactions that all these tools handle in specific ways. Users overwhelmingly want transfers excluded from budgets and spending reports so that moving money around doesn’t falsely appear as new income or expense. In Mint, the convention is to mark such transactions with the built-in “Transfer” category. Mint users advise each other to use “Transfer” for things like credit card payments, bank account transfers, or ATM withdrawals, so that those movements “do not count as income or expense in your budget”
reddit.com
reddit.com
. For example, withdrawing $100 cash from checking should be categorized as a transfer (cash moved to your wallet) – otherwise Mint might count it as $100 spent. The challenge is that Mint’s auto-categorization doesn’t always get this right. As one user laments, “Mint often messes up the auto-categorization”, so you must vigilantly check for mistakes
reddit.com
. A common error: Mint sees an incoming ACH bank transfer and categorizes it as a Transfer when in reality it was a paycheck (income)
reddit.com
. Users find these mistakes detrimental since a paycheck wrongly marked “Transfer” disappears from income totals
reddit.com
.

YNAB approaches transfers differently: if you properly record a transfer in YNAB (by selecting the other account as the payee), it requires no category at all. The transaction is simply labeled as a transfer and doesn’t hit any budget category
reddit.com
. New YNAB users sometimes get confused seeing a prompt to choose a category for an account-to-account transfer, not realizing they should use the special “Transfer ✓” payee to have it excluded from budgeting
reddit.com
reddit.com
. Once they do, YNAB handles it cleanly – no duplicate income/expense is shown, and the money just moves in the background. This design is generally praised, as it keeps internal shuffles from polluting your “spending” view.

Some newer apps have had hiccups with transfer detection. Copilot users, for instance, have reported that certain random charges get mislabeled as “Internal Transfer” when they were actually regular expenses, causing confusion (and likely excluding those transactions from spend totals)
reddit.com
reddit.com
. Such misclassifications frustrate users because it requires recategorizing those entries to the correct expense category to get accurate cashflow numbers. In Monarch, a financial coach observed that peer-to-peer payments (Venmo, Zelle, etc.) were often auto-categorized as “Transfers” by mistake, when really money was leaving your finances entirely
evolvingmoneycoaching.com
. The “big mistake,” he explains, is that if you Zelle a friend $1,000 and Monarch hides it as a transfer, it “will not be counted as an expense” – your reports would show $1,000 more in your account than reality, skewing your cashflow analysis
evolvingmoneycoaching.com
. Power users emphasize the importance of vigilantly reviewing all “Transfer” categorizations and reclassifying any that represent money to/from a third party
evolvingmoneycoaching.com
. The consensus across communities is that transfers should be clearly identified and separated – users dislike when apps double-count a transfer (once in each account) or, conversely, hide a true expense/income under a transfer label. The ideal workflow is one that correctly flags genuine transfers automatically and allows easy correction of any false-positives.

Reimbursements, Refunds, and Shared Expenses

Handling reimbursements and refunds is another pain point frequently discussed by users of budgeting tools. A key theme is that money refunded or paid back should not be treated as new income – it’s just neutralizing a prior expense. Experienced users across Mint, YNAB, and Monarch all suggest the same best practice: categorize the incoming reimbursement to the same category as the original expense
reddit.com
evolvingmoneycoaching.com
. This way, the reports offset the two and reflect your net spending. For example, if you buy a $100 item in “Shopping” and later return it for a $100 refund, logging both the purchase and the refund in the “Shopping” category will show $0 net spent on Shopping (rather than $100 spent and $100 income)
reddit.com
. As a Monarch rep on Reddit put it, “Reimbursements & returning something is not Income to you.” Labeling that refund as income would inflate your earnings and not “help you track if you don’t get reimbursed” properly
reddit.com
. Instead, keeping it in the expense category cancels out the cost and gives a true picture of what you spent on that category
reddit.com
. YNAB’s community offers the same advice: “Categorize the reimbursement inflow to the same category as the original spending”, so the inflow offsets the spending in reports
reddit.com
. This pattern is seen as critical for cashflow clarity, ensuring that, say, you only show $50 net spent on Dining Out if your friend paid you back for half the dinner.

Users do point out some shortcomings in how apps handle these scenarios. One issue is timing across months – if the expense is in one month and the reimbursement in the next, many budget apps will show the first month over budget (or a negative category balance) and the next month artificially low spending. Experienced budgeters have developed workarounds: for example, adjusting the date of the reimbursement transaction to fall in the same month as the expense (if using Monarch) so that the offset happens in one period
reddit.com
. Others create a temporary holding category – some Copilot users mentioned making an “Owed to Me” category: when they pay an expense for someone else, they categorize that portion under “Owed to Me” (signifying a receivable), and when the friend’s payback comes in, they categorize it to “Owed to Me” as well, zeroing out the interim balance. This effectively keeps track of money others owe them, without mucking up the real spending categories. It’s a bit of a hack, but many are willing to do it since no major app yet offers a built-in “awaiting reimbursement” workflow. (YNAB aficionados sometimes use a similar trick with a dedicated tracking account or category for reimbursable expenses.)

Another frequent question is how to handle peer-to-peer payments for shared bills – for instance, you paid the $80 restaurant tab on your card, and your friend Venmos you $40 later. In Mint or Monarch, the straightforward advice is to categorize both the initial $80 outflow and the $40 inflow in “Restaurants”, so the net restaurant expense is $40 in your reports
reddit.com
reddit.com
. Some prefer a slight variation: categorize the friend’s $40 as a negative expense in Restaurants (rather than positive income), which achieves the same net effect. Users like this approach because it directly shows the true cost of that dinner to you (instead of treating the reimbursement as income which would muddy spending totals)
reddit.com
. Overall, there’s strong consensus that reimbursements and shared expense paybacks should be handled in a way that nets out the original expense – and frustration when apps aren’t flexible enough to do so cleanly. Mint, for example, will default any person-to-person payment you receive as “Income: Personal” unless you manually recategorize it. Tools that allow negative transactions or easy re-categorization make this easier. Monarch explicitly encourages users to fix this by recategorizing those Venmo/Zelle reimbursements out of “Transfers” into the proper expense category
evolvingmoneycoaching.com
.

Ambiguous Merchants and Splitting Transactions

“Ambiguous” or all-in-one merchants like Amazon, Walmart, Costco, etc. pose a special challenge for transaction categorization. By default, most apps treat an Amazon purchase as a single transaction under a generic category (often “Shopping”). This is a major pain point because an Amazon order might contain groceries, household supplies, and a gift – multiple categories in one. Users of Simplifi noted that “Simplifi categorizes all Amazon purchases as Shopping (other budgeting software does this as well)”, requiring them to go back and manually recategorize each Amazon transaction into the right buckets
reddit.com
. One user described this as “annoying” and time-consuming, given the need to cross-reference the Amazon order details for each transaction
reddit.com
. YNAB users have echoed this, advising others to disable auto-categorization for Amazon payees so that each transaction forces a manual review and split – otherwise YNAB might blindly put every Amazon charge in whatever category you last used for Amazon
reddit.com
. Without special handling, these ambiguous merchants can wreck budget accuracy, as people suddenly see a huge “Shopping” total that actually included groceries or pet food, etc., if they don’t split them out.

Recognizing this, the community has long clamored for solutions, and we’re starting to see innovative approaches. In mid-2025, Monarch Money introduced a browser extension that connects to your Amazon account to fetch detailed order information
reddit.com
. This extension will automatically split a single Amazon transaction into multiple line items and categorize each one accurately, based on the actual items in your order
reddit.com
reddit.com
. For example, that $120 Amazon charge might get split into $60 “Groceries”, $40 “Home Supplies”, and $20 “Electronics” (with notes about the items), all done for you. Users greeted this feature with enthusiasm: “Absolutely wonderful – categorizing Amazon transactions is one of the most annoying things I’ve ever done… This extension is amazing” gushed one user, who found that it put everything into the same categories they would have chosen manually
reddit.com
. Another replied that the auto-categorization was very accurate for Amazon orders, and they loved that they could simply hover over the split transactions to see what each item was without extra clicks
reddit.com
. This development was directly driven by user feedback – Monarch’s team noted they built the extension because “those Amazon orders are rarely just one thing” and people wanted clearer budgets without all the manual work
reddit.com
reddit.com
. They even acknowledged a community member who built an early Amazon-order parser as inspiration
reddit.com
. It’s a great example of a nontraditional categorization workflow addressing a long-standing user headache by bringing in external data.

Beyond Amazon, users have expressed interest in similar solutions for other retailers. In the Monarch subreddit thread, many immediately asked for Costco and Target to be next on the integration list
reddit.com
reddit.com
. There’s recognition that some retailers (Costco in-store, for example) might be harder since their receipts don’t have an easily accessible digital record per item
reddit.com
, but the demand is clearly there. In absence of official features, some tech-savvy users resort to DIY tools. One user built a personal script that pulls their Amazon order history and uses an AI (LLM) to categorize each item, outputting a CSV they can import – essentially a homemade version of what Monarch just implemented
reddit.com
. Others mention using browser extensions or third-party services that scrape receipts from email. These workarounds underscore that users badly want smarter categorization for merchants that sell “everything.” At minimum, most apps do let you manually split transactions into multiple categories, but without automated help, splitting every Amazon purchase or Costco run can become tedious.

User Control: Confirmation, Overrides, and Flexibility

A recurring theme in user feedback is the desire for more control and transparency in categorization. Users want to be able to override the software’s decisions easily, set up their own rules, and ensure those rules “stick.” They also differ on how much the app should force them to review transactions. For instance, Copilot takes an explicit “trust, but verify” approach by requiring users to mark each transaction as Reviewed. Many users understand the rationale – as one commenter explained, the review step is basically asking the user to confirm “automatic categorization can get it wrong, can you check our work?”
reddit.com
. Copilot users acknowledge this prevents transactions from slipping by miscategorized (a common issue in Mint, which has no review step – “Mint gets stuff wrong all the time and it just gets swept under the rug”
reddit.com
). However, not everyone appreciates the nag. Some find it tedious to manually approve dozens of transactions and have asked for an option to turn off the mandatory review once they trust the system
reddit.com
reddit.com
. In that Copilot subreddit thread, users pointed out you can bulk-review a day’s transactions with one tap, but power users still begged: “If that’s all it’s for, just let me turn it off… I don’t need more useless clicks”
reddit.com
. As a compromise, one suggested an “I’m experienced – auto-accept for me” mode
reddit.com
reddit.com
. This split opinion shows that confirmations are a double-edged sword: new or cautious users like the safety net of approving each categorization, whereas advanced users want the ability to streamline and trust the auto-cat or their own rules.

Bulk editing and overrides are another area of frequent feature requests. In YNAB, for example, users have long requested the ability to select multiple transactions and change their category all at once. As one user put it, “I don’t know why it takes so many clicks… I want to multiselect and set the category for all selected items,” instead of editing each one-by-one
reddit.com
. YNAB’s web app still lacks an easy multi-edit for categories (you can multi-select but it’s somewhat hidden in the UI), which leads to frustration when catching up on a backlog of uncategorized entries. YNAB also requires a separate “approve” click for each imported transaction, which some find clunky (they even briefly tried a multi-approve feature but removed it due to issues, according to forum replies)
reddit.com
. Mint historically had a different problem: users would re-categorize transactions, but Mint’s algorithms sometimes reverted them or didn’t apply the change to future similar transactions. There is no formal “rules engine” exposed to the user – it just learns behind the scenes, and not always well. As a result, Mint users have wished for a way to disable auto-categorization entirely (essentially start everything as Uncategorized) so they could apply their own categories without fighting Mint’s guesses
reddit.com
. In fact, one user explicitly asked: “Is there a way to turn off Mint auto categorization? … it gets the categories wrong so often that it’s tedious to find and fix them.”
reddit.com
. The lack of a user-directed rules or tagging system in Mint is often cited as a reason people migrate to more flexible tools.

On the flip side, Monarch and Tiller give users powerful rule-based controls, which advanced users love – but those can overwhelm others. Monarch allows creating custom rules to automatically rename or recategorize transactions based on patterns. Users who need complex setups (multiple accounts, business vs personal splits, etc.) appreciate this. In a comparison, one user noted Monarch’s rule engine is “very powerful” and you can re-run rules on all past transactions after editing one (a huge time saver)
reddit.com
reddit.com
. They gave an example: after spending time programming dozens of custom rules, they could correct months of data in one go – a level of control that Mint or Copilot didn’t offer
reddit.com
reddit.com
. Copilot, by contrast, launched without a robust rule editor, and this drew criticism from some early adopters. An annoyed user pointed out you “can create a rule [in Copilot], but can’t edit rules after the fact… If you create a bad rule, you have to contact support” to remove or change it
reddit.com
. Furthermore, Copilot’s rules could only auto-update categories, not rename payees or add tags, etc., and there was no tag system at all
reddit.com
. These omissions were glaringly noted as feature requests. Copilot’s team seems to have prioritized a simpler, guided experience (relying on their AI and the review workflow) over exposing a complex rules UI – which works for some users but alienates the power users who migrated from tools like Quicken, Mint or Monarch expecting more customization. As one financial advisor who tested both remarked: Copilot’s strength is that it “does an excellent job categorizing transactions” with very low labor, whereas Monarch’s strength is the ability to fine-tune everything (at the cost of more labor to set up)
reddit.com
reddit.com
. The ideal many users seem to voice is a hybrid approach: let the machine do the heavy lifting, but give me the ability to correct it, override it, and set up my own rules without needing to fight the system. A transparent override mechanism (with an audit trail) can build trust. For instance, users love hearing that if they manually recategorize something, the app will remember that for next time (and not randomly change it back). Tiller’s AutoCat feature is often praised here: it lets you define a set of Excel-like rules that will “precisely categorize your transactions 100% based on your rules”, ensuring complete consistency and no surprises
tiller.com
. Many former Mint users flocked to that because it gave them control back, eliminating Mint’s often unpredictable auto-guessing
tiller.com
tiller.com
.

Smarter Categorization for Clear Cashflow

Looking at all this feedback, a clear goal emerges: users want categorization to make their true cashflow clear with minimal manual effort. That means:

Transfers and pass-through funds separated from real spending (so moving $500 from checking to savings or paying your credit card bill doesn’t show up as “$500 spent”)
reddit.com
reddit.com
. All apps attempt this, but user stories show the importance of getting it right (and letting users fix it when the app guesses wrong).

Reimbursements and refunds treated as neutral (offsetting expenses) rather than income
reddit.com
evolvingmoneycoaching.com
. Users find it immensely helpful when the budgeting tool can reflect net spending – several remarked that using the same category for a reimbursed expense was key to “reflect the true amount” they spent
reddit.com
reddit.com
.

Expected vs. Actual tracking of cash flows. Users trying to align their budget plan with reality often do manual gymnastics. YNAB’s approach is to budget every dollar ahead of time and then adjust categories as transactions hit, which many find effective but labor-intensive. Some users have requested features like visualizing expected inflows that haven’t arrived yet (e.g. “outstanding income” or bills coming due). In the absence of built-in features, people set up calendar reminders or maintain “dummy transactions” as placeholders. The Financial Command Center concept addresses this by highlighting “expected inflows not yet received” and “planned vs actual” in one view (features drawn from the user’s project document). Indeed, users have voiced that seeing what’s supposed to happen and getting alerted when something deviates would be incredibly useful for real-world financial management – but legacy apps haven’t focused much here beyond basic bill reminders.

User confirmation and traceability. Users feel most confident when they can audit why a transaction is categorized a certain way, and override it if needed with the assurance it won’t be changed back. The idea of a log of manual overrides (and perhaps the app learning from it) resonates with users who have been burned by “invisible” algorithms. In the community, you’ll find praise for systems that allow locking a category or providing a clear indicator that “this was auto-categorized” vs “user edited.” Copilot’s review checkmark is one take on traceability (you know you personally approved each transaction’s category)
reddit.com
. Tiller’s explicit rules and Monarch’s upcoming audit trails are another (you define or adjust the rule, and it applies). The FCC project’s approach of logging overrides for audit and improving the model is aligned with what savvy users seem to want.

Finally, minimizing effort while preserving accuracy is the holy grail. The innovations that excite users most are those that take burdensome tasks off their plate without sacrificing correctness. The Monarch Amazon integration is a prime example – it removed a tedious manual chore and improved accuracy dramatically
reddit.com
reddit.com
. Users also mention smaller workflow improvements, like being able to approve or categorize multiple transactions in one action, as simple yet huge time-savers
reddit.com
. Community-built scripts to auto-split or tag transactions with additional context (like grabbing Venmo payment notes to categorize who paid for what) are also born from this desire for less toil and more insight. Many such features start as user requests or hacks that “never got built” into the official apps, but forward-thinking platforms are beginning to incorporate them.

In summary, users love when their finance app “gets” their spending patterns right and separates the signal from the noise – when it correctly flags transfers, intelligently categorizes tricky transactions, and lets them drill down into true cashflow (income minus expenses) without a spreadsheet. But when the tool is wrong or inflexible, it can create extra work and frustration. The collective feedback suggests that a successful categorization system should combine intelligent defaults with user empowerment: use smart algorithms (and even integrations like receipts or AI) to automate as much as possible, while giving the user ultimate control to review, confirm, and correct. This balance leads to the clarity and confidence that people seek for managing their money day-to-day.

Sources: Users’ discussions and reviews on Reddit and personal finance forums, including r/ynab
reddit.com
reddit.com
, r/mintuit
reddit.com
reddit.com
, r/MonarchMoney
reddit.com
reddit.com
, r/CopilotMoney
reddit.com
reddit.com
, and expert commentary
evolvingmoneycoaching.com
tiller.com
, as cited above.


overview_and_scope.md
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


gaps-in-the-above:
Transaction Categorization Gaps – What Apps Do and What We Should Do
Actionable Now (Clear Solutions to Implement)

Rule Conflicts & Priority: Leading tools prevent overlapping rules from causing chaos by enforcing a clear priority. QuickBooks Online, for example, lets users reorder bank rules – the top rule wins if multiple match a transaction
mro.cpa
. Brex’s enterprise cards go further: they assign internal priority levels and even flag conflicts. If two custom rules at the same level both apply, Brex prompts an admin to choose which to keep, marking that transaction as “Manually recategorized” for audit trail
brex.com
brex.com
. Takeaway: We should implement a deterministic rule hierarchy. A simple approach is user-defined ordering (like QuickBooks’ drag-and-drop ranking
mro.cpa
) or specificity-based precedence. This ensures only one rule categorizes a given transaction, avoiding rule “overreach.” In edge cases where two rules still collide, we can mimic Brex’s approach: flag the transaction and require a manual choice (no silent coin-flips). This makes rule behavior predictable and auditable.

Retroactive Application & Undo: Users rightly expect new rules to clean up past data, not just future transactions. Consumer apps often let you apply a rule to historical entries as you create it. Mint, for instance, lets you check “Always categorize X as Y” and immediately recategorizes all past and future matches
kosheronabudget.com
. Monarch Money’s rule system similarly offers to apply a new “Smart Split” or category rule to all existing transactions that meet the criteria, or only to new ones going forward
monarch.com
. We should provide this one-click batch recategorization when a rule is added or edited. Crucially, make it auditable – e.g. tag those transactions with the rule name or an “auto” label and log the change. QuickBooks flags rule-applied entries with a “RULE” badge (and “AUTO” if auto-confirmed)
quickbooks.intuit.com
, and our system can do the same. If a rule misfires, an easy rollback is needed. While full version control might be overkill, we can support multi-select bulk edits to reverse a rule, or simply an “Undo last bulk change” function. (QuickBooks Online lacks a true rollback, but accountants often “undo” accepted transactions back to pending and re-apply rules
quickbooks.intuit.com
.) Emphasizing auditability, every rule-based change should leave a footprint – in logs and UI – so users trust that they can recover from mistakes. Our design will favor explicit overrides and traceability over silent autocorrections, in line with our auditability principle.

Split Transactions – Parents, Children, Budgets: All the top finance apps support splitting one transaction into multiple categories for accuracy. Typically a single “parent” payment is recorded with multiple “child” line items assigned to categories. In practice, this means $100 at Costco can be split into $70 Groceries and $30 Home Supplies, etc. Monarch and Mint handle this by letting users add splits in the transaction detail UI
reddit.com
. Under the hood, reporting treats each split amount as part of its category’s total spend, while the parent ensures no double-counting of the bank total. We should implement a similar parent-child transaction model. Each split carries its own category, tags, and (optionally) memo, but links back to the single real payment for audit clarity. Budgets and “Safe-to-Spend”: When splits cross categories, budgeting still works because each piece hits the appropriate budget bucket. If $70 of that Costco purchase is Groceries, it reduces the grocery budget only by that amount. Apps like YNAB and Monarch follow this principle so that bundled expenses don’t blow up one category incorrectly
ynab.com
kosheronabudget.com
. Our safe-to-spend (discretionary funds) calculation will naturally stay accurate if we categorize splits properly – only the portion of a transaction that is truly spending (and not a transfer or non-discretionary category) will count against safe-to-spend. The key is to let users split easily and often. Rollups and UI: We’ll show the parent transaction with an expandable list of splits beneath it, similar to how QuickBooks or Mint display “split” entries. Totals roll up to the parent for account reconciliation, while analysis views sum by category across all splits. We should also adopt Monarch’s idea of distributing things like tax or fees proportionally or evenly in splits
help.monarch.com
help.monarch.com
, so that each split is fully loaded with its share of the expense. This gives a truthful picture (e.g. each item’s price with tax) in category reports.

Transaction-Receipt Matching (Order Itemization): Matching transactions to receipts or item details can greatly enhance categorization, but it’s challenging. Still, some consumer apps have made headway. Monarch’s new Amazon and Target extension is a prime example: it connects to your Amazon account via browser extension to pull in actual order line-items
monarch.com
monarch.com
. If you buy miscellaneous items in one Amazon order, Monarch automatically splits that single charge into detailed transactions by item, categorizing each (socks to Clothing, vitamins to Health, etc.)
monarch.com
help.monarch.com
. It even adds notes about what was in the order and why a category was chosen
help.monarch.com
. We likely can’t build something so robust overnight, but we can start with basic receipt matching for clarity on big or ambiguous transactions. For instance, allow users to attach a photo/PDF of a receipt or email forward, and store it with the transaction. As a first step, this is manual but improves audit trails (e.g. seeing the receipt confirms what was purchased). Automated matching – where the system auto-links an emailed receipt or OCR-scanned receipt to a transaction – can be incremental. Expensify and Brex already auto-match receipts to corporate card transactions by comparing amount, date, and merchant text
brex.com
help.expensify.com
. When there’s a confident match, Brex will attach the receipt image behind the scenes
brex.com
. We can implement a simple version: if a user forwards a receipt email or uploads a photo, attempt to match it to an unreceipted transaction within, say, +/-2 days and equal amount. If exactly one candidate is found, auto-link them; if not, flag it for user review. Fallbacks for ambiguity: Both Expensify and Brex avoid “guessing” wrong – if the system isn’t sure, it does nothing or asks the user. Expensify notes that if a receipt and card charge don’t closely match, they won’t merge automatically (the user may have to manually merge or correct them)
help.expensify.com
. We’ll follow that guideline: no forced matches on low confidence. Instead, present the user with a “possible match” prompt or simply leave the receipt unattached in an inbox for them to link. This ensures we never erroneously double-count or mislabel spending due to a bad receipt link. In short, basic receipt capture is achievable now; full item-level parsing (like Monarch’s Amazon integration) is valuable but can be deferred until we have capacity (see Defer/Later below).

Explainability & User Trust: A critical lesson from these tools is to show your work. Users trust categorizations more when they can see why a transaction was put in a category. QuickBooks surfaces this via badges and filters: after applying a rule, it adds a visible “RULE” label in the transaction’s category field
quickbooks.intuit.com
. Brex’s interface even lets you hover over an auto-categorized field to see which rule or mapping was applied, giving “full visibility into automation behavior—no surprises”
brex.com
. We should implement similar explainability features from day one. Concretely, each transaction entry in our UI can include a small indicator of its source: e.g. “Rule: Starbucks → Dining” or “ML suggestion” or “Manual”. A tooltip or info icon could reveal details like “Categorized by rule ‘Coffee Shops’ on Jan 5” or “You set this category (override of rule)”. This aligns with our auditability principle that nothing happens opaquely. It also helps users learn the system’s logic and catch mistakes. If a rule misfires, the user will immediately see “Rule: Grocery” and realize a correction or rule tweak is needed, rather than wondering how that category appeared. Explanations build trust. Even a simple note like “(auto-categorized based on merchant name)” vs “(you categorized this)” can reassure users that they remain in control. In addition, we’ll maintain a log of changes (accessible in an “Activity” view for a transaction) – e.g. “Originally categorized as X by rule, changed to Y by user on [date]” – so they can trace back any surprises. This log can be invaluable during budgeting or reconciliation to recall why a change was made.

Privacy, Consent & Data Enrichment: When enhancing categorization with external data (web scraping, AI services, etc.), platforms tread carefully with user consent. Monarch’s Amazon solution is opt-in by design: the user must install a browser extension and explicitly log in to Amazon for Monarch to fetch orders
help.monarch.com
. This way, the user’s credentials and data stay within the extension’s context (under their control) and not scraped unbeknownst to them. We should follow this pattern of explicit user authorization for any data enrichment. For example, if we ever pull detailed receipts from an email account or use a browser integration for e-commerce, it should be via user-provided API access or extensions – never “magic” scraping without permission. Likewise, if we leverage an LLM (Large Language Model) to interpret transaction memos or suggest categories, we must be transparent and obtain consent if sensitive data leaves our system. Many apps haven’t yet tackled this (most still use internal ML models), but it’s emerging. Our plan could include a settings toggle like “Allow AI-based categorization” with a note on what data might be sent to the AI service. On the plus side, some enrichment stays entirely in-house: e.g. using merchant names to do a web lookup for more info could be done server-side without exposing user identity, but we’d still disclose it in our privacy policy. Permission models in practice: Generally, financial apps piggyback on aggregator permissions – when users connect their bank accounts, they consent to the aggregator’s data use (Plaid, etc., which in turn provide cleaned merchant info and categories). Additional enrichment (like receipts) is usually user-initiated (upload a receipt, connect Amazon) rather than automatic. We’ll continue that norm. Brex, for instance, lets users submit receipts via email, mobile app, or even Slack – methods that users choose to use – and then auto-matches them
brex.com
. It’s convenient but still user-driven. Our system will similarly require the user to provide any supplementary data; we won’t surprise them by crawling their emails or browser history without ask. And when we do get extra data, we’ll make it visible (e.g. “Receipt attached” or “Enriched via web lookup”) so the user knows the source. Ultimately, respecting privacy and consent isn’t just ethical – it also improves data quality, since users who trust us will be willing to link accounts or forward receipts that make categorization more complete.

Transfer Detection & Clear Semantics: (Not explicitly in the asked list, but core to our goals.) Many tools fail to separate transfers from real spending, so we will treat transfers as first-class. We’ll use rules (and possibly ML) to auto-mark transactions as transfers or reimbursements when appropriate (e.g. detecting matching in/out amounts, known account numbers, Venmo between own accounts, etc.). Marked transfers will be excluded from spending totals, giving a true cashflow picture. Any automatic transfer classification will also be explainable and reversible by the user (e.g. “Auto-marked as internal transfer because origin and destination accounts are yours – undo?”). This clarity is actionable now using heuristics and user confirmation.

Operational Safety (Batch Ops & Idempotence): As we add automation, we must guard against runaway changes. Misapplied rules or integrations could wreak havoc (e.g. categorizing every transaction wrong). The state-of-the-art solution is controlled, idempotent batch processing. In practice, this means two things: (a) never applying the same rule twice to the same transaction, and (b) giving users a preview or narrow scope for bulk actions. Monarch’s Amazon extension illustrates (a) well – once it splits & categorizes a transaction, it won’t touch that transaction on subsequent syncs
help.monarch.com
. This prevents oscillation or duplicate splits. We’ll similarly tag transactions that have been handled by a rule or AI pass, and not re-process them unless prompted. For (b), consider how Monarch’s extension setup asks the user if they want to retroactively fix past 3 months or only do new transactions
help.monarch.com
help.monarch.com
. If the user opts for “future only,” the past data is left unchanged (no surprise mass edits). We can adopt this pattern: whenever a user creates a new rule or bulk-split, provide a scope choice – e.g. “Apply to all 12 past transactions from this merchant?” – before execution. We can even show a short preview list: “This will recategorize the last 5 ‘Starbucks’ charges to ‘Coffee Shops’.” Brex’s system offers another safety net: if two automations of equal priority could apply, it doesn’t choose arbitrarily – it flags and defers to user
brex.com
. We will always favor pausing and asking over making a dubious automatic call. Additionally, maintaining an internal idempotency key for each rule application run ensures that if a process is accidentally triggered twice (say due to a page refresh), we don’t double-apply changes. In terms of error recovery, we will log every bulk operation (e.g. “Rule X applied to 8 transactions at 2026-01-02 10:00 UTC”) so that if a user says “oops,” support or the system can identify those transactions and help revert them. As a final layer, perhaps incorporate a “dry run” mode in the future (even if just for admin use) to simulate what a new complex rule would do – but even without a formal dry-run UI, the confirmation step and robust logging will address safety for now. The bottom line is that by learning from others’ ops practices – Monarch’s cautious re-run behavior
help.monarch.com
, Brex’s conflict prompts
brex.com
, QuickBooks’ advice to test on simple transactions first
quickbooks.intuit.com
 – we can avoid catastrophic categorization mistakes from day one.

Defer / Later (Worthwhile, But Higher Effort or Needs Upstream Tech)

Advanced Receipt Parsing & Itemization: While basic receipt matching is in our immediate plan, the full “item-level” breakdown (like Monarch’s Amazon/Target integration) may be too heavy to tackle early. It requires building web scrapers or negotiating with retailers for APIs, plus a rules engine to categorize line items (Monarch even maps Amazon item categories to your custom budget categories automatically
help.monarch.com
help.monarch.com
!). This depth is hugely valuable for power users – it turns a mysterious $300 Amazon charge into a clear list of what was bought – but implementing it reliably (and maintaining it as retailer websites change) is costly. We should defer this and possibly explore partnerships or using an API service (if one arises) later. Likewise, using OCR or an LLM to parse any uploaded receipt into individual line items and amounts is an emerging tech (Expensify’s “SmartScan” mostly just grabs total, date, merchant
use.expensify.com
). Fully automating split categorizations from a long grocery receipt, for example, would be great, but current accuracy is variable and might require a trained ML model plus a confirmation UI for the user. It’s a project in itself, so we mark this for later exploration. For now, letting users manually split or attach receipts covers the need; in the future, we can add a “Scan receipt for details” that suggests splits – ideally when the tech (or a third-party API) is mature enough.

AI/LLM-Based Categorization: Today we rely on rules and simple machine learning (e.g. lookups of known merchants). In the future, more semantic understanding of transactions could reduce manual work further. For instance, an LLM could read a cryptic bank description (“VENMO DES: RENT Payment”) and infer it’s likely a Housing/Rent expense even if our rules didn’t catch it. Some fintechs are experimenting with this
zenml.io
, but as noted in one source, out-of-the-box LLMs are costly and not fast enough for high volumes
reddit.com
. We’d likely need a fine-tuned model or a hybrid approach. This is valuable to consider later, once we have plenty of categorized data (and miscategorized examples) to possibly train a model or when services like Plaid/Ntropy improve their AI categorization offerings. Additionally, deploying LLMs raises data privacy questions (sending financial strings to an API) – another reason to defer until we can do it securely (perhaps an on-device or self-hosted model in the future). In short, LLM categorization could handle drift and new merchants in a smart way, but it’s a “later” due to complexity. We’ll stick to deterministic or small-model logic now and keep an eye on AI advances.

Drift Detection & Rule Lifecycle: As merchant behavior or user spending patterns change over time, it would be ideal for the system to notice and adapt. For example, Venmo transactions that were once personal (friends splitting dinner) might later be primarily business (paying rent or contractors). Today, no mainstream app automatically “expires” or adjusts your old rules in such cases – they rely on the user to catch it and update the rule or recategorize. In the future, we can build a drift detection feature: e.g. flag to the user “Your rule categorizing ‘VENMO’ as Entertainment hasn’t matched recent Venmo transactions well – review?” if we see the user frequently overriding it. This could be powered by tracking rule accuracy over time or noticing anomalies (perhaps an ML could gauge that a series of Venmo payments look like rent due to memo notes or amount). Implementing this robustly is complex and could annoy users if done naively (false alarms). So we defer this idea. A simpler future step might be adding an expiry or review date to user rules – e.g. let the user set “Ask me about this rule in a year.” For now, a more manual approach suffices: include guidance in docs or onboarding that users should periodically review their rules for relevance (echoing QuickBooks’ advice to clients to adapt rules to business changes
mro.cpa
). Auto-downgrading the confidence of rules or auto-disabling unused rules is something we can revisit after we gather more data on how often rules truly go stale.

Automated Safe-to-Spend Adjustments: We plan to deliver a robust weekly safe-to-spend number as a core feature, factoring in budgets, income, and excluding transfers. One advanced idea is dynamically adjusting safe-to-spend for drift or upcoming anomalies (e.g. if the system “expects” a certain bill or transfer based on history but it changed). This gets into forecasting and would depend on detecting drift as above. It’s a nice-to-have for later once we trust our categorization thoroughly. Initially, a static calculation based on the user’s set budgets and known upcoming transactions will do.

Comprehensive Dry-Run Simulator: While we will confirm rule actions with the user now, a more sophisticated simulation mode could be a future enhancement. For example, a sandbox where a user can create a complex multi-condition rule and see a report: “This would recategorize 120 transactions and change last month’s Grocery total from $500 to $470.” This kind of feature would increase confidence for power users managing lots of data. However, building a full simulation engine (essentially running the categorization pipeline in “test” and diffing results) is a later phase item. Initially, we’ll rely on simpler counts and user intuition for rules (and our logging/undo to fix any oversights). Down the road, especially as our user base grows, adding a preview step for bulk operations (beyond just a count) could further safeguard big changes – but it’s a heavy lift not needed immediately.

Enhanced Operational Tooling: In production, miscategorization bugs or bad data ingestions happen. We’ll have basic recovery (undo logs, etc.) now, but later we might build admin tools to re-run categorization on a set of transactions or to mass-revert a specific rule application. Additionally, maintaining idempotency keys for all automation (so reprocessing a bank file twice doesn’t duplicate transactions, for instance) is something we do plan now in code, but monitoring and perfecting it might evolve. As we integrate more external systems (perhaps multiple data feeds or new features like bill pay), ensuring idempotent and atomic operations will be an ongoing effort. This is not a one-and-done feature but an operational practice. We flag it here to continuously improve, but our current design (with unique transaction IDs and marking processed items) should be sufficient to start.

Contextual Categorization & Suggestions: Brex’s “Assistant” suggests mappings or rules based on patterns – e.g. noticing you often recode Uber from “Travel” to “Team Offsite” and prompting a rule for that
brex.com
. This kind of AI-driven suggestion is a later phase for us. It requires accumulating user-specific behavior and possibly a similarity engine. It’s very useful for large organizations (where an admin might appreciate the system learning preferences), but our initial focus is individual/personal finance, where the user can directly create the rule themselves when they see the need. Over time, as our dataset grows, we could add a feature: “You’ve changed 5 Starbucks transactions to ‘Coffee’ – create a rule to do this automatically?” This reduces friction, but we should first nail the fundamentals of manual rule creation and editing. We’ll defer smart suggestions until we have enough history and perhaps a dedicated AI module to analyze categorization history.

In summary, features that directly contribute to our cashflow clarity, accuracy, and trust – conflict-free rules, retroactive fixes, splits, clear transfer handling, explainability, basic receipt linking – are on the front burner. More complex or speculative enhancements – AI-driven categorization, automatic behavior adaptation, fully automated receipt itemization, and super-granular ops tooling – will be queued for later once the foundation is solid. This two-phase approach ensures we deliver on the Financial Command Center’s core goals (accurate expected vs actual views, rock-solid audit trails, and unambiguous treatment of transfers) without overextending on tech that isn’t yet necessary. We’ll learn from how today’s best tools solved these problems – and also from where they failed – to prioritize what truly brings clarity now, and save the “nice-to-haves” for when we have the luxury to polish.

Sources:

QuickBooks Online Help – Bank Rules and Priorities
mro.cpa
quickbooks.intuit.com

QuickBooks Online Help – Rule Badges (RULE vs AUTO)
quickbooks.intuit.com

Mint Tutorial – Setting Category Rules (retroactive application)
kosheronabudget.com

Monarch Money Blog – Smart Split rules (auto-split transactions, apply to existing)
monarch.com
monarch.com

Monarch Help Center – Retail Sync (Amazon) matching & splits
help.monarch.com
help.monarch.com

Expensify Help – Receipt Matching and Merge Behavior
help.expensify.com

Brex Help Center – Accounting Automation (rule hierarchy, conflict resolution)
brex.com
brex.com

Brex Help Center – Automation Suggestions (Brex Assistant)
brex.com

Brex Help Center – Receipt Matching Capabilities
brex.com

YNAB Blog – Payee Memorization and Category Guessing
ynab.com
 (demonstrating auto-category based on past usage)

Financial Command Center – Project Overview (internal principles and goals)


