import type { CallSignalPayload, CallType } from './types';

// ---------------------------------------------------------------------------
// WebRTC call manager
//
// Owns the RTCPeerConnection, the local media stream (mic / camera / screen)
// and the remote MediaStream. Uses dependency injection for the browser media
// APIs so it can be unit-tested in a non-browser environment.
//
// Signaling flow (offered over the Supabase realtime conversation channel):
//   caller.startLocal() -> createOffer(peerId) -> { offer } broadcast
//   callee.acceptOffer(peerId, offer)         -> { answer } broadcast
//   both: adoptIce(candidate)                 -> { ice } broadcast
// The ICE candidates are gathered by the underlying peer connection and are
// handed to the caller through `onIceCandidate` callbacks.
// ---------------------------------------------------------------------------

export type CallState =
  | 'idle'
  | 'acquiring'
  | 'ringing' // caller waiting for answer
  | 'connected'
  | 'active' // adopted an already-ongoing call (join), media still being linked
  | 'ended'
  | 'failed';

export interface CallOptions {
  type: CallType;
  audio: boolean;
  video: boolean;
  screen: boolean;
}

export interface CallManagerDeps {
  createPeer?: () => RTCPeerConnection;
  getUserMedia?: typeof navigator.mediaDevices.getUserMedia;
  getDisplayMedia?: typeof navigator.mediaDevices.getDisplayMedia;
  iceServers?: RTCConfiguration['iceServers'];
  onLocalStream?: (stream: MediaStream, options: CallOptions) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onStateChange?: (state: CallState) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit, callId: string) => void;
  /** Emitted when a mid-call track change needs a fresh SDP offer. */
  onRenegotiation?: (offer: RTCSessionDescriptionInit, callId: string) => void;
}

export class CallManager {
  deps: CallManagerDeps;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private options: CallOptions | null = null;
  private state: CallState = 'idle';
  private callId: string | null = null;
  private peerId: string | null = null;
  private creatingAnswer = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private videoSender: RTCRtpSender | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;
  private screenActive = false;
  private cameraTrack: MediaStreamTrack | null = null;
  private renegotiating = false;

  constructor(deps: CallManagerDeps = {}) {
    this.deps = deps;
  }

  get currentState(): CallState {
    return this.state;
  }

  get localMedia(): MediaStream | null {
    return this.localStream;
  }

  get remoteMedia(): MediaStream | null {
    return this.remoteStream;
  }

  private setState(next: CallState): void {
    if (next === this.state) return;
    this.state = next;
    this.deps.onStateChange?.(next);
  }

