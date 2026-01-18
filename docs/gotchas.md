# Gotchas & Documentation Lessons

## Documentation Corrections

During the initial documentation generation, several assumptions were made that required correction upon deeper audit of the codebase.

### Incorrect or Unsupported Assumptions
- **AI Categorizer Status:** It was initially assumed that the AI Transaction Categorizer (Workflow 4) was fully implemented and active. An audit revealed that while comprehensive design documentation and prompts existed, the actual n8n `.json` implementation file was missing from the repository.
- **Authentication Enforcement:** The system was documented as having a standard authentication layer. However, no server-side middleware (`middleware.ts`) was found. The system actually relies on client-side Supabase authentication and Row Level Security (RLS).
- **AI Data Provenance:** The `category_ai` field in the `transactions` table was initially linked to the planned AI workflow, whereas it is currently populated by Plaid's built-in enrichment data during ingestion.

### Why They Occurred
- **Documentation vs. Implementation Split:** The repository contains detailed "official-plan" and design documents in `docs/` that describe intended features as if they were present. The initial pass prioritized these high-level descriptions over verifying the presence of executable files (like n8n JSON exports).
- **Standard Framework Expectations:** Modern Next.js projects typically include middleware for auth, leading to an assumption of its presence without explicit verification of the `app/` root structure.

### How to Avoid in Future Runs
- **Executable Verification:** Always verify that a documented "Workflow" or "Service" has a corresponding executable file (e.g., `.json` for n8n, `.sql` for migrations, or API route files) before claiming it is "active."
- **Source Citation First:** Build documentation by citing file paths *before* summarizing. If a file path cannot be found for a claim made in a design doc, label it as "Planned" or "Design Only."
- **Logic Location Check:** Explicitly check for "Guard" files like `middleware.ts`, `auth.ts`, or `.env.example` early in the process to avoid assuming standard boilerplate implementations.
