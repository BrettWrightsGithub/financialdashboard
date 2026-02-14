import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  buildIntakeStoragePath,
  DEFAULT_INTAKE_STORAGE_BUCKET,
  type IntakeUploadSourceType,
  parseRequestedSourceType,
  resolveIntakeUploadSourceType,
  validateUploadFile,
} from "@/lib/intake/upload";
import {
  extractAndPersistUploadReceipt,
  parseReceiptExtractionMode,
  resolveReceiptMimeType,
  type ReceiptExtractionMode,
} from "@/lib/intake/extraction/service";

interface FileLike {
  name: string;
  size: number;
  type: string;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  text?: () => Promise<string>;
}

function parseStringField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseUserScope(value: FormDataEntryValue | null): string {
  const normalized = parseStringField(value);
  if (!normalized) {
    return "anonymous";
  }
  return normalized.slice(0, 120);
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function enforceUploadRetention(params: {
  supabase: ReturnType<typeof createServerSupabaseClient>;
  bucketName: string;
  createdBy: string;
  keepLatest: number;
}): Promise<void> {
  if (params.keepLatest < 1) {
    return;
  }

  const { data: staleArtifacts, error: staleError } = await params.supabase
    .from("intake_artifacts")
    .select("id, storage_path")
    .eq("source_type", "upload")
    .eq("created_by", params.createdBy)
    .order("received_at", { ascending: false })
    .range(params.keepLatest, params.keepLatest + 200);

  if (staleError || !Array.isArray(staleArtifacts) || staleArtifacts.length === 0) {
    return;
  }

  const staleRows = staleArtifacts as Array<{ id: string; storage_path: string | null }>;
  const staleIds = staleRows.map((row) => row.id);
  const stalePaths = staleRows
    .map((row) => row.storage_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);

  if (stalePaths.length > 0) {
    await params.supabase.storage.from(params.bucketName).remove(stalePaths);
  }

  if (staleIds.length > 0) {
    await params.supabase.from("intake_artifacts").delete().in("id", staleIds);
  }
}

function isMissingCreatedByColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) {
    return false;
  }
  return (
    error.message.includes("created_by") &&
    (error.message.includes("schema cache") || error.message.includes("column"))
  );
}

function isFileLike(value: unknown): value is FileLike {
  if (!value || typeof value === "string") {
    return false;
  }

  const candidate = value as Partial<FileLike>;
  return typeof candidate.name === "string" && typeof candidate.size === "number" && typeof candidate.type === "string";
}

