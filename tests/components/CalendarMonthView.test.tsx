import { describe, it, expect, vi } from 'vitest';
import { createSignal } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { CalendarMonthView } from '../../src/components/CalendarMonthView';
import { CalendarEventItem } from '../../src/lib/ical';

describe('CalendarMonthView Component (CalendarMonthView.tsx)', () => {
  const mockDate = new Date(2026, 9, 15); // October 15, 2026

  const mockEvents: CalendarEventItem[] = [
    {
      id: 'oct-15-evt',
      title: 'Anime Fest 2026',
      start: new Date(2026, 9, 15, 10, 0, 0).toISOString(),
      end: new Date(2026, 9, 15, 12, 0, 0).toISOString(),
      allDay: false,
      type: 'event',
      completed: false,
      color: '#ff6584'
    }
  ];

  it('renders weekday column headers (SUN to SAT)', () => {
    render(() => (
      <CalendarMonthView
        currentDate={mockDate}
        events={[]}
        onSelectDay={() => {}}
        onOpenEvent={() => {}}
      />
    ));

    expect(screen.getByText('SUN')).toBeInTheDocument();
    expect(screen.getByText('MON')).toBeInTheDocument();
    expect(screen.getByText('SAT')).toBeInTheDocument();
  });

  it('renders month days grid and displays event pills on corresponding days', () => {
    render(() => (
      <CalendarMonthView
        currentDate={mockDate}
        events={mockEvents}
        onSelectDay={() => {}}
        onOpenEvent={() => {}}
      />
    ));

    expect(screen.getByText('Anime Fest 2026')).toBeInTheDocument();
  });

  it('triggers onSelectDay callback when a day cell is clicked', () => {
    const onSelectDay = vi.fn();

    const { container } = render(() => (
      <CalendarMonthView
        currentDate={mockDate}
        events={[]}
        onSelectDay={onSelectDay}
        onOpenEvent={() => {}}
      />
    ));

    const dayCells = container.querySelectorAll('.month-day-cell');
    expect(dayCells.length).toBeGreaterThanOrEqual(35);

    fireEvent.click(dayCells[10]);
    expect(onSelectDay).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpenEvent callback when an event pill is clicked', () => {
    const onOpenEvent = vi.fn();

    render(() => (
      <CalendarMonthView
        currentDate={mockDate}
        events={mockEvents}
        onSelectDay={() => {}}
        onOpenEvent={onOpenEvent}
      />
    ));

    const pill = screen.getByText('Anime Fest 2026');
    fireEvent.click(pill);

    expect(onOpenEvent).toHaveBeenCalledTimes(1);
    expect(onOpenEvent.mock.calls[0][0].id).toBe('oct-15-evt');
  });

  it('reactively updates pills when the events prop changes without changing the visible month', () => {
    const [events, setEvents] = createSignal<CalendarEventItem[]>(mockEvents);

    const { container } = render(() => (
      <CalendarMonthView
        currentDate={mockDate}
        events={events()}
        onSelectDay={() => {}}
        onOpenEvent={() => {}}
      />
    ));

    const task: CalendarEventItem = {
      id: 'oct-15-task',
      title: 'Finish Kanji Sheet',
      start: new Date(2026, 9, 15, 18, 0, 0).toISOString(),
      end: new Date(2026, 9, 15, 18, 30, 0).toISOString(),
      allDay: false,
      type: 'task',
      completed: false,
      color: '#00cec9'
    };

    // Inject a new event into the same day (as a filter toggle / store change would).
    setEvents([...mockEvents, task]);
    expect(screen.getByText('Finish Kanji Sheet')).toBeInTheDocument();

    // A task completion toggle must reflect immediately in the pill checkbox.
    setEvents([...mockEvents, { ...task, completed: true }]);
    const checkboxes = container.querySelectorAll('.pill-task-check');
    expect(checkboxes).toHaveLength(1);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
  });

  it('reactively drops hidden events after a category filter hides them', () => {
    const [events, setEvents] = createSignal<CalendarEventItem[]>(mockEvents);

    render(() => (
      <CalendarMonthView
        currentDate={mockDate}
        events={events()}
        onSelectDay={() => {}}
        onOpenEvent={() => {}}
      />
    ));

    expect(screen.getByText('Anime Fest 2026')).toBeInTheDocument();

    // Simulate the parent filter memo returning an empty list.
    setEvents([]);
    expect(screen.queryByText('Anime Fest 2026')).not.toBeInTheDocument();
  });
});
