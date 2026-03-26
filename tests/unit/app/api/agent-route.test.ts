async function readNdjson(response: Response) {
  const text = await response.text();

  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type: string; agentName: string; message: string });
}

describe("POST /api/agent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unmock("@/lib/agents/runtime");
    vi.unstubAllEnvs();
  });

  it("rejects blank prompts before streaming starts", async () => {
    const { POST } = await import("@/app/api/agent/route");
    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ prompt: "   " }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Prompt is required." });
  });

  it("returns deterministic fake-agent ndjson events", async () => {
    vi.stubEnv("E2E_USE_FAKE_AGENT", "true");
    const { POST } = await import("@/app/api/agent/route");

    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ prompt: "List installed skills" }),
      }),
    );

    expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");
    await expect(readNdjson(response)).resolves.toEqual([
      {
        type: "tool_result",
        agentName: "main-agent",
        message: "run_function: Fake agent mode returned the installed skills fixture.",
      },
      {
        type: "response_delta",
        agentName: "main-agent",
        message: "Fake agent response",
      },
      {
        type: "response_delta",
        agentName: "main-agent",
        message: " for: List installed skills",
      },
      {
        type: "final",
        agentName: "main-agent",
        message: "Fake agent response for: List installed skills",
      },
    ]);
  });

  it("ignores fake-agent mode in production and uses the real runtime", async () => {
    vi.stubEnv("E2E_USE_FAKE_AGENT", "true");
    vi.stubEnv("NODE_ENV", "production");

    const streamEvents = vi.fn(async function* () {
      yield [[], "custom", { type: "final", agentName: "main-agent", message: "Real runtime output" }] as const;
    });

    vi.doMock("@/lib/agents/runtime", () => ({
      createAgentRuntime: vi.fn(() => ({ streamEvents })),
    }));

    const { POST: mockedPost } = await import("@/app/api/agent/route");
    const response = await mockedPost(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ prompt: "List installed skills" }),
      }),
    );

    await expect(readNdjson(response)).resolves.toEqual([
      {
        type: "final",
        agentName: "main-agent",
        message: "Real runtime output",
      },
    ]);
    expect(streamEvents).toHaveBeenCalledTimes(1);
  });

  it("emits a final failure event if streaming fails after the response starts", async () => {
    vi.doMock("@/lib/agents/runtime", () => ({
      createAgentRuntime: vi.fn(() => ({
        streamEvents: async function* () {
          yield [[], "updates", { "main-agent": { state: "started" } }] as const;
          throw new Error("boom");
        },
      })),
    }));

    const { POST: mockedPost } = await import("@/app/api/agent/route");
    const response = await mockedPost(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ prompt: "Explain the runtime" }),
      }),
    );

    await expect(readNdjson(response)).resolves.toEqual([
      {
        type: "status",
        agentName: "main-agent",
        message: "main-agent updated main-agent.",
      },
      {
        type: "final",
        agentName: "main-agent",
        message: "Request failed",
      },
    ]);
  });

  it("does not synthesize a duplicate final event when the runtime already emits one", async () => {
    vi.doMock("@/lib/agents/runtime", () => ({
      createAgentRuntime: vi.fn(() => ({
        streamEvents: async function* () {
          yield [[], "messages", [{ content: [{ text: "Hello " }] }, { langgraph_node: "main-agent" }]] as const;
          yield [[], "custom", { type: "final", agentName: "main-agent", message: "Hello there" }] as const;
          throw new Error("cleanup failed");
        },
      })),
    }));

    const { POST: mockedPost } = await import("@/app/api/agent/route");
    const response = await mockedPost(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ prompt: "Explain the runtime" }),
      }),
    );

    await expect(readNdjson(response)).resolves.toEqual([
      {
        type: "response_delta",
        agentName: "main-agent",
        message: "Hello ",
      },
      {
        type: "final",
        agentName: "main-agent",
        message: "Hello there",
      },
    ]);
  });

  it("stops consuming the runtime stream when the request is aborted", async () => {
    const returnSpy = vi.fn().mockResolvedValue({ done: true, value: undefined });
    let releaseGate: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    vi.doMock("@/lib/agents/runtime", () => ({
      createAgentRuntime: vi.fn(() => ({
        streamEvents: () => ({
          [Symbol.asyncIterator]: () => ({
            next: vi.fn(async () => {
              await gate;
              return { done: true, value: undefined };
            }),
            return: returnSpy,
          }),
        }),
      })),
    }));

    const { POST: mockedPost } = await import("@/app/api/agent/route");
    const abortController = new AbortController();
    const response = await mockedPost({
      json: async () => ({ prompt: "Explain the runtime" }),
      signal: abortController.signal,
    } as Request);

    const reader = response.body?.getReader();
    abortController.abort();
    releaseGate?.();

    await expect(reader?.read()).resolves.toEqual({ done: true, value: undefined });
    expect(returnSpy).toHaveBeenCalled();
  });
});