async function readFileBytes(file: FileLike): Promise<Uint8Array> {
  const maybeArrayBuffer = file.arrayBuffer;
  if (typeof maybeArrayBuffer === "function") {
    return new Uint8Array(await maybeArrayBuffer.call(file));
  }

  const maybeText = file.text;
  if (typeof maybeText === "function") {
    return new TextEncoder().encode(await maybeText.call(file));
  }

  throw new Error("Could not read uploaded file bytes");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileField = formData.get("file");

    if (!isFileLike(fileField)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    try {
      validateUploadFile(fileField);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid uploaded file";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const requestedSourceType = parseRequestedSourceType(formData.get("source_type"));
    if (formData.get("source_type") && !requestedSourceType) {
      return NextResponse.json({ error: "source_type must be either upload or csv" }, { status: 400 });
    }

    const filename = fileField.name || "upload";
    const mimeType = resolveReceiptMimeType(filename, fileField.type || "application/octet-stream");
    const createdBy = parseUserScope(formData.get("user_scope"));
    const requestedExtractionMode = parseReceiptExtractionMode(formData.get("extraction_mode"));
    const extractionMode: ReceiptExtractionMode =
      requestedExtractionMode || (process.env.INTAKE_RECEIPT_DEFAULT_MODE === "ocr" ? "ocr" : "google_model");
    const originalSizeBytes = parseOptionalNumber(formData.get("original_size_bytes"));
    let sourceType: IntakeUploadSourceType;
    try {
      sourceType = resolveIntakeUploadSourceType({
        requestedSourceType,
        filename,
        mimeType,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unsupported file type";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (sourceType === "upload" && formData.get("extraction_mode") && !requestedExtractionMode) {
      return NextResponse.json({ error: "extraction_mode must be either ocr or google_model" }, { status: 400 });
    }

    const receivedAt = new Date().toISOString();
    const artifactId = randomUUID();
    const storagePath = buildIntakeStoragePath({
      sourceType,
      filename,
      receivedAtIso: receivedAt,
      artifactId,
    });
    const bucketName = process.env.INTAKE_STORAGE_BUCKET || DEFAULT_INTAKE_STORAGE_BUCKET;

    const supabase = createServerSupabaseClient();
    const rawPayloadJson = {
      filename,
      mime_type: mimeType,
      upload_channel: "web_form",
      extraction_mode: sourceType === "upload" ? extractionMode : null,
      original_size_bytes: originalSizeBytes,
    };

    const artifactInsertBase = {
      id: artifactId,
      source_type: sourceType,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: fileField.size,
      status: "received",
      raw_payload_json: rawPayloadJson,
      received_at: receivedAt,
      updated_at: receivedAt,
    };

    let artifactError: { message: string; code?: string } | null = null;
    {
      const firstAttempt = await supabase.from("intake_artifacts").insert({
        ...artifactInsertBase,
        created_by: createdBy,
      });
      artifactError = (firstAttempt.error as { message: string; code?: string } | null) || null;

      // Backward-compatible fallback while migration is not yet applied.
      if (isMissingCreatedByColumnError(artifactError)) {
        const fallbackAttempt = await supabase.from("intake_artifacts").insert(artifactInsertBase);
        artifactError = (fallbackAttempt.error as { message: string; code?: string } | null) || null;
      }
    }

    if (artifactError) {
      return NextResponse.json({ error: artifactError.message }, { status: 500 });
    }

    let fileBytes: Uint8Array;
    try {
      fileBytes = await readFileBytes(fileField);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read uploaded file bytes";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: false,
    });

    if (uploadError) {
      const errorTime = new Date().toISOString();
      await supabase
        .from("intake_artifacts")
        .update({
          status: "error",
          error_message: uploadError.message,
          updated_at: errorTime,
        })
        .eq("id", artifactId);

      return NextResponse.json({ error: `Failed to store uploaded file: ${uploadError.message}` }, { status: 500 });
    }

    let artifactStatus: string = "received";
    let artifactErrorMessage: string | null = null;
    let artifactAiResponsePreview: string | null = null;
    let artifactAiProvider: string | null = null;
    let artifactAiModel: string | null = null;
    if (sourceType === "upload") {
      const extractionResult = await extractAndPersistUploadReceipt({
        supabase,
        artifactId,
        filename,
        mimeType,
        mode: extractionMode,
        fileBytes,
      });
      artifactStatus = extractionResult.status;
      artifactErrorMessage = extractionResult.error_message;
      artifactAiResponsePreview = extractionResult.ai_response_preview;
      artifactAiProvider = extractionResult.provider;
      artifactAiModel = extractionResult.model;
      console.info("[intake.receipt] upload_artifact_post_extraction", {
        artifact_id: artifactId,
        source_type: sourceType,
        extraction_mode: extractionMode,
        status: artifactStatus,
        error_message: artifactErrorMessage,
        ai_provider: artifactAiProvider,
        ai_model: artifactAiModel,
        ai_response_preview: artifactAiResponsePreview
          ? `${artifactAiResponsePreview.slice(0, 500)}${artifactAiResponsePreview.length > 500 ? "... [truncated]" : ""}`
          : null,
      });

      // Keep the latest 50 receipt uploads for this uploader scope.
      await enforceUploadRetention({
        supabase,
        bucketName,
        createdBy,
        keepLatest: 50,
      });
    }

    return NextResponse.json(
      {
        success: true,
        artifact: {
          id: artifactId,
          source_type: sourceType,
          status: artifactStatus,
          storage_path: storagePath,
          mime_type: mimeType,
          size_bytes: fileField.size,
          error_message: artifactErrorMessage,
          ai_provider: artifactAiProvider,
          ai_model: artifactAiModel,
          ai_response_preview: artifactAiResponsePreview,
          received_at: receivedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload intake artifact";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
