import { createSignal, Show } from 'solid-js';
import type { PresenceStatus } from '../../lib/dm/types';
import { statusColor } from '../../lib/dm/presence';

/**
 * Tiny avatar pill used across the DM UI. Renders the user's initials until
 * their avatar image loads (falling back to initials on error), with an
 * optional presence dot in the bottom-right corner.
 */
export function DmAvatar(props: {
  name: string;
  avatarUrl?: string | null;
  status?: PresenceStatus | null;
  size?: string;
  class?: string;
}) {
  const [errored, setErrored] = createSignal(false);
  const initials = () => (props.name || '?').trim().slice(0, 2).toUpperCase();
  const size = () => props.size || '32px';
  const color = () => statusColor(props.status ?? 'offline');

  return (
    <span
      class={`dm-avatar ${props.class ?? ''}`}
      data-testid="dm-avatar"
      style={{ width: size(), height: size(), 'font-size': `calc(${size()} * 0.42)` }}
      aria-hidden="true"
    >
      <Show when={!props.avatarUrl || errored()} fallback={<img src={props.avatarUrl!} alt="" loading="lazy" onError={() => setErrored(true)} />}>
        <span class="dm-avatar-initials">{initials()}</span>
      </Show>
      <Show when={props.status !== undefined && props.status !== null}>
        <span class="dm-presence-dot" style={{ background: color() }} />
      </Show>
    </span>
  );
}