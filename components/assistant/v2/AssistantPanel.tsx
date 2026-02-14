"use client";

import { useCallback, useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { AssistantChat } from "./AssistantChat";

interface AssistantPanelProps {
  projectName: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

const MIN_PANEL_WIDTH = 300;
const DEFAULT_PANEL_WIDTH = 400;
const MAX_VIEWPORT_RATIO = 0.9;

export function AssistantPanel({ projectName }: AssistantPanelProps) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [conversationSessionKey, setConversationSessionKey] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const maxWidth = Math.floor(viewportWidth * MAX_VIEWPORT_RATIO);
  const panelWidth = Math.max(MIN_PANEL_WIDTH, Math.min(width, maxWidth));
  const storageKey = `assistant_v2_active_conversation_${projectName}`;

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/assistant/conversations?projectName=${encodeURIComponent(projectName)}&limit=25`
      );
      if (!response.ok) return;
      const payload = await response.json();
      setConversations(Array.isArray(payload.conversations) ? payload.conversations : []);
    } catch {
      // no-op
    }
  }, [projectName]);

  useEffect(() => {
    if (!open) return;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        setActiveConversationId(stored);
      }
    }
    void loadConversations();
  }, [open, loadConversations, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeConversationId) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, activeConversationId);
  }, [activeConversationId, storageKey]);

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const nextWidth = startWidth + delta;
      const bounded = Math.max(
        MIN_PANEL_WIDTH,
        Math.min(nextWidth, Math.floor(window.innerWidth * MAX_VIEWPORT_RATIO))
      );
      setWidth(bounded);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <>
      <button
        type="button"
        className="fixed bottom-5 right-5 z-40 rounded-full bg-blue-600 text-white px-4 py-3 text-sm shadow-lg min-h-[44px]"
        onClick={() => setOpen(true)}
      >
        Assistant
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="assistant-v2-backdrop"
            aria-label="Close assistant panel"
            onClick={() => setOpen(false)}
          />
          <aside
            className="assistant-v2-panel"
            style={{ width: `${panelWidth}px`, maxWidth: "90vw" }}
            data-assistant-panel-v2
            data-project-name={projectName}
          >
            <div className="assistant-v2-resize-handle" onMouseDown={startResize} />
            <header className="assistant-v2-panel-header">
              <div className="assistant-v2-panel-title">Assistant</div>
              <div className="assistant-v2-panel-actions">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => {
                    setActiveConversationId(null);
                    setConversationSessionKey((value) => value + 1);
                  }}
                >
                  New chat
                </button>
                <select
                  className="select text-xs py-1 w-[170px]"
                  value={activeConversationId || ""}
                  onChange={(event) => {
                    const nextId = event.target.value || null;
                    setActiveConversationId(nextId);
                    setConversationSessionKey((value) => value + 1);
                  }}
                >
                  <option value="">Current conversation</option>
                  {conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>
                      {conversation.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            </header>

            <AssistantChat
              key={`${activeConversationId || "new"}-${conversationSessionKey}`}
              projectName={projectName}
              initialConversationId={activeConversationId}
              onConversationIdChange={(conversationId) => {
                setActiveConversationId(conversationId);
                void loadConversations();
              }}
              onNewChat={() => {
                setActiveConversationId(null);
                setConversationSessionKey((value) => value + 1);
              }}
            />
          </aside>
        </>
      ) : null}
    </>
  );
}
