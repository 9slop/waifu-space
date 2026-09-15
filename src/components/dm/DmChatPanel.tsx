import { createSignal, Show } from 'solid-js';
import { dmState, startCall } from '../../lib/dm/store';
import { statusForUserId, isVisiblePresence } from '../../lib/dm/presence';
import { t } from '../../lib/i18n';
import { PhPhoneCall } from '../icons';
import { DmAvatar } from './DmAvatar';
import { DmMessageList } from './DmMessageList';
import { DmInputBar } from './DmInputBar';
import { DmProfilePopover } from './DmProfilePopover';
import { CallOverlay } from './CallOverlay';

/**
 * The right-hand chat region: conversation header (identity + single call
 * button), the top-docked call panel, the message timeline, the composer,
 * and an anchored profile popup for the other participant.
 */
export function DmChatPanel() {
  const [profileTarget, setProfileTarget] = createSignal<{ id: string; anchor: () => DOMRect } | null>(null);
  let identityBtnRef: HTMLButtonElement | undefined;

  const conv = () => dmState.conversations.find((c) => c.id === dmState.activeConversationId);
  const realtimeMap: Record<string, any> = {};
  for (const [uid, entry] of Object.entries(dmState.realtimePresence)) realtimeMap[uid] = entry.status;
  const status = () => (conv() ? statusForUserId(conv()!.otherUser.id, dmState.presence, realtimeMap) : 'offline');

  const openHeaderProfile = () => {
    if (!conv()) return;
    const anchor = () => (identityBtnRef ? identityBtnRef.getBoundingClientRect() : new DOMRect(0, 0, 0, 0));
    setProfileTarget((prev) => (prev ? null : { id: conv()!.otherUser.id, anchor }));
  };

  const onAuthorClick = (senderId: string, el: HTMLElement) => {
    const anchor = () => el.getBoundingClientRect();
    setProfileTarget((prev) => (prev?.id === senderId ? null : { id: senderId, anchor }));
  };

  return (
    <section class="dm-chat" data-testid="dm-chat">
      <Show when={conv()} fallback={<DmChatEmpty />}>
        <CallOverlay />

        <header class="dm-chat-header">
          <button class="dm-chat-identity" data-testid="dm-chat-identity" ref={identityBtnRef} onClick={openHeaderProfile}>
            <DmAvatar
              name={conv()!.otherUser.username || conv()!.otherUser.id}
              avatarUrl={conv()!.otherUser.avatarUrl}
              status={status()}
              size="38px"
            />
            <div class="dm-chat-id-text">
              <span class="dm-chat-name">{conv()!.otherUser.username || conv()!.otherUser.id}</span>
              <Show when={isVisiblePresence(status())}>
                <span class="dm-chat-presence-text">{t(`dm.${status()}`)}</span>
              </Show>
            </div>
          </button>

          <div class="dm-chat-actions">
            <button
              class="dm-call-btn"
              data-testid="dm-call-voice"
              title={t('dm.callVoice')}
              disabled={dmState.call !== null || dmState.incomingCall !== null}
              onClick={() => void startCall('voice')}
            >
              <PhPhoneCall />
            </button>
          </div>
        </header>

        <DmMessageList onAuthorClick={onAuthorClick} />
        <DmInputBar />

        <Show when={profileTarget()}>
          <DmProfilePopover
            userId={profileTarget()!.id}
            anchor={profileTarget()!.anchor}
            onClose={() => setProfileTarget(null)}
          />
        </Show>
      </Show>
    </section>
  );
}

function DmChatEmpty() {
  return (
    <div class="dm-chat-empty" data-testid="dm-chat-empty">
      <div class="dm-chat-empty-inner">
        <div class="dm-chat-empty-icon">DM</div>
        <h2>{t('dm.emptyTitle')}</h2>
        <p>{t('dm.emptyHint')}</p>
      </div>
    </div>
  );
}