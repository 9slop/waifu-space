import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { state } from '../../lib/store';
import { dmState, loadOlder } from '../../lib/dm/store';
import { formatDayDivider, isOwnMessage } from '../../lib/dm/api';
import { t } from '../../lib/i18n';
import { DmMessageGroup } from './DmMessageGroup';
import type { DmMessage } from '../../lib/dm/types';

interface Row {
  kind: 'divider' | 'message';
  key: string;
  day?: string;
  message?: DmMessage;
  showAvatar?: boolean;
}

const GROUPING_MS = 5 * 60 * 1000;

/** Distance (px) from the bottom under which new messages still snap to the latest. */
const SCROLL_SNAP_MARGIN = 120;

/** The currently mounted message timeline, driven by scrollDmThreadToBottom(). */
let mountedScrollEl: HTMLDivElement | null = null;

/**
 * Grace window (ms) after a scroll-to-bottom during which media load events
 * (GIFs/images that grow the row and push the old 'bottom' upward) still snap
 * to the true bottom even if the reader is momentarily detected as not-near.
 * The window is scoped to the exact timeline element and is cancelled as soon
 * as the reader manually scrolls away from the bottom.
 */
const SCROLL_GRACE_MS = 600;
let scrollGraceUntil = 0;
let scrollGraceEl: HTMLDivElement | null = null;

function inGraceWindow(el: HTMLDivElement): boolean {
  return typeof performance !== 'undefined' && performance.now() < scrollGraceUntil && scrollGraceEl === el;
}

function cancelGrace(el: HTMLDivElement) {
  if (scrollGraceEl === el) scrollGraceUntil = 0;
}

/** Scrolls a conversation's message view to the newest message. */
export function scrollDmToBottom(el: HTMLDivElement) {
  el.scrollTop = el.scrollHeight;
}

function isNearBottom(el: HTMLDivElement): boolean {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_SNAP_MARGIN;
}

/**
 * Scrolls the mounted timeline (if any) to the newest message. Runs a double
 * requestAnimationFrame so media that loads after the message row is inserted
 * (GIFs/images change the row height) can settle before the final position is
 * computed — this lands at the true bottom instead of "almost at the bottom".
 * Deferred frames re-snap while the reader is still near the bottom (or while
 * the short grace window is open, which covers the moment a just-sent GIF's
 * row grows past the previously computed bottom) so a deliberate scroll up
 * into history is never yanked back down.
 */
export function scrollDmThreadToBottom() {
  const el = mountedScrollEl;
  if (!el) return;
  scrollGraceUntil = performance.now() + SCROLL_GRACE_MS;
  scrollGraceEl = el;
  el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  const tick = () => {
    if (!mountedScrollEl || !(isNearBottom(mountedScrollEl) || inGraceWindow(mountedScrollEl))) return;
    mountedScrollEl.scrollTop = Math.max(0, mountedScrollEl.scrollHeight - mountedScrollEl.clientHeight);
  };
  requestAnimationFrame(tick);
  requestAnimationFrame(() => requestAnimationFrame(tick));
}

/**
 * Re-scrolls to the bottom when the reader is already near it, or within the
 * short post-send grace window (used by media load events so a freshly sent
 * GIF snaps closed instead of leaving a gap at the bottom of the timeline).
 * Each snap refreshes the grace window so a stream of async-loading media
 * (GIFs, Twemoji rows) keeps pinning until everything settles.
 */
export function scrollDmThreadToBottomIfNear() {
  const el = mountedScrollEl;
  if (!el || !(isNearBottom(el) || inGraceWindow(el))) return;
  scrollGraceUntil = performance.now() + SCROLL_GRACE_MS;
  scrollGraceEl = el;
  requestAnimationFrame(() => {
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  });
}

/**
 * The message timeline for the active conversation: inserts "Today /
 * Yesterday / date" day dividers and splits messages into visual groups
 * (avatar shown only for the first message of a run from the same author).
 */
