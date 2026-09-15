import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { state } from '../../lib/store';
import { dmState } from '../../lib/dm/store';
import { fetchUserProfileRequest, formatJoinDate } from '../../lib/dm/api';
import { statusColor, statusForUserId } from '../../lib/dm/presence';
import { t } from '../../lib/i18n';
import { PhX } from '../icons';
import { DmAvatar } from './DmAvatar';
import type { DmUserProfile } from '../../lib/dm/types';

const POPOVER_WIDTH = 264;
const POPOVER_EST_HEIGHT = 330;

/**
 * Compact, Discord-like profile popup anchored near the element that was
 * clicked. Shows avatar, name, presence + custom status, registration date
 * and the user's description/bio. Flips above/below the anchor and clamps to
 * the viewport, matching the requested "popup near the click" behaviour.
 */
export function DmProfilePopover(props: { userId: string; anchor: () => DOMRect | null; onClose: () => void }) {
  const [pos, setPos] = createSignal<{ top: number; left: number; openUp: boolean }>({ top: 80, left: 20, openUp: false });
  const [profile, setProfile] = createSignal<DmUserProfile | null>(null);
  let lastLoadedUserId: string | null = null;

  // Fetch the profile imperatively instead of createResource: reading a
  // resource suspends, and the app's top-level <Suspense> has no fallback so
  // the whole layout vanishes while the fetch is in flight.
  createEffect(() => {
    const id = props.userId;
    if (!id || id === lastLoadedUserId) return;
    lastLoadedUserId = id;
    let alive = true;
    setProfile(null);
    const token = state.user?.token;
    if (!token) return;
    fetchUserProfileRequest(token, id)
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch(() => {
        if (alive) setProfile(null);
      });
    onCleanup(() => {
      alive = false;
    });
  });

  const presence = () => {
    const realtime = dmState.realtimePresence[props.userId]?.status;
    return statusForUserId(props.userId, dmState.presence, { [props.userId]: realtime });
  };
  const customStatus = () => dmState.presence[props.userId]?.customStatus ?? dmState.realtimePresence[props.userId]?.customStatus;

  const recompute = () => {
    const rect = props.anchor();
    if (!rect) return;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const openUp = rect.top > VIEWPORT_OFFSET + POPOVER_EST_HEIGHT || viewH - rect.bottom < POPOVER_EST_HEIGHT;
    const left = Math.max(8, Math.min(rect.left, viewW - POPOVER_WIDTH - 8));
    const top = openUp
      ? Math.max(8, rect.top - POPOVER_EST_HEIGHT - 8)
      : Math.min(rect.bottom + 8, viewH - POPOVER_EST_HEIGHT - 8);
    setPos({ top, left, openUp });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!(e.target as Element | null)?.closest('.dm-profile-popover')) props.onClose();
  };

  onMount(() => {
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
  });

  onCleanup(() => {
    window.removeEventListener('resize', recompute);
    window.removeEventListener('scroll', recompute, true);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('pointerdown', onPointerDown);
  });

  return (
    <section
        class="dm-profile-popover"
        data-testid="dm-profile-popover"
        role="dialog"
        aria-label={t('dm.profile')}
        style={{ top: `${pos().top}px`, left: `${pos().left}px` }}
      >
        <button class="dm-profile-close dm-popover-close" data-testid="dm-profile-close" onClick={props.onClose} aria-label={t('common.close')}>
          <PhX />
        </button>

        <DmAvatar
          name={profile()?.username ?? dmState.conversations.find((c) => c.otherUser.id === props.userId)?.otherUser?.username ?? '?'}
          avatarUrl={profile()?.avatarUrl}
          status={presence()}
          size="80px"
        />

        <h3 class="dm-profile-name" data-testid="dm-profile-name">
          {profile()?.username
            ?? dmState.conversations.find((c) => c.otherUser.id === props.userId)?.otherUser?.username
            ?? (state.user?.id === props.userId ? state.user?.username : null)
            ?? '…'}
        </h3>
        <span class="dm-popover-status" data-testid="dm-popover-status">
          <span class="dm-status-dot" style={{ background: statusColor(presence()) }} />
          {t(`dm.${presence()}`)}
        </span>
        <Show when={customStatus()}>
          <span class="dm-popover-custom-status" data-testid="dm-popover-custom-status">~ {customStatus()}</span>
        </Show>

        <Show when={profile()?.createdAt}>
          <div class="dm-profile-section dm-popover-section">
            <span class="dm-profile-section-label">{t('dm.memberSince')}</span>
            <span class="dm-profile-section-value" data-testid="dm-popover-joined">{formatJoinDate(profile()!.createdAt)}</span>
          </div>
        </Show>

        <Show when={profile()?.bio}>
          <div class="dm-profile-section dm-popover-section">
            <span class="dm-profile-section-label">{t('dm.bio')}</span>
            <p class="dm-profile-bio" data-testid="dm-popover-bio">{profile()!.bio}</p>
          </div>
        </Show>
      </section>
  );
}

const VIEWPORT_OFFSET = 16;