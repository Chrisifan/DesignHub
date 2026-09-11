export type TimelineEvent = {
  id: string;
  kind: 'message' | 'tool' | 'revision' | 'handoff' | 'finalized';
  label: string;
  revisionId?: string;
  timestamp?: string;
};

export type TimelineProps = {
  events: TimelineEvent[];
};

export const Timeline = ({ events }: TimelineProps) => (
  <ol className="revision-timeline" aria-label="Revision timeline">
    {events.map((event) => (
      <li key={event.id} className={`revision-timeline__event revision-timeline__event--${event.kind}`}>
        <div>
          <strong>{event.label}</strong>
          {event.revisionId && <span className="revision-timeline__revision">{event.revisionId}</span>}
        </div>
        {event.timestamp && <time dateTime={event.timestamp}>{event.timestamp}</time>}
      </li>
    ))}
  </ol>
);
