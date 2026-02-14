// Database types matching docs/db-schema.md

export type CashflowGroup =
  | "Income"
  | "Fixed"
  | "Variable Essentials"
  | "Discretionary"
  | "Debt"
  | "Savings/Investing"
  | "Business"
  | "Transfer"
  | "Detractors"
  | "Other";

export type FlowType = "Income" | "Expense" | "Transfer";

export type AccountGroup =
  | "Cash"
  | "Savings"
  | "Debt"
  | "Investment"
  | "Property"
  | "Vehicle"
  | "Crypto"
  | "Other";

export type BalanceClass = "Asset" | "Liability";

export type Owner = "Brett" | "Ashley" | "Joint";

// Account from accounts table
export interface Account {
  id: string;
  provider: string;
  provider_account_id: string;
  name: string;
  display_name: string;
  institution_id: string | null;
  institution_name: string | null;
  currency: string;
  status: string;
  subtype: string;
  balance_class: BalanceClass;
  account_group: AccountGroup;
  owner: Owner;
  is_primary_cashflow: boolean;
  include_in_cashflow: boolean;
  last_four: string | null;
  ledger_balance: number | null;
  available_balance: number | null;
  current_balance: number | null;
  credit_limit: number | null;
  interest_rate_apr: number | null;
  created_at: string;
  updated_at: string;
}

