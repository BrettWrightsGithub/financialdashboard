import { buildCashflowSankeyData } from "@/lib/cashflowSankey";
import type { Transaction } from "@/types/database";

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? "tx-id",
    provider: "manual",
    provider_transaction_id: "provider-tx-id",
    account_id: "acct-1",
    provider_account_id: "provider-acct-1",
    date: overrides.date ?? "2026-01-10",
    amount: overrides.amount ?? 0,
    description_raw: "Test",
    description_clean: overrides.description_clean ?? null,
    life_category_id: overrides.life_category_id ?? null,
    cashflow_group: overrides.cashflow_group ?? null,
    flow_type: null,
    category_ai: null,
    category_ai_conf: null,
    category_locked: false,
    status: overrides.status ?? "posted",
    provider_type: null,
    processing_status: null,
    counterparty_name: overrides.counterparty_name ?? null,
    counterparty_id: null,
    is_transfer: overrides.is_transfer ?? false,
    transfer_pair_id: null,
    transfer_match_confidence: null,
    transfer_match_source: null,
    is_pass_through: false,
    is_business: false,
    category_source: null,
    parent_transaction_id: null,
    is_split_child: false,
    is_split_parent: overrides.is_split_parent ?? false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("buildCashflowSankeyData", () => {
  it("builds balanced surplus graph with Net Increase", () => {
    const result = buildCashflowSankeyData({
      month: "2026-01",
      categoryNameById: { c1: "Salary" },
      transactions: [
        makeTransaction({ id: "1", amount: 5000, cashflow_group: "Income", life_category_id: "c1" }),
        makeTransaction({ id: "2", amount: 300, cashflow_group: "Business" }),
        makeTransaction({ id: "3", amount: -1500, cashflow_group: "Fixed" }),
        makeTransaction({ id: "4", amount: -500, cashflow_group: "Discretionary" }),
        makeTransaction({ id: "5", amount: -200, cashflow_group: "Business" }),
      ],
    });

    expect(result.totals).toEqual({
      inflow: 5300,
      outflow: 2200,
      net: 3100,
    });
    expect(result.projection).toEqual({
      expectedIncome: 0,
      expectedOutflow: 0,
      projectedNet: 3100,
    });
    expect(result.nodes.some((node) => node.label === "Net Increase")).toBe(true);
    expect(result.nodes.some((node) => node.label === "Prior Cash/Credit")).toBe(false);
    expect(
      result.links.some(
        (link) => link.source === "cash_pool" && link.target === "balance_net_increase" && link.value === 3100
      )
    ).toBe(true);
  });

  it("builds balanced deficit graph with Prior Cash/Credit", () => {
    const result = buildCashflowSankeyData({
      month: "2026-01",
      categoryNameById: { c1: "Salary" },
      transactions: [
        makeTransaction({ id: "1", amount: 2000, cashflow_group: "Income", life_category_id: "c1" }),
        makeTransaction({ id: "2", amount: -2500, cashflow_group: "Fixed" }),
      ],
    });

    expect(result.totals).toEqual({
      inflow: 2000,
      outflow: 2500,
      net: -500,
    });
    expect(result.nodes.some((node) => node.label === "Prior Cash/Credit")).toBe(true);
    expect(result.nodes.some((node) => node.label === "Net Increase")).toBe(false);
    expect(
      result.links.some(
        (link) => link.source === "balance_prior_cash_credit" && link.target === "cash_pool" && link.value === 500
      )
    ).toBe(true);
  });

  it("excludes pending, transfer, and split-parent transactions", () => {
    const result = buildCashflowSankeyData({
      month: "2026-01",
      categoryNameById: {},
      transactions: [
        makeTransaction({ id: "1", amount: 1000, cashflow_group: "Income", status: "pending" }),
        makeTransaction({ id: "2", amount: 1000, cashflow_group: "Income", is_transfer: true }),
        makeTransaction({ id: "3", amount: 1000, cashflow_group: "Income", is_split_parent: true }),
      ],
    });

    expect(result.nodes).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.totals).toEqual({ inflow: 0, outflow: 0, net: 0 });
  });

  it("collapses non-top income streams and uses fallback labels deterministically", () => {
    const transactions = [
      makeTransaction({ id: "1", amount: 1200, cashflow_group: "Income", counterparty_name: "Client A" }),
      makeTransaction({ id: "2", amount: 800, cashflow_group: "Income", counterparty_name: "Client B" }),
      makeTransaction({ id: "3", amount: 600, cashflow_group: "Income", counterparty_name: "Client C" }),
      makeTransaction({ id: "4", amount: 400, cashflow_group: "Income" }),
      makeTransaction({ id: "5", amount: -500, cashflow_group: "Fixed" }),
    ];

    const a = buildCashflowSankeyData({
      month: "2026-01",
      categoryNameById: {},
      transactions,
      topIncomeCount: 2,
    });
    const b = buildCashflowSankeyData({
      month: "2026-01",
      categoryNameById: {},
      transactions: [...transactions].reverse(),
      topIncomeCount: 2,
    });

    expect(a).toEqual(b);
    expect(a.nodes.some((node) => node.label === "Other Income Items")).toBe(true);
    expect(a.nodes.some((node) => node.label === "Uncategorized Income")).toBe(true);
  });

  it("includes expected projection totals for mid-month context", () => {
    const result = buildCashflowSankeyData({
      month: "2026-02",
      categoryNameById: {},
      transactions: [
        makeTransaction({ id: "1", amount: 1000, cashflow_group: "Income" }),
        makeTransaction({ id: "2", amount: -600, cashflow_group: "Fixed" }),
      ],
      projection: {
        expectedIncome: 3200,
        expectedOutflow: 2800,
      },
    });

    expect(result.projection).toEqual({
      expectedIncome: 3200,
      expectedOutflow: 2800,
      projectedNet: 1400,
    });
  });

  it("breaks out outflows by category with uncategorized fallback labels", () => {
    const result = buildCashflowSankeyData({
      month: "2026-02",
      categoryNameById: { c_food: "Food & Dining" },
      transactions: [
        makeTransaction({ id: "1", amount: 1000, cashflow_group: "Income", counterparty_name: "Employer" }),
        makeTransaction({ id: "2", amount: -240, cashflow_group: "Discretionary", life_category_id: "c_food" }),
        makeTransaction({ id: "3", amount: -90, cashflow_group: "Fixed", life_category_id: null, description_clean: null }),
      ],
    });

    expect(result.nodes.some((node) => node.label === "Food & Dining")).toBe(true);
    expect(result.nodes.some((node) => node.label === "Uncategorized Fixed")).toBe(true);
  });
});
