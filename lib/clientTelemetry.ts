const SESSION_STORAGE_KEY = "app_telemetry_session_id";

function ensureSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const created =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

export async function trackClientEvent(
  eventName: string,
  options?: {
    pagePath?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (typeof window === "undefined") return;

  const payload = {
    event_name: eventName,
    session_id: ensureSessionId(),
    page_path: options?.pagePath || window.location.pathname,
    metadata: options?.metadata || {},
  };

  try {
    await fetch("/api/telemetry/client-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best effort only.
  }
}
