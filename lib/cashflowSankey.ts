import type { Transaction } from "@/types/database";

export type CashflowSankeyNodeKind = "income" | "pool" | "outflow" | "balance";
export type CashflowSankeyLinkKind = "income" | "outflow" | "balance";
export type CashflowSankeyMode = "source" | "category";

export interface CashflowSankeyNode {
  id: string;
  label: string;
  kind: CashflowSankeyNodeKind;
  value: number;
  color: string;
  column: number;
}

export interface CashflowSankeyLink {
  source: string;
  target: string;
  value: number;
  kind: CashflowSankeyLinkKind;
}

export interface CashflowSankeyData {
  nodes: CashflowSankeyNode[];
  links: CashflowSankeyLink[];
  totals: {
    inflow: number;
    outflow: number;
    net: number;
  };
  meta: {
    topIncomeCount: number;
    month: string;
  };
  projection: {
    expectedIncome: number;
    expectedOutflow: number;
    projectedNet: number;
  };
}

export interface CashflowSankeyVariants {
  source: CashflowSankeyData;
  category: CashflowSankeyData;
}

const DEFAULT_TOP_INCOME_COUNT = 20;
const CASH_POOL_NODE_ID = "cash_pool";
const PRIOR_CASH_NODE_ID = "balance_prior_cash_credit";
const NET_INCREASE_NODE_ID = "balance_net_increase";
const EPSILON = 0.00001;

const COLORS = {
  income: "#16a34a",
  outflow: "#0ea5e9",
  pool: "#64748b",
  balance: "#f59e0b",
} as const;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getIncomeCategoryLabel(
  transaction: Transaction,
  categoryNameById: Record<string, string>
): string {
  if (transaction.life_category_id && categoryNameById[transaction.life_category_id]) {
    return categoryNameById[transaction.life_category_id];
  }
  if (transaction.cashflow_group === "Business") {
    return "Business Income";
  }
  return "Uncategorized Income";
}

function getIncomeDetailLabel(
  transaction: Transaction,
  categoryNameById: Record<string, string>
): string {
  const counterparty = normalizeLabel(transaction.counterparty_name);
  if (counterparty) return counterparty;

  const description = normalizeLabel(transaction.description_clean) ?? normalizeLabel(transaction.description_raw);
  if (description) return description;

  if (transaction.life_category_id && categoryNameById[transaction.life_category_id]) {
    return categoryNameById[transaction.life_category_id];
  }

  return "Uncategorized Income";
}

function getOutflowCategoryLabel(
  transaction: Transaction,
  categoryNameById: Record<string, string>
): string | null {
  if (transaction.amount >= 0) return null;

  if (transaction.life_category_id && categoryNameById[transaction.life_category_id]) {
    return categoryNameById[transaction.life_category_id];
  }

  switch (transaction.cashflow_group) {
    case "Fixed":
    case "Variable Essentials":
    case "Discretionary":
    case "Debt":
    case "Savings/Investing":
      return `Uncategorized ${transaction.cashflow_group}`;
    case "Business":
      return "Uncategorized Business Outflow";
    default:
      return null;
  }
}

function getOutflowDetailLabel(transaction: Transaction, fallbackCategory: string): string {
  const counterparty = normalizeLabel(transaction.counterparty_name);
  if (counterparty) return counterparty;

  const description = normalizeLabel(transaction.description_clean) ?? normalizeLabel(transaction.description_raw);
  if (description) return description;

  return `Uncategorized ${fallbackCategory}`;
}

function isIncomeTransaction(transaction: Transaction): boolean {
  if (transaction.amount <= 0) return false;
  return transaction.cashflow_group === "Income" || transaction.cashflow_group === "Business";
}

