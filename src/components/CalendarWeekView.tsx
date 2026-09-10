import { For, onMount } from 'solid-js';
import { CalendarEventItem } from '../lib/ical';
import { updateCalendarEvent, toggleTask, showToast } from '../lib/store';

export function CalendarWeekView(props: {
  currentDate: Date;
  events: CalendarEventItem[];
  onSelectSlot: (d: Date) => void;
  onOpenEvent: (ev: CalendarEventItem, anchorRect?: DOMRect) => void;
}) {
  let scrollContainerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (scrollContainerRef) {
      scrollContainerRef.scrollTop = 480; // Scroll to 8 AM
    }
  });

  const getStartOfWeek = (d: Date) => {
    const res = new Date(d);
    const day = res.getDay();
    res.setDate(res.getDate() - day);
    res.setHours(0, 0, 0, 0);
    return res;
  };

  const weekDays = () => {
    const start = getStartOfWeek(props.currentDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(start.getTime() + i * 86400000));
    }
    return days;
  };

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const today = new Date();

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
      height: `${Math.max(height, 2.2)}%`
    };
  };

  const handleDragStart = (e: DragEvent, ev: CalendarEventItem) => {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'calendar-event', id: ev.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: DragEvent, targetDay: Date, hour: number) => {
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

      const newStart = new Date(targetDay);
      newStart.setHours(hour, 0, 0, 0);
      const newEnd = new Date(newStart.getTime() + (duration > 0 ? duration : 3600000));

      updateCalendarEvent(ev.id, {
        start: newStart.toISOString(),
        end: newEnd.toISOString()
      });
      showToast(`Rescheduled "${ev.title}" to ${newStart.toLocaleDateString()} ${hour}:00`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div class="week-view-container" style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
      {/* Week Header */}
      <div class="week-header-row">
        <div class="time-gutter-header">GMT</div>
        <For each={weekDays()}>
          {d => {
            const isT = isSameDay(d, today);
            return (
              <div class={`week-header-day ${isT ? 'today' : ''}`}>
                <span class="week-day-name">
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span class={`week-day-num ${isT ? 'today-badge' : ''}`}>
                  {d.getDate()}
                </span>
              </div>
            );
          }}
        </For>
      </div>

      {/* 24-Hour Time Grid */}
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

        <div class="week-columns-wrapper">
          <For each={weekDays()}>
            {day => {
              const isT = isSameDay(day, today);
              const dayEvents = props.events.filter(e => isSameDay(new Date(e.start), day));

              return (
                <div class={`week-day-column ${isT ? 'today-col' : ''}`}>
                  <For each={Array.from({ length: 24 })}>
                    {(_, idx) => {
                      const h = idx();
                      return (
                        <div
                          class="week-hour-cell"
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => handleDrop(e, day, h)}
                          onClick={() => {
                            const targetDate = new Date(day);
                            targetDate.setHours(h, 0, 0, 0);
                            props.onSelectSlot(targetDate);
                          }}
                        />
                      );
                    }}
                  </For>

                  {isT && (
                    <div
                      class="current-time-line"
                      style={{ top: `${getCurrentTimePercent()}%` }}
                    />
                  )}

                  <div class="week-events-layer">
                    <For each={dayEvents}>
                      {ev => {
                        const pos = getEventPosition(ev);
                        const s = new Date(ev.start);
                        const timeStr = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

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
                            </div>
                            <span class="card-time">{timeStr}</span>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}
