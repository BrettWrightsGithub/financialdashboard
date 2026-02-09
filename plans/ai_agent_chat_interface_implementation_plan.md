# AI Agent Chat Interface Implementation Plan

## Goal
Implement a production-ready AI Agent chat interface (panel + streaming + history + structured questions + tool-call visibility) based on the PRD, in this repository, without breaking existing assistant workflows.

## Who This Is For
This plan is written for an agent with limited prior context of the codebase.

## Context Acquisition Runbook (Do This First)
Use this exact sequence before coding so you have the minimum context needed.

1. Confirm current branch and workspace state.
- `git branch --show-current`
- `git status --short`
- Do not revert unrelated uncommitted files.

2. Read product context and existing assistant plans.
- `sed -n '1,220p' docs/backlog/ai_assistant_data_entry_expansion_plan.md`
- Read the PRD from the task prompt and keep it open while implementing.

3. Read current assistant UI/API implementation.
- `sed -n '1,320p' components/assistant/ChatAssistant.tsx`
- `sed -n '1,340p' app/api/assistant/chat/route.ts`
- `sed -n '1,260p' lib/assistant/provider.ts`
- `sed -n '1,300p' lib/assistant/types.ts`
- `sed -n '1,260p' components/mobile/AssistantDrawer.tsx`
- `sed -n '1,260p' components/layout/AppShell.tsx`

4. Inspect app-wide styling and dependencies.
- `sed -n '1,260p' app/globals.css`
- `cat package.json`

5. Inspect API conventions and testing style.
- `find app/api -maxdepth 3 -type f | sort`
- `find app/api -maxdepth 4 -type f | grep -E 'assistant|conversation|chat'`
- `find app/api -maxdepth 4 -type f | grep -E 'test.ts'`

6. Verify baseline tests before major edits.
- `npx vitest run app/api/assistant/chat/route.test.ts`

## Current State Summary
- Current assistant is a floating widget (`components/assistant/ChatAssistant.tsx`) with HTTP request/response (`/api/assistant/chat`).
- No WebSocket chat protocol currently implemented.
- No first-class conversation history model or API for assistant sessions.
- Debug traces exist but are per-surface and not yet unified with a dedicated chat architecture.

## Non-Goals
- Do not remove existing assistant entry points until v2 interface is validated.
- Do not mix this work with unrelated intake/extension changes.
- Do not require immediate migration of all pages in phase 1.

## Architecture Decisions To Make Early
Complete these decisions before large implementation.

1. Transport decision: WebSocket in Next.js route vs dedicated WS server/process.
- If using Next route handlers, confirm deployment/runtime supports persistent upgrades.
- If not reliable, create a dedicated WS service and proxy from app.

2. Persistence model decision.
- Start with DB-backed conversation + message tables.
- Keep payload schema flexible for tool events and structured question metadata.

3. Rollout strategy.
- Keep existing `ChatAssistant` as fallback while adding `AssistantPanel` v2 behind a feature flag.

## Implementation Phases

## Phase 0: Foundation + Feature Flag
Deliverables:
- Feature flag for v2 assistant panel.
- New folder structure for v2 components and hooks.

Target files:
- `lib/featureFlags.ts` (new)
- `components/assistant/v2/*` (new directory)
- `hooks/useAssistantChat.ts` (new)

Acceptance:
- App builds with feature flag off by default.
- No behavior changes to current assistant when flag is off.

## Phase 1: Protocol Types + Conversation Persistence
Deliverables:
- Shared chat protocol and domain types.
- Conversation history APIs.
- DB migration for conversations/messages.

Target files:
- `lib/assistant/chatTypes.ts` (new)
- `types/assistantChat.ts` (new, if needed)
- `app/api/assistant/conversations/route.ts` (new)
- `app/api/assistant/conversations/[id]/route.ts` (new)
- `supabase/migrations/<timestamp>_assistant_conversations.sql` (new)

Data model minimum:
- `assistant_conversations`: `id`, `project_name`, `title`, `created_at`, `updated_at`
- `assistant_messages`: `id`, `conversation_id`, `role`, `content`, `message_type`, `metadata_json`, `created_at`

Acceptance:
- Can create/list/load conversation history via API.
- History load returns correctly ordered messages.
- Unit/integration tests cover create/list/load.

## Phase 2: WebSocket Backend
Deliverables:
- WS endpoint implementing PRD protocol (`start`, `message`, `answer`, `ping` and server events).
- Connection lifecycle, keep-alive, and graceful error handling.

Target files:
- `app/api/assistant/ws/[projectName]/route.ts` (new) or dedicated ws server module.
- `lib/assistant/wsSession.ts` (new)
- `lib/assistant/wsProtocol.ts` (new)

Behavior:
- Emit `conversation_created` when session starts without existing id.
- Stream assistant text in chunks (`text` events) and close with `response_done`.
- Emit `tool_call` events when tools are invoked.
- Emit `question` events for structured flows.
- Reply to `ping` with `pong`.

Acceptance:
- Manual WS client can connect and exchange all protocol message types.
- Reconnect-safe behavior with existing conversation id.

## Phase 3: `useAssistantChat` Hook
Deliverables:
- Hook for WS connection, state, reconnection, ping interval, typed message handling.

