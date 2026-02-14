import { createAssistantWsSession } from "@/lib/assistant/wsSession";

export const runtime = "edge";

type WsResponseInit = ResponseInit & { webSocket?: WebSocket };

type WebSocketPairConstructor = new () => {
  0: WebSocket;
  1: WebSocket;
};

type EdgeSocket = WebSocket & {
  accept: () => void;
};

function getWebSocketPairConstructor(): WebSocketPairConstructor | null {
  const globalValue = globalThis as unknown as { WebSocketPair?: WebSocketPairConstructor };
  return globalValue.WebSocketPair || null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectName: string }> }
) {
  const upgradeHeader = request.headers.get("upgrade");
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const WebSocketPairCtor = getWebSocketPairConstructor();
  if (!WebSocketPairCtor) {
    return new Response("WebSocketPair is not available in this runtime", { status: 501 });
  }

  const { projectName } = await context.params;
  const pair = new WebSocketPairCtor();
  const client = pair[0];
  const server = pair[1] as EdgeSocket;

  const session = await createAssistantWsSession({ projectName });
  server.accept();

  server.addEventListener("message", async (event) => {
    const raw = typeof event.data === "string" ? event.data : String(event.data || "");
    const events = await session.handleRawMessage(raw);
    for (const nextEvent of events) {
      server.send(JSON.stringify(nextEvent));
    }
  });

  server.addEventListener("close", () => {
    try {
      server.close(1000, "session closed");
    } catch {
      // no-op
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  } as WsResponseInit);
}
