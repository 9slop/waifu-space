import { createSignal } from 'solid-js';
import { splitEmojiText, twemojiUrl } from '../../lib/dm/emoji';

function EmojiGlyph(props: { emoji: string; onImageLoad?: () => void }) {
  const [failed, setFailed] = createSignal(false);
  return (
    <span class="dm-emoji-glyph">
      {failed()
        ? <span class="dm-emoji-native">{props.emoji}</span>
        : (
          <img
            class="dm-emoji-img"
            src={twemojiUrl(props.emoji)}
            alt={props.emoji}
            loading="lazy"
            draggable={false}
            onError={() => setFailed(true)}
            onLoad={() => props.onImageLoad?.()}
          />
        )
      }
    </span>
  );
}

export { EmojiGlyph };

export function DmEmojiText(props: { text: string; class?: string; onImageLoad?: () => void }) {
  return (
    <span class={props.class}>
      {splitEmojiText(props.text).map(seg =>
        seg.emoji
          ? <EmojiGlyph emoji={seg.text} onImageLoad={props.onImageLoad} />
          : <span>{seg.text}</span>
      )}
    </span>
  );
}