Target files:
- `hooks/useAssistantChat.ts` (new)

Required capabilities:
- Exponential backoff reconnect (max 3 attempts).
- `connected`/`connecting`/`disconnected` state.
- Message stream assembly for in-progress assistant response.
- Structured question state management and answer submission.
- Conversation id tracking and callbacks.

Acceptance:
- Hook unit tests cover: connect, disconnect, retry, ping/pong, stream assembly, question submission.

## Phase 4: UI Components (v2)
Deliverables:
- New panel/chat UI matching PRD UX.

Target files:
- `components/assistant/v2/AssistantPanel.tsx` (new)
- `components/assistant/v2/AssistantChat.tsx` (new)
- `components/assistant/v2/ChatMessage.tsx` (new)
- `components/assistant/v2/QuestionOptions.tsx` (new)
- `app/globals.css` (append `chat-prose`, markdown, and panel styles)

UI requirements:
- Right slide-out panel with backdrop.
- Resizable width (min 300, default 400, max 90vw).
- Header controls: new chat, history dropdown, connection status.
- Scrollable message area with autoscroll.
- Streaming indicator and thinking indicator.
- Input box with Enter/Shift+Enter behavior.

Acceptance:
- Visual parity with PRD sections for layout/states.
- Keyboard and pointer flows function on desktop and mobile.

## Phase 5: Markdown + Attachments + Tool Call Visualization
Deliverables:
- Rich markdown rendering with GitHub-flavored markdown.
- Tool-call system messages displayed in chat timeline.
- Image attachment rendering for supported MIME types.

Dependencies:
- Add `react-markdown`, `remark-gfm`.

Target files:
- `components/assistant/v2/ChatMessage.tsx`
- `package.json`

Acceptance:
- Markdown tables/lists/code blocks render correctly.
- Tool calls appear as system entries with human-readable labels.
- Image previews render safely.

## Phase 6: Structured Questions
Deliverables:
- `QuestionOptions` card UI with single/multi-select and “Other” text support.
- Submission flow back to WS `answer` message.

Target files:
- `components/assistant/v2/QuestionOptions.tsx`
- `components/assistant/v2/AssistantChat.tsx`
- `hooks/useAssistantChat.ts`

Acceptance:
- Input disables while questions are pending.
- Cannot submit until all required questions are answered.

## Phase 7: Conversation History UX
Deliverables:
- Header history dropdown and “new conversation” actions.
- localStorage persistence of active conversation per project.
- API-backed reload and dedupe with live stream.

Target files:
- `components/assistant/v2/AssistantPanel.tsx`
- `components/assistant/v2/AssistantChat.tsx`
- `app/api/assistant/conversations/*`

Acceptance:
- Reopen panel restores last conversation id.
- Switching conversation swaps messages and continues correctly.

## Phase 8: Integration Into App Shell
Deliverables:
- Mount new panel from app shell with feature flag.
- Keep current assistant available as fallback until final cutover.

Target files:
- `components/layout/AppShell.tsx`
- `components/mobile/AssistantDrawer.tsx` (if reusing mobile patterns)

Acceptance:
- Panel opens globally where intended.
- No regression in existing routes.

## Phase 9: QA, Telemetry, and Rollout
Deliverables:
- Tests across hook, API, and UI components.
- Telemetry for connect/send/stream/tool/question/confirm/error events.
- Rollout checklist and fallback instructions.

Target files:
- `app/api/assistant/ws/*` tests (new)
- `hooks/useAssistantChat.test.ts` (new)
- `components/assistant/v2/*.test.tsx` (new)
- `e2e/assistant-panel.spec.ts` (new)

Acceptance:
- Critical path e2e passes.
- Error and reconnect behavior covered.
- Feature flag can instantly disable v2 and return to current assistant.

## Implementation Checklist (Agent Execution Order)
1. Complete context runbook and write a short discovery note in PR description.
2. Implement Phase 0 and Phase 1 only; open PR #1.
3. Implement Phase 2 and Phase 3; open PR #2.
4. Implement Phase 4 and Phase 5; open PR #3.
5. Implement Phase 6 and Phase 7; open PR #4.
6. Implement Phase 8 and Phase 9; open PR #5.

## Validation Commands (Per PR)
- `npm run typecheck`
- `npm run lint`
- `npm run test:integration`
- `npm run test:unit`
- `npx vitest run app/api/assistant/chat/route.test.ts`
- For UI phases: add and run targeted tests for new v2 components.

## Risk Register
1. WS hosting/runtime incompatibility.
- Mitigation: validate transport in Phase 0 and pivot to dedicated WS process early.

2. Conversation schema churn.
- Mitigation: store extensible `metadata_json` and avoid over-constraining early.

3. Streaming race conditions.
- Mitigation: stable message IDs and reducer-based message assembly.

4. Reconnect duplicates.
- Mitigation: dedupe by message ID and idempotent response finalization.

5. Regressions to current assistant.
- Mitigation: keep feature flag default-off until end-to-end validation is complete.

## Definition of Done
- PRD capabilities implemented and verified.
- Conversation persistence and resume works.
- WS streaming, tool calls, and structured questions work.
- Panel UX (resizable, history, status, markdown, loading states) matches spec.
- Existing assistant remains available as fallback until explicit cutover.
