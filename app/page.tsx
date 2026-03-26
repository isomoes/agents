import { ChatShell } from "@/components/chat-shell";

const demoMessages = [
  {
    id: "intro-user",
    role: "user" as const,
    content: "What functions are available in this MVP runtime?",
  },
  {
    id: "intro-assistant",
    role: "assistant" as const,
    content:
      "Right now the runtime exposes a single approved function, `get_installed_skills`, through the `run_function` tool.",
  },
];

const demoEvents = [
  {
    id: "timeline-1",
    type: "status" as const,
    agentName: "main-agent",
    message: "Single-agent now, deep-agent behind a flag.",
  },
  {
    id: "timeline-2",
    type: "tool_result" as const,
    agentName: "main-agent",
    message: "`run_function` wraps `get_installed_skills` with a zod schema.",
  },
  {
    id: "timeline-3",
    type: "status" as const,
    agentName: "main-agent",
    message: "The runtime keeps a single invoke and stream interface for both modes.",
  },
];

export default function Page() {
  return (
    <main className="page-shell">
      <ChatShell
        eyebrow="DeepAgents MVP"
        title="DeepAgents Runtime"
        description="A runtime foundation for one active agent, one approved server function, and a clean path to deeper multi-agent orchestration."
        messages={demoMessages}
        events={demoEvents}
      />
    </main>
  );
}
