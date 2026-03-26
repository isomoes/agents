import type { AgentStreamEvent } from "@/lib/agents/types";

export type ClientStreamEventType = "status" | "tool_result" | "response_delta" | "final";

export type ClientStreamEvent = {
  type: ClientStreamEventType;
  agentName: string;
  message: string;
};

const DEFAULT_AGENT_NAME = "main-agent";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAgentName(namespace: string[], fallback = DEFAULT_AGENT_NAME) {
  return namespace.at(-1) ?? fallback;
}

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((part) => extractText(part)).join("");
  }

  if (!isRecord(value)) {
    return "";
  }

  if (typeof value.text === "string") {
    return value.text;
  }

  if (typeof value.content === "string") {
    return value.content;
  }

  if (Array.isArray(value.content)) {
    return extractText(value.content);
  }

  if (typeof value.output === "string") {
    return value.output;
  }

  return "";
}

function getMessageType(message: unknown): string | undefined {
  if (!isRecord(message)) {
    return undefined;
  }

  if (typeof message.type === "string") {
    return message.type;
  }

  if (typeof message.role === "string") {
    return message.role;
  }

  return undefined;
}

function normalizeMessageChunk(namespace: string[], chunk: unknown): ClientStreamEvent[] {
  const items = Array.isArray(chunk) ? chunk : [chunk];
  const message = items[0];
  const metadata = items[1];
  const metadataAgentName =
    isRecord(metadata) && typeof metadata.langgraph_node === "string"
      ? metadata.langgraph_node
      : undefined;
  const agentName = getAgentName(namespace, metadataAgentName ?? DEFAULT_AGENT_NAME);
  const text = extractText(message);

  if (text.length === 0) {
    return [];
  }

  return [{ type: "response_delta", agentName, message: text }];
}

function normalizeUpdateChunk(namespace: string[], chunk: unknown): ClientStreamEvent[] {
  if (!isRecord(chunk)) {
    return [];
  }

  const events: ClientStreamEvent[] = [];

  for (const [nodeName, value] of Object.entries(chunk)) {
    const agentName = typeof nodeName === "string" && nodeName.length > 0 ? nodeName : getAgentName(namespace);
    let emittedNodeEvent = false;

    if (isRecord(value) && Array.isArray(value.messages)) {
      for (const message of value.messages) {
        const messageType = getMessageType(message);

        if (messageType === "tool" || messageType === "tool_result") {
          const toolName = isRecord(message) && typeof message.name === "string" ? message.name : "tool";
          const detail = extractText(message).trim() || `${toolName} completed.`;

          events.push({
            type: "tool_result",
            agentName,
            message: `${toolName}: ${detail}`,
          });
          emittedNodeEvent = true;
        }
      }
    }

    if (!emittedNodeEvent) {
      events.push({
        type: "status",
        agentName,
        message: `${agentName} updated ${nodeName}.`,
      });
    }
  }

  return events;
}

function normalizeCustomChunk(namespace: string[], chunk: unknown): ClientStreamEvent[] {
  if (!isRecord(chunk) || typeof chunk.type !== "string") {
    return [];
  }

  const type: ClientStreamEventType =
    chunk.type === "final" || chunk.type === "tool_result" || chunk.type === "response_delta"
      ? chunk.type
      : "status";

  return [
    {
      type,
      agentName:
        typeof chunk.agentName === "string" && chunk.agentName.trim().length > 0
          ? chunk.agentName
          : getAgentName(namespace),
      message: typeof chunk.message === "string" ? chunk.message : "",
    },
  ].filter((event) => event.message.length > 0);
}

export function normalizeRuntimeStreamEvent(event: AgentStreamEvent): ClientStreamEvent[] {
  const [namespace, mode, chunk] = event;

  if (mode === "messages") {
    return normalizeMessageChunk(namespace, chunk);
  }

  if (mode === "updates") {
    return normalizeUpdateChunk(namespace, chunk);
  }

  if (mode === "custom") {
    return normalizeCustomChunk(namespace, chunk);
  }

  return [];
}

export function serializeStreamEvent(event: ClientStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export async function readNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: ClientStreamEvent) => void,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parseLine = (line: string) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return;
    }

    try {
      onEvent(JSON.parse(trimmed) as ClientStreamEvent);
    } catch (error) {
      throw new Error("Invalid NDJSON stream.", { cause: error });
    }
  };

  try {
    while (true) {
      if (options?.signal?.aborted) {
        return;
      }

      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        parseLine(line);
      }

      if (done) {
        break;
      }
    }

    const trailing = buffer.trim();
    if (trailing) {
      parseLine(trailing);
    }
  } finally {
    if (options?.signal?.aborted) {
      await reader.cancel().catch(() => undefined);
    }

    reader.releaseLock();
  }
}

export function createFakeAgentEvents(prompt: string): ClientStreamEvent[] {
  const trimmedPrompt = prompt.trim();

  return [
    {
      type: "tool_result",
      agentName: DEFAULT_AGENT_NAME,
      message: "run_function: Fake agent mode returned the installed skills fixture.",
    },
    {
      type: "response_delta",
      agentName: DEFAULT_AGENT_NAME,
      message: "Fake agent response",
    },
    {
      type: "response_delta",
      agentName: DEFAULT_AGENT_NAME,
      message: ` for: ${trimmedPrompt}`,
    },
    {
      type: "final",
      agentName: DEFAULT_AGENT_NAME,
      message: `Fake agent response for: ${trimmedPrompt}`,
    },
  ];
}
