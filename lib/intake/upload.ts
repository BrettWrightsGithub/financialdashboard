import { randomUUID } from "crypto";

export const INTAKE_UPLOAD_SOURCE_TYPES = ["upload", "csv"] as const;
export type IntakeUploadSourceType = (typeof INTAKE_UPLOAD_SOURCE_TYPES)[number];

export const MAX_INTAKE_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const DEFAULT_INTAKE_STORAGE_BUCKET = "intake-artifacts";

export interface IntakeUploadFileLike {
  size: number;
}

const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]);
const RECEIPT_MIME_TYPES = new Set(["application/pdf"]);

export function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^[-_.]+|[-_.]+$)/g, "");

  if (!cleaned) {
    return "upload";
  }

  return cleaned.slice(0, 120);
}

function looksLikeCsv(filename: string, mimeType: string): boolean {
  if (CSV_MIME_TYPES.has(mimeType.toLowerCase())) {
    return true;
  }

  return filename.toLowerCase().endsWith(".csv");
}

function looksLikeReceipt(filename: string, mimeType: string): boolean {
  if (mimeType.toLowerCase().startsWith("image/")) {
    return true;
  }

  if (RECEIPT_MIME_TYPES.has(mimeType.toLowerCase())) {
    return true;
  }

  const lowered = filename.toLowerCase();
  return lowered.endsWith(".pdf") || lowered.endsWith(".jpg") || lowered.endsWith(".jpeg") || lowered.endsWith(".png");
}

export function parseRequestedSourceType(value: FormDataEntryValue | null): IntakeUploadSourceType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "upload" || normalized === "csv") {
    return normalized;
  }

  return null;
}

export function resolveIntakeUploadSourceType(params: {
  requestedSourceType: IntakeUploadSourceType | null;
  filename: string;
  mimeType: string;
}): IntakeUploadSourceType {
  const csvLike = looksLikeCsv(params.filename, params.mimeType);
  const receiptLike = looksLikeReceipt(params.filename, params.mimeType);

  if (!params.requestedSourceType) {
    if (csvLike) {
      return "csv";
    }
    if (receiptLike) {
      return "upload";
    }
    throw new Error("Unsupported file type. Use CSV, image, or PDF.");
  }

  if (params.requestedSourceType === "csv" && !csvLike) {
    throw new Error("File does not look like a CSV document");
  }

  if (params.requestedSourceType === "upload" && !receiptLike) {
    throw new Error("File must be an image or PDF when source_type is upload");
  }

  return params.requestedSourceType;
}

export function validateUploadFile(file: IntakeUploadFileLike): void {
  if (!file || file.size <= 0) {
    throw new Error("Uploaded file is empty");
  }

  if (file.size > MAX_INTAKE_FILE_BYTES) {
    throw new Error(`File exceeds max size of ${Math.round(MAX_INTAKE_FILE_BYTES / (1024 * 1024))} MB`);
  }
}

export function buildIntakeStoragePath(params: {
  sourceType: IntakeUploadSourceType;
  filename: string;
  receivedAtIso?: string;
  artifactId?: string;
}): string {
  const received = params.receivedAtIso ? new Date(params.receivedAtIso) : new Date();
  const year = String(received.getUTCFullYear());
  const month = String(received.getUTCMonth() + 1).padStart(2, "0");
  const day = String(received.getUTCDate()).padStart(2, "0");
  const id = params.artifactId || randomUUID();
  const safeName = sanitizeFilename(params.filename);
  return `${params.sourceType}/${year}/${month}/${day}/${id}-${safeName}`;
}
