import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { isOwnMessage, mediaSourceOf, gifKeyOfUrl, formatMessageTime, MediaKind } from '../../lib/dm/api';
import { dmState, gifToggleFavoriteByUrl, isGifFavorited, toggleReaction, setReplyTarget, editMessage, deleteMessage } from '../../lib/dm/store';
import { scrollDmThreadToBottomIfNear } from './DmMessageList';
import { isSingleEmoji } from '../../lib/dm/emoji';
import { t } from '../../lib/i18n';
import { PhArrowBendUpLeft, PhHeart, PhHeartFill, PhPencilSimple, PhPhoneCall, PhPhoneDisconnect, PhPhoneIncoming, PhPlus, PhTrash } from '../icons';
import { DmAvatar } from './DmAvatar';
import { DmEmojiText, EmojiGlyph } from './DmEmojiText';
import { EmojiPicker } from './EmojiPicker';
import type { DmMessage } from '../../lib/dm/types';

/** Lets any message row close every other row's open context menu. */
const openMenuClosers = new Set<() => void>();

function closeAllMessageMenus() {
  for (const close of [...openMenuClosers]) close();
}

/** Parses a system payload stored in `content` ({"kind":"call-started","callType":"voice"}). */
export interface DmSystemContent {
  kind?: string;
  callType?: string;
}

export function parseDmSystemContent(content: string): DmSystemContent {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      return { kind: typeof parsed.kind === 'string' ? parsed.kind : undefined, callType: typeof parsed.callType === 'string' ? parsed.callType : undefined };
    }
  } catch {
    // falls through to the legacy plain-kind form ('call-started')
  }
  return { kind: content };
}

/**
 * A single message row. When `showAvatar` is set the full "group header" is
 * rendered (avatar, author, timestamp); otherwise it is a compact continuation
 * line for messages from the same author within a few minutes.
 */
