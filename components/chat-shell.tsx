"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Composer } from "@/components/composer";
import { EventTimeline, type TimelineEvent } from "@/components/event-timeline";
import { MessageList, type ChatMessage } from "@/components/message-list";
import { readNdjsonStream, type ClientStreamEvent } from "@/lib/agents/stream";

type ChatShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  messages: ChatMessage[];
  events: TimelineEvent[];
};

export function ChatShell({ eyebrow, title, description, messages, events }: ChatShellProps) {
  const [prompt, setPrompt] = useState("");
  const [chatMessages, setChatMessages] = useState(messages);
  const [timelineEvents, setTimelineEvents] = useState(events);
  const [isSending, setIsSending] = useState(false);
  const [pendingAssistantMessage, setPendingAssistantMessage] = useState("");
  const pendingAssistantId = useMemo(() => "pending-assistant-message", []);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const appendEvent = (event: ClientStreamEvent) => {
    setTimelineEvents((current) => [
      ...current,
      {
        id: `${event.type}-${current.length + 1}`,
        ...event,
      },
    ]);
  };

  const finalizeAssistantMessage = (message: string) => {
    const content = message.length > 0 ? message : "Request failed";
    setPendingAssistantMessage("");
    setChatMessages((current) => {
      const next = current.filter((entry) => entry.id !== pendingAssistantId);

      return [
        ...next,
        {
          id: `assistant-${next.length + 1}`,
          role: "assistant",
          content,
        },
      ];
    });
  };

  const failRequest = (message: string) => {
    appendEvent({ type: "final", agentName: "main-agent", message });
    finalizeAssistantMessage(message);
  };

  const handleSubmit = async () => {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt || isSending) {
      return;
    }

    setPrompt("");
    setTimelineEvents([]);
    setPendingAssistantMessage("");
    setChatMessages((current) => [
      ...current,
      {
        id: `user-${current.length + 1}`,
        role: "user",
        content: trimmedPrompt,
      },
    ]);
    setIsSending(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        let message = "Request failed";

        try {
          const payload = (await response.json()) as { error?: string };
          message = payload.error?.trim() || message;
        } catch {
          // Ignore JSON parsing errors and use the default message.
        }

        failRequest(message);
        return;
      }

      if (!response.body) {
        failRequest("Request failed");
        return;
      }

      await readNdjsonStream(response.body, (event) => {
        appendEvent(event);

        if (event.type === "response_delta") {
          setPendingAssistantMessage((current) => `${current}${event.message}`);
        }

        if (event.type === "final") {
          finalizeAssistantMessage(event.message);
        }
      }, { signal: abortController.signal });
    } catch {
      if (abortController.signal.aborted || !isMountedRef.current) {
        return;
      }

      failRequest("Request failed");
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }

      if (!abortController.signal.aborted && isMountedRef.current) {
        setIsSending(false);
        setPendingAssistantMessage("");
      }
    }
  };

  const renderedMessages = pendingAssistantMessage
    ? [
        ...chatMessages,
        {
          id: pendingAssistantId,
          role: "assistant" as const,
          content: pendingAssistantMessage,
        },
      ]
    : chatMessages;

  return (
    <section className="chat-shell">
      <header className="hero-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      <div className="chat-grid">
        <div>
          <section className="panel">
            <h2>Runtime Conversation</h2>
            <MessageList messages={renderedMessages} isSending={isSending && !pendingAssistantMessage} />
          </section>

          <Composer value={prompt} isSending={isSending} onChange={setPrompt} onSubmit={handleSubmit} />
        </div>

        <aside className="panel">
          <h3>Runtime Notes</h3>
          <EventTimeline events={timelineEvents} />
        </aside>
      </div>
    </section>
  );
}
