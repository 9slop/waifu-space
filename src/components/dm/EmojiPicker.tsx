import { createSignal, For, onCleanup, onMount } from 'solid-js';
import { EMOJI_CATEGORIES } from '../../lib/dm/emoji';
import { setEmojiOpen } from '../../lib/dm/store';
import { t } from '../../lib/i18n';
import { EmojiGlyph } from './DmEmojiText';

const PICKER_W = 480;
/** Rough rendered height of the picker so we can keep it inside the viewport. */
const PICKER_H = 400;

interface PickerPos {
  alignLeft: boolean;
  openDown: boolean;
}

/**
 * Popover emoji picker: category tabs + a grid of Twemoji buttons. Unlike the
 * GIF picker it inserts the chosen emoji (via `onSelect`) instead of sending
 * a message; it closes on outside click. It measures its anchor on mount and
 * flips itself horizontally/vertically so it always stays in the viewport.
 */
export function EmojiPicker(props: { onSelect: (emoji: string) => void; onRequestClose?: () => void }) {
  const [cat, setCat] = createSignal<string>(EMOJI_CATEGORIES[0].id);
  const [pos, setPos] = createSignal<PickerPos>({ alignLeft: false, openDown: false });
  let rootRef: HTMLDivElement | undefined;

  const active = () => EMOJI_CATEGORIES.find((c) => c.id === cat()) ?? EMOJI_CATEGORIES[0];

  const closeOnClickAway = (e: PointerEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.closest('.dm-emoji-picker') || el.closest('.dm-emoji-btn') || el.closest('.dm-reaction-add') || el.closest('.dm-reaction-add-anchor'))) return;
    props.onRequestClose?.();
    setEmojiOpen(false);
  };

  onMount(() => {
    const el = rootRef;
    const anchor = el?.parentElement;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(PICKER_W, vw * 0.92);
      const hasRoomRight = vw - rect.right >= w - 8;
      const hasRoomLeft = rect.left >= w - 8;
      const hasRoomUp = rect.top >= PICKER_H + 10;
      const hasRoomDown = vh - rect.bottom >= PICKER_H + 10;
      // The default opens to the left (right edge aligned). Flip to the right
      // when the anchor is hugging the left edge of the viewport.
      const alignLeft = !hasRoomLeft && hasRoomRight;
      // The default opens upward. Flip down when there is no head room but the
      // anchor has space below (or simply more space below than above).
      const openDown = !hasRoomUp && hasRoomDown;
      if (alignLeft || openDown) setPos({ alignLeft, openDown });
    }
    document.addEventListener('pointerdown', closeOnClickAway);
  });
  onCleanup(() => document.removeEventListener('pointerdown', closeOnClickAway));

  return (
    <div
      class={`dm-emoji-picker${pos().alignLeft ? ' opens-left' : ''}${pos().openDown ? ' opens-down' : ''}`}
      data-testid="dm-emoji-picker"
      ref={rootRef}
    >
      <div class="dm-emoji-cats">
        <For each={EMOJI_CATEGORIES}>
          {(c) => (
            <button
              class={`dm-emoji-cat${cat() === c.id ? ' active' : ''}`}
              data-testid={`dm-emoji-cat-${c.id}`}
              onClick={() => setCat(c.id)}
            >
              {t(c.labelKey)}
            </button>
          )}
        </For>
      </div>
      <div class="dm-emoji-grid" data-testid="dm-emoji-grid">
        <For each={active().items}>
          {(emoji, i) => (
            <button
              class="dm-emoji-item"
              data-testid={`dm-emoji-item-${i()}`}
              aria-label={emoji}
              onClick={() => props.onSelect(emoji)}
            >
              <EmojiGlyph emoji={emoji} />
            </button>
          )}
        </For>
      </div>
    </div>
  );
}