export function DmMessageGroup(props: {
  message: DmMessage;
  showAvatar: boolean;
  senderName: string;
  senderAvatar?: string | null;
  myUserId?: string | null;
  onAuthorClick?: (senderId: string, el: HTMLElement) => void;
}) {
  const own = () => isOwnMessage(props.message, props.myUserId);
  const deleted = () => Boolean(props.message.deletedAt);
  const bigEmoji = () => props.message.messageType === 'text' && isSingleEmoji(props.message.content.trim());
  const media = () => mediaSourceOf(props.message);
  const mediaKind = (): MediaKind | null => media()?.kind ?? null;
  const mediaUrl = (): string | null => media()?.url ?? null;
  const favId = (): string | null => mediaUrl() ? gifKeyOfUrl(mediaUrl()!) : null;

  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [menu, setMenu] = createSignal<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal('');

  const closePopups = (e: PointerEvent) => {
    const el = e.target as HTMLElement | null;
    if (!el || !el.closest('.dm-reaction-add-anchor')) setPickerOpen(false);
    if (!el || !el.closest('.dm-msg-menu')) setMenu(null);
  };

  onMount(() => document.addEventListener('pointerdown', closePopups, true));
  onCleanup(() => document.removeEventListener('pointerdown', closePopups, true));

  onMount(() => {
    const closer = () => setMenu(null);
    openMenuClosers.add(closer);
    onCleanup(() => openMenuClosers.delete(closer));
  });

  const closeMenuOnKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setMenu(null);
  };
  onMount(() => document.addEventListener('keydown', closeMenuOnKey));
  onCleanup(() => document.removeEventListener('keydown', closeMenuOnKey));

  const openMenu = (e: MouseEvent) => {
    e.preventDefault();
    closeAllMessageMenus();
    const menuW = 176;
    const menuH = 88;
    setMenu({
      x: Math.max(4, Math.min(e.clientX, window.innerWidth - menuW - 4)),
      y: Math.max(4, Math.min(e.clientY, window.innerHeight - menuH - 4))
    });
  };

  const replyTarget = () => {
    const convId = props.message.conversationId;
    const list = dmState.messages[convId] ?? [];
    return list.find((m) => m.id === props.message.replyToId) ?? null;
  };

  const saveEdit = async () => {
    const value = editValue().trim();
    if (!value) return;
    const ok = await editMessage(props.message.id, value);
    if (ok) setEditing(false);
    setMenu(null);
  };

  const canEdit = () => own() && props.message.messageType === 'text' && !deleted();
  const canDelete = () => own() && props.message.messageType !== 'system' && !deleted();

  const react = (emoji: string) => {
    void toggleReaction(props.message.id, emoji);
  };

  const sys = () => (props.message.messageType === 'system' ? parseDmSystemContent(props.message.content) : null);

  const systemLabel = () => {
    const kind = sys()?.kind;
    switch (kind) {
      case 'call-started':
        return t(sys()?.callType ? 'dm.systemCallStartedVideo' : 'dm.systemCallStartedVoice');
      case 'call-end':
      case 'call-ended':
        return t('dm.systemCallEnded');
      case 'call-declined':
        return t('dm.systemCallDeclined');
      case 'call-missed':
        return t('dm.systemCallMissed');
      default:
        return props.message.content;
    }
  };

  const systemIcon = () => {
    switch (sys()?.kind) {
      case 'call-started':
        return <PhPhoneCall class="dm-system-icon started" />;
      case 'call-end':
      case 'call-ended':
        return <PhPhoneDisconnect class="dm-system-icon ended" />;
      case 'call-declined':
        return <PhPhoneDisconnect class="dm-system-icon declined" />;
      case 'call-missed':
        return <PhPhoneIncoming class="dm-system-icon missed" />;
      default:
        return <PhPhoneCall class="dm-system-icon started" />;
    }
  };

  return (
    <div
      class={`dm-msg${props.showAvatar ? ' dm-msg-header' : ' dm-msg-cont'}${own() ? ' dm-msg-own' : ''}`}
      data-testid="dm-message"
      data-message-id={props.message.id}
      onContextMenu={openMenu}
    >
      <Show when={props.message.messageType === 'system'} fallback={
        <>
          <Show when={props.showAvatar}>
            <button
              class="dm-msg-avatar-btn"
              onClick={(e) => props.onAuthorClick?.(props.message.senderId, e.currentTarget)}
              aria-label={props.senderName}
            >
              <DmAvatar name={props.senderName} avatarUrl={props.senderAvatar} size="38px" class="dm-msg-avatar" />
            </button>
          </Show>
          <div class="dm-msg-body">
            <Show when={props.showAvatar}>
              <div class="dm-msg-meta">
                <button
                  class="dm-msg-author"
                  onClick={(e) => props.onAuthorClick?.(props.message.senderId, e.currentTarget)}
                >
                  {props.senderName}
                </button>
                <span class="dm-msg-time" title={new Date(props.message.createdAt).toLocaleString()}>
                  {formatMessageTime(props.message.createdAt)}
                  <Show when={props.message.editedAt}>
                    <span class="dm-msg-edited"> · {t('dm.edited')}</span>
                  </Show>
                </span>
              </div>
            </Show>
<Show when={replyTarget()}>
              <div class="dm-reply-quote" data-testid="dm-reply-quote">
                <PhArrowBendUpLeft class="dm-reply-quote-icon" />
                <div class="dm-reply-quote-inner">
                  <span class="dm-reply-quote-author">
                    {isOwnMessage(replyTarget()!, props.myUserId) ? t('dm.replyingToYou') : t('dm.replyingTo', { name: props.senderName })}
                  </span>
                  <span class="dm-reply-quote-text">
                    {replyTarget()!.deletedAt
                      ? t('dm.deletedMessage')
                      : replyTarget()!.messageType === 'text'
                        ? replyTarget()!.content
                        : `[${replyTarget()!.messageType}]`}
                  </span>
                </div>
              </div>
            </Show>
            <Show when={deleted()}>
              <div class="dm-msg-content dm-msg-deleted">
                <span class="dm-msg-deleted-text">{t('dm.deletedMessage')}</span>
              </div>
            </Show>
            <Show when={!deleted()}>
              <Show when={editing() && props.message.messageType === 'text'} fallback={
                <div class={`dm-msg-content${bigEmoji() ? ' dm-msg-content-bigemoji' : ''}`}>
                  <Show
                    when={media()}
                    fallback={<DmEmojiText text={props.message.content} onImageLoad={scrollDmThreadToBottomIfNear} />}
                  >
                    <div class="dm-msg-media-wrap">
                      <Show when={mediaKind() === 'video'} fallback={<img class="dm-msg-media" src={mediaUrl()!} alt="" loading="lazy" onLoad={scrollDmThreadToBottomIfNear} />}>
                        <video class="dm-msg-media" controls preload="metadata" src={mediaUrl()!} />
                      </Show>
                      <Show when={favId()}>
                        <button
                          class={`dm-msg-fav-btn${isGifFavorited(favId()!) ? ' favorited' : ''}`}
                          data-testid={`dm-msg-fav-${favId()}`}
                          aria-label={isGifFavorited(favId()!) ? 'Unfavorite' : 'Favorite'}
                          onClick={() => void gifToggleFavoriteByUrl(mediaUrl()!, props.message.content)}
                        >
                          {isGifFavorited(favId()!) ? <PhHeartFill /> : <PhHeart />}
                        </button>
                      </Show>
                    </div>
                  </Show>
                </div>
              }
              >
                <div class="dm-msg-edit">
                  <textarea
                    class="dm-msg-edit-input"
                    data-testid="dm-msg-edit-input"
                    value={editValue()}
                    onInput={(e) => setEditValue(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void saveEdit();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditing(false);
                      }
                    }}
                  />
                  <div class="dm-msg-edit-actions">
                    <button class="dm-msg-edit-save" data-testid="dm-msg-edit-save" onClick={() => void saveEdit()}>
                      {t('dm.saveEdit')}
                    </button>
                    <button class="dm-msg-edit-cancel" data-testid="dm-msg-edit-cancel" onClick={() => setEditing(false)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              </Show>
            </Show>
            <Show when={!deleted()}>
              <div class="dm-reactions-row" data-testid="dm-reactions-row">
                <For each={props.message.reactions ?? []}>
                  {(reaction) => {
                    const mine = () => (props.myUserId ? reaction.userIds.includes(props.myUserId) : false);
                    return (
                      <button
                        class={`dm-reaction-btn${mine() ? ' mine' : ''}`}
                        data-testid={`dm-reaction-${reaction.emoji.length > 4 ? reaction.emoji.codePointAt(0)!.toString(16) : reaction.emoji}`}
                        onClick={() => void react(reaction.emoji)}
                      >
                        <EmojiGlyph emoji={reaction.emoji} />
                        <span class="dm-reaction-count">{reaction.count}</span>
                      </button>
                    );
                  }}
                </For>
              </div>
              <div class="dm-reaction-add-anchor" data-testid="dm-reaction-add-anchor">
                <button
                  class={`dm-reaction-add${pickerOpen() ? ' active' : ''}`}
                  data-testid="dm-reaction-add"
                  aria-label="Add reaction"
                  onClick={() => setPickerOpen(!pickerOpen())}
                >
                  <PhPlus />
                </button>
                <Show when={pickerOpen()}>
                  <EmojiPicker
                    onSelect={(emoji) => {
                      react(emoji);
                      setPickerOpen(false);
                    }}
                    onRequestClose={() => setPickerOpen(false)}
                  />
                </Show>
              </div>
            </Show>
          </div>
        </>
      }>
        <div class="dm-msg-system" data-testid="dm-message-system">
          {systemIcon()}
          <span class="dm-system-text">{systemLabel()}</span>
        </div>
      </Show>
      <Show when={menu()}>
        <div
          class="dm-msg-menu"
          data-testid="dm-msg-menu"
          style={{ top: `${menu()!.y}px`, left: `${menu()!.x}px` }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            class="dm-msg-menu-item"
            data-testid="dm-msg-menu-reply"
            role="menuitem"
            onClick={() => {
              setReplyTarget(props.message.id);
              setMenu(null);
            }}
          >
            <PhArrowBendUpLeft />
            {t('dm.reply')}
          </button>
          <Show when={canEdit()}>
            <button
              class="dm-msg-menu-item"
              data-testid="dm-msg-menu-edit"
              role="menuitem"
              onClick={() => {
                setEditValue(props.message.content);
                setEditing(true);
                setMenu(null);
              }}
            >
              <PhPencilSimple />
              {t('dm.edit')}
            </button>
          </Show>
          <Show when={canDelete()}>
            <button
              class="dm-msg-menu-item danger"
              data-testid="dm-msg-menu-delete"
              role="menuitem"
              onClick={() => {
                if (confirm(t('dm.confirmDelete'))) void deleteMessage(props.message.id);
                setMenu(null);
              }}
            >
              <PhTrash />
              {t('dm.delete')}
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}