import { CalendarEventItem } from '../lib/ical';
import { toggleTask, deleteCalendarEvent, showToast } from '../lib/store';

export function CalendarPopover(props: {
  event: CalendarEventItem | null;
  position: { top: number; left: number } | null;
  onEdit: (ev: CalendarEventItem) => void;
  onClose: () => void;
}) {
  if (!props.event) return null;

  const ev = () => props.event!;
  const s = () => new Date(ev().start);
  const e = () => new Date(ev().end || ev().start);

  const dateStr = () =>
    s().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const timeStr = () =>
    ev().allDay
      ? 'All Day'
      : `${s().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const handleDelete = () => {
    deleteCalendarEvent(ev().id);
    showToast(`Deleted "${ev().title}"`);
    props.onClose();
  };

  const handleToggle = () => {
    toggleTask(ev().id);
  };

  return (
    <div
      class="gcal-popover"
      style={{
        display: 'block',
        top: props.position ? `${props.position.top}px` : '50%',
        left: props.position ? `${props.position.left}px` : '50%',
        transform: props.position ? 'none' : 'translate(-50%, -50%)',
        position: 'fixed',
        'z-index': 1100
      }}
    >
      <div class="popover-header">
        <div
          class="popover-color-stripe"
          style={{ background: ev().color || '#ff6584' }}
        />
        <div class="popover-actions">
          {ev().type === 'task' && (
            <button
              class="popover-btn"
              title="Toggle Completed"
              onClick={handleToggle}
            >
              {ev().completed ? '↩️' : '✅'}
            </button>
          )}
          <button
            class="popover-btn"
            title="Edit Event"
            onClick={() => props.onEdit(ev())}
          >
            ✏️
          </button>
          <button
            class="popover-btn popover-btn-del"
            title="Delete Event"
            onClick={handleDelete}
          >
            🗑️
          </button>
          <button
            class="popover-btn"
            title="Close"
            onClick={props.onClose}
          >
            ✕
          </button>
        </div>
      </div>

      <div class="popover-body">
        <h3 class="popover-title">{ev().title}</h3>
        <div class="popover-time">
          {dateStr()} · {timeStr()}
        </div>
        <div
          class="popover-badge"
          style={{ background: ev().color || '#ff6584' }}
        >
          {ev().type.toUpperCase()}
          {ev().completed ? ' (COMPLETED)' : ''}
        </div>
        {ev().location && (
          <div class="popover-loc">📍 {ev().location}</div>
        )}
        {ev().description && (
          <div class="popover-desc">{ev().description}</div>
        )}
      </div>
    </div>
  );
}
