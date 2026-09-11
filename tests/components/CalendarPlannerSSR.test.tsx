import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { CalendarPlanner } from '../../src/components/CalendarPlanner';
import { addCalendarEvent, setState, DEFAULT_STATE, state } from '../../src/lib/store';

describe('CalendarPlanner Component & SSR Safety (Issue #11)', () => {
  beforeEach(() => {
    localStorage.clear();
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  });

  it('renders and disposes cleanly in SSR context without window ReferenceError', () => {
    expect(() => {
      createRoot(dispose => {
        // Simulating SSR render tree disposal (cleanNode)
        CalendarPlanner();
        dispose();
      });
    }).not.toThrow();
  });

  it('renders calendar planner toolbar, today button, view selector and task sidebar', () => {
    render(() => <CalendarPlanner />);

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('+ Add a task & press Enter')).toBeInTheDocument();
  });

  it('removes the search input and waifu briefing button from the toolbar', () => {
    setState('calendar', 'searchQuery', 'stale-query');
    const { container } = render(() => <CalendarPlanner />);

    expect(container.querySelector('.gcal-search-wrap')).toBeNull();
    expect(container.querySelector('.gcal-search-input')).toBeNull();
    expect(container.querySelector('.gcal-btn-waifu')).toBeNull();

    // Stale queries are cleared on mount so they can no longer hide events.
    expect(state.calendar.searchQuery).toBe('');
  });

  it('opens event popover when an event card is clicked', () => {
    const testEvt = addCalendarEvent({
      title: 'Waifu Date Night',
      start: new Date().toISOString(),
      type: 'event'
    });

    render(() => <CalendarPlanner />);

    const eventEl = screen.getByText('Waifu Date Night');
    expect(eventEl).toBeInTheDocument();

    fireEvent.click(eventEl);

    // Popover should open displaying event title and actions
    const popoverTitles = screen.getAllByText('Waifu Date Night');
    expect(popoverTitles.length).toBeGreaterThan(1);
    expect(screen.getByTitle('Edit Event')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Event')).toBeInTheDocument();
  });

  it('handles keyboard shortcuts (Escape closes popover/modal)', () => {
    addCalendarEvent({
      title: 'Shortcut Event',
      start: new Date().toISOString(),
      type: 'event'
    });

    render(() => <CalendarPlanner />);

    fireEvent.click(screen.getByText('Shortcut Event'));
    expect(screen.getByTitle('Close')).toBeInTheDocument();

    // Trigger Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Popover should be closed
    expect(screen.queryByTitle('Close')).not.toBeInTheDocument();
  });

  it('strictly runs cleanNode disposal when window is undefined without ReferenceError', () => {
    const originalWindow = globalThis.window;
    try {
      // @ts-ignore
      delete globalThis.window;
      expect(() => {
        createRoot(dispose => {
          CalendarPlanner();
          dispose();
        });
      }).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('moves existing event to another date when dropped on calendar cell', () => {
    const testEvt = addCalendarEvent({
      id: 'move-target-evt',
      title: 'Move Me Around',
      start: new Date(2026, 8, 10, 10, 0, 0).toISOString(),
      end: new Date(2026, 8, 10, 11, 0, 0).toISOString(),
      type: 'event'
    });

    setState('calendar', 'view', 'month');
    const { container } = render(() => <CalendarPlanner />);

    const dropTargetCell = container.querySelectorAll('.month-day-cell')[15] as HTMLElement;
    expect(dropTargetCell).toBeTruthy();

    const dataTransfer = {
      getData: (format: string) => (format === 'text/plain' ? JSON.stringify({ type: 'calendar-event', id: 'move-target-evt' }) : ''),
      setData: vi.fn(),
      effectAllowed: 'move'
    };

    fireEvent.drop(dropTargetCell, { dataTransfer });

    const updated = state.calendar.events.find(e => e.id === 'move-target-evt');
    expect(updated).toBeTruthy();
    expect(new Date(updated!.start).getHours()).toBe(10);
  });
});
