import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startIncomingRing, stopIncomingRing } from '../../src/lib/dm/ringtone';
import { setState } from '../../src/lib/store';

/** Minimal Web Audio stub: the ring module only touches this surface. */
class FakeAudioContext {
  static instances: any[] = [];
  state = 'running';
  currentTime = 0;
  destination: unknown = {};
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  createGain() {
    return {
      connect: () => undefined,
      gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }
    };
  }
  createOscillator() {
    return { type: '', frequency: { setValueAtTime: () => undefined }, connect: () => undefined, start: () => undefined, stop: () => undefined };
  }
}

describe('ringtone', () => {
  beforeEach(() => {
    FakeAudioContext.instances = [];
    (window as any).AudioContext = FakeAudioContext;
    (window as any).webkitAudioContext = undefined;
  });

  afterEach(() => {
    stopIncomingRing();
    vi.restoreAllMocks();
    delete (window as any).AudioContext;
  });

  it('loops a ring tone while started and stops when stopped', () => {
    setState('settings', 'soundEnabled', true);
    const setSpy = vi.spyOn(window, 'setInterval');

    startIncomingRing();

    expect(FakeAudioContext.instances.length).toBe(1);
    expect(setSpy).toHaveBeenCalledTimes(1);
    const timerId = setSpy.mock.results[0].value;
    expect(timerId).toBeDefined();

    const clearSpy = vi.spyOn(window, 'clearInterval');
    stopIncomingRing();
    expect(clearSpy).toHaveBeenCalledWith(timerId);
  });

  it('does not start a ring when sound is disabled', () => {
    setState('settings', 'soundEnabled', false);
    const setSpy = vi.spyOn(window, 'setInterval');

    startIncomingRing();

    expect(FakeAudioContext.instances.length).toBe(0);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('starts without audio support and silently stays silent', () => {
    setState('settings', 'soundEnabled', true);
    (window as any).AudioContext = undefined;
    const setSpy = vi.spyOn(window, 'setInterval');

    startIncomingRing();

    expect(setSpy).not.toHaveBeenCalled();
  });
});