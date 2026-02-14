import type { AssistantChatTimelineMessage } from "@/hooks/useAssistantChat";

interface ChatMessageProps {
  message: AssistantChatTimelineMessage;
}

interface AttachmentMetadata {
  url: string;
  mime_type?: string;
  alt?: string;
}

const TOOL_LABELS: Record<string, string> = {
  create_rule: "Create rule",
  bulk_edit_transactions: "Bulk edit transactions",
  propose_split: "Propose split",
  create_expected_inflow: "Create expected inflow",
  suggest_account_updates: "Suggest account updates",
};

function renderInlineMarkdown(text: string): Array<string | JSX.Element> {
  const nodes: Array<string | JSX.Element> = [];
  const regex = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      nodes.push(
        <code key={`code-${match.index}`} className="assistant-v2-inline-code">
          {match[1]}
        </code>
      );
    } else if (match[2] && match[3]) {
      nodes.push(
        <a
          key={`link-${match.index}`}
          href={match[3]}
          target="_blank"
          rel="noreferrer"
          className="assistant-v2-link"
        >
          {match[2]}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function renderMarkdownLite(content: string) {
  const lines = content.split("\n");
  const isBulletList = lines.every((line) => line.trim().startsWith("- "));
  const isNumberList = lines.every((line) => /^\s*\d+\.\s+/.test(line));
  const codeBlockMatch = content.match(/^```([a-z0-9_-]+)?\n([\s\S]+)\n```$/i);

  if (codeBlockMatch) {
    return (
      <pre className="assistant-v2-code-block">
        <code>{codeBlockMatch[2]}</code>
      </pre>
    );
  }

  if (isBulletList) {
    return (
      <ul className="assistant-v2-markdown-list">
        {lines.map((line, index) => (
          <li key={`li-${index}`}>{renderInlineMarkdown(line.replace(/^\s*-\s+/, ""))}</li>
        ))}
      </ul>
    );
  }

  if (isNumberList) {
    return (
      <ol className="assistant-v2-markdown-list">
        {lines.map((line, index) => (
          <li key={`oli-${index}`}>{renderInlineMarkdown(line.replace(/^\s*\d+\.\s+/, ""))}</li>
        ))}
      </ol>
    );
  }

  return (
    <div className="assistant-v2-markdown">
      {lines.map((line, index) => (
        <p key={`p-${index}`}>{renderInlineMarkdown(line)}</p>
      ))}
    </div>
  );
}

function renderImageAttachments(metadata: Record<string, unknown>) {
  const raw = metadata.attachments;
  if (!Array.isArray(raw)) return null;
  const attachments = raw as AttachmentMetadata[];
  const imageAttachments = attachments.filter(
    (attachment) =>
      typeof attachment?.url === "string" &&
      attachment.url.length > 0 &&
      typeof attachment?.mime_type === "string" &&
      attachment.mime_type.startsWith("image/")
  );

  if (!imageAttachments.length) return null;

  return (
    <div className="assistant-v2-image-grid">
      {imageAttachments.map((attachment) => (
        <img
          key={attachment.url}
          src={attachment.url}
          alt={attachment.alt || "Assistant attachment"}
          className="assistant-v2-image"
          loading="lazy"
        />
      ))}
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="assistant-v2-bubble assistant-v2-bubble-user">
        {renderMarkdownLite(message.content)}
      </div>
    );
  }

  if (message.role === "tool") {
    const label = TOOL_LABELS[message.content] || message.content;
    return (
      <div className="assistant-v2-bubble assistant-v2-bubble-tool">
        [tool] {label}
      </div>
    );
  }

  if (message.role === "system") {
    return <div className="assistant-v2-system">{message.content}</div>;
  }

  return (
    <div className="assistant-v2-bubble assistant-v2-bubble-assistant">
      {renderMarkdownLite(message.content)}
      {renderImageAttachments(message.metadata)}
      {message.isStreaming && <span className="assistant-v2-cursor">▍</span>}
    </div>
  );
}