  private setPeer(peerId: string): void {
    this.peerId = peerId;
    if (this.pc) return;
    const createPeer = this.deps.createPeer ?? (() => new RTCPeerConnection({ iceServers: this.deps.iceServers ?? defaultIceServers() }));
    this.pc = createPeer();
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate && this.callId) this.deps.onIceCandidate?.(ev.candidate.toJSON(), this.callId);
    };
    this.pc.ontrack = (ev) => {
      if (!this.remoteStream) this.remoteStream = new MediaStream();
      this.remoteStream.addTrack(ev.track);
      this.deps.onRemoteStream?.(this.remoteStream);
    };
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        const sender = this.pc.addTrack(track, this.localStream);
        if (track.kind === 'video') this.videoSender = sender;
      }
    }
  }

  private renegotiate(): void {
    if (this.state !== 'connected' || !this.pc || this.renegotiating || !this.callId) return;
    this.renegotiating = true;
    void (async () => {
      try {
        const offer = await this.pc!.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await this.pc!.setLocalDescription(offer);
        const desc: RTCSessionDescriptionInit = { type: (this.pc!.localDescription as any)?.type ?? 'offer', sdp: this.pc!.localDescription?.sdp ?? '' };
        this.deps.onRenegotiation?.(desc, this.callId!);
      } catch {
        // renegotiation is best-effort
      }
      this.renegotiating = false;
    })();
  }

  private async applyVideoTrack(track: MediaStreamTrack | null): Promise<void> {
    if (!this.pc) return;
    try {
      if (this.videoSender) {
        await this.videoSender.replaceTrack(track);
      } else if (track) {
        this.videoSender = this.pc.addTrack(track, this.localStream ?? new MediaStream());
      }
      this.renegotiate();
    } catch {
      // ignore track wiring errors
    }
  }

  private async withLocalMedia(options: CallOptions): Promise<MediaStream | null> {
    const getUserMedia = this.deps.getUserMedia ?? ((constraints: MediaStreamConstraints) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return Promise.reject(new Error('media unsupported'));
      }
      return navigator.mediaDevices.getUserMedia(constraints);
    });
    const getDisplayMedia = this.deps.getDisplayMedia ?? (() => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        return Promise.reject(new Error('screen sharing unsupported'));
      }
      return navigator.mediaDevices.getDisplayMedia({ video: true });
    });
    const streams: MediaStream[] = [];
    try {
      if (options.screen) {
        streams.push(await getDisplayMedia());
      } else if (options.audio || options.video) {
        streams.push(
          await getUserMedia({
            audio: options.audio,
            video: options.video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : undefined
          })
        );
      }
    } catch {
      return null;
    }
    const merged = new MediaStream();
    for (const s of streams) for (const t of s.getTracks()) {
      // Audio + (optionally deduped) video tracks get merged into one stream.
      if (t.kind === 'audio' || options.video || !merged.getVideoTracks().length) merged.addTrack(t);
    }
    return merged;
  }

  /** Starts local media acquisition for the given call type. Returns false when unavailable/denied. */
  async startLocal(options: CallOptions): Promise<boolean> {
    if (this.state !== 'idle' && this.state !== 'ended') return false;
    this.setState('acquiring');
    this.options = options;
    const stream = await this.withLocalMedia(options);
    if (!stream) {
      this.setState('failed');
      return false;
    }
    this.localStream = stream;
    this.setState('ringing');
    return true;
  }

  /** Creates an offer for a new call. Caller must have started local media first. */
  async createOffer(callId: string, peerId: string): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) this.setPeer(peerId);
    this.callId = callId;
    this.peerId = peerId;
    try {
      const offer = await this.pc!.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: this.options?.video || this.options?.screen || false });
      await this.pc!.setLocalDescription(offer);
      return offer;
    } catch {
      this.setState('failed');
      return null;
    }
  }

  /** Callee accepts an incoming offer and answers. */
  async acceptOffer(callId: string, peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) this.setPeer(peerId);
    this.callId = callId;
    this.peerId = peerId;
    try {
      await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));
      if (this.pc!.remoteDescription && this.pc!.remoteDescription.type !== 'offer') {
        // An existing negotiation is being updated; re-offer behaviour stays with the caller.
        return this.pc!.localDescription?.toJSON() ?? null;
      }
      for (const c of this.pendingCandidates.splice(0)) {
        try {
          await this.pc!.addIceCandidate(new RTCIceCandidate(c));
        } catch {
          // stale/unusable candidate - ignore
        }
      }
      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);
      this.setState('connected');
      return answer;
    } catch {
      this.setState('failed');
      return null;
    }
  }

  async adoptOffer(callId: string, peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    return this.acceptOffer(callId, peerId, offer);
  }

  async adoptAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      for (const c of this.pendingCandidates.splice(0)) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {
          // ignore
        }
      }
      this.setState('connected');
    } catch {
      this.setState('failed');
    }
  }

  async adoptIce(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // ignore stale candidates
    }
  }

  /** Toggles audio track(s), returns the new muted state. */
  toggleMute(): boolean {
    if (!this.localStream) return false;
    const next = this.localStream.getAudioTracks().some(t => !t.enabled);
    for (const t of this.localStream.getAudioTracks()) t.enabled = next;
    return next;
  }

  /** Toggles the camera track when a video/screen call is active. */
  toggleVideo(): boolean {
    if (!this.localStream) return false;
    const tracks = this.localStream.getVideoTracks();
    if (!tracks.length) return false;
    const next = !tracks[0].enabled;
    for (const t of tracks) t.enabled = next;
    return next;
  }

  /** Ensures a camera feed is live mid-call (used from a voice call). */
  async ensureCamera(): Promise<boolean> {
    if (!this.localStream) return false;
    const existing = this.localStream.getVideoTracks()[0];
    if (existing && existing !== this.screenTrack) return true;
    const getUserMedia = this.deps.getUserMedia ?? ((constraints: MediaStreamConstraints) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return Promise.reject(new Error('camera unavailable'));
      }
      return navigator.mediaDevices.getUserMedia(constraints);
    });
    let stream: MediaStream;
    try {
      stream = await getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
    } catch {
      return false;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) return false;
    this.cameraTrack = track;
    this.screenActive = false;
    this.screenTrack = null;
    this.localStream.addTrack(track);
    if (this.screenStream) {
      for (const t of this.screenStream.getTracks()) t.stop();
      this.screenStream = null;
    }
    await this.applyVideoTrack(track);
    return true;
  }

  /** Starts sharing the user's screen over the current call. */
  async enableScreenShare(): Promise<boolean> {
    if (!this.localStream || this.screenActive) return false;
    const getDisplayMedia = this.deps.getDisplayMedia ?? (() => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        return Promise.reject(new Error('screen sharing unsupported'));
      }
      return navigator.mediaDevices.getDisplayMedia({ video: true });
    });
    let stream: MediaStream;
    try {
      stream = await getDisplayMedia();
    } catch {
      return false;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) return false;
    this.screenStream = stream;
    this.screenTrack = track;
    this.screenActive = true;
    this.localStream.addTrack(track);
    await this.applyVideoTrack(track);
    return true;
  }

  /** Stops screen sharing and restores the camera feed if one was live. */
  async disableScreenShare(): Promise<boolean> {
    if (!this.screenActive || !this.screenTrack) return false;
    this.screenTrack.stop();
    this.localStream?.removeTrack(this.screenTrack);
    if (this.screenStream) {
      for (const t of this.screenStream.getTracks()) t.stop();
    }
    this.screenStream = null;
    this.screenTrack = null;
    this.screenActive = false;
    await this.applyVideoTrack(this.cameraTrack && this.cameraTrack.enabled ? this.cameraTrack : null);
    return true;
  }

  /** True while the user is sharing their screen. */
  isScreenSharing(): boolean {
    return this.screenActive;
  }

  /** Tracks whether the user is currently muted (any audio track disabled). */
  isMuted(): boolean {
    return !!this.localStream && this.localStream.getAudioTracks().every(t => !t.enabled);
  }

  /** Enables/disables audio playback of the remote stream (used for deafen). */
  setRemoteAudioEnabled(enabled: boolean): void {
    if (!this.remoteStream) return;
    for (const t of this.remoteStream.getAudioTracks()) t.enabled = enabled;
  }

  /** Tracks whether the video is currently disabled. */
  isVideoOff(): boolean {
    const tracks = this.localStream?.getVideoTracks();
    return !tracks || tracks.length === 0 || tracks.every(t => !t.enabled);
  }

  /** Whether any local video track exists (camera or screen). */
  hasVideoTracks(): boolean {
    return !!this.localStream && this.localStream.getVideoTracks().length > 0;
  }

  hangUp(reason: 'ended' | 'declined' | 'canceled' = 'ended'): void {
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }
    if (this.localStream) {
      for (const t of this.localStream.getTracks()) t.stop();
      this.localStream = null;
    }
    if (this.screenStream) {
      for (const t of this.screenStream.getTracks()) t.stop();
      this.screenStream = null;
    }
    this.remoteStream = null;
    this.pendingCandidates = [];
    this.callId = null;
    this.peerId = null;
    this.options = null;
    this.videoSender = null;
    this.screenTrack = null;
    this.screenActive = false;
    this.cameraTrack = null;
    this.setState(reason === 'canceled' ? 'idle' : reason === 'declined' ? 'ended' : 'ended');
  }
}

function defaultIceServers(): RTCIceServer[] {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ];
}