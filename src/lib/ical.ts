// iCalendar (.ics) and JSON Import/Export Utilities

export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays';

export interface CalendarEventItem {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  type: 'event' | 'task' | 'birthday';
  completed: boolean;
  color: string;
  description?: string;
  location?: string;
  recurrence?: RecurrenceRule;
  _notified?: boolean;
  _rewarded?: boolean;
  // Set when this item represents a single occurrence of a repeating parent
  // event: `parentId` references the series and `dateKey` is its local date.
  parentId?: string;
  dateKey?: string;
}

/**
 * Per-occurrence override for recurring calendar events. The base event stays
 * untouched; an override records what happened to one specific occurrence
 * (completed, deleted, moved, retitled, ...) so changes never bleed across the
 * whole series.
 */
export interface CalendarOccurrenceOverride {
  id: string;
  parentId: string;
  dateKey: string;
  deleted?: boolean;
  completed?: boolean;
  rewarded?: boolean;
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  color?: string;
  location?: string;
  description?: string;
  updatedAt: string;
}

export function generateICSString(events: CalendarEventItem[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WaifuSpace//Anime Calendar 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  events.forEach(ev => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@waifuspace.local`);
    lines.push(`SUMMARY:${escapeICS(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeICS(ev.location)}`);

    if (ev.allDay) {
      const d = new Date(ev.start);
      const dt = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      lines.push(`DTSTART;VALUE=DATE:${dt}`);
    } else {
      lines.push(`DTSTART:${formatICSDate(new Date(ev.start))}`);
      lines.push(`DTEND:${formatICSDate(new Date(ev.end || ev.start))}`);
    }

    if (ev.recurrence && ev.recurrence !== 'none') {
      if (ev.recurrence === 'daily') lines.push('RRULE:FREQ=DAILY');
      else if (ev.recurrence === 'weekly') lines.push('RRULE:FREQ=WEEKLY');
      else if (ev.recurrence === 'monthly') lines.push('RRULE:FREQ=MONTHLY');
      else if (ev.recurrence === 'weekdays') lines.push('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    }

    lines.push(`STATUS:${ev.completed ? 'COMPLETED' : 'CONFIRMED'}`);
    if (ev.type === 'task') {
      lines.push('X-Task: TRUE'); // Custom property for tasks
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function exportToICS(events: CalendarEventItem[]) {
  const ics = generateICSString(events);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  downloadBlob(blob, 'waifu-space-calendar.ics');
}

export function importFromICS(icsText: string): CalendarEventItem[] {
  const events: CalendarEventItem[] = [];
  const lines = icsText.split(/\r\n|\n|\r/);
  let inEvent = false;
  let curr: CalendarEventItem | null = null;

  lines.forEach(line => {
    line = line.trim();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      curr = {
        id: 'evt-import-' + Math.random().toString(36).substr(2, 7),
        title: 'Imported Event',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        allDay: false,
        type: 'event',
        completed: false,
        color: '#ff6584'
      };
    } else if (line === 'END:VEVENT' && inEvent) {
      inEvent = false;
      if (curr) events.push(curr);
      curr = null;
    } else if (inEvent && curr) {
      if (line.startsWith('SUMMARY:')) {
        curr.title = unescapeICS(line.substring(8));
      } else if (line.startsWith('DESCRIPTION:')) {
        curr.description = unescapeICS(line.substring(12));
      } else if (line.startsWith('LOCATION:')) {
        curr.location = unescapeICS(line.substring(9));
      } else if (line.startsWith('DTSTART')) {
        const val = line.split(':')[1];
        if (line.includes('VALUE=DATE')) {
          curr.allDay = true;
          curr.start = parseICSDate(val, true).toISOString();
        } else {
          curr.start = parseICSDate(val, false).toISOString();
        }
      } else if (line.startsWith('DTEND')) {
        const val = line.split(':')[1];
        curr.end = parseICSDate(val, false).toISOString();
      } else if (line.startsWith('RRULE:')) {
        const rrule = line.substring(6);
        if (rrule.includes('FREQ=DAILY')) {
          curr.recurrence = 'daily';
        } else if (rrule.includes('FREQ=MONTHLY')) {
          curr.recurrence = 'monthly';
        } else if (rrule.includes('BYDAY=MO,TU,WE,TH,FR') || rrule.includes('BYDAY=MO,TU,WE,TH,FR;')) {
          curr.recurrence = 'weekdays';
        } else if (rrule.includes('FREQ=WEEKLY')) {
          curr.recurrence = 'weekly';
        }
      }
    }
  });

  return events;
}

function escapeICS(str: string) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function unescapeICS(str: string) {
  return (str || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function formatICSDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function parseICSDate(str: string, isDateOnly?: boolean) {
  if (!str) return new Date();
  if (isDateOnly || str.length === 8) {
    const y = parseInt(str.substring(0, 4), 10);
    const m = parseInt(str.substring(4, 6), 10) - 1;
    const d = parseInt(str.substring(6, 8), 10);
    return new Date(y, m, d);
  }
  const y = parseInt(str.substring(0, 4), 10);
  const m = parseInt(str.substring(4, 6), 10) - 1;
  const d = parseInt(str.substring(6, 8), 10);
  const h = parseInt(str.substring(9, 11) || '0', 10);
  const min = parseInt(str.substring(11, 13) || '0', 10);
  const s = parseInt(str.substring(13, 15) || '0', 10);
  return new Date(Date.UTC(y, m, d, h, min, s));
}

function pad(n: number) {
  return n < 10 ? '0' + n : n;
}

function downloadBlob(blob: Blob, filename: string) {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
