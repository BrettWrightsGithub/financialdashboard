export interface ParsedRulePayload {
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  match_merchant_contains: string | null;
  match_merchant_exact: string | null;
  match_amount_min: number | null;
  match_amount_max: number | null;
  match_direction: "inflow" | "outflow" | null;
  assign_category_name: string | null;
  assign_category_id: string | null;
  assign_is_transfer: boolean | null;
  assign_is_pass_through: boolean | null;
}

export interface ParseRuleResult {
  rule: ParsedRulePayload | null;
  clarification?: string;
  response?: string;
}
