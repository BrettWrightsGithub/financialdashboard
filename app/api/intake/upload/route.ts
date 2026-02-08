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

interface FileLike {
  name: string;
  size: number;
  type: string;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  text?: () => Promise<string>;
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
    const mimeType = fileField.type || "application/octet-stream";
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
    };

    const { error: artifactError } = await supabase.from("intake_artifacts").insert({
      id: artifactId,
      source_type: sourceType,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: fileField.size,
      status: "received",
      raw_payload_json: rawPayloadJson,
      received_at: receivedAt,
      updated_at: receivedAt,
    });

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

    return NextResponse.json(
      {
        success: true,
        artifact: {
          id: artifactId,
          source_type: sourceType,
          status: "received",
          storage_path: storagePath,
          mime_type: mimeType,
          size_bytes: fileField.size,
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
