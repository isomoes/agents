import type { ClientStreamEvent } from "@/lib/agents/stream";

export type TimelineEvent = {
  id: string;
} & ClientStreamEvent;

type EventTimelineProps = {
  events: TimelineEvent[];
};

export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <div className="timeline">
      {events.length === 0 ? (
        <article className="timeline-card timeline-card-empty">
          <strong>No runtime events yet</strong>
          <p>Tool results and streamed agent updates show up here after you send a prompt.</p>
        </article>
      ) : null}

      {events.map((event) => (
        <article key={event.id} className="timeline-card">
          <p className="timeline-meta">
            <span>{event.agentName}</span>
            <span>{event.type}</span>
          </p>
          <strong>{event.message}</strong>
        </article>
      ))}
    </div>
  );
}
