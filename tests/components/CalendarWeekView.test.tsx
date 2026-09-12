import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render } from '@solidjs/testing-library';
import { CalendarWeekView } from '../../src/components/CalendarWeekView';

// Issue: the fall-back DST weekend (e.g. 2026-10-25 in most of Europe) has a
// 25-hour day. Building the 7 day columns with fixed 24h steps (start + i*86400000)
// duplicated the first column and dropped the last day (Oct 31, a Saturday).
// Run this file under a DST timezone so the old arithmetic is guaranteed to fail.
const originalTZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Berlin';
});
afterAll(() => {
  if (originalTZ !== undefined) process.env.TZ = originalTZ;
  else delete process.env.TZ;
});

function renderWeekAt(saturday: Date) {
  return render(() => (
    <CalendarWeekView
      currentDate={saturday}
      events={[]}
      onSelectSlot={vi.fn()}
      onSelectRange={vi.fn()}
      onOpenEvent={vi.fn()}
    />
  ));
}

describe('CalendarWeekView daylight-saving safety (Issue: Oct 31 missing)', () => {
  it('renders all seven consecutive day columns Sun..Sat across the Oct 2026 fall-back weekend', () => {
    const { container } = renderWeekAt(new Date(2026, 9, 31)); // Saturday Oct 31, 2026

    const numbers = Array.from(container.querySelectorAll('.week-day-num')).map(el => el.textContent);
    // With the old fixed-24h arithmetic this week produced "25 25 26 27 28 29 30".
    expect(numbers).toEqual(['25', '26', '27', '28', '29', '30', '31']);

    const names = Array.from(container.querySelectorAll('.week-day-name')).map(el => el.textContent);
    expect(names).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  it('keeps the grid and allday strip in sync for the same week', () => {
    const { container } = renderWeekAt(new Date(2026, 9, 31));

    const headerDays = container.querySelectorAll('.week-header-day').length;
    const alldayDays = container.querySelectorAll('.week-allday-day').length;
    const columns = container.querySelectorAll('.week-day-column').length;

    expect(headerDays).toBe(7);
    expect(alldayDays).toBe(headerDays);
    expect(columns).toBe(headerDays);
  });
});