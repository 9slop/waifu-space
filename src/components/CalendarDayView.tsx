import { For, Show, onMount, createSignal } from 'solid-js';
import { CalendarEventItem } from '../lib/ical';
import { updateCalendarEvent, toggleTask, showToast, isSameDay, getEventsForDate } from '../lib/store';
import { layoutTimedEvents } from '../lib/calendar-layout';
import { t, getLocale, holidayTooltip } from '../lib/i18n';
import { countryFlagEmoji } from '../lib/countries';
import { onActivateKey } from '../lib/accessibility';

export function CalendarDayView(props: {
  currentDate: Date;
  events: CalendarEventItem[];
  onSelectSlot: (d: Date) => void;
  onSelectRange?: (range: { start: Date; end: Date }) => void;
  onOpenEvent: (ev: CalendarEventItem, anchorRect?: DOMRect) => void;
  onRequestMove?: (ev: CalendarEventItem, start: Date, end: Date, dateKey?: string) => void;
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
  const allDayEvents = () => dayEvents().filter(ev => ev.allDay);
  const timedLayouts = () => layoutTimedEvents(dayEvents().filter(ev => !ev.allDay));

  const getCurrentTimePercent = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 1440) * 100;
  };

const handleDragStart = (e: DragEvent, ev: CalendarEventItem) => {
    if (!e.dataTransfer) return;
    if (ev._holiday) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'calendar-event', id: ev.id, dateKey: ev.dateKey }));
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
      // Country holidays are read-only and must never be moved by a drop.
      if (ev._holiday) return;

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

      const minStr = minute < 10 ? '0' + minute : minute;

      if (data.dateKey && ev.recurrence && ev.recurrence !== 'none' && props.onRequestMove) {
        props.onRequestMove(ev, newStart, newEnd, data.dateKey);
        showToast(t('calendar.toasts.rescheduled', { title: ev.title, date: `${hour}:${minStr}` }));
        return;
      }

      updateCalendarEvent(ev.id, {
        start: newStart.toISOString(),
        end: newEnd.toISOString()
      });
      showToast(t('calendar.toasts.rescheduled', {
        title: ev.title,
        date: `${hour}:${minStr}`
      }));
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
      if (typeof window !== 'undefined') {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }

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

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
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
            {props.currentDate.toLocaleDateString(getLocale(), { weekday: 'long' })}
          </span>
          <span class={`week-day-num ${isToday() ? 'today-badge' : ''}`}>
            {props.currentDate.getDate()}
          </span>
        </div>
      </div>

      {/* All-Day Strip */}
      <div class="week-allday-strip">
        <div class="allday-gutter">{t('calendar.alldayLabel')}</div>
        <div class="week-allday-day">
          <For each={allDayEvents()}>
            {ev => (
              <div
                class={`allday-pill ${ev._holiday ? 'holiday' : ''}`}
                style={{ background: ev.color || '#ff6584' }}
                role="button"
                tabindex="0"
                aria-label={t('calendar.a11y.openEvent', { title: ev.title })}
                title={ev._holiday ? holidayTooltip(ev._holiday) : undefined}
                draggable={!ev._holiday}
                onDragStart={e => handleDragStart(e, ev)}
                onClick={e => {
                  e.stopPropagation();
                  props.onOpenEvent(ev, e.currentTarget.getBoundingClientRect());
                }}
                onKeyDown={e => onActivateKey(e, () => props.onOpenEvent(ev))}
              >
                {ev.type === 'task' && (
                  <input
                    type="checkbox"
                    class="pill-task-check"
                    checked={ev.completed}
                    onClick={e => {
                      e.stopPropagation();
                      toggleTask(ev.id, ev.dateKey);
                    }}
                  />
                )}
                {ev._holiday && <span class="pill-holiday-flag">{ev._holiday.culture ? '🎉' : countryFlagEmoji(ev._holiday.countryCode)}</span>}
                <span class="allday-pill-title">{ev.title}</span>
              </div>
            )}
          </For>
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
              {(dcAccessor) => {
                const dc = dcAccessor();
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
              <For each={timedLayouts()}>
                {layout => {
                  const ev = layout.ev;
                  const s = new Date(ev.start);
                  const e = new Date(ev.end || ev.start);
                  const timeStr = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                  return (
                    <div
                      class={`week-event-card ${ev.type === 'task' && ev.completed ? 'completed' : ''}`}
                      style={{
                        top: `${layout.topPct}%`,
                        height: `${layout.heightPct}%`,
                        left: `calc(${layout.leftPct}% + 2px)`,
                        width: `calc(${layout.widthPct}% - 4px)`,
                        background: ev.color || '#ff6584'
                      }}
                      role="button"
                      tabindex="0"
                      aria-label={t('calendar.a11y.openEvent', { title: ev.title })}
                      draggable={true}
                      onDragStart={e => handleDragStart(e, ev)}
                      onClick={e => {
                        e.stopPropagation();
                        props.onOpenEvent(ev, e.currentTarget.getBoundingClientRect());
                      }}
                      onKeyDown={e => onActivateKey(e, () => props.onOpenEvent(ev))}
                    >
                      <div class="event-card-header">
                        {ev.type === 'task' && (
                          <input
                            type="checkbox"
                            class="card-task-check"
                            checked={ev.completed}
                            onClick={e => {
                              e.stopPropagation();
                              toggleTask(ev.id, ev.dateKey);
                            }}
                          />
                        )}
                        <span class="card-title">{ev.title}</span>
                        {ev.recurrence && ev.recurrence !== 'none' && (
                          <span class="card-repeat-icon" title={`Repeats: ${ev.recurrence}`}>🔁</span>
                        )}
                      </div>
                      <span class="card-time">{timeStr}</span>
                      {ev.location && <span class="card-loc">📍 {ev.location}</span>}
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
