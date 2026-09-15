import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { CallOverlay } from '../../../src/components/dm/CallOverlay';
import { dmState, setDmState, startCall } from '../../../src/lib/dm/store';
import { resetForDmTests, stubFetch, flush } from '../../dm-helpers';
import type { CallOfferBroadcast, CallSession } from '../../../src/lib/dm/types';

vi.mock('../../../src/lib/dm/call', () => ({
  CallManager: class {
    deps: any = {};
    currentState = 'ringing';
    localMedia: MediaStream | null = null;
    remoteMedia: MediaStream | null = null;
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
    async acceptOffer(): Promise<{ type: string; sdp: string }> {
      this.currentState = 'connected';
      this.deps.onStateChange?.();
      return { type: 'answer', sdp: 'answer-sdp' };
    }
    async adoptAnswer(): Promise<void> {
      this.currentState = 'connected';
      this.deps.onStateChange?.();
    }
    async adoptIce(): Promise<void> {}
    toggleMute(): boolean {
      this.muted = true;
      return true;
    }
    setRemoteAudioEnabled(): void {}
    toggleVideo(): boolean {
      this.videoOff = this.videoOff ? false : false;
      return true;
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
      this.videoOff = false;
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

const callSession = (over: Partial<CallSession> = {}): CallSession => ({
  id: 'call-1',
  conversationId: 'c1',
  callerId: 'u-bob',
  calleeId: 'u-me',
  callType: 'voice',
  status: 'ringing',
  startedAt: '2025-01-02T00:00:00.000Z',
  answeredAt: null,
  endedAt: null,
  createdAt: '2025-01-02T00:00:00.000Z',
  ...over
});

function seedConv() {
  setDmState('conversations', [
    {
      id: 'c1',
      type: 'dm',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
      lastReadAt: null,
      unreadCount: 0,
      lastMessage: null,
      otherUser: { id: 'u-bob', username: 'Bob', presenceStatus: 'online' }
    }
  ]);
  setDmState('activeConversationId', 'c1');
}

describe('CallOverlay', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
  });

  it('renders nothing when there is no call activity', () => {
    const { container } = render(() => <CallOverlay />);
    expect(container.querySelector('[data-testid="dm-incoming-call"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="dm-active-call"]')).not.toBeInTheDocument();
  });

  it('shows the incoming banner and declines', async () => {
    const offer: CallOfferBroadcast = { kind: 'call-offer', call: callSession(), callerName: 'Bob' };
    const restore = stubFetch({ '/api/dm/calls': () => ({ body: { success: true } }) });
    setDmState('incomingCall', offer);
    const { container } = render(() => <CallOverlay />);
    expect(container.querySelector('[data-testid="dm-incoming-call"]')).toBeInTheDocument();
    expect(container.textContent).toContain('Bob');
    // both participant avatars + pulsing ring are rendered while ringing
    expect(container.querySelectorAll('[data-testid="dm-avatar"]').length).toBe(2);
    expect(container.querySelector('[data-testid="dm-call-avatars"].ringing')).toBeInTheDocument();
    expect(container.querySelector('.dm-call-ring')).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-testid="dm-call-decline"]')!);
    await flush();
    expect(dmState.incomingCall).toBeNull();
    restore();
  });

  it('accepts an incoming call and transitions to an active call', async () => {
    const offer: CallOfferBroadcast = { kind: 'call-offer', call: callSession(), callerName: 'Bob', offer: { type: 'offer', sdp: 'offer' } };
    setDmState('incomingCall', offer);
    const restore = stubFetch({ '/api/dm/calls/call-1/status': () => ({ body: { success: true } }) });
    const { container } = render(() => <CallOverlay />);
    fireEvent.click(container.querySelector('[data-testid="dm-call-accept"]')!);
    await flush();
    expect(dmState.incomingCall).toBeNull();
    expect(dmState.call?.direction).toBe('incoming');
    expect(dmState.call?.callState).toBe('connected');
    expect(container.querySelector('[data-testid="dm-active-call"]')).toBeInTheDocument();
    // connected calls keep both avatars but drop the pulsing ring
    expect(container.querySelectorAll('[data-testid="dm-avatar"]').length).toBe(2);
    expect(container.querySelector('.dm-call-ring')).not.toBeInTheDocument();
    restore();
  });

  it('startCall shows an outgoing ringing panel and hangup cancels it', async () => {
    seedConv();
    const restore = stubFetch({
      '/api/dm/calls': () => ({
        body: {
          success: true,
          call: callSession({ id: 'call-2', callerId: 'u-me', calleeId: 'u-bob', callType: 'voice' })
        },
        status: 201
      }),
      '/api/dm/calls/call-2/status': () => ({ body: { success: true, call: callSession({ id: 'call-2', status: 'canceled' }) } })
    });
    const ok = await startCall('voice');
    expect(ok).toBe(true);
    const { container } = render(() => <CallOverlay />);
    expect(container.querySelector('[data-testid="dm-active-call"]')).toBeInTheDocument();
    expect(container.textContent).toContain('Calling');
    expect(container.textContent).not.toContain('In call');
    fireEvent.click(container.querySelector('[data-testid="dm-call-hangup"]')!);
    await flush();
    expect(dmState.call).toBeNull();
    restore();
  });

  it('outgoing call that joined an existing active call reads as In call, not Calling', async () => {
    seedConv();
    setDmState('call', {
      call: callSession({ id: 'call-3', callerId: 'u-me', calleeId: 'u-bob', status: 'active' }),
      direction: 'outgoing',
      remoteName: 'Bob',
      callState: 'active',
      muted: false,
      videoOff: true,
      screenSharing: false,
      deafened: false
    });
    const { container } = render(() => <CallOverlay />);
    expect(container.textContent).toContain('In call');
    expect(container.textContent).not.toContain('Calling');
  });

  it('outgoing call keeps Calling… until the peer actually answers', async () => {
    seedConv();
    const call = callSession({ id: 'call-4', callerId: 'u-me', calleeId: 'u-bob', status: 'ringing' });
    setDmState('call', {
      call,
      direction: 'outgoing',
      remoteName: 'Bob',
      callState: 'ringing',
      muted: false,
      videoOff: true,
      screenSharing: false,
      deafened: false
    });
    const { container } = render(() => <CallOverlay />);
    expect(container.textContent).toContain('Calling');
    expect(container.textContent).not.toContain('In call');
    // The peer answers: manager state flips to 'connected' -> label updates.
    setDmState('call', 'callState', 'connected');
    await flush();
    expect(container.textContent).toContain('In call');
    expect(container.textContent).not.toContain('Calling');
  });

  it('mute toggles the call state and badges the avatar', async () => {
    const offer: CallOfferBroadcast = { kind: 'call-offer', call: callSession(), callerName: 'Bob', offer: { type: 'offer', sdp: 'offer' } };
    setDmState('incomingCall', offer);
    const restore = stubFetch({ '/api/dm/calls/call-1/status': () => ({ body: { success: true } }) });
    const { container } = render(() => <CallOverlay />);
    fireEvent.click(container.querySelector('[data-testid="dm-call-accept"]')!);
    await flush();
    expect(dmState.call?.muted).toBe(false);
    expect(container.querySelector('[data-testid="dm-call-muted-badge"]')).not.toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-testid="dm-call-mute"]')!);
    await flush();
    expect(dmState.call?.muted).toBe(true);
    expect(container.querySelector('[data-testid="dm-call-muted-badge"]')).toBeInTheDocument();
    restore();
  });

  it('deafen toggles the headphones state and badge', async () => {
    const offer: CallOfferBroadcast = { kind: 'call-offer', call: callSession(), callerName: 'Bob', offer: { type: 'offer', sdp: 'offer' } };
    setDmState('incomingCall', offer);
    const restore = stubFetch({ '/api/dm/calls/call-1/status': () => ({ body: { success: true } }) });
    const { container } = render(() => <CallOverlay />);
    fireEvent.click(container.querySelector('[data-testid="dm-call-accept"]')!);
    await flush();
    expect(dmState.call?.deafened).toBe(false);
    fireEvent.click(container.querySelector('[data-testid="dm-call-deafen"]')!);
    await flush();
    expect(dmState.call?.deafened).toBe(true);
    expect(dmState.call?.muted).toBe(true);
    expect(container.querySelector('[data-testid="dm-call-deafened-badge"]')).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-testid="dm-call-deafen"]')!);
    await flush();
    expect(dmState.call?.deafened).toBe(false);
    expect(container.querySelector('[data-testid="dm-call-deafened-badge"]')).not.toBeInTheDocument();

    restore();
  });

  it('deafened badge draws a single diagonal slash, not a crossed X', async () => {
    const offer: CallOfferBroadcast = { kind: 'call-offer', call: callSession(), callerName: 'Bob', offer: { type: 'offer', sdp: 'offer' } };
    setDmState('incomingCall', offer);
    const restore = stubFetch({ '/api/dm/calls/call-1/status': () => ({ body: { success: true } }) });
    const { container } = render(() => <CallOverlay />);
    fireEvent.click(container.querySelector('[data-testid="dm-call-accept"]')!);
    await flush();
    fireEvent.click(container.querySelector('[data-testid="dm-call-deafen"]')!);
    await flush();
    const badgeSvg = container.querySelector('[data-testid="dm-call-deafened-badge"] svg')!;
    const paths = badgeSvg.querySelectorAll('path');
    // Headphones body + one slash stroke only.
    expect(paths.length).toBe(2);
    // A single diagonal slash is one line command; a crossed X needs four.
    const slashD = paths[1].getAttribute('d') ?? '';
    expect(slashD.split('L').length - 1).toBe(1);
    restore();
  });

  it('camera button acquires a video feed and shows the stage', async () => {
    const offer: CallOfferBroadcast = {
      kind: 'call-offer',
      call: callSession({ callType: 'voice' }),
      callerName: 'Bob',
      offer: { type: 'offer', sdp: 'offer' }
    };
    setDmState('incomingCall', offer);
    const restore = stubFetch({ '/api/dm/calls/call-1/status': () => ({ body: { success: true } }) });
    const { container } = render(() => <CallOverlay />);
    fireEvent.click(container.querySelector('[data-testid="dm-call-accept"]')!);
    await flush();
    expect(container.querySelector('.dm-call-remote-video')).not.toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-testid="dm-call-video-toggle"]')!);
    await flush();
    expect(dmState.call?.videoOff).toBe(false);
    expect(container.querySelector('.dm-call-remote-video')).toBeInTheDocument();
    expect(container.querySelector('.dm-call-pip-video')).toBeInTheDocument();
    restore();
  });

  it('enables a camera preview while still ringing (before answering)', async () => {
    seedConv();
    const restore = stubFetch({
      '/api/dm/calls': () => ({
        body: { success: true, call: callSession({ id: 'call-3', callerId: 'u-me', calleeId: 'u-bob' }) },
        status: 201
      }),
      '/api/dm/calls/call-3/status': () => ({ body: { success: true } })
    });
    const ok = await startCall('voice');
    expect(ok).toBe(true);
    const { container } = render(() => <CallOverlay />);
    expect(dmState.call?.callState).toBe('ringing');
    expect(container.querySelector('.dm-call-remote-video')).not.toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-testid="dm-call-video-toggle"]')!);
    await flush();
    expect(dmState.call?.videoOff).toBe(false);
    // pre-accept preview fills the stage and avatars turn into rounded squares
    expect(container.querySelector('.dm-call-remote-video')).toBeInTheDocument();
    expect(container.querySelector('.dm-call-avatars.squared')).toBeInTheDocument();
    restore();
  });

  it('screen share toggles on and shows in the bar', async () => {
    const offer: CallOfferBroadcast = {
      kind: 'call-offer',
      call: callSession(),
      callerName: 'Bob',
      offer: { type: 'offer', sdp: 'offer' }
    };
    setDmState('incomingCall', offer);
    const restore = stubFetch({ '/api/dm/calls/call-1/status': () => ({ body: { success: true } }) });
    const { container } = render(() => <CallOverlay />);
    fireEvent.click(container.querySelector('[data-testid="dm-call-accept"]')!);
    await flush();
    fireEvent.click(container.querySelector('[data-testid="dm-call-screen-toggle"]')!);
    await flush();
    expect(dmState.call?.screenSharing).toBe(true);
    // While sharing, the big stage hosts the shared feed and the square
    // camera PiP gets the .screen modifier; the dock reports the share.
    expect(container.querySelector('.dm-call-pip-video.screen')).toBeInTheDocument();
    expect(container.querySelector('.dm-call-dock.has-video')).toBeInTheDocument();
    expect(container.textContent).toContain('Sharing');
    fireEvent.click(container.querySelector('[data-testid="dm-call-screen-toggle"]')!);
    await flush();
    expect(dmState.call?.screenSharing).toBe(false);
    restore();
  });
});