function collapseDetailBreakdown(
  edgeMap: Map<string, number>,
  preferredDetail: string,
  topCount: number,
  otherLabel: string
): Map<string, number> {
  const detailTotals = new Map<string, number>();
  for (const [edgeKey, value] of edgeMap.entries()) {
    const [detail] = edgeKey.split("|||");
    detailTotals.set(detail, (detailTotals.get(detail) ?? 0) + value);
  }

  const orderedDetails = Array.from(detailTotals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([detail]) => detail);

  const topDetails = new Set(orderedDetails.slice(0, topCount));
  if (detailTotals.has(preferredDetail)) topDetails.add(preferredDetail);

  const collapsed = new Map<string, number>();
  for (const [edgeKey, value] of edgeMap.entries()) {
    const [detail, category] = edgeKey.split("|||");
    const retainedDetail = topDetails.has(detail) ? detail : otherLabel;
    const collapsedKey = `${retainedDetail}|||${category}`;
    collapsed.set(collapsedKey, (collapsed.get(collapsedKey) ?? 0) + value);
  }
  return collapsed;
}

export function createEmptyCashflowSankey(month: string): CashflowSankeyData {
  return {
    nodes: [],
    links: [],
    totals: { inflow: 0, outflow: 0, net: 0 },
    meta: { topIncomeCount: DEFAULT_TOP_INCOME_COUNT, month },
    projection: { expectedIncome: 0, expectedOutflow: 0, projectedNet: 0 },
  };
}

export function createEmptyCashflowSankeyVariants(month: string): CashflowSankeyVariants {
  return {
    source: createEmptyCashflowSankey(month),
    category: createEmptyCashflowSankey(month),
  };
}

