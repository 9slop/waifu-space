import { For, Show, onMount, createSignal } from 'solid-js';
import { CalendarEventItem } from '../lib/ical';
import { updateCalendarEvent, toggleTask, showToast, isSameDay, getEventsForDate } from '../lib/store';

export function CalendarDayView(props: {
  currentDate: Date;
  events: CalendarEventItem[];
  onSelectSlot: (d: Date) => void;
  onSelectRange?: (range: { start: Date; end: Date }) => void;
  onOpenEvent: (ev: CalendarEventItem, anchorRect?: DOMRect) => void;
}) {
  let scrollContainerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (scrollContainerRef) {
      scrollContainerRef.scrollTop = 480;
    }
  });

  const today = new Date();
  const isToday = () => isSameDay(props.currentDate, today);

  const dayEvents = () => getEventsForDate(props.events, props.currentDate);

  const getCurrentTimePercent = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 1440) * 100;
  };

  const getEventPosition = (ev: CalendarEventItem) => {
    const s = new Date(ev.start);
    const e = new Date(ev.end || ev.start);
    const startMin = s.getHours() * 60 + s.getMinutes();
    let durationMin = (e.getTime() - s.getTime()) / 60000;
    if (durationMin < 25) durationMin = 30;

    const top = (startMin / 1440) * 100;
    const height = Math.min((durationMin / 1440) * 100, 100 - top);

    return {
      top: `${top}%`,
      height: `${Math.max(height, 2.5)}%`
    };
  };

  const handleDragStart = (e: DragEvent, ev: CalendarEventItem) => {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'calendar-event', id: ev.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: DragEvent, hour: number) => {
    e.preventDefault();
    if (!e.dataTransfer) return;
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      const ev = props.events.find(x => x.id === data.id);
      if (!ev) return;

      const oldStart = new Date(ev.start);
      const oldEnd = new Date(ev.end || ev.start);
      const duration = oldEnd.getTime() - oldStart.getTime();

      // 15-minute precision calculation based on drop point in cell
      let minute = 0;
      const targetCell = e.currentTarget as HTMLElement;
      if (targetCell) {
        const rect = targetCell.getBoundingClientRect();
        const relY = Math.max(0, Math.min(rect.height - 1, e.clientY - rect.top));
        const fraction = relY / rect.height;
        minute = Math.floor(fraction * 4) * 15; // 0, 15, 30, 45
      }

      const newStart = new Date(props.currentDate);
      newStart.setHours(hour, minute, 0, 0);
      const newEnd = new Date(newStart.getTime() + (duration > 0 ? duration : 3600000));

      updateCalendarEvent(ev.id, {
        start: newStart.toISOString(),
        end: newEnd.toISOString()
      });
      const minStr = minute < 10 ? '0' + minute : minute;
      showToast(`Rescheduled "${ev.title}" to ${hour}:${minStr}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Click-and-drag to create
  interface DragCreateState {
    startMin: number;
    currentMin: number;
    hasMoved: boolean;
  }
  const [dragCreate, setDragCreate] = createSignal<DragCreateState | null>(null);

  const startDragCreate = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.week-event-card') || target.tagName === 'INPUT' || target.tagName === 'BUTTON') {
      return;
    }

    const colEl = e.currentTarget as HTMLElement;
    const rect = colEl.getBoundingClientRect();
    const relY = Math.max(0, Math.min(rect.height - 1, e.clientY - rect.top));
    const fraction = relY / rect.height;
    const exactMin = fraction * 1440;
    const snappedMin = Math.floor(exactMin / 15) * 15;

    setDragCreate({
      startMin: snappedMin,
      currentMin: Math.min(1440, snappedMin + 30),
      hasMoved: false
    });

    const onMouseMove = (moveEv: MouseEvent) => {
      const currRect = colEl.getBoundingClientRect();
      const currRelY = Math.max(0, Math.min(currRect.height - 1, moveEv.clientY - currRect.top));
      const currFrac = currRelY / currRect.height;
      const currExactMin = currFrac * 1440;
      const currSnappedMin = Math.round(currExactMin / 15) * 15;

      setDragCreate(prev => {
        if (!prev) return null;
        return {
          ...prev,
          currentMin: Math.max(0, Math.min(1440, currSnappedMin)),
          hasMoved: true
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const state = dragCreate();
      if (!state) return;

      const minM = Math.min(state.startMin, state.currentMin);
      let maxM = Math.max(state.startMin, state.currentMin);
      if (maxM - minM < 15) maxM = minM + 30;

      const startDate = new Date(props.currentDate);
      startDate.setHours(Math.floor(minM / 60), minM % 60, 0, 0);

      const endDate = new Date(props.currentDate);
      endDate.setHours(Math.floor(maxM / 60), maxM % 60, 0, 0);

      setDragCreate(null);

      if (state.hasMoved && props.onSelectRange) {
        props.onSelectRange({ start: startDate, end: endDate });
      } else {
        props.onSelectSlot(startDate);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const formatDragTime = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const period = h < 12 ? 'AM' : 'PM';
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayH}:${m < 10 ? '0' + m : m} ${period}`;
  };

  return (
    <div class="day-view-container" style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
      <div class="week-header-row" style={{ 'padding-left': '60px' }}>
        <div class="week-header-day" style={{ 'justify-content': 'center' }}>
          <span class="week-day-name">
            {props.currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
          </span>
          <span class={`week-day-num ${isToday() ? 'today-badge' : ''}`}>
            {props.currentDate.getDate()}
          </span>
        </div>
      </div>

      <div class="week-time-grid" ref={scrollContainerRef}>
        <div class="time-gutter">
          <For each={Array.from({ length: 24 })}>
            {(_, idx) => {
              const h = idx();
              const label = h === 0 ? '' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
              return (
                <div class="time-slot-label">
                  <span>{label}</span>
                </div>
              );
            }}
          </For>
        </div>

        <div class="week-columns-wrapper" style={{ flex: 1 }}>
          <div
            class={`week-day-column ${isToday() ? 'today-col' : ''}`}
            style={{ width: '100%' }}
            onMouseDown={e => startDragCreate(e)}
          >
            <For each={Array.from({ length: 24 })}>
              {(_, idx) => {
                const h = idx();
                return (
                  <div
                    class="week-hour-cell"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(e, h)}
                  />
                );
              }}
            </For>

            {isToday() && (
              <div
                class="current-time-line"
                style={{ top: `${getCurrentTimePercent()}%` }}
              />
            )}

            {/* Drag-to-create Ghost Preview Box */}
            <Show when={dragCreate()}>
              {() => {
                const dc = dragCreate()!;
                const start = Math.min(dc.startMin, dc.currentMin);
                const end = Math.max(dc.startMin, dc.currentMin, start + 15);
                const topPct = (start / 1440) * 100;
                const heightPct = Math.max(1.6, ((end - start) / 1440) * 100);

                return (
                  <div
                    class="drag-create-preview"
                    style={{
                      top: `${topPct}%`,
                      height: `${heightPct}%`
                    }}
                  >
                    <span class="drag-create-title">(New Event)</span>
                    <span class="drag-create-time">
                      {formatDragTime(start)} – {formatDragTime(end)}
                    </span>
                  </div>
                );
              }}
            </Show>

            <div class="week-events-layer">
              <For each={dayEvents()}>
                {ev => {
                  const pos = getEventPosition(ev);
                  const s = new Date(ev.start);
                  const e = new Date(ev.end || ev.start);
                  const timeStr = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                  return (
                    <div
                      class={`week-event-card ${ev.type === 'task' && ev.completed ? 'completed' : ''}`}
                      style={{
                        top: pos.top,
                        height: pos.height,
                        background: ev.color || '#ff6584'
                      }}
                      draggable={true}
                      onDragStart={e => handleDragStart(e, ev)}
                      onClick={e => {
                        e.stopPropagation();
                        props.onOpenEvent(ev, e.currentTarget.getBoundingClientRect());
                      }}
                    >
                      <div class="event-card-header">
                        {ev.type === 'task' && (
                          <input
                            type="checkbox"
                            class="card-task-check"
                            checked={ev.completed}
                            onClick={e => {
                              e.stopPropagation();
                              toggleTask(ev.id);
                            }}
                          />
                        )}
                        <span class="card-title">{ev.title}</span>
                        {ev.recurrence && ev.recurrence !== 'none' && (
                          <span class="card-repeat-icon" title={`Repeats: ${ev.recurrence}`}>🔁</span>
                        )}
                      </div>
                      <span class="card-time">{timeStr}</span>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
