# .windsurf Directory

This directory contains Windsurf-specific configuration for the Financial Command Center project.

## Structure

### `/workflows/` - Step-by-step implementation guides

Numbered workflows for building features in order:

**Foundation & Core Pages**
1. **01_bootstrap_app_COMPLETED.md** - Initial Next.js setup, Supabase connection
2. **02_budget_planner_page_COMPLETED.md** - Budget Planner UI and logic
3. **03_dashboard_page_COMPLETED.md** - Dashboard widgets & cashflow
4. **04_transactions_page_COMPLETED.md** - Transactions list & filters

**Categorization MVP Implementation (Completed)**
5. **05_data_validation_pilot_COMPLETED.md** - Data validation & rules testing
6. **06_categorization_rule_engine_COMPLETED.md** - Core rules engine logic
7. **07_user_override_payee_memory_COMPLETED.md** - User overrides & payee memory
8. **08_transfer_reimbursement_handling_COMPLETED.md** - Transfers & reimbursements
9. **09_transaction_splitting_COMPLETED.md** - Split transactions support
10. **10_bulk_edit_review_queue_COMPLETED.md** - Bulk edit & review queue UI
11. **11_audit_log_explainability_COMPLETED.md** - Audit logging & explainability
12. **12_pending_transaction_sync_COMPLETED.md** - Pending transaction sync
13. **13_retroactive_rule_application_COMPLETED.md** - Retroactive rules & undo
14. **14_supabase_stored_procedures_COMPLETED.md** - Stored procedures (The Engine)

**Categorization Planning (Reference)**
- *03_categorization_mvp_foundation.md* - Original engine plan
- *04_categorization_ui_review_queue.md* - Original UI plan
- *05_categorization_rules_engine.md* - Original rules plan

**Next Steps**
15. **15_n8n_orchestration.md** - N8n automation setup

**When to use workflows:**
- Implementing new features or pages
- Need step-by-step guidance
- Want auto_execution mode for faster builds

**How to use:**
```
/workflow 03_categorization_mvp_foundation
```

### `/paths/` - Context and reference guides

Domain-specific knowledge that should always be referenced:

- **categorization-context.md** - Categorization MVP strategy, requirements (TI-01 through TI-05), precedence waterfall, success metrics
- **plaid-integration.md** - Plaid API usage, transaction syncing, pending→posted handling, transfer detection
- **cashflow-calculations.md** - Cashflow logic, Safe-to-Spend algorithm, budget vs actual, filters
- *(More to be added as needed)*

**When to reference paths:**
- Before writing categorization logic → read `categorization-context.md`
- Before Plaid integration work → read `plaid-integration.md`
- Before cashflow calculations → read `cashflow-calculations.md`
- Debugging categorization issues → check technical requirements
- Need to understand system design → review relevant path file

**Windsurf automatically includes relevant path files based on your query context.**

## What's Next?

### Recommended Additions (Create as needed)

**Workflows:**
- `06_dashboard_implementation.md` - Dashboard cards, sparklines, Safe-to-Spend display
- `07_transactions_page_filters.md` - Advanced filtering, search, export
- `08_plaid_sync_automation.md` - Background jobs, webhooks, error handling
- `09_expected_inflows_tracking.md` - Rental payments, T-Mobile reimbursements UI

**Paths:**
- `testing-strategy.md` - Unit tests, integration tests, validation approach
- `security-best-practices.md` - Auth, RLS policies, sensitive data handling
- `database-optimization.md` - Indexes, query performance, materialized views
- `deployment-checklist.md` - Pre-launch validation, monitoring setup

## File Naming Conventions

### Workflows
- Use numbered prefixes: `01_`, `02_`, etc.
- Lowercase with underscores: `feature_name.md`
- Include `auto_execution_mode: 1` for automated execution

### Paths
- Descriptive domain names: `domain-topic.md`
- Kebab-case: `plaid-integration.md`, `categorization-context.md`
- No numbering (not sequential)

## Best Practices

### When Creating Workflows

1. **Start with context** - Link to relevant docs and path files
2. **Define prerequisites** - What must exist before starting
3. **Break into steps** - Small, testable increments
4. **Include code snippets** - Show expected implementation
5. **Add success criteria** - Checklist for validation
6. **Document next steps** - What comes after

### When Creating Path Files

1. **Quick reference section** - Key info at the top
2. **Link to primary docs** - Don't duplicate, reference
3. **Highlight critical requirements** - Especially TI-XX style requirements
4. **Common pitfalls** - What mistakes to avoid
5. **Code examples** - Practical implementations
6. **When to reference** - Clear guidance on usage

### Keeping Files Updated

**Path files should be updated when:**
- Requirements change
- New critical requirements discovered (TI-06, etc.)
- Common mistakes identified
- Implementation patterns established

**Workflows should be updated when:**
- Steps are incomplete or incorrect
- Better approaches discovered
- Dependencies change

## Integration with Project Docs

### Document Hierarchy

```
docs/                                    # Project documentation (requirements, decisions)
├── financial-command-center-overview.md # MASTER: System design, goals, logic
├── db-schema.md                         # MASTER: Database schema reference
├── categorization/
│   └── official-plan-synthesis_mvp_categorization_ai2.md  # MASTER: Categorization requirements
└── ...

.windsurf/                               # Windsurf-specific (how to build)
├── workflows/                           # Step-by-step build guides
│   ├── 01_bootstrap_app.md
│   └── ...
└── paths/                               # Context for AI assistant
    ├── categorization-context.md        # Distills categorization docs for quick reference
    ├── plaid-integration.md
    └── ...
```

**Rule of thumb:**
- `docs/` = **WHAT** (requirements, decisions, specifications)
- `.windsurf/workflows/` = **HOW** (implementation steps)
- `.windsurf/paths/` = **CONTEXT** (quick reference, critical reminders)

## Tips for Using with Windsurf

### Asking for Workflows

```
"Run workflow 03 to set up categorization"
"Execute the categorization foundation workflow"
"Follow workflow 05 for rules engine"
```

### Referencing Context

```
"Using the categorization context, implement the precedence waterfall"
"Check plaid-integration.md for how to handle pending transactions"
"What does cashflow-calculations.md say about Safe-to-Spend?"
```

### Creating New Workflows

```
"Create a new workflow for implementing the Dashboard page"
"Write workflow 06 for dashboard implementation based on the overview doc"
```

### Updating Documentation

```
"Update categorization-context.md to include the new TI-06 requirement"
"Add transfer detection examples to plaid-integration.md"
```

## Future Enhancements

Consider adding:
- **Slash commands** in `.windsurf/commands/` for common tasks
- **Context snippets** for frequently referenced code patterns
- **Testing workflows** for validation procedures
- **Troubleshooting guides** in paths/ for common issues

## Questions?

See main project README.md or Windsurf documentation at https://docs.windsurf.com
