export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type MessageListProps = {
  messages: ChatMessage[];
  isSending?: boolean;
};

export function MessageList({ messages, isSending = false }: MessageListProps) {
  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <article className="message-card message-card-empty">
          <p className="message-role">Ready</p>
          <p className="message-body">Ask the runtime about its tools, mode, or streaming behavior.</p>
        </article>
      ) : null}

      {messages.map((message) => (
        <article key={message.id} className="message-card" data-role={message.role}>
          <p className="message-role">{message.role}</p>
          <p className="message-body">{message.content}</p>
        </article>
      ))}

      {isSending ? (
        <article className="message-card message-card-pending" data-role="assistant" aria-live="polite">
          <p className="message-role">assistant</p>
          <p className="message-body">Thinking...</p>
        </article>
      ) : null}
    </div>
  );
}
