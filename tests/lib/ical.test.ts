import { describe, it, expect } from 'vitest';
import { generateICSString, importFromICS, CalendarEventItem } from '../../src/lib/ical';

describe('iCalendar (ical.ts) RFC 5545 Processing', () => {
  const sampleEvents: CalendarEventItem[] = [
    {
      id: 'test-evt-1',
      title: 'Anime Convention 2026',
      start: '2026-10-15T09:00:00.000Z',
      end: '2026-10-15T18:00:00.000Z',
      allDay: false,
      type: 'event',
      completed: false,
      color: '#ff6584',
      description: 'Cosplay, merch, and fun times with Akari!',
      location: 'Tokyo Big Sight'
    },
    {
      id: 'test-evt-2',
      title: "Akari's Special Day",
      start: '2026-11-20T00:00:00.000Z',
      end: '2026-11-20T23:59:59.000Z',
      allDay: true,
      type: 'birthday',
      completed: true,
      color: '#e84393'
    },
    {
      id: 'test-evt-3',
      title: 'Daily Kanji Practice',
      start: '2026-10-16T10:00:00.000Z',
      end: '2026-10-16T10:30:00.000Z',
      allDay: false,
      type: 'task',
      completed: false,
      color: '#00cec9',
      recurrence: 'daily'
    },
    {
      id: 'test-evt-4',
      title: 'Weekday Standup',
      start: '2026-10-19T08:30:00.000Z',
      end: '2026-10-19T09:00:00.000Z',
      allDay: false,
      type: 'task',
      completed: false,
      color: '#6c5ce7',
      recurrence: 'weekdays'
    }
  ];

  it('generates valid RFC 5545 VCALENDAR string with VEVENT blocks', () => {
    const ics = generateICSString(sampleEvents);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//WaifuSpace//Anime Calendar 1.0//EN');
    expect(ics).toContain('END:VCALENDAR');

    // Check events present
    expect(ics).toContain('SUMMARY:Anime Convention 2026');
    expect(ics).toContain('LOCATION:Tokyo Big Sight');
    expect(ics).toContain('DTSTART;VALUE=DATE:');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
  });

  it('escapes and unescapes special characters correctly', () => {
    const specialEvent: CalendarEventItem = {
      id: 'special-1',
      title: 'Title, with; special\\chars & newline\nSecond Line',
      start: '2026-12-01T12:00:00.000Z',
      end: '2026-12-01T13:00:00.000Z',
      allDay: false,
      type: 'event',
      completed: false,
      color: '#ff6584',
      description: 'First, second; third\\fourth'
    };

    const ics = generateICSString([specialEvent]);
    expect(ics).toContain('SUMMARY:Title\\, with\\; special\\\\chars & newline\\nSecond Line');

    const imported = importFromICS(ics);
    expect(imported.length).toBe(1);
    expect(imported[0].title).toBe('Title, with; special\\chars & newline\nSecond Line');
    expect(imported[0].description).toBe('First, second; third\\fourth');
  });

  it('imports events from standard iCalendar string', () => {
    const rawICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:sample-1@test
SUMMARY:Study Session
DESCRIPTION:Math and Physics
LOCATION:Library
DTSTART:20261015T140000Z
DTEND:20261015T160000Z
RRULE:FREQ=WEEKLY
END:VEVENT
BEGIN:VEVENT
UID:sample-2@test
SUMMARY:All Day Holiday
DTSTART;VALUE=DATE:20261225
END:VEVENT
END:VCALENDAR`;

    const parsed = importFromICS(rawICS);
    expect(parsed.length).toBe(2);

    expect(parsed[0].title).toBe('Study Session');
    expect(parsed[0].description).toBe('Math and Physics');
    expect(parsed[0].location).toBe('Library');
    expect(parsed[0].recurrence).toBe('weekly');
    expect(parsed[0].allDay).toBe(false);

    expect(parsed[1].title).toBe('All Day Holiday');
    expect(parsed[1].allDay).toBe(true);
  });

  it('handles empty or malformed ICS text gracefully without throwing', () => {
    expect(() => importFromICS('')).not.toThrow();
    expect(importFromICS('')).toEqual([]);

    expect(() => importFromICS('random gibberish\nno events here')).not.toThrow();
    expect(importFromICS('random gibberish\nno events here')).toEqual([]);
  });
});
