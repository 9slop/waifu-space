import { Show } from 'solid-js';
import { dmState } from '../../lib/dm/store';
import { t } from '../../lib/i18n';
import { DmSidebar } from './DmSidebar';
import { DmChatPanel } from './DmChatPanel';

/**
 * The home page when a registered user is signed in: a Discord-style DM
 * interface. The DM realtime runtime is booted globally in the app shell (see
 * app.tsx) so incoming calls ring and messages arrive live on every page; this
 * page only renders the sidebar + chat from the shared `dmState`.
 */
export function DmHome() {
  const ready = () => dmState.ready;

  return (
    <div class="dm-home" data-testid="dm-home">
      <Show
        when={ready()}
        fallback={
          <div class="dm-boot" data-testid="dm-boot">
            <Show when={dmState.error} fallback={<>{t('dm.loading')}</>}>
              <span class="dm-boot-error">{dmState.error}</span>
            </Show>
          </div>
        }
      >
        <DmSidebar />
        <DmChatPanel />
      </Show>
    </div>
  );
}