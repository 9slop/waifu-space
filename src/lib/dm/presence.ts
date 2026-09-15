import type { PresenceStatus, UserPresence } from './types';

// ---------------------------------------------------------------------------
// Pure presence helpers (framework-free, unit-tested)
// ---------------------------------------------------------------------------

export const PRESENCE_ORDER: PresenceStatus[] = ['online', 'idle', 'dnd', 'invisible', 'offline'];

/** Presence statuses that are broadcast on the realtime presence channel. */
export function isVisiblePresence(status: PresenceStatus | null | undefined): boolean {
  return status === 'online' || status === 'idle' || status === 'dnd';
}

/** Statuses that suppress incoming-message notifications locally. */
export function suppressesNotifications(status: PresenceStatus | null | undefined): boolean {
  return status === 'dnd';
}

/** True when a status is stored server-side (all except offline). */
export function isStorableStatus(status: string | null | undefined): status is PresenceStatus {
  return status === 'online' || status === 'idle' || status === 'dnd' || status === 'invisible';
}

export const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  invisible: 'Invisible',
  offline: 'Offline'
};

export const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: '#23a55a',
  idle: '#f0b232',
  dnd: '#f23f43',
  invisible: '#80848e',
  offline: '#80848e'
};

export function statusColor(status: PresenceStatus | null | undefined): string {
  return STATUS_COLORS[status ?? 'offline'];
}

/**
 * Effective presence for a user: realtime presence (online/idle/dnd) wins when
 * present, otherwise the stored presence (invisible → offline display), and
 * finally a stored "offline" row or last-seen.
 */
export function effectivePresence(
  realtimeStatus: PresenceStatus | undefined,
  stored: UserPresence | null | undefined
): PresenceStatus {
  if (realtimeStatus === 'online' || realtimeStatus === 'idle' || realtimeStatus === 'dnd') {
    return realtimeStatus;
  }
  if (!stored) return 'offline';
  return stored.status === 'invisible' ? 'offline' : stored.status;
}

/** Comparator: online→offline order for sorting channel lists. */
export function comparePresence(a: PresenceStatus, b: PresenceStatus): number {
  const rank = (s: PresenceStatus) => (s === 'online' ? 0 : s === 'idle' ? 1 : s === 'dnd' ? 2 : 3);
  return rank(a) - rank(b);
}

/** Maps a single row + realtime data to that user's displayed status. */
export function statusForUserId(
  userId: string,
  presenceMap: Record<string, UserPresence>,
  realtimeMap: Record<string, PresenceStatus>
): PresenceStatus {
  return effectivePresence(realtimeMap[userId], presenceMap[userId]);
}