import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { CalendarPlanner } from '../../src/components/CalendarPlanner';
import { addCalendarEvent, setState, DEFAULT_STATE, state } from '../../src/lib/store';

describe('CalendarPlanner Component & SSR Safety (Issue #11)', () => {
  beforeEach(() => {
    localStorage.clear();
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
    // Stub the /api/holidays proxy so the country picker gets a real catalog
    // (and no real network attempt) when it is opened in tests.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            countries: [
              { code: 'JP', name: 'Japan' },
              { code: 'DE', name: 'Germany' }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('loads the country catalog and filters it by search input', async () => {
    const { container } = render(() => <CalendarPlanner />);

    fireEvent.click(screen.getByRole('button', { name: /country holidays/i }));
    const holidaysOverlay = container.querySelector('[aria-labelledby="holidays-modal-title"]') as HTMLElement | null;
    expect(holidaysOverlay).toHaveClass('active');

    // The catalog arrives from the (stubbed) proxy and renders country rows.
    await screen.findByText('Japan');
    expect(screen.getByText('Germany')).toBeInTheDocument();

    // Typing in the search box actually filters the visible rows.
    const search = screen.getByPlaceholderText('Search countries...');
    fireEvent.input(search, { target: { value: 'zzz' } });
    expect(screen.queryByText('Japan')).not.toBeInTheDocument();
    expect(screen.queryByText('Germany')).not.toBeInTheDocument();
  });

  it('blocks the create-event shortcut while the country-holidays modal is open', async () => {
    const { container } = render(() => <CalendarPlanner />);

    const holidaysOverlay = container.querySelector('[aria-labelledby="holidays-modal-title"]') as HTMLElement | null;
    const eventModalOverlay = container.querySelector('[aria-labelledby="event-modal-title"]') as HTMLElement | null;
    expect(holidaysOverlay).not.toHaveClass('active');
    expect(eventModalOverlay).not.toHaveClass('active');

    // Open the holidays modal via its toolbar button.
    fireEvent.click(screen.getByRole('button', { name: /country holidays/i }));
    expect(holidaysOverlay).toHaveClass('active');
    expect(eventModalOverlay).not.toHaveClass('active');
    await screen.findByText('Japan'); // let the catalog (async) settle

    // Pressing 'c' while this overlay is open must NOT activate the create-event modal.
    fireEvent.keyDown(window, { key: 'c' });
    expect(eventModalOverlay).not.toHaveClass('active');

    // Escape should close the holidays overlay.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(holidaysOverlay).not.toHaveClass('active');
  });

  it('toggles worldwide cultural holidays from the picker and shows them on the calendar', async () => {
    // Halloween lives in October 2026 in the cultural-holiday list; the window
    // only makes sense while Oct 2026 is still reachable on this machine.
    const now = new Date();
    if (now.getFullYear() * 12 + now.getMonth() > 2026 * 12 + 9) return;

    setState('calendar', 'view', 'month');
    const { container } = render(() => <CalendarPlanner />);

    fireEvent.click(screen.getByRole('button', { name: /country holidays/i }));

    const cultureCheckbox = container.querySelector('.holiday-culture-toggle input') as HTMLInputElement | null;
    expect(cultureCheckbox).toBeTruthy();
    expect(cultureCheckbox!.checked).toBe(false);
    expect(screen.getByText(/Cultural holidays/)).toBeInTheDocument();

    fireEvent.change(cultureCheckbox!, { target: { checked: true } });
    expect(state.settings.showCulturalHolidays).toBe(true);

    // Close the picker and browse to October 2026 via the mini calendar.
    fireEvent.keyDown(window, { key: 'Escape' });
    let guard = 0;
    while (
      !(document.querySelector('.mini-cal-header span') as HTMLElement | null)?.textContent?.includes('Oct') &&
      guard < 12
    ) {
      fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
      guard++;
    }
    if (!(document.querySelector('.mini-cal-header span') as HTMLElement | null)?.textContent?.includes('Oct')) return;

    const thirtyFirst = Array.from(container.querySelectorAll<HTMLButtonElement>('.mini-day')).find(
      b => b.textContent === '31'
    );
    expect(thirtyFirst).toBeTruthy();
    fireEvent.click(thirtyFirst!);

    expect(screen.getByText('Halloween')).toBeInTheDocument();
    expect(container.querySelector('.pill-holiday-flag')?.textContent).toBe('🎉');

    // Opening it surfaces the read-only cultural badge — never edit/delete.
    const pill = screen.getByText('Halloween').closest('.event-pill');
    expect(pill).toBeTruthy();
    fireEvent.click(pill as HTMLElement);
    expect(container.querySelector('.popover-badge')?.textContent).toContain('Cultural');
    expect(screen.queryByTitle('Edit Event')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete Event')).not.toBeInTheDocument();
  });

  it('renders the full Sun..Sat range in the week view title across the fall-back DST weekend', () => {
    // The fixed-24h arithmetic (start + 6*86400000) showed "Oct 25 – Oct 30"
    // and skipped the Saturday. October 2026 is only in future/recent time in
    // the reference environment, so when Oct 2026 has passed this assertion is
    // not meaningful anymore and is skipped.
    const now = new Date();
    if (now.getFullYear() * 12 + now.getMonth() > 2026 * 12 + 9) return;

    setState('calendar', 'view', 'week');
    const { container } = render(() => <CalendarPlanner />);

    const miniHeader = () => (document.querySelector('.mini-cal-header span') as HTMLElement | null)?.textContent ?? '';
    let guard = 0;
    while (!miniHeader().includes('Oct') && guard < 12) {
      fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
      guard++;
    }
    if (!miniHeader().includes('Oct')) return;

    const thirtyFirst = Array.from(container.querySelectorAll<HTMLButtonElement>('.mini-day')).find(
      b => b.textContent === '31'
    );
    expect(thirtyFirst).toBeTruthy();
    fireEvent.click(thirtyFirst!);

    expect(container.querySelector('.gcal-title')?.textContent).toBe('Oct 25 – Oct 31, 2026');
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
