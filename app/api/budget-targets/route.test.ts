import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "http";
import { NextRequest } from "next/server";

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
};

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

// Import the route handler after mocking
import { GET, POST, DELETE } from "./route";

describe("/api/budget-targets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      mockSupabase.select.mockResolvedValue({
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
      expect(data).toEqual({ error: "Month parameter is required" });
    });

    it("handles database errors", async () => {
      mockSupabase.select.mockResolvedValue({
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

      mockSupabase.upsert.mockResolvedValue({
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
      expect(data.error).toContain("Amount must be a number");
    });

    it("handles database errors on create", async () => {
      mockSupabase.upsert.mockResolvedValue({
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
      expect(data).toEqual({ error: "Failed to create/update budget target" });
    });
  });

  describe("DELETE", () => {
    it("deletes a budget target", async () => {
      mockSupabase.delete.mockResolvedValue({
        error: null,
      });

      const request = new NextRequest("http://localhost:3000/api/budget-targets?id=target-1", {
        method: "DELETE",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "target-1");
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
      mockSupabase.delete.mockResolvedValue({
        error: { message: "Database error" },
      });

      const request = new NextRequest("http://localhost:3000/api/budget-targets?id=target-1", {
        method: "DELETE",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to delete budget target" });
    });
  });
});
