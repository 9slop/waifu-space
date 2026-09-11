import { describe, it, expect, vi } from 'vitest';
import { createSignal } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { MiniCalendar } from '../../src/components/MiniCalendar';

describe('MiniCalendar Component (MiniCalendar.tsx)', () => {
  it('renders month header, week labels, and day cells', () => {
    render(() => (
      <MiniCalendar selectedDate={new Date(2026, 9, 15)} onSelectDate={() => {}} />
    ));

    expect(document.querySelector('.mini-cal-header')!.textContent).toMatch(/Oct/);
    expect(document.querySelectorAll('.mini-day').length).toBeGreaterThanOrEqual(35);
  });

  it('marks the selected day and updates the selection reactively', () => {
    const [selected, setSelected] = createSignal<Date>(new Date(2026, 9, 15));
    const onSelectDate = vi.fn((d: Date) => setSelected(d));

    const { container } = render(() => (
      <MiniCalendar selectedDate={selected()} onSelectDate={onSelectDate} />
    ));

    const dayButtons = () => Array.from(container.querySelectorAll<HTMLButtonElement>('.mini-day'));
    expect(dayButtons().some(b => b.classList.contains('selected'))).toBe(true);

    // Select the 20th of the same month: the highlight must move without a
    // re-render of the whole grid (selection lives on the same daysInGrid()).
    const twentieth = dayButtons().find(b => b.textContent === '20')!;
    fireEvent.click(twentieth);
    expect(onSelectDate).toHaveBeenCalledTimes(1);

    const selectedButtons = dayButtons().filter(b => b.classList.contains('selected'));
    expect(selectedButtons).toHaveLength(1);
    expect(selectedButtons[0].textContent).toBe('20');
  });

  it('navigates months with the prev/next buttons', () => {
    render(() => (
      <MiniCalendar selectedDate={new Date(2026, 9, 15)} onSelectDate={() => {}} />
    ));

    const header = () => document.querySelector('.mini-cal-header')!.textContent!;
    expect(header()).toMatch(/Oct/);

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(header()).toMatch(/Sep/);

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(header()).toMatch(/Oct/);
  });

  it('syncs the visible month when the selected date moves to another month externally', () => {
    const [selected, setSelected] = createSignal<Date>(new Date(2026, 9, 15));
    let onSelectDate = (_d: Date) => {};

    const { container } = render(() => (
      <MiniCalendar selectedDate={selected()} onSelectDate={d => onSelectDate(d)} />
    ));

    expect(document.querySelector('.mini-cal-header')!.textContent).toMatch(/Oct/);

    // External navigation (main grid arrows) jumps the selection to November.
    setSelected(new Date(2026, 10, 3));
    expect(document.querySelector('.mini-cal-header')!.textContent).toMatch(/Nov/);

    // The selected highlight moved to the 3rd on the synced grid.
    const dayButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('.mini-day'));
    const selectedButtons = dayButtons.filter(b => b.classList.contains('selected'));
    expect(selectedButtons).toHaveLength(1);
    expect(selectedButtons[0].textContent).toBe('3');
  });
});