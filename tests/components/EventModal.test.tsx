import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { EventModal } from '../../src/components/EventModal';
import { state, setState, DEFAULT_STATE } from '../../src/lib/store';
import { CalendarEventItem } from '../../src/lib/ical';

describe('EventModal Component (EventModal.tsx)', () => {
  beforeEach(() => {
    cleanup();
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  });

  it('renders "Add Event" modal with empty fields when creating new event', () => {
    render(() => (
      <EventModal
        isOpen={true}
        event={null}
        onClose={() => {}}
      />
    ));

    expect(screen.getByText('Add Event')).toBeInTheDocument();
    const titleInput = screen.getByPlaceholderText('Add title') as HTMLInputElement;
    expect(titleInput.value).toBe('');
  });

  it('populates fields with existing event data when editing', () => {
    const existing: CalendarEventItem = {
      id: 'existing-1',
      title: 'Cosplay Workshop',
      start: '2026-10-15T14:00:00.000Z',
      end: '2026-10-15T16:00:00.000Z',
      allDay: false,
      type: 'event',
      completed: false,
      color: '#ff6584',
      location: 'Community Hall'
    };

    render(() => (
      <EventModal
        isOpen={true}
        event={existing}
        onClose={() => {}}
      />
    ));

    expect(screen.getByText('Edit Event')).toBeInTheDocument();
    const titleInput = screen.getByPlaceholderText('Add title') as HTMLInputElement;
    expect(titleInput.value).toBe('Cosplay Workshop');
  });

  it('submits form to create a new event in the store', () => {
    const onClose = vi.fn();

    const { container } = render(() => (
      <EventModal
        isOpen={true}
        event={null}
        defaultDate={new Date('2026-10-15')}
        onClose={onClose}
      />
    ));

    const titleInput = screen.getByPlaceholderText('Add title');
    fireEvent.input(titleInput, { target: { value: 'New Test Event' } });

    const form = container.querySelector('form.modal-form');
    fireEvent.submit(form!);

    expect(state.calendar.events.some(e => e.title === 'New Test Event')).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking close button', () => {
    const onClose = vi.fn();

    render(() => (
      <EventModal
        isOpen={true}
        event={null}
        onClose={onClose}
      />
    ));

    const closeBtn = screen.getByText('✕');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
