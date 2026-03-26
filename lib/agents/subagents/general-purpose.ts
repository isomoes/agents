import "server-only";

import type { SubAgent } from "deepagents";

import { runFunctionTool } from "@/lib/agents/tools/run-function";

type RuntimeGeneralPurposeSubagent = Pick<
  SubAgent,
  "name" | "description" | "systemPrompt"
> & {
  tools: NonNullable<SubAgent["tools"]>;
};

export const runtimeGeneralPurposeSubagent: RuntimeGeneralPurposeSubagent = {
  name: "runtime-general-purpose",
  description: "Delegates general runtime tasks while preserving the main agent's context window.",
  systemPrompt:
    "You are the general-purpose DeepAgents subagent. Keep results concise, use the approved runtime tool when it helps, and return only the essential answer.",
  tools: [runFunctionTool],
};
