import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockSupabase } = vi.hoisted(() => {
  const mockSupabase: any = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
  };
  mockSupabase.from.mockImplementation(() => mockSupabase);
  mockSupabase.select.mockImplementation(() => mockSupabase);
  mockSupabase.eq.mockImplementation(() => mockSupabase);
  mockSupabase.order.mockImplementation(() => mockSupabase);
  mockSupabase.upsert.mockImplementation(() => mockSupabase);
  mockSupabase.delete.mockImplementation(() => mockSupabase);
  return { mockSupabase };
});

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

// Import the route handler after mocking
import { GET, POST, DELETE } from "./route";

describe("/api/budget-targets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockImplementation(() => mockSupabase);
    mockSupabase.select.mockImplementation(() => mockSupabase);
    mockSupabase.eq.mockImplementation(() => mockSupabase);
    mockSupabase.order.mockImplementation(() => mockSupabase);
    mockSupabase.upsert.mockImplementation(() => mockSupabase);
    mockSupabase.delete.mockImplementation(() => mockSupabase);
  });

  describe("GET", () => {
    it("returns budget targets for a valid month", async () => {
      const mockData = [
        {
          id: "1",
          category_id: "cat-1",
          month: "2025-01-01",
          amount: 1000,
          notes: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/budget-targets?month=2025-01");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ data: mockData });
      expect(mockSupabase.from).toHaveBeenCalledWith("budget_targets");
      expect(mockSupabase.eq).toHaveBeenCalledWith("month", "2025-01-01");
    });

    it("handles missing month parameter", async () => {
      const request = new NextRequest("http://localhost:3000/api/budget-targets");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Month parameter is required (format: YYYY-MM)" });
    });

    it("handles database errors", async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const request = new NextRequest("http://localhost:3000/api/budget-targets?month=2025-01");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to fetch budget targets" });
    });
  });

  describe("POST", () => {
    it("creates a new budget target", async () => {
      const mockData = {
        id: "1",
        category_id: "cat-1",
        month: "2025-01-01",
        amount: 1000,
        notes: "Test note",
        created_at: "2025-01-01T00:00:00Z",
      };

      mockSupabase.single.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const requestBody = {
        category_id: "cat-1",
        month: "2025-01",
        amount: 1000,
        notes: "Test note",
      };

      const request = new NextRequest("http://localhost:3000/api/budget-targets", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ data: mockData });
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        category_id: "cat-1",
        month: "2025-01-01",
        amount: 1000,
        notes: "Test note",
        updated_at: expect.any(String),
      }, {
        onConflict: "category_id,month",
      });
    });

    it("validates required fields", async () => {
      const requestBody = {
        category_id: "cat-1",
        // missing month and amount
      };

      const request = new NextRequest("http://localhost:3000/api/budget-targets", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("required");
    });

    it("validates amount is a number", async () => {
      const requestBody = {
        category_id: "cat-1",
        month: "2025-01",
        amount: "invalid",
      };

      const request = new NextRequest("http://localhost:3000/api/budget-targets", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Amount must be a valid number");
    });

    it("handles database errors on create", async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const requestBody = {
        category_id: "cat-1",
        month: "2025-01",
        amount: 1000,
      };

      const request = new NextRequest("http://localhost:3000/api/budget-targets", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to save budget target" });
    });
  });

  describe("DELETE", () => {
    it("deletes a budget target", async () => {
      mockSupabase.eq.mockResolvedValueOnce({
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/budget-targets?id=550e8400-e29b-41d4-a716-446655440000", {
        method: "DELETE",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "550e8400-e29b-41d4-a716-446655440000");
    });

    it("handles missing id parameter", async () => {
      const request = new NextRequest("http://localhost:3000/api/budget-targets", {
        method: "DELETE",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Budget target ID is required" });
    });

    it("handles database errors on delete", async () => {
      mockSupabase.eq.mockResolvedValueOnce({
        error: { message: "Database error" },
      });

      const request = new NextRequest("http://localhost:3000/api/budget-targets?id=550e8400-e29b-41d4-a716-446655440000", {
        method: "DELETE",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to delete budget target" });
    });
  });
});
