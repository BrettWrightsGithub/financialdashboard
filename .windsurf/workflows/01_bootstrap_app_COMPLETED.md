---
description: Create the initial Next.js + TypeScript + Tailwind app for the Financial Command Center, wired to Supabase and ready for the three main pages (Dashboard, Budget Planner, Transactions).
auto_execution_mode: 1
---

## Steps

1. Read `.windsurfrules`, `README.md`, and `docs/financial-command-center-overview.md` to understand the app.
2. Initialize a Next.js App Router project in this folder using TypeScript and TailwindCSS.
3. Add basic Tailwind configuration and a simple layout with a top navbar containing:
   - Logo / title: "Financial Command Center"
   - Links: Dashboard, Budget Planner, Transactions, PRD & Specs.
4. Create a `lib/supabaseClient.ts` file that exports a typed Supabase client using environment variables.
5. Create a `types/` folder and add TypeScript interfaces for:
   - `Account`
   - `Category`
   - `Transaction`
   - `BudgetTarget`
   as described in `docs/db-schema.md`.
6. Create basic placeholder routes and pages:
   - `app/(routes)/dashboard/page.tsx`
   - `app/(routes)/budget-planner/page.tsx`
   - `app/(routes)/transactions/page.tsx`
   Each page should render a simple heading and a short description of its purpose.
7. Add a simple healthcheck API route at `app/api/health/route.ts` that returns JSON:

   '''
   { "status": "ok" }
   '''

8. Ensure the command below starts without TypeScript errors or build failures:

   '''
   npm run dev
   '''

9. Document any commands or setup steps you added in the `README.md`.
