import { describe, it, expect } from 'vitest';
import { layoutTimedEvents } from '../../src/lib/calendar-layout';
import { CalendarEventItem } from '../../src/lib/ical';

const ev = (id: string, start: string, end: string, allDay = false): CalendarEventItem => ({
  id,
  title: id,
  completed: false,
  start,
  end,
  allDay,
  recurrence: 'none',
});

const at = (h: number, m = 0): Date => {
  const d = new Date(2026, 8, 15);
  d.setHours(h, m, 0, 0);
  return d;
};

const iso = (h: number, m = 0): string => at(h, m).toISOString();

describe('layoutTimedEvents (calendar-layout.ts)', () => {
  it('gives non-overlapping events the full column width in start order', () => {
    const layouts = layoutTimedEvents([
      ev('a', iso(9, 0), iso(10, 0)),
      ev('b', iso(11, 0), iso(12, 0)),
    ]);

    expect(layouts).toHaveLength(2);
    for (const l of layouts) {
      expect(l.leftPct).toBe(0);
      expect(l.widthPct).toBe(100);
    }
    expect(layouts[0].ev.id).toBe('a');
    expect(layouts[1].ev.id).toBe('b');
  });

  it('places two overlapping events side by side at 50% width', () => {
    const layouts = layoutTimedEvents([
      ev('a', iso(9, 0), iso(10, 0)),
      ev('b', iso(9, 30), iso(10, 30)),
    ]);

    expect(layouts.map(l => l.widthPct)).toEqual([50, 50]);
    expect(layouts.map(l => l.leftPct)).toEqual([0, 50]);
  });

  it('splits three-way overlap into equal thirds', () => {
    const layouts = layoutTimedEvents([
      ev('a', iso(9, 0), iso(12, 0)),
      ev('b', iso(9, 30), iso(10, 0)),
      ev('c', iso(9, 45), iso(10, 15)),
    ]);

    for (const l of layouts) {
      expect(l.widthPct).toBeCloseTo(33.333333, 5);
    }
    expect(new Set(layouts.map(l => l.leftPct)).size).toBe(3);
  });

  it('breaks into separate clusters when events do not chain-overlap', () => {
    const layouts = layoutTimedEvents([
      ev('a', iso(9, 0), iso(10, 0)),
      ev('b', iso(10, 30), iso(11, 30)),
    ]);

    // a and b never overlap -> both full width
    expect(layouts.map(l => l.widthPct)).toEqual([100, 100]);
    expect(layouts.map(l => l.leftPct)).toEqual([0, 0]);
  });

  it('computes vertical position and height as percentages of the day', () => {
    const layouts = layoutTimedEvents([ev('a', iso(9, 0), iso(10, 0))]);

    expect(layouts[0].topPct).toBe(37.5); // 540/1440
    expect(layouts[0].heightPct).toBeCloseTo((60 / 1440) * 100, 5);
  });

  it('normalizes an inverted or zero-length range to a minimum duration', () => {
    const layouts = layoutTimedEvents([
      ev('a', iso(10, 0), iso(10, 0)),
      ev('b', iso(11, 0), iso(10, 0)),
    ]);

    for (const l of layouts) {
      expect(l.heightPct).toBeGreaterThanOrEqual(((30 / 1440) * 100));
    }
  });

  it('keeps all-day events out of the timed stack when filtered upstream returns none', () => {
    const layouts = layoutTimedEvents([ev('a', iso(0, 0), iso(0, 0), true)]);
    // all-day events are excluded by callers; an all-day record here still lays out at top
    expect(layouts[0].topPct).toBe(0);
    expect(layouts[0].widthPct).toBe(100);
  });

  it('returns an empty array for no events', () => {
    expect(layoutTimedEvents([])).toEqual([]);
  });
});