import crypto from "crypto";

const AMAZON_SOURCE_TYPE = "amazon_extension" as const;
const TOKEN_PREFIX = "amz";
const TOKEN_TTL_DAYS = 30;

type SupabaseLike = {
  from: (table: string) => any;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function hashIngestToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isValidInstallId(installId: string): boolean {
  return /^[a-zA-Z0-9._-]{8,128}$/.test(installId);
}

function generateRawToken(): string {
  return `${TOKEN_PREFIX}_${crypto.randomBytes(24).toString("hex")}`;
}

export interface IssueAmazonTokenResult {
  token: string;
  token_prefix: string;
  source_type: typeof AMAZON_SOURCE_TYPE;
  install_id: string;
  expires_at: string;
}

export interface VerifyAmazonTokenResult {
  valid: boolean;
  reason?: string;
  source_type?: typeof AMAZON_SOURCE_TYPE;
  install_id?: string;
  token_id?: string;
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, value] = authorizationHeader.split(" ");
  if (!scheme || !value || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return value.trim();
}

export async function issueAmazonIngestToken(
  supabase: SupabaseLike,
  installId: string
): Promise<IssueAmazonTokenResult> {
  if (!isValidInstallId(installId)) {
    throw new Error("install_id must be 8-128 chars and contain only letters, numbers, dot, underscore, or hyphen");
  }

  const token = generateRawToken();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: revokeError } = await supabase
    .from("intake_source_tokens")
    .update({
      status: "revoked",
      revoked_at: now,
      updated_at: now,
    })
    .eq("source_type", AMAZON_SOURCE_TYPE)
    .eq("install_id", installId)
    .eq("status", "active")
    .is("revoked_at", null);

  if (revokeError) {
    throw new Error(`Failed to revoke prior token: ${revokeError.message}`);
  }

  const tokenPrefix = token.slice(0, 12);
  const tokenHash = hashIngestToken(token);

  const { error: insertError } = await supabase.from("intake_source_tokens").insert({
    source_type: AMAZON_SOURCE_TYPE,
    install_id: installId,
    token_hash: tokenHash,
    token_prefix: tokenPrefix,
    status: "active",
    scopes: ["amazon:ingest"],
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  });

  if (insertError) {
    throw new Error(`Failed to issue token: ${insertError.message}`);
  }

  return {
    token,
    token_prefix: tokenPrefix,
    source_type: AMAZON_SOURCE_TYPE,
    install_id: installId,
    expires_at: expiresAt,
  };
}

export async function verifyAmazonIngestToken(
  supabase: SupabaseLike,
  token: string | null
): Promise<VerifyAmazonTokenResult> {
  if (!token) {
    return { valid: false, reason: "Missing bearer token" };
  }

  const { data, error } = await supabase
    .from("intake_source_tokens")
    .select("id, source_type, install_id, status, expires_at, revoked_at")
    .eq("source_type", AMAZON_SOURCE_TYPE)
    .eq("token_hash", hashIngestToken(token))
    .maybeSingle();

  if (error) {
    return { valid: false, reason: `Token lookup failed: ${error.message}` };
  }

  if (!data) {
    return { valid: false, reason: "Token not found" };
  }

  if (data.status !== "active" || data.revoked_at) {
    return { valid: false, reason: "Token is revoked" };
  }

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "Token is expired" };
  }

  const now = nowIso();
  await supabase
    .from("intake_source_tokens")
    .update({
      last_used_at: now,
      updated_at: now,
    })
    .eq("id", data.id);

  return {
    valid: true,
    token_id: data.id,
    source_type: AMAZON_SOURCE_TYPE,
    install_id: data.install_id,
  };
}
