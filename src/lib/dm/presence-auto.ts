import { dmState, setOwnPresenceAuto, heartbeatPresence, isAutoPresence } from './store';
import type { PresenceStatus } from './types';

const IDLE_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 45_000;
const EVAL_MS = 5_000;
/** How long the page must stay hidden before the monitor writes 'offline'. */
const HIDDEN_MS = 2_500;

export interface PresenceAutoDetectHandle {
  stop(): void;
  poke(): void;
}

function getVisibility(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

/**
 * Client-side auto-presence monitor. While the DM system is active this
 * module keeps the user's stored presence in sync with page activity:
 *
 *  - online ↔ idle (after 5 minutes of no pointer/keyboard/touch activity).
 *  - offline after the page stays hidden for a moment (tab backgrounded or
 *    window minimized). A reload/navigation never writes 'offline', so a
 *    refreshed page rehydrates the user's stored visible presence.
 *  - heartbeat every 45 seconds while the page is visible, so the server
 *    can treat stale presence rows as offline.
 *
 * The auto monitor only drives the machine while the user is online; idle,
 * DND and invisible statuses are never touched by the auto monitor (except an
 * offline it wrote itself is re-raised to online on the next return).
 */
export function startPresenceAutoDetect(opts?: { idleMs?: number; heartbeatMs?: number; evalMs?: number; hiddenMs?: number }): PresenceAutoDetectHandle {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { stop() {}, poke() {} };
  }

  let stopped = false;
  let lastActivity = Date.now();
  let lastHeartbeat = 0;
  let visible = getVisibility();
  let flushing = false;
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  let navigating = false;

  const idleMs = opts?.idleMs ?? IDLE_MS;
  const heartbeatMs = opts?.heartbeatMs ?? HEARTBEAT_MS;
  const evalMs = opts?.evalMs ?? EVAL_MS;
  const hiddenMs = opts?.hiddenMs ?? HIDDEN_MS;

  const poke = () => { lastActivity = Date.now(); };

  const isAutoManaged = (): boolean => {
    const s = dmState.myPresence?.status;
    // Only drive statuses the auto monitor itself produced, plus a plain
    // "online" the user chose. A manually-set idle/dnd/invisible/offline is
    // never touched (Poke never bumps a manual idle back to online).
    return s === 'online' || ((s === 'idle' || s === 'offline') && isAutoPresence());
  };

  const cancelHiddenTimer = () => {
    if (hiddenTimer) { clearTimeout(hiddenTimer); hiddenTimer = null; }
  };

  const writeOffline = async () => {
    flushing = true;
    await setOwnPresenceAuto('offline', dmState.myPresence?.customStatus ?? null);
    flushing = false;
  };

  const flush = async () => {
    if (stopped || flushing) return;
    if (!visible) {
      if (navigating || hiddenTimer) return;
      const s = dmState.myPresence?.status;
      if (s !== 'online' && !(s === 'idle' && isAutoPresence())) return;
      // Defer the offline write: a quick hide->show or a reload/navigation
      // (pagehide) cancels it, so a refresh never squashes the user's stored
      // online/idle status to offline.
      hiddenTimer = setTimeout(() => {
        hiddenTimer = null;
        if (stopped || navigating || visible) return;
        void writeOffline();
      }, hiddenMs);
      return;
    }
    cancelHiddenTimer();
    if (!isAutoManaged()) return;
    const target: PresenceStatus = Date.now() - lastActivity >= idleMs ? 'idle' : 'online';
    if (target !== dmState.myPresence?.status) {
      flushing = true;
      await setOwnPresenceAuto(target, dmState.myPresence?.customStatus ?? null);
      flushing = false;
    }
  };

  const runHeartbeat = async () => {
    if (stopped || !visible) return;
    const s = dmState.myPresence?.status;
    if (s !== 'online' && s !== 'idle' && s !== 'dnd') return;
    const now = Date.now();
    if (now - lastHeartbeat < heartbeatMs) return;
    lastHeartbeat = now;
    await heartbeatPresence();
  };

  const onVisibilityChange = () => {
    if (stopped) return;
    const nextVisible = getVisibility();
    if (nextVisible === visible) return;
    visible = nextVisible;
    if (nextVisible) {
      // Back in the tab (or restored from bfcache): re-arm the monitor and
      // treat the return as activity, so the restored status is an online one.
      navigating = false;
      poke();
    } else {
      cancelHiddenTimer();
    }
    void flush();
  };

  const onPageHide = () => {
    if (stopped) return;
    // Reload/close/back-forward: never persist 'offline' from the unload path,
    // otherwise the refreshed page rehydrates the stored presence as offline.
    navigating = true;
    cancelHiddenTimer();
  };

  const onActivity = () => { if (!stopped) poke(); };

  let moveTimer: ReturnType<typeof setTimeout> | null = null;
  const onThrottledMove = () => {
    if (moveTimer) return;
    moveTimer = setTimeout(() => { moveTimer = null; onActivity(); }, 500);
  };

  document.addEventListener('pointerdown', onActivity);
  document.addEventListener('keydown', onActivity);
  document.addEventListener('touchstart', onActivity);
  document.addEventListener('pointermove', onThrottledMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  const evalInterval = setInterval(() => { void flush(); }, evalMs);
  const heartbeatInterval = setInterval(() => { void runHeartbeat(); }, heartbeatMs);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    document.removeEventListener('pointerdown', onActivity);
    document.removeEventListener('keydown', onActivity);
    document.removeEventListener('touchstart', onActivity);
    document.removeEventListener('pointermove', onThrottledMove as EventListener);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    clearInterval(evalInterval);
    clearInterval(heartbeatInterval);
    cancelHiddenTimer();
    if (moveTimer) { clearTimeout(moveTimer); moveTimer = null; }
  };

  return { stop, poke };
}
