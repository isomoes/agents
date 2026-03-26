import { z } from "zod";

export const RuntimeKindSchema = z.enum(["single", "deep"]);

export type RuntimeKind = z.infer<typeof RuntimeKindSchema>;
export type SingleAgentStreamChunk = [mode: string, chunk: unknown];
export type AgentStreamEvent = [namespace: string[], mode: string, chunk: unknown];

export type AgentMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AgentInvokePayload = {
  messages: AgentMessage[];
};

export function toSingleAgentStreamEvent([mode, chunk]: SingleAgentStreamChunk): AgentStreamEvent {
  return [[], mode, chunk];
}

export function normalizeDeepStreamChunk(chunk: unknown): AgentStreamEvent {
  if (Array.isArray(chunk) && chunk.length === 3 && Array.isArray(chunk[0]) && typeof chunk[1] === "string") {
    return [chunk[0].map((part) => String(part)), chunk[1], chunk[2]];
  }

  if (Array.isArray(chunk) && chunk.length === 2 && typeof chunk[0] === "string") {
    return [[], chunk[0], chunk[1]];
  }

  throw new TypeError("Unsupported stream chunk shape.");
}
