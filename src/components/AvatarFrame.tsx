import { Show } from 'solid-js';
import { getAvatarFrame } from '../lib/avatar-frames';

/**
 * Square avatar-frame overlay for round / square profile avatars
 * (profile header circle, navbar badge, leaderboard rows).
 * Renders nothing when no frame is equipped.
 */
export function AvatarFrameOverlay(props: { frameId?: string | null; class?: string }) {
  const frame = () => getAvatarFrame(props.frameId || 'none');

  return (
    <Show when={frame()}>
      {f => {
        const Overlay = f().Overlay;
        return (
          <svg
            class={`avatar-frame-overlay ${props.class || ''}`}
            viewBox="0 0 200 200"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            data-frame-id={f().id}
          >
            <Overlay />
          </svg>
        );
      }}
    </Show>
  );
}