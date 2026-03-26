import "server-only";

import { createAgent } from "langchain";

import { createRuntimeEnv } from "@/lib/env";
import {
  normalizeDeepStreamChunk,
  type AgentInvokePayload,
  type AgentStreamEvent,
  type RuntimeKind,
  toSingleAgentStreamEvent,
} from "@/lib/agents/types";
import { runFunctionTool } from "@/lib/agents/tools/run-function";

const systemPrompt = [
  "You are the DeepAgents MVP runtime assistant.",
  "Use the approved runtime tool when you need server-side data.",
  "Right now only get_installed_skills is available.",
].join(" ");

type BaseAgentConfig = {
  model: string;
  systemPrompt: string;
  tools: [typeof runFunctionTool];
};

type SingleRuntimeConfig = {
  kind: "single";
  agentConfig: BaseAgentConfig;
};

type DeepRuntimeConfig = {
  kind: "deep";
  agentConfig: BaseAgentConfig & {
    name: string;
  };
};

type ResolvedDeepAgentConfig = DeepRuntimeConfig["agentConfig"] & {
  generalPurposeAgent: false;
  subagents: [
    Awaited<
      typeof import("@/lib/agents/subagents/general-purpose")
    >["runtimeGeneralPurposeSubagent"],
  ];
};

export type AgentRuntimeConfig = SingleRuntimeConfig | DeepRuntimeConfig;

type RuntimeAgent = {
  invoke: (input: AgentInvokePayload) => Promise<unknown>;
  stream: (
    input: AgentInvokePayload,
    options?: Record<string, unknown>,
  ) => Promise<AsyncIterable<unknown>>;
};

type RuntimeFactories = {
  createSingleAgent?: (
    config: SingleRuntimeConfig["agentConfig"],
  ) => RuntimeAgent | Promise<RuntimeAgent>;
  createDeepAgent?: (
    config: ResolvedDeepAgentConfig,
  ) => RuntimeAgent | Promise<RuntimeAgent>;
};

export type AgentRuntime = {
  kind: RuntimeKind;
  invoke: (input: AgentInvokePayload) => Promise<unknown>;
  streamEvents: (input: AgentInvokePayload) => AsyncIterable<AgentStreamEvent>;
};

export function createAgentRuntimeConfig(
  source: Record<string, string | undefined> = process.env,
): AgentRuntimeConfig {
  const env = createRuntimeEnv(source);

  const baseAgentConfig: BaseAgentConfig = {
    model: env.model,
    systemPrompt,
    tools: [runFunctionTool],
  };

  if (env.runtimeMode === "deep") {
    return {
      kind: "deep",
      agentConfig: {
        ...baseAgentConfig,
        name: "deepagents-mvp-runtime",
      },
    };
  }

  return {
    kind: "single",
    agentConfig: baseAgentConfig,
  };
}

export function createAgentRuntime(
  source: Record<string, string | undefined> = process.env,
  factories: RuntimeFactories = {},
): AgentRuntime {
  const runtimeConfig = createAgentRuntimeConfig(source);
  const singleFactory =
    factories.createSingleAgent ??
    ((config: SingleRuntimeConfig["agentConfig"]) => createAgent(config) as RuntimeAgent);
  const baseDeepFactory =
    factories.createDeepAgent ??
    (async (config: ResolvedDeepAgentConfig) => {
      const { createDeepAgent } = await import("deepagents");

      return createDeepAgent(config) as RuntimeAgent;
    });
  const deepFactory = async (config: DeepRuntimeConfig["agentConfig"]) =>
    baseDeepFactory(await resolveDeepAgentConfig(config));

  let agentPromise: Promise<RuntimeAgent> | undefined;

  const getAgent = () => {
    if (!agentPromise) {
      agentPromise = Promise.resolve(
        runtimeConfig.kind === "single"
          ? singleFactory(runtimeConfig.agentConfig)
          : deepFactory(runtimeConfig.agentConfig),
      );
    }

    return agentPromise;
  };

  return {
    kind: runtimeConfig.kind,
    async invoke(input) {
      const agent = await getAgent();

      return agent.invoke(input);
    },
    async *streamEvents(input) {
      const agent = await getAgent();
      const stream = await agent.stream(input, {
        streamMode: ["updates", "messages", "custom"],
        subgraphs: runtimeConfig.kind === "deep",
      });

      for await (const chunk of stream) {
        yield runtimeConfig.kind === "single"
          ? toSingleAgentStreamEvent(chunk as [string, unknown])
          : normalizeDeepStreamChunk(chunk);
      }
    },
  };
}

async function resolveDeepAgentConfig(
  config: DeepRuntimeConfig["agentConfig"],
): Promise<ResolvedDeepAgentConfig> {
  const { runtimeGeneralPurposeSubagent } = await import(
    "@/lib/agents/subagents/general-purpose"
  );

  return {
    ...config,
    generalPurposeAgent: false,
    subagents: [runtimeGeneralPurposeSubagent],
  };
}
