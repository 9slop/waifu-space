import { describe, it, expect, vi } from 'vitest';
import { createSignal } from 'solid-js';
import { render, fireEvent } from '@solidjs/testing-library';
import { RepeatScopeDialog, RepeatScopeRequest } from '../../src/components/RepeatScopeDialog';
import type { CalendarEventItem } from '../../src/lib/ical';

const makeEvent = (overrides: Partial<CalendarEventItem> = {}): CalendarEventItem => ({
  id: 'occ-1',
  parentId: 'evt-9',
  dateKey: '2026-09-15',
  title: 'Weekly Standup',
  completed: false,
  start: '2026-09-15T09:00:00.000Z',
  end: '2026-09-15T10:00:00.000Z',
  allDay: false,
  recurrence: 'weekly',
  ...overrides,
});

describe('RepeatScopeDialog Component (RepeatScopeDialog.tsx)', () => {
  const request = (action: RepeatScopeRequest['action']='edit'): RepeatScopeRequest => ({
    action,
    event: makeEvent(),
    dateKey: '2026-09-15',
  });

  it('renders title and both scope options when a request is set', () => {
    render(() => (
      <RepeatScopeDialog request={request()} onSelect={() => {}} onClose={() => {}} />
    ));

    expect(document.querySelector('.gcal-modal-overlay')!.classList.contains('active')).toBe(true);
    expect(document.querySelector('.repeat-scope-body')!.textContent).toMatch(/Weekly Standup/);
    expect(document.querySelectorAll('.repeat-scope-actions .gcal-btn')).toHaveLength(3);
  });

  it('is hidden when there is no request', () => {
    render(() => (
      <RepeatScopeDialog request={null} onSelect={() => {}} onClose={() => {}} />
    ));

    expect(document.querySelector('.gcal-modal-overlay')!.classList.contains('active')).toBe(false);
  });

  it('reports this/all scopes and closes on cancel', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(() => (
      <RepeatScopeDialog request={request('delete')} onSelect={onSelect} onClose={onClose} />
    ));

    const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.repeat-scope-actions .gcal-btn'));

    fireEvent.click(buttons()[0]);
    expect(onSelect).toHaveBeenCalledWith('this');

    fireEvent.click(buttons()[1]);
    expect(onSelect).toHaveBeenCalledWith('all');
    expect(onSelect).toHaveBeenCalledTimes(2);

    fireEvent.click(buttons()[2]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});