export function buildCashflowSankeyData(params: {
  month: string;
  transactions: Transaction[];
  categoryNameById: Record<string, string>;
  topIncomeCount?: number;
  mode?: CashflowSankeyMode;
  projection?: {
    expectedIncome: number;
    expectedOutflow: number;
  };
}): CashflowSankeyData {
  const mode = params.mode ?? "source";
  const topIncomeCount = params.topIncomeCount ?? DEFAULT_TOP_INCOME_COUNT;
  const filteredTransactions = params.transactions.filter(
    (t) => t.status === "posted" && !t.is_transfer && !t.is_split_parent
  );

  const incomeDetailToCategory = new Map<string, number>();
  const outflowCategoryToDetail = new Map<string, number>();
  const incomeCategoryTotals = new Map<string, number>();
  const outflowCategoryTotals = new Map<string, number>();

  for (const transaction of filteredTransactions) {
    if (isIncomeTransaction(transaction)) {
      const category = getIncomeCategoryLabel(transaction, params.categoryNameById);
      const detail = getIncomeDetailLabel(transaction, params.categoryNameById);
      const key = `${detail}|||${category}`;
      incomeDetailToCategory.set(key, (incomeDetailToCategory.get(key) ?? 0) + transaction.amount);
      incomeCategoryTotals.set(category, (incomeCategoryTotals.get(category) ?? 0) + transaction.amount);
      continue;
    }

    const outflowCategory = getOutflowCategoryLabel(transaction, params.categoryNameById);
    if (!outflowCategory) continue;

    const absAmount = Math.abs(transaction.amount);
    const outflowDetail = getOutflowDetailLabel(transaction, outflowCategory);
    const key = `${outflowDetail}|||${outflowCategory}`;
    outflowCategoryToDetail.set(key, (outflowCategoryToDetail.get(key) ?? 0) + absAmount);
    outflowCategoryTotals.set(outflowCategory, (outflowCategoryTotals.get(outflowCategory) ?? 0) + absAmount);
  }

  const collapsedIncomeEdges = collapseDetailBreakdown(
    incomeDetailToCategory,
    "Uncategorized Income",
    topIncomeCount,
    "Other Income Items"
  );
  const collapsedOutflowEdges = collapseDetailBreakdown(
    outflowCategoryToDetail,
    "Uncategorized Outflow",
    topIncomeCount,
    "Other Outflow Items"
  );

  const totalInflow = roundCurrency(
    Array.from(incomeCategoryTotals.values()).reduce((sum, value) => sum + value, 0)
  );
  const totalOutflow = roundCurrency(
    Array.from(outflowCategoryTotals.values()).reduce((sum, value) => sum + value, 0)
  );
  const net = roundCurrency(totalInflow - totalOutflow);

  if (totalInflow <= EPSILON && totalOutflow <= EPSILON) {
    const empty = createEmptyCashflowSankey(params.month);
    if (params.projection) {
      empty.projection.expectedIncome = roundCurrency(Math.max(params.projection.expectedIncome, 0));
      empty.projection.expectedOutflow = roundCurrency(Math.max(params.projection.expectedOutflow, 0));
      empty.projection.projectedNet = roundCurrency(
        empty.projection.expectedIncome - empty.projection.expectedOutflow
      );
    }
    return empty;
  }

  if (mode === "category") {
    const nodes = new Map<string, CashflowSankeyNode>();
    const links = new Map<string, CashflowSankeyLink>();

    function upsertNode(id: string, label: string, kind: CashflowSankeyNodeKind, value: number, column: number) {
      const existing = nodes.get(id);
      if (existing) {
        existing.value = roundCurrency(existing.value + value);
        return;
      }
      nodes.set(id, { id, label, kind, value: roundCurrency(value), color: COLORS[kind], column });
    }

    function upsertLink(source: string, target: string, value: number, kind: CashflowSankeyLinkKind) {
      const key = `${source}->${target}`;
      const existing = links.get(key);
      if (existing) {
        existing.value = roundCurrency(existing.value + value);
        return;
      }
      links.set(key, { source, target, value: roundCurrency(value), kind });
    }

    for (const [category, amount] of incomeCategoryTotals.entries()) {
      const categoryId = `income_category_${toSlug(category)}`;
      upsertNode(categoryId, category, "income", amount, 0);
      upsertLink(categoryId, CASH_POOL_NODE_ID, amount, "income");
    }

    upsertNode(CASH_POOL_NODE_ID, "Cash Pool", "pool", Math.max(totalInflow, totalOutflow), 1);

    for (const [category, amount] of outflowCategoryTotals.entries()) {
      const categoryId = `outflow_category_${toSlug(category)}`;
      upsertNode(categoryId, category, "outflow", amount, 2);
      upsertLink(CASH_POOL_NODE_ID, categoryId, amount, "outflow");
    }

    if (net < -EPSILON) {
      upsertNode(PRIOR_CASH_NODE_ID, "Prior Cash/Credit", "balance", Math.abs(net), 0);
      upsertLink(PRIOR_CASH_NODE_ID, CASH_POOL_NODE_ID, Math.abs(net), "balance");
    }

    if (net > EPSILON) {
      upsertNode(NET_INCREASE_NODE_ID, "Net Increase", "balance", net, 2);
      upsertLink(CASH_POOL_NODE_ID, NET_INCREASE_NODE_ID, net, "balance");
    }

    const nodeList = Array.from(nodes.values()).sort(
      (a, b) => a.column - b.column || b.value - a.value || a.label.localeCompare(b.label)
    );
    const nodeIndex = new Map(nodeList.map((node, index) => [node.id, index]));
    const linkList = Array.from(links.values()).sort((a, b) => {
      const sourceCompare = (nodeIndex.get(a.source) ?? 0) - (nodeIndex.get(b.source) ?? 0);
      if (sourceCompare !== 0) return sourceCompare;
      const targetCompare = (nodeIndex.get(a.target) ?? 0) - (nodeIndex.get(b.target) ?? 0);
      if (targetCompare !== 0) return targetCompare;
      return b.value - a.value;
    });

    const expectedIncome = roundCurrency(Math.max(params.projection?.expectedIncome ?? 0, 0));
    const expectedOutflow = roundCurrency(Math.max(params.projection?.expectedOutflow ?? 0, 0));
    const expectedOutflowRemaining = roundCurrency(Math.max(expectedOutflow - totalOutflow, 0));

    return {
      nodes: nodeList,
      links: linkList,
      totals: { inflow: totalInflow, outflow: totalOutflow, net },
      meta: { topIncomeCount, month: params.month },
      projection: {
        expectedIncome,
        expectedOutflow,
        projectedNet: roundCurrency(net + expectedIncome - expectedOutflowRemaining),
      },
    };
  }

  const nodes = new Map<string, CashflowSankeyNode>();
  const links = new Map<string, CashflowSankeyLink>();

  function upsertNode(
    id: string,
    label: string,
    kind: CashflowSankeyNodeKind,
    value: number,
    column: number
  ) {
    const existing = nodes.get(id);
    if (existing) {
      existing.value = roundCurrency(existing.value + value);
      return;
    }
    nodes.set(id, { id, label, kind, value: roundCurrency(value), color: COLORS[kind], column });
  }

  function upsertLink(source: string, target: string, value: number, kind: CashflowSankeyLinkKind) {
    const key = `${source}->${target}`;
    const existing = links.get(key);
    if (existing) {
      existing.value = roundCurrency(existing.value + value);
      return;
    }
    links.set(key, { source, target, value: roundCurrency(value), kind });
  }

  for (const [edgeKey, amount] of collapsedIncomeEdges.entries()) {
    const [detail, category] = edgeKey.split("|||");
    const detailId = `income_detail_${toSlug(detail)}`;
    const categoryId = `income_category_${toSlug(category)}`;
    upsertNode(detailId, detail, "income", amount, 0);
    upsertNode(categoryId, category, "income", amount, 1);
    upsertLink(detailId, categoryId, amount, "income");
    upsertLink(categoryId, CASH_POOL_NODE_ID, amount, "income");
  }

  upsertNode(CASH_POOL_NODE_ID, "Cash Pool", "pool", Math.max(totalInflow, totalOutflow), 2);

  for (const [category, amount] of outflowCategoryTotals.entries()) {
    const categoryId = `outflow_category_${toSlug(category)}`;
    upsertNode(categoryId, category, "outflow", amount, 3);
    upsertLink(CASH_POOL_NODE_ID, categoryId, amount, "outflow");
  }

  for (const [edgeKey, amount] of collapsedOutflowEdges.entries()) {
    const [detail, category] = edgeKey.split("|||");
    const categoryId = `outflow_category_${toSlug(category)}`;
    const detailId = `outflow_detail_${toSlug(detail)}`;
    upsertNode(detailId, detail, "outflow", amount, 4);
    upsertLink(categoryId, detailId, amount, "outflow");
  }

  if (net < -EPSILON) {
    upsertNode(PRIOR_CASH_NODE_ID, "Prior Cash/Credit", "balance", Math.abs(net), 1);
    upsertLink(PRIOR_CASH_NODE_ID, CASH_POOL_NODE_ID, Math.abs(net), "balance");
  }

  if (net > EPSILON) {
    upsertNode(NET_INCREASE_NODE_ID, "Net Increase", "balance", net, 3);
    upsertLink(CASH_POOL_NODE_ID, NET_INCREASE_NODE_ID, net, "balance");
  }

  const nodeList = Array.from(nodes.values()).sort(
    (a, b) => a.column - b.column || b.value - a.value || a.label.localeCompare(b.label)
  );
  const nodeIndex = new Map(nodeList.map((node, index) => [node.id, index]));
  const linkList = Array.from(links.values()).sort((a, b) => {
    const sourceCompare = (nodeIndex.get(a.source) ?? 0) - (nodeIndex.get(b.source) ?? 0);
    if (sourceCompare !== 0) return sourceCompare;
    const targetCompare = (nodeIndex.get(a.target) ?? 0) - (nodeIndex.get(b.target) ?? 0);
    if (targetCompare !== 0) return targetCompare;
    return b.value - a.value;
  });

  const expectedIncome = roundCurrency(Math.max(params.projection?.expectedIncome ?? 0, 0));
  const expectedOutflow = roundCurrency(Math.max(params.projection?.expectedOutflow ?? 0, 0));
  const expectedOutflowRemaining = roundCurrency(Math.max(expectedOutflow - totalOutflow, 0));

  return {
    nodes: nodeList,
    links: linkList,
    totals: { inflow: totalInflow, outflow: totalOutflow, net },
    meta: { topIncomeCount, month: params.month },
    projection: {
      expectedIncome,
      expectedOutflow,
      projectedNet: roundCurrency(net + expectedIncome - expectedOutflowRemaining),
    },
  };
}
