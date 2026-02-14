import { describe, expect, it } from "vitest";
import {
  buildIntakeStoragePath,
  parseRequestedSourceType,
  resolveIntakeUploadSourceType,
  sanitizeFilename,
  validateUploadFile,
} from "@/lib/intake/upload";

describe("intake upload helpers", () => {
  it("sanitizes filenames for storage paths", () => {
    expect(sanitizeFilename("  Costco Receipt (Jan).JPG  ")).toBe("costco-receipt-jan-.jpg");
  });

  it("parses source type only for supported values", () => {
    expect(parseRequestedSourceType("csv")).toBe("csv");
    expect(parseRequestedSourceType("upload")).toBe("upload");
    expect(parseRequestedSourceType("amazon_extension")).toBeNull();
    expect(parseRequestedSourceType(null)).toBeNull();
  });

  it("infers csv source by mime type", () => {
    expect(
      resolveIntakeUploadSourceType({
        requestedSourceType: null,
        filename: "statement.data",
        mimeType: "text/csv",
      })
    ).toBe("csv");
  });

  it("rejects explicit csv source for non-csv files", () => {
    expect(() =>
      resolveIntakeUploadSourceType({
        requestedSourceType: "csv",
        filename: "receipt.jpg",
        mimeType: "image/jpeg",
      })
    ).toThrow("File does not look like a CSV document");
  });

  it("rejects unsupported file types when source is inferred", () => {
    expect(() =>
      resolveIntakeUploadSourceType({
        requestedSourceType: null,
        filename: "notes.txt",
        mimeType: "text/plain",
      })
    ).toThrow("Unsupported file type");
  });

  it("treats heic files as receipt uploads", () => {
    expect(
      resolveIntakeUploadSourceType({
        requestedSourceType: null,
        filename: "IMG_0001.HEIC",
        mimeType: "application/octet-stream",
      })
    ).toBe("upload");
  });

  it("builds stable storage paths when id and timestamp are provided", () => {
    const path = buildIntakeStoragePath({
      sourceType: "upload",
      filename: "Receipt.PDF",
      receivedAtIso: "2026-02-08T12:34:56.000Z",
      artifactId: "artifact-id",
    });

    expect(path).toBe("upload/2026/02/08/artifact-id-receipt.pdf");
  });

  it("validates file size constraints", () => {
    const validFile = new File(["row"], "statement.csv", { type: "text/csv" });
    expect(() => validateUploadFile(validFile)).not.toThrow();

    const empty = new File([], "empty.csv", { type: "text/csv" });
    expect(() => validateUploadFile(empty)).toThrow("Uploaded file is empty");
  });
});
