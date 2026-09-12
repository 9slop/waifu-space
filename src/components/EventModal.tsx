import { createSignal, createEffect, For } from 'solid-js';
import { CalendarEventItem, RecurrenceRule } from '../lib/ical';
import { addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, showToast } from '../lib/store';
import { t } from '../lib/i18n';
import { useFocusTrap } from '../lib/accessibility';
import { validateCalendarEventInput, EVENT_TITLE_MAX_LENGTH } from '../lib/validation';

export function EventModal(props: {
  isOpen: boolean;
  event: CalendarEventItem | null;
  defaultDate?: Date;
  initialType?: 'event' | 'task' | 'birthday';
  prefilledRange?: { start: Date; end: Date };
  onClose: () => void;
}) {
  const [title, setTitle] = createSignal('');
  const [type, setType] = createSignal<'event' | 'task' | 'birthday'>('event');
  const [allDay, setAllDay] = createSignal(false);
  const [startDate, setStartDate] = createSignal('');
  const [startTime, setStartTime] = createSignal('09:00');
  const [endDate, setEndDate] = createSignal('');
  const [endTime, setEndTime] = createSignal('10:00');
  const [recurrence, setRecurrence] = createSignal<RecurrenceRule>('none');
  const [color, setColor] = createSignal('#ff6584');
  const [location, setLocation] = createSignal('');
  const [description, setDescription] = createSignal('');

  const colors = ['#ff6584', '#6c5ce7', '#00cec9', '#fdcb6e', '#e84393', '#0984e3'];

  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  const issueField: Record<string, 'title' | 'start' | 'end' | 'type' | 'recurrence' | 'color'> = {
    'calendar.validation.titleRequired': 'title',
    'calendar.validation.titleTooLong': 'title',
    'calendar.validation.invalidStart': 'start',
    'calendar.validation.invalidEnd': 'end',
    'calendar.validation.endBeforeStart': 'end',
    'calendar.validation.invalidType': 'type',
    'calendar.validation.invalidRecurrence': 'recurrence',
    'calendar.validation.invalidColor': 'color'
  };

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const formatDateForInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  createEffect(() => {
    if (!props.isOpen) {
      setConfirmDelete(false);
      setFieldErrors({});
      return;
    }

    if (props.event) {
      const ev = props.event;
      setTitle(ev.title);
      setType(ev.type);
      setAllDay(ev.allDay);
      setRecurrence(ev.recurrence || 'none');
      setColor(ev.color || '#ff6584');
      setLocation(ev.location || '');
      setDescription(ev.description || '');

      const s = new Date(ev.start);
      const e = new Date(ev.end || ev.start);
      setStartDate(formatDateForInput(s));
      setEndDate(formatDateForInput(e));
      setStartTime(s.toTimeString().slice(0, 5));
      setEndTime(e.toTimeString().slice(0, 5));
    } else {
      const isTask = props.initialType === 'task';
      setTitle('');
      setType(props.initialType || 'event');
      setAllDay(false);
      setRecurrence('none');
      setColor(isTask ? '#00cec9' : '#ff6584');
      setLocation('');
      setDescription('');

      if (props.prefilledRange) {
        const s = props.prefilledRange.start;
        const e = props.prefilledRange.end;
        setStartDate(formatDateForInput(s));
        setEndDate(formatDateForInput(e));
        setStartTime(s.toTimeString().slice(0, 5));
        setEndTime(e.toTimeString().slice(0, 5));
      } else {
        const d = props.defaultDate || new Date();
        const endD = new Date(d.getTime() + 3600000);
        setStartDate(formatDateForInput(d));
        setEndDate(formatDateForInput(endD));
        setStartTime(d.toTimeString().slice(0, 5));
        setEndTime(endD.toTimeString().slice(0, 5));
      }
    }
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const trimmedTitle = title().trim();

    const startIso = allDay()
      ? new Date(startDate() + 'T00:00:00').toISOString()
      : new Date(`${startDate()}T${startTime()}:00`).toISOString();

    const endIso = allDay()
      ? new Date(endDate() + 'T23:59:59').toISOString()
      : new Date(`${endDate()}T${endTime()}:00`).toISOString();

    const validation = validateCalendarEventInput({
      title: trimmedTitle,
      type: type(),
      recurrence: recurrence(),
      color: color(),
      start: startIso,
      end: endIso
    });

    if (!validation.ok) {
      const errors: Record<string, string> = {};
      validation.issues.forEach(issue => {
        const field = issueField[issue.key];
        if (field && !errors[field]) errors[field] = t(issue.key, { max: EVENT_TITLE_MAX_LENGTH });
      });
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const payload = {
      title: trimmedTitle,
      type: type(),
      allDay: allDay(),
      recurrence: recurrence(),
      start: startIso,
      end: endIso,
      color: color(),
      location: location().trim(),
      description: description().trim()
    };

    if (props.event) {
      updateCalendarEvent(
        props.event.parentId || props.event.id,
        payload,
        props.event.dateKey
      );
      showToast(t('calendar.toasts.eventUpdated', { title: trimmedTitle }));
    } else {
      addCalendarEvent(payload);
      showToast(t('calendar.toasts.eventCreated', { title: trimmedTitle }));
    }

    props.onClose();
  };

  const handleDelete = () => {
    if (!props.event) return;
    // Two-step confirmation so a stray click cannot destroy calendar data.
    if (!confirmDelete()) {
      setConfirmDelete(true);
      return;
    }
    deleteCalendarEvent(
      props.event.parentId || props.event.id,
      props.event.dateKey
    );
    showToast(t('calendar.toasts.eventDeleted', { title: props.event.title }));
    props.onClose();
  };

  return (
    <div
      ref={useFocusTrap(() => props.isOpen, props.onClose)}
      class={`gcal-modal-overlay ${props.isOpen ? 'active' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="gcal-modal">
        <div class="modal-header">
          <h3 id="event-modal-title">
            {props.event
              ? type() === 'task'
                ? t('calendar.modal.editTask')
                : t('calendar.modal.editEvent')
              : type() === 'task'
              ? t('calendar.modal.addTask')
              : t('calendar.modal.addEvent')}
          </h3>
          <button class="modal-close-btn" type="button" onClick={props.onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <form class="modal-form" onSubmit={handleSubmit}>
          <div class="form-group">
            <input
              type="text"
              placeholder={t('calendar.modal.addTitle')}
              class="modal-title-input"
              value={title()}
              aria-invalid={fieldErrors().title ? true : undefined}
              onInput={e => {
                setTitle(e.currentTarget.value);
                clearFieldError('title');
              }}
              required
            />
            {fieldErrors().title && (
              <p class="validation-error" role="alert" style={{ color: 'var(--danger, #e84393)', 'font-size': '0.85rem', 'margin-top': '4px' }}>
                {fieldErrors().title}
              </p>
            )}
          </div>

          <div class="form-group-row">
            <label class="form-label">{t('calendar.modal.type')}</label>
            <select
              class="modal-select"
              value={type()}
              aria-invalid={fieldErrors().type ? true : undefined}
              onChange={e => {
                setType(e.currentTarget.value as any);
                clearFieldError('type');
              }}
            >
              <option value="event">{t('calendar.menu.event')}</option>
              <option value="task">{t('calendar.menu.task')}</option>
              <option value="birthday">{t('calendar.menu.birthday')} 🎂</option>
            </select>
            {fieldErrors().type && (
              <p class="validation-error" role="alert" style={{ color: 'var(--danger, #e84393)', 'font-size': '0.85rem', 'margin-top': '4px' }}>
                {fieldErrors().type}
              </p>
            )}
          </div>

          <div class="form-group-row">
            <label class="form-label">{t('calendar.modal.repeat')}</label>
            <select
              class="modal-select"
              value={recurrence()}
              aria-invalid={fieldErrors().recurrence ? true : undefined}
              onChange={e => {
                setRecurrence(e.currentTarget.value as any);
                clearFieldError('recurrence');
              }}
            >
              <option value="none">{t('calendar.recurrence.none')}</option>
              <option value="daily">{t('calendar.recurrence.daily')}</option>
              <option value="weekly">{t('calendar.recurrence.weekly')}</option>
              <option value="weekdays">{t('calendar.recurrence.weekdays')}</option>
              <option value="monthly">{t('calendar.recurrence.monthly')}</option>
            </select>
            {fieldErrors().recurrence && (
              <p class="validation-error" role="alert" style={{ color: 'var(--danger, #e84393)', 'font-size': '0.85rem', 'margin-top': '4px' }}>
                {fieldErrors().recurrence}
              </p>
            )}
          </div>

          <div class="form-group-row">
            <label class="form-label">{t('calendar.modal.allDay')}</label>
            <input
              type="checkbox"
              checked={allDay()}
              onChange={e => setAllDay(e.currentTarget.checked)}
            />
          </div>

          <div class="form-group-row">
            <div class="time-col" style={{ flex: 1 }}>
              <label class="form-sublabel">{t('calendar.modal.start')}</label>
              <input
                type="date"
                class="modal-input"
                value={startDate()}
                aria-invalid={fieldErrors().start ? true : undefined}
                onInput={e => {
                  setStartDate(e.currentTarget.value);
                  clearFieldError('start');
                }}
                required
              />
              {!allDay() && (
                <input
                  type="time"
                  class="modal-input"
                  style={{ 'margin-top': '4px' }}
                  value={startTime()}
                  onInput={e => {
                    setStartTime(e.currentTarget.value);
                    clearFieldError('start');
                  }}
                />
              )}
              {fieldErrors().start && (
                <p class="validation-error" role="alert" style={{ color: 'var(--danger, #e84393)', 'font-size': '0.85rem', 'margin-top': '4px' }}>
                  {fieldErrors().start}
                </p>
              )}
            </div>
            <div class="time-col" style={{ flex: 1 }}>
              <label class="form-sublabel">{t('calendar.modal.end')}</label>
              <input
                type="date"
                class="modal-input"
                value={endDate()}
                aria-invalid={fieldErrors().end ? true : undefined}
                onInput={e => {
                  setEndDate(e.currentTarget.value);
                  clearFieldError('end');
                }}
                required
              />
              {!allDay() && (
                <input
                  type="time"
                  class="modal-input"
                  style={{ 'margin-top': '4px' }}
                  value={endTime()}
                  onInput={e => {
                    setEndTime(e.currentTarget.value);
                    clearFieldError('end');
                  }}
                />
              )}
              {fieldErrors().end && (
                <p class="validation-error" role="alert" style={{ color: 'var(--danger, #e84393)', 'font-size': '0.85rem', 'margin-top': '4px' }}>
                  {fieldErrors().end}
                </p>
              )}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">{t('calendar.modal.colorBadge')}</label>
            <div class="color-palette-options">
              <For each={colors}>
                {c => (
                  <button
                    type="button"
                    class={`color-dot ${color() === c ? 'active' : ''}`}
                    style={{ background: c }}
                    aria-label={t('calendar.modal.colorBadge')}
                    onClick={() => {
                      setColor(c);
                      clearFieldError('color');
                    }}
                  />
                )}
              </For>
            </div>
            {fieldErrors().color && (
              <p class="validation-error" role="alert" style={{ color: 'var(--danger, #e84393)', 'font-size': '0.85rem', 'margin-top': '4px' }}>
                {fieldErrors().color}
              </p>
            )}
          </div>

          <div class="form-group">
            <label class="form-label">{t('calendar.modal.location')}</label>
            <input
              type="text"
              placeholder={t('calendar.modal.locationPlaceholder')}
              class="modal-input"
              value={location()}
              onInput={e => setLocation(e.currentTarget.value)}
            />
          </div>

          <div class="form-group">
            <label class="form-label">{t('calendar.modal.description')}</label>
            <textarea
              placeholder={t('calendar.modal.descriptionPlaceholder')}
              class="modal-textarea"
              rows={3}
              value={description()}
              onInput={e => setDescription(e.currentTarget.value)}
            />
          </div>

          <div class="modal-actions">
            {props.event && (
              <button
                type="button"
                class={`gcal-btn gcal-btn-danger ${confirmDelete() ? 'danger-armed' : ''}`}
                onClick={handleDelete}
              >
                {confirmDelete()
                  ? t('calendar.modal.confirmDeleteAction')
                  : `🗑️ ${t('calendar.modal.delete')}`}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              type="button"
              class="gcal-btn gcal-btn-outline"
              onClick={props.onClose}
            >
              {t('calendar.modal.cancel')}
            </button>
            <button type="submit" class="gcal-btn gcal-btn-primary">
              {t('calendar.modal.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
