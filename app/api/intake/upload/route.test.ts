import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockCreateServerSupabaseClient,
  mockFrom,
  mockInsert,
  mockUpdate,
  mockEq,
  mockStorageFrom,
  mockUpload,
} = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockEq = vi.fn();
  const mockUpdate = vi.fn(() => ({ eq: mockEq }));

  const mockFrom = vi.fn(() => ({
    insert: mockInsert,
    update: mockUpdate,
  }));

  const mockUpload = vi.fn();
  const mockStorageFrom = vi.fn(() => ({
    upload: mockUpload,
  }));

  const mockCreateServerSupabaseClient = vi.fn(() => ({
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  }));

  return {
    mockCreateServerSupabaseClient,
    mockFrom,
    mockInsert,
    mockUpdate,
    mockEq,
    mockStorageFrom,
    mockUpload,
  };
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: mockCreateServerSupabaseClient,
}));

import { POST } from "./route";

function makeFileLike(content: string, name: string, type: string) {
  return {
    name,
    type,
    size: content.length,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
    text: async () => content,
  };
}

function makeFormData(entries: Record<string, unknown>) {
  return {
    get: (key: string) => (key in entries ? (entries[key] as FormDataEntryValue) : null),
  };
}

describe("/api/intake/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null } as any);
    mockUpload.mockResolvedValue({ error: null } as any);
    mockEq.mockResolvedValue({ error: null } as any);
  });

  it("creates an intake artifact and uploads csv files", async () => {
    const formData = makeFormData({
      file: makeFileLike("date,description,amount", "statement.csv", "text/csv"),
      source_type: "csv",
    });

    const request = {
      formData: async () => formData,
    } as any;

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.artifact.source_type).toBe("csv");
    expect(body.artifact.status).toBe("received");
    expect(mockFrom).toHaveBeenCalledWith("intake_artifacts");
    expect(mockStorageFrom).toHaveBeenCalledWith("intake-artifacts");
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when source_type is invalid", async () => {
    const formData = makeFormData({
      file: makeFileLike("abc", "receipt.jpg", "image/jpeg"),
      source_type: "amazon_extension",
    });

    const request = {
      formData: async () => formData,
    } as any;

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("source_type must be either upload or csv");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 400 for unsupported file formats", async () => {
    const formData = makeFormData({
      file: makeFileLike("notes", "notes.txt", "text/plain"),
    });

    const request = {
      formData: async () => formData,
    } as any;

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Unsupported file type");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("marks artifact as error when storage upload fails", async () => {
    mockUpload.mockResolvedValueOnce({ error: { message: "bucket not found" } } as any);

    const formData = makeFormData({
      file: makeFileLike("file", "receipt.jpg", "image/jpeg"),
    });

    const request = {
      formData: async () => formData,
    } as any;

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("Failed to store uploaded file");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledWith("id", expect.any(String));
  });
});
