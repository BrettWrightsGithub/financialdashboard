import React from "react";
import { render, screen } from "@testing-library/react";
import { CashflowSankeyCard } from "./CashflowSankeyCard";
import type { CashflowSankeyData, CashflowSankeyVariants } from "@/lib/cashflowSankey";

describe("CashflowSankeyCard", () => {
  it("renders empty state when there are no flows", () => {
    const emptyData: CashflowSankeyData = {
      nodes: [],
      links: [],
      totals: { inflow: 0, outflow: 0, net: 0 },
      meta: { topIncomeCount: 5, month: "2026-01" },
      projection: { expectedIncome: 0, expectedOutflow: 0, projectedNet: 0 },
    };
    const variants: CashflowSankeyVariants = { source: emptyData, category: emptyData };

    render(<CashflowSankeyCard month="2026-01" data={variants} />);

    expect(screen.getByText("Cashflow Flow Map")).toBeInTheDocument();
    expect(screen.getByText("No qualifying cashflow transactions for this month.")).toBeInTheDocument();
  });

  it("renders sankey labels and legend", () => {
    const sourceData: CashflowSankeyData = {
      nodes: [
        { id: "income_salary", label: "Salary", kind: "income", value: 5000, color: "#16a34a", column: 0 },
        { id: "income_category_salary", label: "Salary", kind: "income", value: 5000, color: "#16a34a", column: 1 },
        { id: "cash_pool", label: "Cash Pool", kind: "pool", value: 5000, color: "#64748b", column: 2 },
        { id: "outflow_category_fixed", label: "Fixed", kind: "outflow", value: 2000, color: "#0ea5e9", column: 3 },
        { id: "outflow_fixed", label: "Rent", kind: "outflow", value: 2000, color: "#0ea5e9", column: 4 },
        { id: "balance_net_increase", label: "Net Increase", kind: "balance", value: 3000, color: "#f59e0b", column: 3 },
      ],
      links: [
        { source: "income_salary", target: "income_category_salary", value: 5000, kind: "income" },
        { source: "income_category_salary", target: "cash_pool", value: 5000, kind: "income" },
        { source: "cash_pool", target: "outflow_category_fixed", value: 2000, kind: "outflow" },
        { source: "outflow_category_fixed", target: "outflow_fixed", value: 2000, kind: "outflow" },
        { source: "cash_pool", target: "balance_net_increase", value: 3000, kind: "balance" },
      ],
      totals: { inflow: 5000, outflow: 2000, net: 3000 },
      meta: { topIncomeCount: 5, month: "2026-01" },
      projection: { expectedIncome: 2500, expectedOutflow: 4200, projectedNet: 3300 },
    };
    const categoryData: CashflowSankeyData = {
      nodes: [
        { id: "income_cat_salary", label: "Salary", kind: "income", value: 5000, color: "#16a34a", column: 0 },
        { id: "cash_pool", label: "Cash Pool", kind: "pool", value: 5000, color: "#64748b", column: 1 },
        { id: "outflow_cat_fixed", label: "Fixed", kind: "outflow", value: 2000, color: "#0ea5e9", column: 2 },
      ],
      links: [
        { source: "income_cat_salary", target: "cash_pool", value: 5000, kind: "income" },
        { source: "cash_pool", target: "outflow_cat_fixed", value: 2000, kind: "outflow" },
      ],
      totals: { inflow: 5000, outflow: 2000, net: 3000 },
      meta: { topIncomeCount: 5, month: "2026-01" },
      projection: { expectedIncome: 2000, expectedOutflow: 3000, projectedNet: 4000 },
    };
    const variants: CashflowSankeyVariants = { source: sourceData, category: categoryData };

    render(<CashflowSankeyCard month="2026-01" data={variants} />);

    expect(screen.getByText("Cashflow Flow Map")).toBeInTheDocument();
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Outflow")).toBeInTheDocument();
    expect(screen.getByText("Balancing")).toBeInTheDocument();
    expect(screen.getByText("Source View")).toBeInTheDocument();
    expect(screen.getByText("Category View")).toBeInTheDocument();
    expect(screen.getByText(/Expected Income/)).toBeInTheDocument();
    expect(screen.getByText(/Expected Outflow/)).toBeInTheDocument();
    expect(screen.getByLabelText("Cashflow Sankey diagram")).toBeInTheDocument();
  });
});
