| Doc | Claim | Evidence | Confidence | Action Needed |
| :--- | :--- | :--- | :--- | :--- |
| **system-overview.md** | Architecture is Next.js + Supabase + n8n | `package.json` (Next.js), `lib/supabase.ts`, `docs/n8n/` | High | None |
| **system-overview.md** | Single-tenant / Household focus | `app/page.tsx` (hardcoded dashboard logic), No user selection | High | None |
| **system-overview.md** | "Safe-to-Spend" formula logic | `lib/queries.ts` (lines 438-450) implements `/ 4.33` logic | High | None |
| **data-model.md** | Core tables (`transactions`, `accounts`, etc.) | `docs/db-schema.md`, Migration files (read previously) | High | None |
| **data-model.md** | Stored Procedures for business logic | `supabase/migrations/20260103_stored_procedures_enhanced.sql` | High | None |
| **data-model.md** | `amount` sign convention (Neg=Exp, Pos=Inc) | `docs/n8n/workflow-02-plaid-sync.md` ("Critical: Amount Normalization") | High | None |
| **automation-workflows.md** | Teller, Plaid, Venmo workflows exist | `docs/n8n/` contains docs and JSON for workflows 1-3 | High | None |
| **automation-workflows.md** | AI Categorizer (Workflow 4) exists | `docs/n8n/workflow-04-ai-categorizer.md` exists, but **NO** `.json` file found | Medium | Clarify if implemented or just planned |
| **automation-workflows.md** | Venmo parser depends on `counterparties` | `docs/n8n/workflow-03-venmo-parser.md` explicitly lists this dependency | High | None |
| **system-overview.md** | Auth implementation / Middleware | **Missing** `middleware.ts`. `lib/supabase.ts` checks env vars but no server-side enforcement found in `app/` | Medium | Note missing auth enforcement as a risk |
