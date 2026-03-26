import { createAgentRuntime } from "@/lib/agents/runtime";
import {
  createFakeAgentEvents,
  normalizeRuntimeStreamEvent,
  serializeStreamEvent,
  type ClientStreamEvent,
} from "@/lib/agents/stream";
import type { AgentStreamEvent } from "@/lib/agents/types";

const headers = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
};

const FAKE_AGENT_EVENT_DELAY_MS = 200;

function finalFailureEvent(): ClientStreamEvent {
  return {
    type: "final",
    agentName: "main-agent",
    message: "Request failed",
  };
}

function isFakeAgentModeEnabled(source: Record<string, string | undefined> = process.env) {
  return source.E2E_USE_FAKE_AGENT === "true" && source.NODE_ENV !== "production";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { prompt?: string };
  const prompt = payload.prompt?.trim() ?? "";

  if (!prompt) {
    return Response.json({ error: "Prompt is required." }, { status: 400 });
  }

  const fakeModeEnabled = isFakeAgentModeEnabled();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let finalMessage = "";
      let runtimeEmittedFinal = false;
      let aborted = request.signal.aborted;
      let closed = false;
      let iterator: AsyncIterator<AgentStreamEvent> | undefined;

      const enqueueEvent = (event: ClientStreamEvent) => {
        if (aborted || closed) {
          return;
        }

        controller.enqueue(encoder.encode(serializeStreamEvent(event)));
      };

      const closeStream = () => {
        if (closed) {
          return;
        }

        closed = true;
        controller.close();
      };

      const handleAbort = () => {
        aborted = true;
        void iterator?.return?.();
        closeStream();
      };

      request.signal.addEventListener("abort", handleAbort, { once: true });

      try {
        if (fakeModeEnabled) {
          const fakeEvents = createFakeAgentEvents(prompt);

          for (const [index, event] of fakeEvents.entries()) {
            enqueueEvent(event);

            if (index < fakeEvents.length - 1) {
              await wait(FAKE_AGENT_EVENT_DELAY_MS);
            }
          }

          closeStream();
          return;
        }

        const runtime = createAgentRuntime();
        iterator = runtime.streamEvents({
          messages: [{ role: "user", content: prompt }],
        })[Symbol.asyncIterator]();

        while (!aborted) {
          const next = await iterator.next();
          if (next.done) {
            break;
          }

          for (const event of normalizeRuntimeStreamEvent(next.value)) {
            if (event.type === "response_delta") {
              finalMessage += event.message;
            }

            if (event.type === "final") {
              runtimeEmittedFinal = true;
              finalMessage = event.message;
            }

            enqueueEvent(event);
          }
        }

        if (!aborted && !runtimeEmittedFinal) {
          enqueueEvent({
            type: "final",
            agentName: "main-agent",
            message: finalMessage.length > 0 ? finalMessage : "Request complete.",
          });
        }

        closeStream();
      } catch {
        if (!aborted && !runtimeEmittedFinal) {
          enqueueEvent(finalFailureEvent());
        }

        closeStream();
      } finally {
        request.signal.removeEventListener("abort", handleAbort);
        await iterator?.return?.().catch(() => undefined);
      }
    },
  });

  return new Response(stream, { headers });
}
