import { describe, it, expect } from 'vitest';
import {
  isVisiblePresence,
  suppressesNotifications,
  isStorableStatus,
  statusColor,
  effectivePresence,
  comparePresence,
  statusForUserId,
  STATUS_LABELS
} from '../../src/lib/dm/presence';

describe('dm presence helpers', () => {
  it('isVisiblePresence marks online/idle/dnd only', () => {
    expect(isVisiblePresence('online')).toBe(true);
    expect(isVisiblePresence('idle')).toBe(true);
    expect(isVisiblePresence('dnd')).toBe(true);
    expect(isVisiblePresence('invisible')).toBe(false);
    expect(isVisiblePresence('offline')).toBe(false);
    expect(isVisiblePresence(null)).toBe(false);
  });

  it('only dnd suppresses notifications', () => {
    expect(suppressesNotifications('dnd')).toBe(true);
    expect(suppressesNotifications('online')).toBe(false);
    expect(suppressesNotifications('idle')).toBe(false);
  });

  it('isStorableStatus accepts everything except offline', () => {
    expect(isStorableStatus('online')).toBe(true);
    expect(isStorableStatus('idle')).toBe(true);
    expect(isStorableStatus('dnd')).toBe(true);
    expect(isStorableStatus('invisible')).toBe(true);
    expect(isStorableStatus('offline')).toBe(false);
    expect(isStorableStatus('bogus')).toBe(false);
    expect(isStorableStatus(null)).toBe(false);
  });

  it('statusColor maps to discord-style palette and falls back to offline', () => {
    expect(statusColor('online')).toBe('#23a55a');
    expect(statusColor('dnd')).toBe('#f23f43');
    expect(statusColor('idle')).toBe('#f0b232');
    expect(statusColor(null)).toBe('#80848e');
  });

  it('STATUS_LABELS has friendly names for every status', () => {
    expect(STATUS_LABELS.online).toBe('Online');
    expect(STATUS_LABELS.invisible).toBe('Invisible');
    expect(STATUS_LABELS.offline).toBe('Offline');
  });

  it('effectivePresence prefers realtime then stored, mapping invisible to offline', () => {
    expect(effectivePresence('online', { status: 'offline', lastSeenAt: '' })).toBe('online');
    expect(effectivePresence(undefined, { status: 'idle', lastSeenAt: '' })).toBe('idle');
    expect(effectivePresence(undefined, { status: 'invisible', lastSeenAt: '' })).toBe('offline');
    expect(effectivePresence(undefined, { status: 'offline', lastSeenAt: '' })).toBe('offline');
    expect(effectivePresence(undefined, undefined)).toBe('offline');
  });

  it('comparePresence ranks online surfaces above offline', () => {
    expect(comparePresence('online', 'idle')).toBeLessThan(0);
    expect(comparePresence('online', 'offline')).toBeLessThan(0);
    expect(comparePresence('dnd', 'offline')).toBeLessThan(0);
    expect(comparePresence('offline', 'online')).toBeGreaterThan(0);
    expect(comparePresence('idle', 'idle')).toBe(0);
  });

  it('statusForUserId combines db + realtime maps', () => {
    const presence = { u2: { userId: 'u2', status: 'invisible', lastSeenAt: '' } };
    const realtime = { u1: 'online' };
    expect(statusForUserId('u1', presence, realtime)).toBe('online');
    expect(statusForUserId('u2', presence, realtime)).toBe('offline');
    expect(statusForUserId('u3', presence, realtime)).toBe('offline');
  });
});