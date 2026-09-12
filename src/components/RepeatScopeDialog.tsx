import { CalendarEventItem } from '../lib/ical';
import { t, formatDate } from '../lib/i18n';
import { useFocusTrap } from '../lib/accessibility';
import { PhClock, PhArrowsClockwise, PhX } from './icons';

export type RepeatScopeAction = 'edit' | 'delete' | 'move';

export interface RepeatScopeRequest {
  action: RepeatScopeAction;
  event: CalendarEventItem;
  dateKey: string;
  moveRange?: { start: Date; end: Date };
}

const TITLE_ID = 'repeat-scope-title';

export function RepeatScopeDialog(props: {
  request: RepeatScopeRequest | null;
  onSelect: (scope: 'this' | 'all') => void;
  onClose: () => void;
}) {
  const dialogRef = useFocusTrap(() => !!props.request, () => props.onClose());

  return (
    <div
      ref={dialogRef}
      class={`gcal-modal-overlay ${props.request ? 'active' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={e => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="gcal-modal" style={{ 'max-width': '360px' }}>
        <div class="modal-header">
          <h3 id={TITLE_ID}>{t('calendar.repeatScope.title')}</h3>
          <button class="modal-close-btn" type="button" onClick={props.onClose} aria-label={t('common.close')}>
            <PhX />
          </button>
        </div>

        <div class="repeat-scope-body">
          <p class="repeat-scope-subtitle">{t('calendar.repeatScope.subtitle')}</p>
          <p class="repeat-scope-event">
            {props.request?.event.title}
            {props.request?.dateKey && (
              <small> · {formatDate(new Date(`${props.request.dateKey}T00:00:00`), { month: 'short', day: 'numeric' })}</small>
            )}
          </p>

          <div class="repeat-scope-actions">
            <button
              type="button"
              class="gcal-btn gcal-btn-primary"
              onClick={() => props.onSelect('this')}
            >
              <PhClock /> {t('calendar.repeatScope.thisEvent')}
            </button>
            <button
              type="button"
              class="gcal-btn gcal-btn-outline"
              onClick={() => props.onSelect('all')}
            >
              <PhArrowsClockwise /> {t('calendar.repeatScope.allEvents')}
            </button>
            <button
              type="button"
              class="gcal-btn gcal-btn-danger"
              onClick={props.onClose}
            >
              {t('calendar.repeatScope.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}