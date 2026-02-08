# Financial Dashboard

A personal finance command center that aggregates accounts, transactions, and budget tracking.

## Quick Start

1. Clone this repo
2. Run `npm install`
3. Set up Supabase (see [DEPLOYMENT.md](DEPLOYMENT.md))
4. Run `npm run dev`

Then open http://localhost:3000

## Screenshots

### Dashboard
[Dashboard showing monthly cashflow overview, safe-to-spend calculator, and key alerts]

### Transactions
[Master transaction ledger with filters, inline editing, and split transaction support]

### Budget Planner
[Budget planning interface showing expected vs actual spending by category]

## Features

- **Unified transaction ledger** — All accounts in one place with filters and search
- **Auto-categorization engine** — Rules-based system with payee memory and manual override tracking
- **Budget planner** — Track planned vs actual spending by category
- **Safe-to-spend calculator** — Weekly discretionary spending based on actuals
- **Expected inflows tracking** — Monitor rent, reimbursements, and other income
- **Review queue** — Bulk edit uncategorized or low-confidence transactions

## Tech Stack

- **Frontend:** Next.js 15 + React + TypeScript
- **Data:** Supabase (PostgreSQL)
- **Styling:** TailwindCSS
- **Testing:** Vitest + Playwright

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) — Full deployment and setup guide
- [docs/db-schema.md](docs/db-schema.md) — Database schema reference
- [docs/financial-command-center-overview.md](docs/financial-command-center-overview.md) — System architecture
- [docs/testing/testing_strategy.md](docs/testing/testing_strategy.md) — Test strategy and CI gate

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Preflight checks (JSON validity + merge marker scan)
npm run preflight

# Static checks
npm run lint
npm run typecheck

# Test suites
npm run test:unit
npm run test:integration
npm run test:e2e:smoke
npm run test:e2e

# Shortcut for unit tests
npm test
```

## CI Test Gate

GitHub Actions runs on push/PR to `main` via `.github/workflows/ci.yml`.

Current CI order:
1. `npm ci`
2. `npm run preflight`
3. `npm run lint`
4. `npm run typecheck`
5. `npm run test:unit`
6. `npm run test:integration`
7. `npx playwright install --with-deps chromium`
8. `npm run test:e2e:smoke`

## License

MIT © 2025 Brett Wright
