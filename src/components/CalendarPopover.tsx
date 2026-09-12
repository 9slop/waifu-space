import { Show } from 'solid-js';
import { CalendarEventItem } from '../lib/ical';
import { toggleTask } from '../lib/store';
import { t, getLocale, holidayTooltip } from '../lib/i18n';
import { countryFlagEmoji } from '../lib/countries';
import { useFocusTrap } from '../lib/accessibility';
import { PhArrowLeft, PhCheckCircle, PhPencilSimple, PhTrash, PhX, PhMapPin, GlyphText } from './icons';

const POPOVER_TITLE_ID = 'calendar-popover-title';

export function CalendarPopover(props: {
  event: CalendarEventItem | null;
  position: { top: number; left: number } | null;
  onEdit: (ev: CalendarEventItem) => void;
  onDeleteEvent: (ev: CalendarEventItem) => void;
  onClose: () => void;
}) {
  const dialogRef = useFocusTrap(() => !!props.event, () => props.onClose());

  return (
    <Show when={props.event}>
      {ev => {
        const s = () => new Date(ev().start);
        const e = () => new Date(ev().end || ev().start);
        const holiday = () => ev()._holiday;

        const dateStr = () =>
          s().toLocaleDateString(getLocale(), { weekday: 'short', month: 'short', day: 'numeric' });

        const timeStr = () =>
          ev().allDay
            ? t('calendar.popover.allDay')
            : `${s().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        const handleDelete = () => {
          props.onDeleteEvent(ev());
        };

        const handleToggle = () => {
          toggleTask(ev().id, ev().dateKey);
        };

        return (
          <div
            ref={dialogRef}
            class="gcal-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby={POPOVER_TITLE_ID}
            style={{
              display: 'block',
              top: props.position ? `${props.position.top}px` : '50%',
              left: props.position ? `${props.position.left}px` : '50%',
              transform: props.position ? 'none' : 'translate(-50%, -50%)',
              position: 'fixed',
              'z-index': 1100
            }}
          >
            <div class="popover-header">
              <div
                class="popover-color-stripe"
                style={{ background: ev().color || '#ff6584' }}
              />
              <div class="popover-actions">
                {ev().type === 'task' && (
                  <button
                    class="popover-btn"
                    title={t('calendar.popover.toggleCompleted')}
                    onClick={handleToggle}
                  >
                    {ev().completed ? <PhArrowLeft /> : <PhCheckCircle />}
                  </button>
                )}
                {/* Country holidays are read-only: no edit or delete affordances. */}
                <Show when={!ev()._holiday}>
                  <button
                    class="popover-btn"
                    title={t('calendar.popover.editEvent')}
                    onClick={() => props.onEdit(ev())}
                  >
                    <PhPencilSimple />
                  </button>
                  <button
                    class="popover-btn popover-btn-del"
                    title={t('calendar.popover.deleteEvent')}
                    onClick={handleDelete}
                  >
                    <PhTrash />
                  </button>
                </Show>
                <button
                  class="popover-btn"
                  title={t('calendar.popover.close')}
                  aria-label={t('calendar.a11y.closeDialog')}
                  onClick={props.onClose}
                >
                  <PhX />
                </button>
              </div>
            </div>

            <div class="popover-body">
              <h3 class="popover-title" id={POPOVER_TITLE_ID}>{ev().title}</h3>
              <div class="popover-time">
                {dateStr()} · {timeStr()}
              </div>
              <div
                class={`popover-badge ${ev()._holiday ? 'popover-badge-holiday' : ''}`}
                style={{ background: ev().color || '#ff6584' }}
              >
                <GlyphText text={
                  holiday()
                    ? holiday()!.culture
                      ? `🎉 ${t('calendar.holidays.culturalBadge')} · ${t('calendar.holidays.badge')}`
                      : `${countryFlagEmoji(holiday()!.countryCode)} ${holiday()!.countryCode} · ${t('calendar.holidays.badge')}`
                    : ev().type.toUpperCase()
                } />
                {ev().completed ? ` (${t('calendar.popover.completed')})` : ''}
              </div>
              {ev().location && (
                <div class="popover-loc"><PhMapPin /> {ev().location}</div>
              )}
              {ev().description && (
                <div class="popover-desc">{ev().description}</div>
              )}
            </div>
          </div>
        );
      }}
    </Show>
  );
}
