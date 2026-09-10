import { describe, it, expect, vi } from 'vitest';
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
});
