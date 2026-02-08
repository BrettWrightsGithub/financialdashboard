import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReviewQueue } from "./ReviewQueue";
import type { Category, TransactionWithDetails } from "@/types/database";
import type { GlobalFilterState } from "./GlobalFilters";

function makeTransaction(overrides: Partial<TransactionWithDetails>): TransactionWithDetails {
  const id = overrides.id || "tx-default";
  return {
    id,
    provider: "plaid",
    provider_transaction_id: `prov-${id}`,
    account_id: "acct-1",
    provider_account_id: "prov-acct-1",
    date: "2026-01-10",
    amount: -10,
    description_raw: "Sample transaction",
    description_clean: "Sample transaction",
    life_category_id: null,
    cashflow_group: "Income",
    flow_type: "Income",
    category_ai: null,
    category_ai_conf: null,
    category_locked: false,
    status: "posted",
    provider_type: null,
    processing_status: null,
    counterparty_name: null,
    counterparty_id: null,
    is_transfer: false,
    transfer_pair_id: null,
    transfer_match_confidence: null,
    transfer_match_source: null,
    is_pass_through: false,
    is_business: false,
    category_source: null,
    parent_transaction_id: null,
    is_split_child: false,
    is_split_parent: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    account_name: "Primary Checking",
    institution_name: "Test Bank",
    category_name: "Uncategorized",
    category_confidence: 0.5,
    ...overrides,
  };
}

