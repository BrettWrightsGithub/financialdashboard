# Plaid Sync & Pending Transaction Handling

This document describes the sync system for fetching transactions from Plaid and handling pending→posted transitions.

## Architecture

Per the MVP plan (Section L), sync responsibilities are split:

| Component | Responsibility |
|-----------|---------------|
| **n8n** | Webhook listening, Plaid API calls, raw data insertion |
| **Supabase** | Stored procedures for pending→posted handover, audit logging |
| **Next.js** | UI for status display, manual sync trigger |

## Database Schema

### sync_state

Tracks sync cursor and status per account/connection.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| account_id | UUID | FK to accounts |
| connection_id | UUID | FK to provider_connections |
| cursor | TEXT | Plaid's sync cursor |
| last_sync_at | TIMESTAMPTZ | Last successful sync |
| last_sync_status | TEXT | 'success', 'error', 'in_progress' |
| last_error | TEXT | Error message if failed |
| transactions_added | INTEGER | Count from last sync |
| transactions_modified | INTEGER | Count from last sync |
| transactions_removed | INTEGER | Count from last sync |

### transactions columns

- `pending_transaction_id` - Links posted to original pending transaction
- `status` - 'posted', 'pending', 'archived'

## Pending→Posted Handover

When a pending transaction settles (becomes posted), user categorizations must be preserved.

### Trigger: trg_handle_pending_handover

Fires BEFORE INSERT on transactions table.

### Function: fn_handle_pending_handover()

1. Checks if new transaction has `pending_transaction_id`
2. Finds matching pending transaction in same account
3. Copies user data from pending to posted:
   - `life_category_id`
   - `category_locked`
   - `category_source`
   - `counterparty_name`
   - `is_transfer`, `is_pass_through`, `is_business`
4. Archives the old pending record (status = 'archived')
5. Logs the preservation to audit log

## API Endpoints

### GET /api/sync/trigger
Returns sync status summary.

**Response:**
```json
{
  "lastSyncAt": "2025-01-15T10:30:00Z",
  "status": "success",
  "accountsSynced": 5,
  "recentTransactions": {
    "added": 12,
    "modified": 2,
    "removed": 0
  }
}
```

### POST /api/sync/trigger
Triggers manual sync via n8n webhook.

**Request:**
```json
{
  "account_id": "uuid",  // optional
  "connection_id": "uuid"  // optional
}
```

## Library Functions

### getSyncSummary()
Returns overall sync status across all accounts.

### getSyncStatus(accountId)
Returns sync state for a specific account.

### triggerSync(options)
Triggers n8n sync workflow via webhook.

### updateSyncState(connectionId, update)
Updates sync state after sync operation.

## n8n Integration

The Next.js app triggers sync via webhook:

```
POST ${N8N_SYNC_WEBHOOK_URL}
{
  "trigger": "manual",
  "accountId": "...",
  "timestamp": "..."
}
```

n8n workflow:
1. Receives webhook
2. Calls Plaid `/transactions/sync` with cursor
3. Upserts transactions to Supabase
4. Database trigger handles pending→posted
5. Updates sync_state with results

## UI Components

### Sync Status Indicator

Shows on Dashboard or Transactions page:
- Last sync time
- Status badge (success/error/in-progress)
- "Sync Now" button

## Configuration

Required environment variable:
```
N8N_SYNC_WEBHOOK_URL=https://your-n8n-instance/webhook/plaid-sync
```
