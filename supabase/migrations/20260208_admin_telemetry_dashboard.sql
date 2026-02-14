-- ============================================================
-- MIGRATION: Admin Telemetry Dashboard Foundation
-- ============================================================
--
-- FILE: 20260208_admin_telemetry_dashboard.sql
-- PURPOSE:
--   Adds application telemetry storage for admin analytics:
--   - API call metrics
--   - Assistant token usage
--   - Client behavior events
--
-- ============================================================

CREATE TABLE IF NOT EXISTS app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('api_call', 'assistant_call', 'client_behavior')),
  event_name TEXT NOT NULL,
  route TEXT,
  http_method TEXT,
  http_status INTEGER,
  latency_ms INTEGER,
  provider TEXT,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  session_id TEXT,
  page_path TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_events_created_at
  ON app_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_events_type_created
  ON app_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_events_route_created
  ON app_events(route, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_events_page_path_created
  ON app_events(page_path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_events_session_created
  ON app_events(session_id, created_at DESC);

COMMENT ON TABLE app_events IS 'Telemetry events for admin analytics: API calls, assistant usage, and client behavior.';
