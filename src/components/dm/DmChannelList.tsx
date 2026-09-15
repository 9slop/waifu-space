import { For, Show } from 'solid-js';
import { dmState, openConversation, selectConversation } from '../../lib/dm/store';
import { statusForUserId, isVisiblePresence } from '../../lib/dm/presence';
import { formatMessageTime, mediaSourceOf } from '../../lib/dm/api';
import { t } from '../../lib/i18n';
import { DmAvatar } from './DmAvatar';
import type { DmConversationSummary, DmUserLite } from '../../lib/dm/types';

function realtimeStatusMap(): Record<string, any> {
  const map: Record<string, any> = {};
  for (const [userId, entry] of Object.entries(dmState.realtimePresence)) {
    map[userId] = entry.status;
  }
  return map;
}

function previewFor(conv: DmConversationSummary): string {
  const last = conv.lastMessage;
  if (!last) return '';
  if (last.deletedAt) return t('dm.deletedMessage');
  const media = mediaSourceOf(last);
  if (media) return media.kind === 'video' ? 'Video' : media.kind === 'gif' ? 'GIF' : 'Image';
  return last.content;
}

function PresenceChip(props: { user: DmUserLite }) {
  const status = () => statusForUserId(props.user.id, dmState.presence, realtimeStatusMap());
  const custom = () => props.user.customStatus;
  return (
    <Show when={isVisiblePresence(status()) || custom()}>
      <span class="dm-conv-presence">
        <Show when={custom()}>
          <span class="dm-conv-custom-status">~ {custom()}</span>
        </Show>
        <Show when={isVisiblePresence(status())}>
          <span class="dm-conv-status-text">{t(`dm.${status()}`)}</span>
        </Show>
      </span>
    </Show>
  );
}

/**
 * The list of direct-message conversations. Sorted online-first and then by
 * most recent message. While a search is active (query set + results loaded)
 * it renders user search results instead, which open a conversation on click.
 */
export function DmChannelList(props: { onUserClick?: (userId: string, el: HTMLElement) => void }) {
  const searching = () => dmState.searchQuery.trim().length >= 2;

  const sorted = () =>
    [...dmState.conversations].sort((a, b) => {
      const aStatus = statusForUserId(a.otherUser.id, dmState.presence, realtimeStatusMap());
      const bStatus = statusForUserId(b.otherUser.id, dmState.presence, realtimeStatusMap());
      const rank = (s: string) => (s === 'online' ? 0 : s === 'idle' ? 1 : s === 'dnd' ? 2 : 3);
      const byPresence = rank(aStatus) - rank(bStatus);
      if (byPresence !== 0) return byPresence;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return (
    <div class="dm-channel-list" data-testid="dm-channel-list">
      <Show when={searching()} fallback={<For each={sorted()}>{(conv) => <ChannelRow conv={conv} onUserClick={props.onUserClick} />}</For>}>
        <Show
          when={dmState.searchResults.length > 0}
          fallback={<div class="dm-list-hint">{t('dm.searchHint')} / {t('dm.searchNoResults')}</div>}
        >
          <For each={dmState.searchResults}>
            {(user) => (
              <button class="dm-conv-row" data-testid={`dm-search-user-${user.id}`} onClick={() => void openConversation(user.id)}>
                <span
                  class="dm-avatar-btn"
                  role="button"
                  data-testid={`dm-search-avatar-${user.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onUserClick?.(user.id, e.currentTarget);
                  }}
                >
                  <DmAvatar name={user.username} avatarUrl={user.avatarUrl} status={user.presenceStatus ?? 'offline'} size="36px" />
                </span>
                <span class="dm-conv-body">
                  <span class="dm-conv-name">{user.username}</span>
                  <Show when={user.customStatus}>
                    <span class="dm-conv-presence">
                      <span class="dm-conv-custom-status">~ {user.customStatus}</span>
                    </span>
                  </Show>
                </span>
              </button>
            )}
          </For>
        </Show>
      </Show>
    </div>
  );
}

function ChannelRow(props: { conv: DmConversationSummary; onUserClick?: (userId: string, el: HTMLElement) => void }) {
  const status = () => statusForUserId(props.conv.otherUser.id, dmState.presence, realtimeStatusMap());
  const active = () => dmState.activeConversationId === props.conv.id;
  const unread = () => props.conv.unreadCount ?? 0;
  const time = () => (props.conv.lastMessage ? formatMessageTime(props.conv.lastMessage!.createdAt) : '');

  return (
    <button
      class={`dm-conv-row${active() ? ' active' : ''}${unread() > 0 ? ' unread' : ''}`}
      data-testid={`dm-conv-${props.conv.id}`}
      onClick={() => void selectConversation(props.conv.id)}
    >
      <span
        class="dm-avatar-btn"
        role="button"
        data-testid={`dm-conv-avatar-${props.conv.id}`}
        onClick={(e) => {
          e.stopPropagation();
          props.onUserClick?.(props.conv.otherUser.id, e.currentTarget);
        }}
      >
        <DmAvatar
          name={props.conv.otherUser.username || props.conv.otherUser.id}
          avatarUrl={props.conv.otherUser.avatarUrl}
          status={status()}
          size="36px"
        />
      </span>
      <span class="dm-conv-body">
        <span class="dm-conv-top">
          <span class="dm-conv-name">{props.conv.otherUser.username || props.conv.otherUser.id}</span>
          <span class="dm-conv-time">{time()}</span>
        </span>
        <span class="dm-conv-bottom">
          <span class="dm-conv-preview">
            <Show when={props.conv.lastMessage} fallback={t('dm.noMessages')}>
              {previewFor(props.conv)}
            </Show>
          </span>
          <Show when={unread() > 0}>
            <span class="dm-unread-badge" data-testid={`dm-unread-${props.conv.id}`}>{unread() > 99 ? '99+' : unread()}</span>
          </Show>
        </span>
        <PresenceChip user={props.conv.otherUser} />
      </span>
    </button>
  );
}