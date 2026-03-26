import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ChatShell } from "@/components/chat-shell";
import { serializeStreamEvent } from "@/lib/agents/stream";

function createNdjsonResponse(...lines: string[]) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(lines.join("")));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson",
      },
    },
  );
}

describe("ChatShell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ignores blank prompts", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <ChatShell
        eyebrow="DeepAgents MVP"
        title="DeepAgents Runtime"
        description="Streaming test"
        messages={[]}
        events={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/send a prompt/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /send prompt/i }));

    await waitFor(() => {
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it("streams events, resets old timeline entries, and finalizes the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
      createNdjsonResponse(
        serializeStreamEvent({
          type: "tool_result",
          agentName: "main-agent",
          message: "run_function: Installed skills loaded.",
        }),
        serializeStreamEvent({
          type: "response_delta",
          agentName: "main-agent",
          message: "Hello",
        }),
        serializeStreamEvent({
          type: "final",
          agentName: "main-agent",
          message: "Hello from the runtime",
        }),
      ),
      ),
    );

    render(
      <ChatShell
        eyebrow="DeepAgents MVP"
        title="DeepAgents Runtime"
        description="Streaming test"
        messages={[]}
        events={[
          {
            id: "old-event",
            type: "status",
            agentName: "main-agent",
            message: "Old event",
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/send a prompt/i), {
      target: { value: "List installed skills" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send prompt/i }));

    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getAllByText("Hello from the runtime")).toHaveLength(2);
    });
    expect(screen.queryByText("Old event")).not.toBeInTheDocument();
    expect(screen.getAllByText("main-agent").length).toBeGreaterThan(0);
    expect(screen.getByText("tool_result")).toBeInTheDocument();
  });

  it("preserves whitespace across streamed assistant deltas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createNdjsonResponse(
          serializeStreamEvent({
            type: "response_delta",
            agentName: "main-agent",
            message: "Hello",
          }),
          serializeStreamEvent({
            type: "response_delta",
            agentName: "main-agent",
            message: " there",
          }),
          serializeStreamEvent({
            type: "final",
            agentName: "main-agent",
            message: "Hello there",
          }),
        ),
      ),
    );

    render(
      <ChatShell
        eyebrow="DeepAgents MVP"
        title="DeepAgents Runtime"
        description="Streaming test"
        messages={[]}
        events={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/send a prompt/i), {
      target: { value: "List installed skills" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send prompt/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Hello there")).toHaveLength(2);
    });
  });

  it("handles failed responses without a stream body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Prompt is required." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(
      <ChatShell
        eyebrow="DeepAgents MVP"
        title="DeepAgents Runtime"
        description="Streaming test"
        messages={[]}
        events={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/send a prompt/i), {
      target: { value: "List installed skills" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send prompt/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Prompt is required.")).toHaveLength(2);
    });
    expect(screen.getByText("final")).toBeInTheDocument();
  });

  it("aborts in-flight requests when the component unmounts", async () => {
    let aborted = false;
    const fetchSpy = vi.fn().mockImplementation((_input, init?: RequestInit) => {
      const signal = init?.signal;

      if (signal) {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
      }

      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { unmount } = render(
      <ChatShell
        eyebrow="DeepAgents MVP"
        title="DeepAgents Runtime"
        description="Streaming test"
        messages={[]}
        events={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/send a prompt/i), {
      target: { value: "List installed skills" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send prompt/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    unmount();

    await waitFor(() => {
      expect(aborted).toBe(true);
    });
  });
});
