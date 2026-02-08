import { describe, expect, it } from "vitest";
import { extractBearerToken, hashIngestToken, isValidInstallId } from "@/lib/intake/sourceTokens";

describe("sourceTokens utilities", () => {
  it("hashes deterministically", () => {
    expect(hashIngestToken("amz_token_123")).toBe(hashIngestToken("amz_token_123"));
    expect(hashIngestToken("amz_token_123")).not.toBe(hashIngestToken("amz_token_456"));
  });

  it("validates install ids", () => {
    expect(isValidInstallId("chrome-install_ABC-123")).toBe(true);
    expect(isValidInstallId("short")).toBe(false);
    expect(isValidInstallId("contains space value")).toBe(false);
  });

  it("extracts bearer tokens", () => {
    expect(extractBearerToken("Bearer token-value")).toBe("token-value");
    expect(extractBearerToken("bearer token-value")).toBe("token-value");
    expect(extractBearerToken("Token token-value")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });
});