function makeFilters(overrides: Partial<GlobalFilterState> = {}): GlobalFilterState {
  return {
    dateRange: { start: "2026-01-01", end: "2026-01-31" },
    accountId: null,
    cashflowGroup: null,
    hideTransfers: false,
    hidePassThrough: false,
    searchQuery: "",
    ...overrides,
  };
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

describe("ReviewQueue", () => {
  const categories: Category[] = [
    {
      id: "cat-rent",
      name: "Rental Income",
      cashflow_group: "Income",
      description: null,
      color: null,
      icon: null,
      sort_order: 1,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-food",
      name: "Food",
      cashflow_group: "Variable Essentials",
      description: null,
      color: null,
      icon: null,
      sort_order: 2,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function renderQueue({
    filters = makeFilters(),
    queueTransactions,
  }: {
    filters?: GlobalFilterState;
    queueTransactions: TransactionWithDetails[];
  }) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/review-queue")) {
        return jsonResponse({ transactions: queueTransactions });
      }
      if (url === "/api/transactions/bulk-edit") {
        return jsonResponse({ success: true, init });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    function Harness({ nextFilters }: { nextFilters: GlobalFilterState }) {
      const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
      return (
        <ReviewQueue
          filters={nextFilters}
          categories={categories}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onSelectTransaction={() => {}}
        />
      );
    }

    const view = render(<Harness nextFilters={filters} />);
    return { ...view, fetchMock, Harness };
  }

  it("shows top 10 by default and toggles show more/show top 10", async () => {
    const queueTransactions = Array.from({ length: 12 }).map((_, index) =>
      makeTransaction({
        id: `tx-${index + 1}`,
        description_raw: `Transaction ${index + 1}`,
        description_clean: `Transaction ${index + 1}`,
      })
    );

    renderQueue({ queueTransactions });

    await screen.findByText("Transaction 1");
    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Show More" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show More" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Show Top 10" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show Top 10" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
  });

  it("applies full filters and sorts by confidence asc then date desc", async () => {
    const queueTransactions = [
      makeTransaction({
        id: "tx-low",
        description_raw: "Low confidence rent older",
        description_clean: "Low confidence rent older",
        date: "2026-01-05",
        account_id: "acct-1",
        cashflow_group: "Income",
        category_confidence: 0.1,
      }),
      makeTransaction({
        id: "tx-tie-new",
        description_raw: "Tie confidence rent newer",
        description_clean: "Tie confidence rent newer",
        date: "2026-01-20",
        account_id: "acct-1",
        cashflow_group: "Income",
        category_confidence: 0.2,
      }),
      makeTransaction({
        id: "tx-tie-old",
        description_raw: "Tie confidence rent older",
        description_clean: "Tie confidence rent older",
        date: "2026-01-10",
        account_id: "acct-1",
        cashflow_group: "Income",
        category_confidence: 0.2,
      }),
      makeTransaction({
        id: "tx-out-transfer",
        description_raw: "Rent but transfer",
        description_clean: "Rent but transfer",
        is_transfer: true,
        category_confidence: 0.05,
      }),
      makeTransaction({
        id: "tx-out-account",
        description_raw: "Rent but other account",
        description_clean: "Rent but other account",
        account_id: "acct-2",
        category_confidence: 0.05,
      }),
      makeTransaction({
        id: "tx-out-group",
        description_raw: "Rent but other group",
        description_clean: "Rent but other group",
        cashflow_group: "Business",
        category_confidence: 0.05,
      }),
      makeTransaction({
        id: "tx-out-search",
        description_raw: "Coffee only",
        description_clean: "Coffee only",
        category_confidence: 0.05,
      }),
      makeTransaction({
        id: "tx-out-date",
        description_raw: "Rent outside date",
        description_clean: "Rent outside date",
        date: "2025-12-15",
        category_confidence: 0.05,
      }),
    ];

    renderQueue({
      filters: makeFilters({
        accountId: "acct-1",
        cashflowGroup: "Income",
        hideTransfers: true,
        hidePassThrough: true,
        searchQuery: "rent",
      }),
      queueTransactions,
    });

    await screen.findByText("Low confidence rent older");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);

    const rows = screen
      .getAllByRole("checkbox")
      .map((checkbox) => checkbox.closest("div.border"))
      .filter(Boolean) as HTMLElement[];
    expect(rows[0]).toHaveTextContent("Low confidence rent older");
    expect(rows[1]).toHaveTextContent("Tie confidence rent newer");
    expect(rows[2]).toHaveTextContent("Tie confidence rent older");

    expect(screen.queryByText("Rent but transfer")).not.toBeInTheDocument();
    expect(screen.queryByText("Rent but other account")).not.toBeInTheDocument();
    expect(screen.queryByText("Rent but other group")).not.toBeInTheDocument();
    expect(screen.queryByText("Coffee only")).not.toBeInTheDocument();
    expect(screen.queryByText("Rent outside date")).not.toBeInTheDocument();
  });

  it("uses header confirm flow, marks rows saved, and resets selection", async () => {
    const queueTransactions = [
      makeTransaction({
        id: "tx-rent",
        description_raw: "Venmo rent payment",
        description_clean: "Venmo rent payment",
        category_ai: "rental_income",
        category_confidence: 0.12,
      }),
    ];

    const { fetchMock } = renderQueue({ queueTransactions });

    await screen.findByText("Venmo rent payment");
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    const selectedRow = checkbox.closest("div.border");
    expect(selectedRow).toHaveClass("border-blue-500");

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("cat-rent");
    });
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm Selected" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/transactions/bulk-edit",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "assign_category",
            transaction_ids: ["tx-rent"],
            category_id: "cat-rent",
            learn_payee: true,
          }),
        })
      );
    });

    expect(screen.getByText("0 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show Processed (1)" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("resets visible window back to top 10 when filters change", async () => {
    const queueTransactions = Array.from({ length: 12 }).map((_, index) =>
      makeTransaction({
        id: `tx-window-${index + 1}`,
        description_raw: `Window item ${index + 1}`,
        description_clean: `Window item ${index + 1}`,
      })
    );

    const { Harness, rerender } = renderQueue({ queueTransactions });
    await screen.findByText("Window item 1");
    fireEvent.click(screen.getByRole("button", { name: "Show More" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);

    rerender(<Harness nextFilters={makeFilters({ searchQuery: "window" })} />);
    await waitFor(() => {
      expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    });
    expect(screen.getByRole("button", { name: "Show More" })).toBeInTheDocument();
  });
});
