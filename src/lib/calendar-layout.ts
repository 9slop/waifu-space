import { CalendarEventItem } from './ical';

export interface TimedEventLayout {
  ev: CalendarEventItem;
  topPct: number;
  heightPct: number;
  widthPct: number;
  leftPct: number;
}

interface RankedEvent {
  originalIndex: number;
  event: CalendarEventItem;
  start: number;
  end: number;
}

/**
 * Google Calendar-style side-by-side layout for timed events on a single day.
 * Events that overlap share the column width; non-overlapping event chains
 * each get the full width. Positions are given as percentages of the
 * (1440-minute) day column so callers can map them onto their own grid.
 */
export function layoutTimedEvents(
  events: CalendarEventItem[],
  options: { minHeightPct?: number; minDurationMin?: number } = {}
): TimedEventLayout[] {
  const { minHeightPct = 2.2, minDurationMin = 30 } = options;

  if (events.length === 0) return [];

  const ranked: RankedEvent[] = events.map((event, originalIndex) => {
    const s = new Date(event.start);
    const e = new Date(event.end || event.start);
    let start = s.getHours() * 60 + s.getMinutes();
    let end = e.getHours() * 60 + e.getMinutes();
    if (end <= start) end = start + minDurationMin;
    return { originalIndex, event, start, end };
  });

  ranked.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start) || a.originalIndex - b.originalIndex);

  const result: (TimedEventLayout | null)[] = new Array(events.length).fill(null);

  let i = 0;
  while (i < ranked.length) {
    const cluster: RankedEvent[] = [ranked[i]];
    let clusterEnd = ranked[i].end;
    let j = i + 1;
    while (j < ranked.length && ranked[j].start < clusterEnd) {
      cluster.push(ranked[j]);
      clusterEnd = Math.max(clusterEnd, ranked[j].end);
      j++;
    }

    const occupied = new Map<number, RankedEvent>();
    const colOf = new Map<number, number>();
    let maxCols = 0;

    for (const r of cluster) {
      let col = 0;
      while (occupied.has(col) && occupied.get(col)!.end > r.start) {
        col++;
      }
      occupied.set(col, r);
      colOf.set(r.originalIndex, col);
      if (col + 1 > maxCols) maxCols = col + 1;
    }

    const widthPct = 100 / maxCols;
    for (const r of cluster) {
      const col = colOf.get(r.originalIndex)!;
      const topPct = (r.start / 1440) * 100;
      const durationPct = ((r.end - r.start) / 1440) * 100;
      result[r.originalIndex] = {
        ev: r.event,
        topPct,
        heightPct: Math.min(Math.max(durationPct, minHeightPct), 100 - topPct),
        widthPct,
        leftPct: col * widthPct,
      };
    }

    i = j;
  }

  return result as TimedEventLayout[];
}