# Documentation Correction Plan

## 1. docs/system-overview.md
*   **Unchanged:**
    *   Project Overview (Purpose, User, Scope).
    *   High-Level Architecture (Frontend, Core, Ingestion).
    *   Data Flow (Ingestion -> Categorization -> UI).
*   **Clarifications Needed:**
    *   **Auth/Security:** In "Known Limitations", explicitly state that no `middleware.ts` or server-side auth enforcement was found. The system relies on Supabase client/RLS or is intended for trusted local execution.
*   **Re-verification:** None.
*   **Unknown:** None.

## 2. docs/data-model.md
*   **Unchanged:**
    *   Databases & Schemas.
    *   Write/Read Paths (General).
    *   Constraints & Invariants.
*   **Clarifications Needed:**
    *   **AI Categorization Fields:** Clarify that `category_ai` in `transactions` is populated by Plaid's enrichment (Workflow 2), but the dedicated *AI Categorizer Workflow* (Workflow 4) is currently a design artifact, not an active write path.
*   **Re-verification:** None.
*   **Unknown:** None.

## 3. docs/automation-workflows.md
*   **Unchanged:**
    *   Workflow 1 (Teller).
    *   Workflow 2 (Plaid).
    *   Workflow 3 (Venmo).
*   **Clarifications Needed:**
    *   **Workflow 4 (AI Categorizer):** Rename status to **"Design / Planned"**. Explicitly state that while the design docs exist (`docs/n8n/workflow-04-ai-categorizer.md` and `docs/ai/`), the implementation (`.json` file) is missing from the repository.
*   **Re-verification:** None.
*   **Unknown:** None.

## Files to Reference
*   `docs/n8n/workflow-04-ai-categorizer.md` (Design)
*   `docs/ai/transaction_categorizer_v1.md` (Prompt Design)
*   `app/api/` (To confirm no hidden auth middleware exists)