// Category from categories table
export interface Category {
  id: string;
  name: string;
  cashflow_group: CashflowGroup;
  flow_type?: FlowType | null;
  description: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// Transaction from transactions table
export interface Transaction {
  id: string;
  provider: string;
  provider_transaction_id: string;
  account_id: string;
  provider_account_id: string;
  date: string;
  amount: number; // Positive = inflow, Negative = outflow
  description_raw: string;
  description_clean: string | null;
  life_category_id: string | null;
  cashflow_group: CashflowGroup | null;
  flow_type: FlowType | null;
  category_ai: string | null;
  category_ai_conf: number | null;
  category_locked: boolean;
  status: string;
  provider_type: string | null;
  processing_status: string | null;
  counterparty_name: string | null;
  counterparty_id: string | null;
  is_transfer: boolean;
  transfer_pair_id?: string | null;
  transfer_match_confidence?: number | null;
  transfer_match_source?: string | null;
  is_pass_through: boolean;
  is_business: boolean;
  category_source: string | null;
  parent_transaction_id?: string | null;
  is_split_child?: boolean;
  is_split_parent?: boolean;
  created_at: string;
  updated_at: string;
}

// Split input for creating child transactions
export interface SplitInput {
  amount: number;
  category_id: string;
  description?: string;
}

// Transaction with joined data (from v_transactions_with_details view or manual joins)
export interface TransactionWithDetails extends Transaction {
  account_name?: string;
  institution_name?: string;
  category_name?: string;
  category_confidence?: number | null;
}

// Counterparty from counterparties table
export interface Counterparty {
  id: string;
  name: string;
  type: "tenant" | "tmobile_family" | "tmobile_person" | "other";
  venmo_username: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

// Expected Inflow from expected_inflows table
export interface ExpectedInflow {
  id: string;
  source: string;
  counterparty_id: string | null;
  expected_amount: number;
  expected_date: string | null;
  recurrence: string | null;
  category_id: string | null;
  matched_transaction_id: string | null;
  actual_amount: number | null;
  actual_date: string | null;
  status: "pending" | "received" | "partial" | "missed";
  month: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data from API responses
  categories?: Category | null;
  counterparties?: {
    id: string;
    name: string;
    type: string;
    notes: string | null;
  } | null;
}

// Budget Target from budget_targets table
export interface BudgetTarget {
  id: string;
  category_id: string;
  month: string; // First day of month, e.g., "2025-03-01"
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Budget target with category details
export interface BudgetTargetWithCategory extends BudgetTarget {
  category_name: string;
  cashflow_group: CashflowGroup;
  flow_type: FlowType;
}

// Category Override from category_overrides table
export interface CategoryOverride {
  id: string;
  transaction_id: string;
  description_snapshot: string;
  old_category_id: string | null;
  new_category_id: string;
  reason: string | null;
  created_at: string;
}

// UI Filter types
export interface TransactionFilters {
  dateRange: {
    start: string;
    end: string;
  };
  accountId: string | null;
  cashflowGroup: CashflowGroup | null;
  hideTransfers: boolean;
  hidePassThrough: boolean;
  searchQuery: string;
}

// Budget summary for display
export interface BudgetSummary {
  categoryId: string;
  categoryName: string;
  cashflowGroup: CashflowGroup;
  expected: number;
  actual: number;
  variance: number; // actual - expected
  percentUsed: number;
}

// Cashflow summary
export interface CashflowSummary {
  month: string;
  income: number;
  fixed: number;
  variableEssentials: number;
  discretionary: number;
  debt: number;
  savings: number;
  business: number;
  netCashflow: number;
}

// Outstanding inflow status
export interface OutstandingInflow {
  id: string;
  counterpartyName: string;
  description: string;
  expected: number;
  received: number;
  outstanding: number;
  status: "received" | "pending" | "overdue";
}

// Categorization Rule from categorization_rules table
export interface CategorizationRule {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  match_merchant_contains: string | null;
  match_merchant_exact: string | null;
  match_amount_min: number | null;
  match_amount_max: number | null;
  match_account_id: string | null;
  match_account_subtype: string | null;
  match_direction: "inflow" | "outflow" | null;
  assign_category_id: string;
  assign_is_transfer: boolean | null;
  assign_is_pass_through: boolean | null;
  created_at: string;
  updated_at: string;
}

// Rule with category name for display
export interface CategorizationRuleWithCategory extends CategorizationRule {
  category_name: string;
}

// Result from categorization waterfall
export interface WaterfallResult {
  batch_id?: string;
  processed: number;
  rules_applied: number;
  memory_applied: number;
  plaid_applied: number;
  skipped_locked: number;
  uncategorized: number;
}

// Result from undo batch operation
export interface UndoBatchResult {
  success: boolean;
  batch_id?: string;
  reverted?: number;
  skipped_locked?: number;
  already_reverted?: number;
  error?: string;
}

// Categorization statistics
export interface CategorizationStats {
  date_range: {
    start: string;
    end: string;
  };
  total: number;
  categorized: number;
  uncategorized: number;
  locked: number;
  by_source: Record<string, number>;
  categorization_rate: number;
}

// Category source types
export type CategorySource = "manual" | "rule" | "payee_memory" | "plaid" | "override";

// Intake source types
export type IntakeSourceType = "upload" | "csv" | "amazon_extension";

export type IntakeArtifactStatus =
  | "received"
  | "parsed"
  | "matched"
  | "needs_review"
  | "ready_to_apply"
  | "applied"
  | "error";

export type IntakeMatchStatus = "unmatched" | "suggested" | "confirmed" | "rejected" | "applied";

// Shared intake artifact
export interface IntakeArtifact {
  id: string;
  source_type: IntakeSourceType;
  created_by: string | null;
  marketplace: string | null;
  provider_order_id: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  status: IntakeArtifactStatus;
  error_message: string | null;
  raw_payload_json: Record<string, unknown> | null;
  received_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Shared intake extraction row
export interface IntakeExtraction {
  id: string;
  artifact_id: string;
  merchant_name: string | null;
  transaction_date: string | null;
  currency: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  shipping_amount: number | null;
  raw_extraction_json: Record<string, unknown> | null;
  extraction_confidence: number | null;
  created_at: string;
  updated_at: string;
}

// Shared intake itemized row
export interface IntakeLineItem {
  id: string;
  extraction_id: string;
  line_index: number;
  description: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
  suggested_category_id: string | null;
  confirmed_category_id: string | null;
  raw_item_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// Shared intake match row
export interface IntakeMatch {
  id: string;
  extraction_id: string;
  transaction_id: string | null;
  match_confidence: number | null;
  match_reason: string | null;
  status: IntakeMatchStatus;
  applied_batch_id: string | null;
  created_at: string;
  updated_at: string;
}

// Amazon source order metadata
export interface ExternalOrder {
  id: string;
  intake_artifact_id: string;
  marketplace: string;
  provider_order_id: string;
  order_date: string;
  order_total: number;
  currency: string;
  raw_payload_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// Amazon source order item metadata
export interface ExternalOrderItem {
  id: string;
  external_order_id: string;
  line_index: number;
  item_title: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
  raw_item_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type CsvImportBatchStatus = "previewed" | "needs_review" | "ready_to_apply" | "applied" | "error";
export type CsvImportRowParseStatus = "valid" | "invalid" | "skipped";
export type CsvImportRowDedupeStatus = "new" | "duplicate" | "merge" | "skip" | "imported";

export interface CsvImportBatch {
  id: string;
  artifact_id: string;
  mapping_json: Record<string, unknown>;
  status: CsvImportBatchStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  applied_rows: number;
  created_by: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CsvImportRow {
  id: string;
  batch_id: string;
  row_index: number;
  raw_row_json: Record<string, unknown>;
  normalized_date: string | null;
  normalized_description: string | null;
  normalized_amount: number | null;
  source_row_hash: string | null;
  parse_status: CsvImportRowParseStatus;
  parse_error: string | null;
  dedupe_status: CsvImportRowDedupeStatus;
  dedupe_transaction_id: string | null;
  imported_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}
