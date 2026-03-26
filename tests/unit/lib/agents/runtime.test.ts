async function loadRuntimeModule() {
  return import("@/lib/agents/runtime");
}

describe("createAgentRuntimeConfig", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("does not eagerly load the deep-only subagent in single mode", async () => {
    let subagentLoads = 0;

    vi.doMock("@/lib/agents/subagents/general-purpose", () => {
      subagentLoads += 1;

      return {
        runtimeGeneralPurposeSubagent: {
          name: "runtime-general-purpose",
          description: "Delegates general runtime tasks while preserving the main agent's context window.",
          systemPrompt: "Test subagent.",
          tools: [],
        },
      };
    });

    const { createAgentRuntimeConfig } = await loadRuntimeModule();
    const config = createAgentRuntimeConfig({ AGENT_MODEL: "openai:gpt-5.4-mini" });

    expect(config.kind).toBe("single");
    expect(config.agentConfig).not.toHaveProperty("subagents");
    expect(subagentLoads).toBe(0);
  });

  it("builds single-agent config by default", async () => {
    const { createAgentRuntimeConfig } = await loadRuntimeModule();
    const config = createAgentRuntimeConfig({ AGENT_MODEL: "openai:gpt-5.4-mini" });

    expect(config.kind).toBe("single");
    expect(config.agentConfig.tools).toHaveLength(1);
  });

  it("builds deep-agent config when enabled", async () => {
    const { createAgentRuntimeConfig } = await loadRuntimeModule();
    const config = createAgentRuntimeConfig({
      AGENT_MODEL: "openai:gpt-5.4-mini",
      DEEPAGENTS_ENABLE_DEEP_MODE: "true",
    });

    expect(config.kind).toBe("deep");
    if (config.kind !== "deep") {
      throw new Error("expected deep runtime config");
    }

    expect(config.agentConfig.name).toBe("deepagents-mvp-runtime");
    expect(config.agentConfig).not.toHaveProperty("subagents");
  });
});

describe("createAgentRuntime", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("does not load deepagents in single mode", async () => {
    let deepagentsLoads = 0;

    vi.doMock("deepagents", () => {
      deepagentsLoads += 1;

      return {
        createDeepAgent: vi.fn(),
      };
    });

    const { createAgentRuntime } = await loadRuntimeModule();

    createAgentRuntime(
      { AGENT_MODEL: "openai:gpt-5.4-mini" },
      {
        createSingleAgent: vi.fn(() => ({
          invoke: vi.fn(),
          stream: vi.fn(),
        })),
      },
    );

    expect(deepagentsLoads).toBe(0);
  });

  it("uses createAgent in single mode and normalizes stream events", async () => {
    const { createAgentRuntime } = await loadRuntimeModule();
    const invoke = vi.fn().mockResolvedValue({ output: "ok" });
    const stream = vi.fn().mockResolvedValue(
      (async function* () {
        yield ["updates", { step: "model" }] as const;
      })(),
    );
    const createSingleAgent = vi.fn(() => ({ invoke, stream }));

    const runtime = createAgentRuntime(
      { AGENT_MODEL: "openai:gpt-5.4-mini" },
      {
        createSingleAgent,
        createDeepAgent: vi.fn(),
      },
    );

    expect(await runtime.invoke({ messages: [] })).toEqual({ output: "ok" });
    expect(createSingleAgent).toHaveBeenCalledTimes(1);

    const chunks: Array<[string[], string, unknown]> = [];
    for await (const chunk of runtime.streamEvents({ messages: [] })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([[[], "updates", { step: "model" }]]);
    expect(stream).toHaveBeenCalledWith(
      { messages: [] },
      {
        streamMode: ["updates", "messages", "custom"],
        subgraphs: false,
      },
    );
  });

  it("uses createDeepAgent in deep mode", async () => {
    vi.doMock("@/lib/agents/subagents/general-purpose", () => ({
      runtimeGeneralPurposeSubagent: {
        name: "runtime-general-purpose",
        description: "Delegates general runtime tasks while preserving the main agent's context window.",
        systemPrompt: "Test subagent.",
        tools: [],
      },
    }));

    const { createAgentRuntime } = await loadRuntimeModule();
    const invoke = vi.fn().mockResolvedValue({ output: "deep" });
    const stream = vi.fn().mockResolvedValue(
      (async function* () {
        yield [["general-purpose"], "messages", { token: "hi" }] as const;
      })(),
    );
    const createDeepAgentImpl = vi.fn(() => ({ invoke, stream }));

    const runtime = createAgentRuntime(
      {
        AGENT_MODEL: "openai:gpt-5.4-mini",
        DEEPAGENTS_ENABLE_DEEP_MODE: "true",
      },
      {
        createSingleAgent: vi.fn(),
        createDeepAgent: createDeepAgentImpl,
      },
    );

    expect(await runtime.invoke({ messages: [] })).toEqual({ output: "deep" });
    expect(createDeepAgentImpl).toHaveBeenCalledTimes(1);
    expect(createDeepAgentImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "deepagents-mvp-runtime",
        generalPurposeAgent: false,
        subagents: [
          expect.objectContaining({
            name: "runtime-general-purpose",
          }),
        ],
      }),
    );

    const chunks: Array<[string[], string, unknown]> = [];
    for await (const chunk of runtime.streamEvents({ messages: [] })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      [["general-purpose"], "messages", { token: "hi" }],
    ]);
    expect(stream).toHaveBeenCalledWith(
      { messages: [] },
      {
        streamMode: ["updates", "messages", "custom"],
        subgraphs: true,
      },
    );
  });
});
