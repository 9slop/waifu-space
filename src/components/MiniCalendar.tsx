import { createSignal, For } from 'solid-js';
import { t, getLocale } from '../lib/i18n';

export function MiniCalendar(props: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}) {
  const [navDate, setNavDate] = createSignal(new Date(props.selectedDate));

  const prevMonth = () => {
    const d = new Date(navDate());
    d.setMonth(d.getMonth() - 1);
    setNavDate(d);
  };

  const nextMonth = () => {
    const d = new Date(navDate());
    d.setMonth(d.getMonth() + 1);
    setNavDate(d);
  };

  const daysInGrid = () => {
    const year = navDate().getFullYear();
    const month = navDate().getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startIdx = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: { date: Date; currentMonth: boolean }[] = [];

    for (let i = startIdx - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        currentMonth: false
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        currentMonth: true
      });
    }

    let nextDay = 1;
    while (days.length % 7 !== 0 || days.length < 35) {
      days.push({
        date: new Date(year, month + 1, nextDay++),
        currentMonth: false
      });
    }

    return days;
  };

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const today = new Date();

  return (
    <div class="mini-cal-card">
      <div class="mini-cal-header">
        <span>
          {navDate().toLocaleDateString(getLocale(), { month: 'short', year: 'numeric' })}
        </span>
        <div class="mini-nav">
          <button type="button" onClick={prevMonth}>◀</button>
          <button type="button" onClick={nextMonth}>▶</button>
        </div>
      </div>
      <div class="mini-cal-grid">
        <div class="mini-day-label">{t('calendar.weekdaysInitial.sun')}</div>
        <div class="mini-day-label">{t('calendar.weekdaysInitial.mon')}</div>
        <div class="mini-day-label">{t('calendar.weekdaysInitial.tue')}</div>
        <div class="mini-day-label">{t('calendar.weekdaysInitial.wed')}</div>
        <div class="mini-day-label">{t('calendar.weekdaysInitial.thu')}</div>
        <div class="mini-day-label">{t('calendar.weekdaysInitial.fri')}</div>
        <div class="mini-day-label">{t('calendar.weekdaysInitial.sat')}</div>

        <For each={daysInGrid()}>
          {item => {
            const isToday = isSameDay(item.date, today);
            const isSelected = isSameDay(item.date, props.selectedDate);
            return (
              <div
                class={`mini-day ${item.currentMonth ? '' : 'outside'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                style={{ opacity: item.currentMonth ? '1' : '0.35' }}
                onClick={() => {
                  props.onSelectDate(item.date);
                }}
              >
                {item.date.getDate()}
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
