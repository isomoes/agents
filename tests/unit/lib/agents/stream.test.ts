import {
  createFakeAgentEvents,
  normalizeRuntimeStreamEvent,
  readNdjsonStream,
  serializeStreamEvent,
} from "@/lib/agents/stream";

describe("agent stream helpers", () => {
  it("normalizes tool results from update chunks", () => {
    const events = normalizeRuntimeStreamEvent([
      [],
      "updates",
      {
        "main-agent": {
          messages: [
            {
              type: "tool",
              name: "run_function",
              content: "Installed skills: stream, route, ui",
            },
          ],
        },
      },
    ]);

    expect(events).toEqual([
      {
        type: "tool_result",
        agentName: "main-agent",
        message: "run_function: Installed skills: stream, route, ui",
      },
    ]);
  });

  it("normalizes message chunks into response deltas", () => {
    const events = normalizeRuntimeStreamEvent([
      ["research-agent"],
      "messages",
      [{ content: [{ text: "Hello from the agent." }] }, { langgraph_node: "research-agent" }],
    ]);

    expect(events).toEqual([
      {
        type: "response_delta",
        agentName: "research-agent",
        message: "Hello from the agent.",
      },
    ]);
  });

  it("preserves whitespace in message deltas", () => {
    const events = normalizeRuntimeStreamEvent([
      ["research-agent"],
      "messages",
      [{ content: [{ text: " Hello from the agent.  " }] }, { langgraph_node: "research-agent" }],
    ]);

    expect(events).toEqual([
      {
        type: "response_delta",
        agentName: "research-agent",
        message: " Hello from the agent.  ",
      },
    ]);
  });

  it("parses ndjson streams for the client", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            `${serializeStreamEvent({ type: "status", agentName: "main-agent", message: "Working" })}${serializeStreamEvent({ type: "final", agentName: "main-agent", message: "Done" })}`,
          ),
        );
        controller.close();
      },
    });

    const events: Array<{ type: string; agentName: string; message: string }> = [];
    await readNdjsonStream(stream, (event) => events.push(event));

    expect(events).toEqual([
      { type: "status", agentName: "main-agent", message: "Working" },
      { type: "final", agentName: "main-agent", message: "Done" },
    ]);
  });

  it("parses ndjson events split across chunks", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        const first = serializeStreamEvent({ type: "status", agentName: "main-agent", message: "Working" });
        const second = serializeStreamEvent({ type: "final", agentName: "main-agent", message: "Done" });

        controller.enqueue(encoder.encode(first.slice(0, 20)));
        controller.enqueue(encoder.encode(first.slice(20) + second.slice(0, 15)));
        controller.enqueue(encoder.encode(second.slice(15)));
        controller.close();
      },
    });

    const events: Array<{ type: string; agentName: string; message: string }> = [];
    await readNdjsonStream(stream, (event) => events.push(event));

    expect(events).toEqual([
      { type: "status", agentName: "main-agent", message: "Working" },
      { type: "final", agentName: "main-agent", message: "Done" },
    ]);
  });

  it("throws on malformed ndjson lines", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('{"type":"status"}\nnot-json\n'));
        controller.close();
      },
    });

    await expect(readNdjsonStream(stream, vi.fn())).rejects.toThrow("Invalid NDJSON stream.");
  });

  it("throws on truncated trailing ndjson input", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('{"type":"status","agentName":"main-agent","message":"Working"'));
        controller.close();
      },
    });

    await expect(readNdjsonStream(stream, vi.fn())).rejects.toThrow("Invalid NDJSON stream.");
  });

  it("creates deterministic fake agent events", () => {
    expect(createFakeAgentEvents(" List installed skills ")).toEqual([
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
});
