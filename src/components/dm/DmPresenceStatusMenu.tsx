import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { dmState, setOwnPresence } from '../../lib/dm/store';
import { isStorableStatus, statusColor } from '../../lib/dm/presence';
import { t } from '../../lib/i18n';
import { PhCheck, PhX } from '../icons';
import type { PresenceStatus } from '../../lib/dm/types';

const STATUS_OPTIONS: PresenceStatus[] = ['online', 'idle', 'dnd', 'invisible'];

/**
 * Dropdown that lets the user change their own presence status and set a
 * custom status line (shown to others under the sidebar username). Opens
 * upward when there is no room below the trigger (the sidebar user panel is
 * pinned to the bottom), otherwise downward.
 */
export function DmPresenceStatusMenu() {
  const [open, setOpen] = createSignal(false);
  const [openUp, setOpenUp] = createSignal(true);
  const [custom, setCustom] = createSignal('');
  let wrapRef: HTMLDivElement | undefined;

  const currentStatus = (): PresenceStatus => {
    const status = dmState.myPresence?.status;
    return isStorableStatus(status) ? status : 'offline';
  };

  const toggle = () => {
    const next = !open();
    if (next && wrapRef) {
      const rect = wrapRef.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUp(spaceBelow < 300 && spaceAbove >= spaceBelow);
    }
    setOpen(next);
  };

  const choose = (status: PresenceStatus) => {
    void setOwnPresence(status, dmState.myPresence?.customStatus ?? null);
    setOpen(false);
  };

  const closeOnClickAway = (e: PointerEvent) => {
    const el = e.target as HTMLElement | null;
    if (open() && (!el || !el.closest('.dm-status-wrap'))) setOpen(false);
  };

  const closeOnKey = (e: KeyboardEvent) => {
    if (open() && e.key === 'Escape') setOpen(false);
  };

  onMount(() => {
    document.addEventListener('pointerdown', closeOnClickAway);
    document.addEventListener('keydown', closeOnKey);
  });

  onCleanup(() => {
    document.removeEventListener('pointerdown', closeOnClickAway);
    document.removeEventListener('keydown', closeOnKey);
  });

  const saveCustom = () => {
    const value = custom().trim();
    void setOwnPresence(currentStatus(), value || null);
    setCustom('');
    setOpen(false);
  };

  return (
    <div class="dm-status-wrap" ref={wrapRef} onClick={(e) => e.stopPropagation()}>
      <button
        class="dm-user-status-btn"
        data-testid="dm-status-menu-btn"
        aria-label={t('dm.setStatus')}
        onClick={toggle}
      >
        <span class="dm-status-dot" style={{ background: statusColor(currentStatus()) }} />
        <span class="dm-user-status-label">{t(`dm.${currentStatus()}`)}</span>
      </button>

      <Show when={open()}>
        <div class={`dm-status-menu${openUp() ? ' open-up' : ''}`} data-testid="dm-status-menu">
          {STATUS_OPTIONS.map((status) => (
            <button
              class={`dm-status-option${status === currentStatus() ? ' active' : ''}`}
              data-testid={`dm-status-${status}`}
              onClick={() => choose(status)}
            >
              <span class="dm-status-dot" style={{ background: statusColor(status) }} />
              <span class="dm-status-option-text">{t(`dm.${status}`)}</span>
              <Show when={status === currentStatus()}>
                <PhCheck class="dm-status-check" />
              </Show>
            </button>
          ))}
          <div class="dm-status-custom-row">
            <input
              class="dm-status-custom-input"
              data-testid="dm-status-custom-input"
              value={custom()}
              placeholder={t('dm.customStatusPlaceholder')}
              onInput={(e) => setCustom(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCustom();
              }}
            />
            <button class="dm-status-custom-save" data-testid="dm-status-custom-save" onClick={saveCustom}>
              <PhCheck />
            </button>
            <button class="dm-status-custom-clear" onClick={() => { void setOwnPresence(currentStatus(), null); setCustom(''); setOpen(false); }} title={t('dm.clearCustomStatus')}>
              <PhX />
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}