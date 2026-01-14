# Documentation Changelog

## 1. docs/system-overview.md
*   **Corrected:** "Known Limitations" now explicitly states that server-side authentication (e.g., `middleware.ts`) is missing. The system relies on client-side Supabase keys (`lib/supabase.ts`) or trusted network environments.
*   **Why:** Audit of `app/` directory confirmed absence of Next.js middleware, which is a critical security detail.

## 2. docs/data-model.md
*   **Corrected:** `transactions` table description now clarifies that `category_ai` is currently populated by Plaid Enrichment (Workflow 2), noting that the dedicated AI Categorizer (Workflow 4) is not yet active.
*   **Why:** Prevents confusion between existing Plaid data and the planned LLM-based classification.

## 3. docs/automation-workflows.md
*   **Corrected:** Marked Workflow 4 (AI Transaction Categorizer) as **"Design / Planned"**.
*   **Why:** Audit found the design documentation (`docs/n8n/workflow-04-ai-categorizer.md`) but confirmed the implementation file (`.json`) is missing from the repository.
