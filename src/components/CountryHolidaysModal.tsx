import { createSignal, createEffect, For, Show } from 'solid-js';
import { state, fetchCountryCatalog, setCountryHolidays } from '../lib/store';
import { CountryInfo, countryFlagEmoji } from '../lib/countries';
import { t } from '../lib/i18n';
import { useFocusTrap } from '../lib/accessibility';

const TITLE_ID = 'holidays-modal-title';

/**
 * Country-holidays picker. Toggling a country applies immediately (like Google
 * Calendar); the selection is saved to settings and synced to the cloud, and
 * the selected countries' public holidays show as read-only all-day events.
 */
export function CountryHolidaysModal(props: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useFocusTrap(() => props.isOpen, () => props.onClose());

  const [countries, setCountries] = createSignal<CountryInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [loadError, setLoadError] = createSignal(false);
  const [search, setSearch] = createSignal('');

  const loadCatalog = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const list = await fetchCountryCatalog();
      if (list.length === 0) {
        setLoadError(true);
      } else {
        setCountries(list);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (props.isOpen) void loadCatalog();
  });

  const selected = () => (state.settings.countryHolidays || []) as string[];

  const toggle = (code: string, on: boolean) => {
    const next = selected().filter(c => c !== code);
    if (on) next.push(code);
    setCountryHolidays(next);
  };

  const filtered = () => {
    const q = search().trim().toLowerCase();
    const list = countries();
    if (!q) return list;
    return list.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  };

  const clearSelection = () => {
    setCountryHolidays([]);
  };

  return (
    <div
      ref={dialogRef}
      class={`gcal-modal-overlay ${props.isOpen ? 'active' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={e => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="gcal-modal" style={{ 'max-width': '440px' }}>
        <div class="modal-header">
          <h3 id={TITLE_ID}>🌍 {t('calendar.holidays.title')}</h3>
          <button class="modal-close-btn" type="button" onClick={props.onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <div class="holiday-modal-body">
          <p class="holiday-modal-subtitle">{t('calendar.holidays.subtitle')}</p>

          <input
            type="text"
            class="holiday-search-input"
            placeholder={t('calendar.holidays.searchPlaceholder')}
            aria-label={t('calendar.holidays.searchPlaceholder')}
            value={search()}
            onInput={e => setSearch(e.currentTarget.value)}
          />

          <Show when={!(loading() || loadError())}>
            <div class="holiday-country-list">
              <For each={filtered()}>
                {c => (
                  <label class="holiday-country-item">
                    <input
                      type="checkbox"
                      checked={selected().includes(c.code)}
                      onChange={e => toggle(c.code, e.currentTarget.checked)}
                    />
                    <span class="holiday-flag">{countryFlagEmoji(c.code)}</span>
                    <span class="holiday-country-name">{c.name}</span>
                    <span class="holiday-country-code">{c.code}</span>
                  </label>
                )}
              </For>
              <Show when={!loading() && filtered().length === 0}>
                <p class="holiday-modal-note">{t('calendar.holidays.noResults')}</p>
              </Show>
            </div>
          </Show>

          <Show when={loading()}>
            <p class="holiday-modal-note">{t('calendar.holidays.loading')}</p>
          </Show>

          <Show when={!loading() && loadError()}>
            <p class="holiday-modal-note holiday-modal-error">{t('calendar.holidays.loadError')}</p>
          </Show>

          <div class="holiday-modal-footer">
            <Show when={selected().length > 0}>
              <button type="button" class="gcal-btn gcal-btn-outline holiday-clear-btn" onClick={clearSelection}>
                {t('calendar.holidays.clear')}
              </button>
            </Show>
            <span class="holiday-modal-source">{t('calendar.holidays.sourceNote')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}