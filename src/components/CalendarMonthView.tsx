import { For } from 'solid-js';
import { CalendarEventItem } from '../lib/ical';
import { updateCalendarEvent, toggleTask, showToast, isSameDay, getEventsForDate } from '../lib/store';
import { t, formatDate } from '../lib/i18n';
import { onActivateKey } from '../lib/accessibility';

export function CalendarMonthView(props: {
  currentDate: Date;
  events: CalendarEventItem[];
  onSelectDay: (d: Date) => void;
  onOpenEvent: (ev: CalendarEventItem, anchorRect?: DOMRect) => void;
}) {
  const year = () => props.currentDate.getFullYear();
  const month = () => props.currentDate.getMonth();

  const getDays = () => {
    const y = year();
    const m = month();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);

    const startIdx = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const prevMonthDays = new Date(y, m, 0).getDate();

    const days: { date: Date; currentMonth: boolean }[] = [];

    for (let i = startIdx - 1; i >= 0; i--) {
      days.push({
        date: new Date(y, m - 1, prevMonthDays - i),
        currentMonth: false
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(y, m, i),
        currentMonth: true
      });
    }

    let nextDay = 1;
    while (days.length % 7 !== 0 || days.length < 35) {
      days.push({
        date: new Date(y, m + 1, nextDay++),
        currentMonth: false
      });
    }

    return days;
  };

  const today = new Date();

  const handleDragStart = (e: DragEvent, ev: CalendarEventItem) => {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'calendar-event', id: ev.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: DragEvent, targetDate: Date) => {
    e.preventDefault();
    if (!e.dataTransfer) return;
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (data.type === 'calendar-event' || data.type === 'sidebar-task') {
        const ev = props.events.find(x => x.id === data.id);
        if (!ev) return;

        const oldStart = new Date(ev.start);
        const oldEnd = new Date(ev.end || ev.start);
        const duration = oldEnd.getTime() - oldStart.getTime();

        const newStart = new Date(targetDate);
        newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
        const newEnd = new Date(newStart.getTime() + (duration > 0 ? duration : 3600000));

        updateCalendarEvent(ev.id, {
          start: newStart.toISOString(),
          end: newEnd.toISOString()
        });
        showToast(t('calendar.toasts.rescheduled', { title: ev.title, date: formatDate(targetDate) }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div class="month-grid-container">
      <div class="month-header-row">
        <div class="month-col-header">{t('calendar.weekdays.sun')}</div>
        <div class="month-col-header">{t('calendar.weekdays.mon')}</div>
        <div class="month-col-header">{t('calendar.weekdays.tue')}</div>
        <div class="month-col-header">{t('calendar.weekdays.wed')}</div>
        <div class="month-col-header">{t('calendar.weekdays.thu')}</div>
        <div class="month-col-header">{t('calendar.weekdays.fri')}</div>
        <div class="month-col-header">{t('calendar.weekdays.sat')}</div>
      </div>

      <div class="month-days-grid">
        <For each={getDays()}>
          {dayObj => {
            const d = dayObj.date;
            const isToday = isSameDay(d, today);
            const dayEvts = () => getEventsForDate(props.events, d);

            return (
              <div
                class={`month-day-cell ${dayObj.currentMonth ? '' : 'outside-month'} ${isToday ? 'today' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, d)}
                onClick={e => {
                  const target = e.target as HTMLElement;
                  if (target.closest('.event-pill')) return;
                  props.onSelectDay(d);
                }}
              >
                <div class="day-cell-top">
                  <span class={`day-num ${isToday ? 'today-badge' : ''}`}>
                    {d.getDate()}
                  </span>
                </div>

                <div class="day-events-wrapper">
                  <For each={dayEvts().slice(0, 4)}>
                    {ev => {
                      const startTime = ev.allDay
                        ? ''
                        : new Date(ev.start).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          });

                      return (
                        <div
                          class={`event-pill ${ev.type === 'task' && ev.completed ? 'completed' : ''}`}
                          style={{ background: ev.color || '#ff6584' }}
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
                          {ev.type === 'task' && (
                            <input
                              type="checkbox"
                              class="pill-task-check"
                              checked={ev.completed}
                              onClick={e => {
                                e.stopPropagation();
                                toggleTask(ev.id);
                              }}
                            />
                          )}
                          {ev.type === 'birthday' && <span class="pill-icon">🎂</span>}
                          <span class="pill-title">
                            {startTime && <small>{startTime} </small>}
                            {ev.title}
                            {ev.recurrence && ev.recurrence !== 'none' && (
                              <span class="pill-repeat-icon" title={t('calendar.sidebar.repeats', { rule: ev.recurrence })}> 🔁</span>
                            )}
                          </span>
                        </div>
                      );
                    }}
                  </For>
                  {dayEvts().length > 4 && (
                    <div class="more-events-tag">{t('calendar.moreEvents', { count: dayEvts().length - 4 })}</div>
                  )}
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