export function DmMessageList(props?: { onAuthorClick?: (senderId: string, el: HTMLElement) => void }) {
  const convId = () => dmState.activeConversationId;
  const messages = () => dmState.messages[convId() ?? ''] ?? [];
  const otherUser = () => dmState.conversations.find((c) => c.id === convId())?.otherUser;

  // The "load older" button only appears while the reader is near the top of
  // the history, where older messages would actually be inserted.
  const [nearTop, setNearTop] = createSignal(true);

  const trackScroll = (el: HTMLDivElement) => {
    setNearTop(el.scrollTop <= 60);
    if (!isNearBottom(el)) cancelGrace(el);
  };

  // --- Auto-scroll (issue B) ---
  let lastConvId: string | null = null;
  let lastMessageCount = 0;
  let lastFirstId: string | null = null;
  let shouldSnapToBottom = false;

  // Opening a conversation always snaps to the newest message.
  createEffect(() => {
    const id = convId();
    if (id !== lastConvId) {
      lastConvId = id;
      lastMessageCount = 0;
      lastFirstId = null;
      shouldSnapToBottom = true;
    }
  });

  // New messages snap when the newest one is ours, or when the reader is near
  // the bottom. Prepending older history (load-more) never yanks the viewport.
  createEffect(() => {
    const el = mountedScrollEl;
    const list = messages();
    const count = list.length;
    const firstId = count ? list[0].id : null;
    const prepended = lastFirstId !== null && firstId !== null && firstId !== lastFirstId;

    if (!el || count === 0) {
      lastMessageCount = count;
      lastFirstId = firstId;
      return;
    }

    if (shouldSnapToBottom) {
      shouldSnapToBottom = false;
      scrollDmThreadToBottom();
    } else if (count > lastMessageCount && !prepended) {
      const newestIsMine = isOwnMessage(list[count - 1], state.user?.id);
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_SNAP_MARGIN;
      if (newestIsMine || nearBottom) scrollDmThreadToBottom();
    } else if (prepended) {
      // Older history was prepended (load-more): never yank the viewport, and
      // drop any in-flight grace-window re-snaps so they can't stomp it.
      cancelGrace(el);
    }
    lastMessageCount = count;
    lastFirstId = firstId;
  });

  const rows = createMemo<Row[]>(() => {
    const list = messages();
    const out: Row[] = [];
    let lastDay = '';
    let lastSender = '';
    let lastTime = 0;
    for (const message of list) {
      const day = formatDayDivider(message.createdAt);
      if (day && day !== lastDay) {
        out.push({ kind: 'divider', key: `day-${message.id}`, day });
        lastDay = day;
        lastSender = '';
        lastTime = 0;
      }
      const grouped = lastSender === message.senderId && new Date(message.createdAt).getTime() - lastTime < GROUPING_MS;
      out.push({ kind: 'message', key: message.id, message, showAvatar: !grouped });
      lastSender = message.messageType === 'system' ? '' : message.senderId;
      lastTime = new Date(message.createdAt).getTime();
    }
    return out;
  });

  const senderName = (msg: DmMessage) =>
    isOwnMessage(msg, state.user?.id)
      ? state.user?.username || 'You'
      : otherUser()?.username || 'User';

  const senderAvatar = (msg: DmMessage) =>
    isOwnMessage(msg, state.user?.id) ? state.user?.avatarUrl : otherUser()?.avatarUrl;

  return (
    <div
      class="dm-messages"
      data-testid="dm-messages"
      ref={(el) => (mountedScrollEl = el)}
      onScroll={(e) => trackScroll(e.currentTarget as HTMLDivElement)}
    >
      <Show when={dmState.hasOlder[convId() ?? ''] && nearTop()}>
        <div class="dm-load-older">
          <button
            class="dm-load-older-btn"
            data-testid="dm-load-older"
            disabled={dmState.loadingMessages.includes(convId() ?? '')}
            onClick={() => void loadOlder()}
          >
            {t('dm.loadOlder')}
          </button>
        </div>
      </Show>
      <Show when={messages().length === 0}>
        <div class="dm-no-messages">{t('dm.noMessages')}</div>
      </Show>
      <For each={rows()}>
        {(row) =>
          row.kind === 'divider' ? (
            <div class="dm-day-divider" data-testid="dm-day-divider">
              <span class="dm-day-divider-line" />
              <span class="dm-day-divider-text">{row.day}</span>
              <span class="dm-day-divider-line" />
            </div>
          ) : (
            <DmMessageGroup
              message={row.message!}
              showAvatar={row.showAvatar!}
              senderName={senderName(row.message!)}
              senderAvatar={senderAvatar(row.message!)}
              myUserId={state.user?.id}
              onAuthorClick={props?.onAuthorClick}
            />
          )
        }
      </For>
    </div>
  );
}