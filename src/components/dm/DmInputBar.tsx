import { createSignal, createMemo, For, Show } from 'solid-js';
import { dmState, emitTyping, sendText, setEmojiOpen, setGifOpen, setReplyTarget } from '../../lib/dm/store';
import { isOwnMessage } from '../../lib/dm/api';
import type { DmMessage } from '../../lib/dm/types';
import { t } from '../../lib/i18n';
import { findEmojiAutocompletions, replaceEmojiShortcodes } from '../../lib/dm/emoji';
import type { EmojiAutocompleteEntry } from '../../lib/dm/emoji';
import { PhPaperPlaneTilt, PhSmiley, PhX } from '../icons';
import { GifPicker } from './GifPicker';
import { EmojiPicker } from './EmojiPicker';

/**
 * The chat composer: a one-line textarea (Enter to send, Shift+Enter for a
 * newline), emoji + GIF buttons on the right side of the box, and a send
 * button. Keystrokes also broadcast a throttled "typing" indicator.
 */
export function DmInputBar() {
  const [text, setText] = createSignal('');
  const [textareaRef, setTextareaRef] = createSignal<HTMLTextAreaElement | undefined>(undefined);
  const [acHighlighted, setAcHighlighted] = createSignal(0);
  const [acDismissed, setAcDismissed] = createSignal(false);

  const otherName = () => dmState.conversations.find((c) => c.id === dmState.activeConversationId)?.otherUser?.username ?? '';
  const typingNames = () => {
    const ids = dmState.typing[dmState.activeConversationId ?? ''] ?? [];
    const conv = dmState.conversations.find((c) => c.id === dmState.activeConversationId);
    return ids.length ? [`${conv?.otherUser?.username ?? 'Someone'}`] : [];
  };

  const replyTarget = (): (DmMessage & { senderName: string }) | null => {
    const convId = dmState.activeConversationId;
    const list = convId ? dmState.messages[convId] ?? [] : [];
    const msg = list.find((m) => m.id === dmState.replyingTo);
    if (!msg) return null;
    const conv = dmState.conversations.find((c) => c.id === convId);
    const senderName = msg.senderId === conv?.otherUser?.id ? conv?.otherUser?.username : 'you';
    return { ...msg, senderName };
  };

  const send = () => {
    const value = text().trim();
    if (!value || !dmState.activeConversationId) return;
    const resolved = replaceEmojiShortcodes(value);
    void sendText(resolved, dmState.replyingTo);
    setAcDismissed(true);
    setText('');
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setEmojiOpen(false);
    textareaRef()?.focus();
  };

  // --- `:name:` shortcode autocomplete ---
  const AC_TOKEN_RE = /:([A-Za-z0-9_+\-]*):?$/;

  const acToken = createMemo<{ start: number; name: string } | null>(() => {
    if (acDismissed()) return null;
    const value = text();
    const match = value.match(AC_TOKEN_RE);
    if (!match) return null;
    return { start: value.length - match[0].length, name: match[1].toLowerCase() };
  });

  const acMatches = createMemo(() => {
    const token = acToken();
    return token ? findEmojiAutocompletions(token.name) : [];
  });

  const acceptShortcode = (item: EmojiAutocompleteEntry) => {
    setText((prev) => {
      const match = prev.match(AC_TOKEN_RE);
      if (!match) return `${prev}${item.emoji}`;
      return `${prev.slice(0, prev.length - match[0].length)}${item.emoji}`;
    });
    setAcHighlighted(0);
    setAcDismissed(true);
    setEmojiOpen(false);
    textareaRef()?.focus();
  };

  return (
    <div class="dm-input-area" data-testid="dm-input-area">
      <Show when={typingNames().length > 0}>
        <div class="dm-typing-indicator" data-testid="dm-typing-indicator">
          {t('dm.typingOne', { name: typingNames()[0] })}
        </div>
      </Show>
      <Show when={replyTarget()}>
        <div class="dm-reply-preview" data-testid="dm-reply-preview">
          <div class="dm-reply-preview-content">
            <span class="dm-reply-preview-label">
              {t('dm.replyingTo', { name: replyTarget()!.senderName ?? 'them' })}
            </span>
            <span class="dm-reply-preview-text">
              {replyTarget()!.deletedAt
                ? t('dm.deletedMessage')
                : replyTarget()!.messageType === 'text'
                  ? replyTarget()!.content.slice(0, 80)
                  : `[${replyTarget()!.messageType}]`}
            </span>
          </div>
          <button class="dm-reply-preview-cancel" data-testid="dm-reply-preview-cancel" onClick={() => setReplyTarget(null)}>
            <PhX />
          </button>
        </div>
      </Show>
      <div class="dm-input-bar">
        <Show when={acMatches().length > 0}>
          <div class="dm-emoji-autocomplete" data-testid="dm-emoji-autocomplete">
            <For each={acMatches()}>
              {(item, i) => (
                <button
                  class={`dm-emoji-ac-item${acHighlighted() === i() ? ' active' : ''}`}
                  data-testid={`dm-emoji-ac-${i()}`}
                  title={`:${item.name}:`}
                  onMouseEnter={() => setAcHighlighted(i())}
                  onClick={() => acceptShortcode(item)}
                >
                  <span class="dm-emoji-ac-glyph">{item.emoji}</span>
                  <span class="dm-emoji-ac-name">:{item.name}:</span>
                </button>
              )}
            </For>
          </div>
        </Show>
        <textarea
          ref={setTextareaRef}
          class="dm-input-textarea"
          data-testid="dm-input-textarea"
          value={text()}
          rows={1}
          placeholder={t('dm.messagePlaceholder', { name: otherName() })}
          onInput={(e) => {
            setText(e.currentTarget.value);
            setAcDismissed(false);
            emitTyping();
          }}
          onKeyDown={(e) => {
            const matches = acMatches();
            if (matches.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAcHighlighted((h) => (h + 1) % matches.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAcHighlighted((h) => (h - 1 + matches.length) % matches.length);
                return;
              }
              if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
                e.preventDefault();
                acceptShortcode(matches[acHighlighted()]);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setAcDismissed(true);
                return;
              }
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div class="dm-input-actions">
          <button
            class="dm-emoji-btn"
            data-testid="dm-emoji-btn"
            onClick={() => {
              setEmojiOpen(!dmState.emojiOpen);
              setGifOpen(false);
            }}
            title={t('dm.emojiTooltip')}
          >
            <PhSmiley class="dm-emoji-btn-glyph" />
          </button>
          <button
            class="dm-gif-btn"
            data-testid="dm-gif-btn"
            onClick={() => {
              setGifOpen(!dmState.gifOpen);
              setEmojiOpen(false);
            }}
            title={t('dm.gifTooltip')}
          >
            GIF
          </button>
        </div>
        <button class="dm-send-btn" data-testid="dm-send-btn" onClick={send} disabled={!text().trim()}>
          <PhPaperPlaneTilt />
        </button>
        <Show when={dmState.gifOpen}>
          <GifPicker />
        </Show>
        <Show when={dmState.emojiOpen}>
          <EmojiPicker onSelect={insertEmoji} />
        </Show>
      </div>
    </div>
  );
}