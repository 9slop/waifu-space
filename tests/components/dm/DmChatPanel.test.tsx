import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { DmChatPanel } from '../../../src/components/dm/DmChatPanel';
import { dmState, setDmState } from '../../../src/lib/dm/store';
import { resetForDmTests, stubFetch, flush } from '../../dm-helpers';
import type { CallSession } from '../../../src/lib/dm/types';

vi.mock('../../../src/lib/dm/call', () => ({
  CallManager: class {
    deps: any = {};
    currentState = 'ended';
    private muted = false;
    private videoOff = true;
    private screenSharing = false;
    constructor(deps: any) {
      this.deps = deps ?? {};
    }
    async startLocal(): Promise<boolean> {
      return true;
    }
    async createOffer(): Promise<{ type: string; sdp: string }> {
      return { type: 'offer', sdp: 'offer-sdp' };
    }
    async adoptAnswer(): Promise<void> {
      this.currentState = 'connected';
      this.deps.onStateChange?.();
    }
    async adoptIce(): Promise<void> {}
    toggleMute(): boolean {
      this.muted = !this.muted;
      return this.muted;
    }
    setRemoteAudioEnabled(): void {}
    toggleVideo(): boolean {
      this.videoOff = !this.videoOff;
      return this.videoOff;
    }
    isMuted(): boolean {
      return this.muted;
    }
    isVideoOff(): boolean {
      return this.videoOff;
    }
    async ensureCamera(): Promise<boolean> {
      this.videoOff = false;
      return true;
    }
    hasVideoTracks(): boolean {
      return true;
    }
    async enableScreenShare(): Promise<boolean> {
      this.screenSharing = true;
      return true;
    }
    async disableScreenShare(): Promise<boolean> {
      this.screenSharing = false;
      return true;
    }
    isScreenSharing(): boolean {
      return this.screenSharing;
    }
    hangUp(): void {
      this.currentState = 'ended';
    }
  }
}));

function callSession(over: Partial<CallSession> = {}): CallSession {
  return {
    id: 'call-1',
    conversationId: 'c1',
    callerId: 'u-me',
    calleeId: 'u-bob',
    callType: 'voice',
    status: 'ringing',
    startedAt: '2025-01-02T00:00:00.000Z',
    answeredAt: null,
    endedAt: null,
    createdAt: '2025-01-02T00:00:00.000Z',
    ...over
  };
}

function seedConv() {
  setDmState('conversations', [
    {
      id: 'c1',
      type: 'dm',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      lastReadAt: null,
      unreadCount: 0,
      lastMessage: null,
      otherUser: { id: 'u-bob', username: 'Bob', presenceStatus: 'online' }
    }
  ]);
  setDmState('activeConversationId', 'c1');
}

describe('DmChatPanel call button', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
  });

  it('clicking the call button starts an outgoing voice call', async () => {
    seedConv();
    const restore = stubFetch({
      '/api/dm/calls': () => ({
        body: { success: true, call: callSession() },
        status: 201
      })
    });
    const { container } = render(() => <DmChatPanel />);
    const btn = container.querySelector('[data-testid="dm-call-voice"]') as HTMLButtonElement;
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    await flush();
    expect(dmState.call).not.toBeNull();
    expect(dmState.call?.direction).toBe('outgoing');
    expect(dmState.call?.callState).toBe('ringing');
    expect(dmState.call?.call?.callType).toBe('voice');
    expect(dmState.call?.call?.conversationId).toBe('c1');
    restore();
  });

  it('call button is not rendered when there is no active conversation', () => {
    const { container } = render(() => <DmChatPanel />);
    expect(container.querySelector('[data-testid="dm-call-voice"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-chat-empty"]')).toBeInTheDocument();
  });

  it('disables the call button while a call is already in progress', async () => {
    seedConv();
    const restore = stubFetch({
      '/api/dm/calls': () => ({
        body: { success: true, call: callSession() },
        status: 201
      })
    });
    const { container } = render(() => <DmChatPanel />);
    const btn = container.querySelector('[data-testid="dm-call-voice"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await flush();
    expect(dmState.call).not.toBeNull();
    expect(btn.disabled).toBe(true);
    restore();
  });

  it('multiple rapid clicks do not crash the store', async () => {
    seedConv();
    const restore = stubFetch({
      '/api/dm/calls': () => ({
        body: { success: true, call: callSession({ id: 'call-rapid' }) },
        status: 201
      })
    });
    const { container } = render(() => <DmChatPanel />);
    const btn = container.querySelector('[data-testid="dm-call-voice"]') as HTMLButtonElement;
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await flush();
    expect(dmState.call).not.toBeNull();
    expect(dmState.call?.direction).toBe('outgoing');
    restore();
  });
});
