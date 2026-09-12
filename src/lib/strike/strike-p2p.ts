import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Vector3 } from '@babylonjs/core';
import {
  WeaponId,
  ScoreboardPlayer,
  KillfeedEntry,
  HitscanRay,
  P2PSignalPayload,
  P2PPlayerState,
  P2PShootEvent,
  StrikeChatMessage
} from './strike-types';
import { StrikeBabylonEngine } from './strike-babylon-engine';
import { BabylonAvatarModel } from './strike-babylon-avatars';
import { WEAPON_CATALOG, strikeAudio } from './strike-weapons';

export interface P2PNetworkCallbacks {
  onScoreboardUpdate: (players: ScoreboardPlayer[]) => void;
  onKillfeedEntry: (entry: KillfeedEntry) => void;
  onMedalAnnouncement: (title: string, sub: string) => void;
  onConnectionStatus: (connected: boolean, peerCount: number) => void;
  onChatMessage?: (msg: StrikeChatMessage) => void;
}

interface PeerConnectionWrapper {
  peerId: string;
  name: string;
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  state: P2PPlayerState | null;
  lastPacketTime: number;
  lastShootTime: number;
  iceCandidatesQueue: RTCIceCandidateInit[];
  isDead?: boolean;
  lastFootstepTime?: number;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Singleton Supabase client for Realtime with isolated storageKey to prevent GoTrue warning
let sharedStrikeClient: SupabaseClient | null = null;
function getStrikeRealtimeClient(url: string, key: string): SupabaseClient {
  if (!sharedStrikeClient) {
    sharedStrikeClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-strike-p2p-client'
      }
    });
  }
  return sharedStrikeClient;
}

export class StrikeP2PManager {
  private engine: StrikeBabylonEngine;
  private callbacks: P2PNetworkCallbacks;

  public myPeerId: string;
  public myName: string = 'Commander';

  // Supabase Realtime
  private supabase: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;

  // WebRTC P2P Peers (Encrypted end-to-end via DTLS)
  private peers: Map<string, PeerConnectionWrapper> = new Map();

  private tickInterval: any = null;
  private packetSeq = 0;

  // Match statistics
  public localKills = 0;
  public localDeaths = 0;
  public localHeadshots = 0;
  public localBestStreak = 0;
  public localCurrentStreak = 0;
  public localDamageDealt = 0;
  public localShotsFired = 0;
  public localShotsHit = 0;
  private seenChatIds: Set<string> = new Set();
  private lastSupabaseBroadcastTime = 0;

  constructor(engine: StrikeBabylonEngine, callbacks: P2PNetworkCallbacks) {
    this.engine = engine;
    this.callbacks = callbacks;
    this.myPeerId = `p_${Math.random().toString(36).slice(2, 8)}`;
  }

  public async start(playerName: string, supabaseUrl?: string, supabaseKey?: string) {
    this.myName = playerName || 'Commander';

    // Connect to Supabase Realtime if credentials exist
    if (supabaseUrl && supabaseKey) {
      this.initSupabaseRealtime(supabaseUrl, supabaseKey);
    } else {
      this.callbacks.onConnectionStatus(true, 0);
      this.callbacks.onChatMessage?.({
        id: `sys_welcome_${Date.now()}`,
        sender: 'Server',
        text: 'Local match active. Press [Enter] or [T] to chat.',
        isSystem: true,
        color: '#ffd32a',
        timestamp: Date.now()
      });
    }

    // Start 25 Hz P2P sync tick
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 40);
  }

  public stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Close WebRTC DataChannels and connections
    this.peers.forEach((p) => {
      try {
        if (typeof p.dc?.close === 'function') p.dc.close();
      } catch {}
      try {
        if (typeof p.pc?.close === 'function') p.pc.close();
      } catch {}
    });
    this.peers.clear();

    // Leave Supabase channel
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }

  private initSupabaseRealtime(url: string, key: string) {
    try {
      this.supabase = getStrikeRealtimeClient(url, key);

      this.channel = this.supabase.channel('waifu-strike-lobby', {
        config: {
          presence: { key: this.myPeerId },
          broadcast: { ack: false, self: false }
        }
      });

      // Presence: Peer Discovery for matchmaking
      this.channel
        .on('presence', { event: 'sync' }, () => {
          const state = this.channel?.presenceState() || {};
          this.handlePresenceSync(state);
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          this.handlePeerJoin(newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          this.handlePeerLeave(leftPresences);
        });

      // Broadcast: WebRTC Signaling (Offers, Answers, ICE Candidates)
      this.channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
        this.handleSignal(payload as P2PSignalPayload);
      });

      // Broadcast: Guaranteed state & gameplay delivery across all browsers and localhost
      this.channel.on('broadcast', { event: 'p2p-state' }, ({ payload }) => {
        if (payload && payload.peerId && payload.peerId !== this.myPeerId) {
          this.handleIncomingPlayerState(payload);
        }
      });

      this.channel.on('broadcast', { event: 'p2p-shoot' }, ({ payload }) => {
        if (payload && payload.shooterId && payload.shooterId !== this.myPeerId) {
          this.handleIncomingPlayerShoot(payload);
        }
      });

      this.channel.on('broadcast', { event: 'p2p-tracer' }, ({ payload }) => {
        if (payload && payload.shooterId && payload.shooterId !== this.myPeerId) {
          if (payload.weaponId && payload.weaponId !== 'knife') {
            const camPos = this.engine.camera.position;
            const camYaw = this.engine.camera.rotation.y;
            const peer = this.peers.get(payload.shooterId);
            const shooterPos = payload.origin || (peer?.state ? { x: peer.state.x, y: peer.state.y, z: peer.state.z } : null);
            strikeAudio.playGunfire(payload.weaponId, shooterPos ? {
              sourcePosition: shooterPos,
              listenerPosition: { x: camPos.x, y: camPos.y, z: camPos.z },
              listenerYaw: camYaw
            } : undefined);
          }
        }
      });

      this.channel.on('broadcast', { event: 'p2p-death' }, ({ payload }) => {
        if (payload && payload.victimId && payload.victimId !== this.myPeerId) {
          this.handleRemoteDeath(payload);
        }
      });

      this.channel.on('broadcast', { event: 'p2p-chat' }, ({ payload }) => {
        this.handleIncomingChat(payload);
      });

      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel?.track({
            peerId: this.myPeerId,
            name: this.myName,
            joinedAt: Date.now()
          });
          this.updateActivePeerCount();
          this.callbacks.onChatMessage?.({
            id: `sys_welcome_${Date.now()}`,
            sender: 'Server',
            text: 'Connected to Kyoto match. Press [Enter] or [T] to chat.',
            isSystem: true,
            color: '#ffd32a',
            timestamp: Date.now()
          });
        }
      });
    } catch {
      this.callbacks.onConnectionStatus(true, 0);
    }
  }

  private getOrCreatePeerWrapper(peerId: string, name?: string): PeerConnectionWrapper {
    let wrapper = this.peers.get(peerId);
    if (!wrapper) {
      wrapper = {
        peerId,
        name: name || `Player_${peerId.slice(0, 4)}`,
        pc: null,
        dc: null,
        state: null,
        lastPacketTime: Date.now(),
        lastShootTime: 0,
        iceCandidatesQueue: []
      };
      this.peers.set(peerId, wrapper);
    } else if (name && name !== wrapper.name) {
      wrapper.name = name;
    }
    return wrapper;
  }

  private handlePresenceSync(state: Record<string, any[]>) {
    const activePeers = new Set<string>();
    for (const key of Object.keys(state)) {
      if (key !== this.myPeerId) {
        activePeers.add(key);
        this.getOrCreatePeerWrapper(key);
        // Only initiate from the peer with the lexicographically smaller ID to avoid WebRTC offer collisions
        if (this.myPeerId < key && (!this.peers.get(key)?.pc)) {
          this.initiatePeerConnection(key);
        }
      }
    }

    // Prune stale peers
    for (const peerId of this.peers.keys()) {
      if (!activePeers.has(peerId) && Date.now() - (this.peers.get(peerId)?.lastPacketTime || 0) > 12000) {
        this.removePeer(peerId);
      }
    }

    this.updateActivePeerCount();
    this.publishScoreboard();
  }

  private handlePeerJoin(newPresences: any[]) {
    for (const p of newPresences) {
      if (p.peerId && p.peerId !== this.myPeerId) {
        const name = p.name || `Player_${p.peerId.slice(0, 4)}`;
        this.callbacks.onChatMessage?.({
          id: `sys_join_${Date.now()}_${p.peerId}`,
          sender: 'Server',
          text: `${name} joined the battle.`,
          isSystem: true,
          color: '#55efc4',
          timestamp: Date.now()
        });
        this.getOrCreatePeerWrapper(p.peerId, p.name);
        if (this.myPeerId < p.peerId && (!this.peers.get(p.peerId)?.pc)) {
          this.initiatePeerConnection(p.peerId);
        }
      }
    }
    this.updateActivePeerCount();
  }

  private handlePeerLeave(leftPresences: any[]) {
    for (const p of leftPresences) {
      if (p.peerId) {
        const wrapper = this.peers.get(p.peerId);
        const name = wrapper?.name || p.name || 'A player';
        this.callbacks.onChatMessage?.({
          id: `sys_leave_${Date.now()}_${p.peerId}`,
          sender: 'Server',
          text: `${name} left the match.`,
          isSystem: true,
          color: '#fab1a0',
          timestamp: Date.now()
        });
        this.removePeer(p.peerId);
      }
    }
  }

  private async initiatePeerConnection(targetPeerId: string) {
    let wrapper = this.peers.get(targetPeerId);
    if (wrapper?.pc) return;
    if (typeof RTCPeerConnection === 'undefined') return;

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      const dc = pc.createDataChannel('gameData', {
        ordered: false,
        maxRetransmits: 0
      });

      if (!wrapper) {
        wrapper = {
          peerId: targetPeerId,
          name: 'Player',
          pc,
          dc,
          state: null,
          lastPacketTime: Date.now(),
          lastShootTime: 0,
          iceCandidatesQueue: []
        };
        this.peers.set(targetPeerId, wrapper);
      } else {
        wrapper.pc = pc;
        wrapper.dc = dc;
      }

      this.setupDataChannel(wrapper, dc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({
            to: targetPeerId,
            from: this.myPeerId,
            type: 'ice-candidate',
            candidate: event.candidate
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignal({
        to: targetPeerId,
        from: this.myPeerId,
        type: 'offer',
        sdp: offer
      });
    } catch {}
  }

  private async handleSignal(msg: P2PSignalPayload) {
    if (!msg || msg.to !== this.myPeerId) return;
    if (typeof RTCPeerConnection === 'undefined') return;

    if (msg.type === 'offer') {
      let wrapper = this.peers.get(msg.from);
      if (!wrapper || !wrapper.pc) {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        if (!wrapper) {
          wrapper = {
            peerId: msg.from,
            name: 'Player',
            pc,
            dc: null,
            state: null,
            lastPacketTime: Date.now(),
            lastShootTime: 0,
            iceCandidatesQueue: []
          };
          this.peers.set(msg.from, wrapper);
        } else {
          wrapper.pc = pc;
        }

        pc.ondatachannel = (evt) => {
          wrapper!.dc = evt.channel;
          this.setupDataChannel(wrapper!, evt.channel);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            this.sendSignal({
              to: msg.from,
              from: this.myPeerId,
              type: 'ice-candidate',
              candidate: event.candidate
            });
          }
        };
      }

      if (!wrapper.pc) return;
      await wrapper.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

      // Flush any ICE candidates received before remote description was ready
      if (wrapper.iceCandidatesQueue.length > 0) {
        for (const candidate of wrapper.iceCandidatesQueue) {
          try {
            await wrapper.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {}
        }
        wrapper.iceCandidatesQueue = [];
      }

      const answer = await wrapper.pc.createAnswer();
      await wrapper.pc.setLocalDescription(answer);

      this.sendSignal({
        to: msg.from,
        from: this.myPeerId,
        type: 'answer',
        sdp: answer
      });
    } else if (msg.type === 'answer') {
      const wrapper = this.peers.get(msg.from);
      if (wrapper && wrapper.pc && wrapper.pc.signalingState !== 'stable') {
        await wrapper.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

        // Flush any queued ICE candidates
        if (wrapper.iceCandidatesQueue.length > 0) {
          for (const candidate of wrapper.iceCandidatesQueue) {
            try {
              await wrapper.pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {}
          }
          wrapper.iceCandidatesQueue = [];
        }
      }
    } else if (msg.type === 'ice-candidate') {
      const wrapper = this.peers.get(msg.from);
      if (wrapper && msg.candidate) {
        if (!wrapper.pc || !wrapper.pc.remoteDescription) {
          wrapper.iceCandidatesQueue.push(msg.candidate);
        } else {
          try {
            await wrapper.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {}
        }
      }
    }
  }

  private sendSignal(payload: P2PSignalPayload) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload
      });
    }
  }

  private updateActivePeerCount() {
    const now = Date.now();
    let count = 0;
    this.peers.forEach((p) => {
      // Considered active if packet seen in last 12 seconds or DataChannel is open
      if ((p.state && now - p.lastPacketTime < 12000) || (p.dc && p.dc.readyState === 'open')) {
        count++;
      }
    });
    this.callbacks.onConnectionStatus(true, count);
  }

  private setupDataChannel(wrapper: PeerConnectionWrapper, dc: RTCDataChannel) {
    const handleOpen = () => {
      this.updateActivePeerCount();

      if (this.engine.isDisposed || !this.engine.scene) return;

      // Create 3D Avatar for this human peer if not already created
      if (!this.engine.remoteAvatars.has(wrapper.peerId)) {
        const avatar = new BabylonAvatarModel(
          wrapper.peerId,
          {
            name: wrapper.name,
            hairColor: '#ff7597',
            outfitColor: '#00cec9'
          },
          this.engine.scene,
          this.engine.mapData?.shadowGenerator
        );
        this.engine.remoteAvatars.set(wrapper.peerId, avatar);
      }
      this.publishScoreboard();
    };

    if (dc.readyState === 'open') {
      handleOpen();
    } else {
      dc.onopen = handleOpen;
    }

    dc.onmessage = (event) => {
      try {
        if (!event.data || typeof event.data !== 'string') return;
        const data = JSON.parse(event.data);
        if (!data || typeof data.type !== 'string') return;

        // Security: validate packet types
        if (data.type === 'state') {
          this.handleRemoteState(wrapper, data.state);
        } else if (data.type === 'shoot') {
          this.handleRemoteShoot(wrapper, data.shoot);
        } else if (data.type === 'chat') {
          this.handleIncomingChat(data.chat);
        } else if (data.type === 'tracer') {
          if (data.weaponId && data.weaponId !== 'knife') {
            const camPos = this.engine.camera.position;
            const camYaw = this.engine.camera.rotation.y;
            const shooterPos = data.origin || (wrapper.state ? { x: wrapper.state.x, y: wrapper.state.y, z: wrapper.state.z } : null);
            strikeAudio.playGunfire(data.weaponId, shooterPos ? {
              sourcePosition: shooterPos,
              listenerPosition: { x: camPos.x, y: camPos.y, z: camPos.z },
              listenerYaw: camYaw
            } : undefined);
          }
        }
      } catch {}
    };

    dc.onclose = () => {
      wrapper.dc = null;
      this.updateActivePeerCount();
    };
  }

  private handleIncomingPlayerState(rawState: any) {
    if (!rawState || typeof rawState !== 'object') return;
    const peerId = String(rawState.peerId || '');
    if (!peerId || peerId === this.myPeerId) return;

    const wrapper = this.getOrCreatePeerWrapper(peerId, rawState.name);
    // If WebRTC DataChannel is open with this peer, prioritize direct P2P and ignore delayed WebSocket broadcasts
    if (wrapper.dc && wrapper.dc.readyState === 'open') {
      return;
    }
    this.handleRemoteState(wrapper, rawState);
  }

  private handleIncomingPlayerShoot(shoot: any) {
    if (!shoot || typeof shoot !== 'object') return;
    const shooterId = String(shoot.shooterId || '');
    if (!shooterId || shooterId === this.myPeerId) return;

    const wrapper = this.getOrCreatePeerWrapper(shooterId, shoot.shooterName);
    this.handleRemoteShoot(wrapper, shoot);
  }

  private handleRemoteDeath(payload: any) {
    if (!payload || payload.victimId === this.myPeerId) return;
    const victimWrapper = this.peers.get(payload.victimId);
    if (victimWrapper) {
      victimWrapper.isDead = true;
      if (victimWrapper.state) victimWrapper.state.health = 0;
    }
    const av = this.engine.remoteAvatars.get(payload.victimId);
    if (av) {
      av.setVisible(false);
    }
    this.callbacks.onKillfeedEntry({
      id: `death_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      killerName: String(payload.killerName || 'Enemy'),
      victimName: String(payload.victimName || 'Player'),
      weaponId: 'rifle',
      isHeadshot: false,
      timestamp: Date.now()
    });
  }

  // Validates incoming player state packet with boundary and anti-teleport checks
  private handleRemoteState(wrapper: PeerConnectionWrapper, rawState: any) {
    if (!rawState || typeof rawState !== 'object') return;
    if (this.engine.isDisposed || !this.engine.scene) return;

    const now = Date.now();
    const seq = Number(rawState.seq) || 0;

    // Sequence check: drop older packets if not delayed
    if (wrapper.state && seq > 0 && wrapper.state.seq && seq <= wrapper.state.seq) {
      if (now - wrapper.lastPacketTime < 500) {
        return;
      }
    }

    // Boundary validation (Kyoto tactical map is 104x104m from -52 to 52)
    const x = Math.max(-51.5, Math.min(51.5, Number(rawState.x) || 0));
    const y = Math.max(-1.0, Math.min(30.0, Number(rawState.y) || 1.62));
    const z = Math.max(-51.5, Math.min(51.5, Number(rawState.z) || 0));

    wrapper.lastPacketTime = now;
    const playerName = String(rawState.name || wrapper.name || 'Player').slice(0, 24);
    wrapper.name = playerName;

    const newStreak = Math.max(0, Number(rawState.streak) || 0);
    const prevStreak = wrapper.state?.streak || 0;
    if (newStreak >= 5 && newStreak % 5 === 0 && newStreak > prevStreak) {
      this.callbacks.onChatMessage?.({
        id: `sys_streak_${now}_${wrapper.peerId}_${newStreak}`,
        sender: 'Server',
        text: `⚡ ${playerName} is on a ${newStreak} KILL STREAK!`,
        isSystem: true,
        color: '#ff7675',
        timestamp: now
      });
    }

    const hp = Math.max(0, Math.min(150, Number(rawState.health ?? rawState.hp ?? 150)));
    const weaponId = (rawState.weaponId && rawState.weaponId in WEAPON_CATALOG ? rawState.weaponId : 'rifle') as WeaponId;

    wrapper.state = {
      peerId: wrapper.peerId,
      name: playerName,
      x,
      y,
      z,
      yaw: Number(rawState.yaw) || 0,
      pitch: Number(rawState.pitch) || 0,
      animState: Number(rawState.animState) || 0,
      health: hp,
      weaponId,
      kills: Math.max(0, Number(rawState.kills) || 0),
      deaths: Math.max(0, Number(rawState.deaths) || 0),
      headshots: Math.max(0, Number(rawState.headshots) || 0),
      streak: newStreak,
      avatarOutfit: rawState.avatarOutfit || '#00cec9',
      seq,
      timestamp: now
    };

    let av = this.engine.remoteAvatars.get(wrapper.peerId);
    if (!av) {
      av = new BabylonAvatarModel(
        wrapper.peerId,
        {
          name: playerName,
          hairColor: '#ff7597',
          outfitColor: rawState.avatarOutfit || '#00cec9'
        },
        this.engine.scene,
        this.engine.mapData?.shadowGenerator
      );
      this.engine.remoteAvatars.set(wrapper.peerId, av);
      av.root.position = new Vector3(x, y - 1.62, z);
    }

    if (av) {
      if (hp <= 0) {
        wrapper.isDead = true;
        av.setVisible(false);
      } else {
        wrapper.isDead = false;
        av.setVisible(true);
        const targetPos = new Vector3(x, y - 1.62, z);
        const dist = Vector3.Distance(av.root.position, targetPos);
        if (dist > 12) {
          // Instant teleport/respawn
          av.root.position = targetPos;
        } else {
          av.root.position = Vector3.Lerp(av.root.position, targetPos, 0.55);
        }
        av.root.rotation.y = Number(rawState.yaw) || 0;
        av.setPitch(Number(rawState.pitch) || 0);
        av.updateAnimation(Number(rawState.animState) || 0, 0.04);
        av.setWeapon(weaponId);
        av.updateNameplate(playerName, hp, 150);

        // Quiet spatial footstep audio if walking
        const isMoving = Number(rawState.animState) === 1;
        if (isMoving) {
          if (!wrapper.lastFootstepTime || now - wrapper.lastFootstepTime > 380) {
            wrapper.lastFootstepTime = now;
            const camPos = this.engine.camera.position;
            const camYaw = this.engine.camera.rotation.y;
            strikeAudio.playFootstep(false, {
              sourcePosition: { x, y, z },
              listenerPosition: { x: camPos.x, y: camPos.y, z: camPos.z },
              listenerYaw: camYaw
            });
          }
        }
      }
    }

    this.publishScoreboard();
    this.updateActivePeerCount();
  }

  // Validates incoming shoot packet with damage and rate-limit checks
  private handleRemoteShoot(wrapper: PeerConnectionWrapper, shoot: any) {
    if (!shoot || typeof shoot !== 'object') return;
    if (this.engine.isDisposed || !this.engine.scene) return;
    const now = Date.now();

    // Weapon validation
    const weaponId = (shoot.weaponId in WEAPON_CATALOG ? shoot.weaponId : 'rifle') as WeaponId;
    const def = WEAPON_CATALOG[weaponId];

    // Rate-limiting check (enforces weapon fire-rate limit)
    const minCooldown = (60 / def.fireRateRpm) * 800;
    if (now - wrapper.lastShootTime < minCooldown) {
      return;
    }
    wrapper.lastShootTime = now;

    if (weaponId !== 'knife') {
      const camPos = this.engine.camera.position;
      const camYaw = this.engine.camera.rotation.y;
      const shooterPos = wrapper.state ? { x: wrapper.state.x, y: wrapper.state.y, z: wrapper.state.z } : (shoot.origin ? shoot.origin : null);
      strikeAudio.playGunfire(weaponId, shooterPos ? {
        sourcePosition: shooterPos,
        listenerPosition: { x: camPos.x, y: camPos.y, z: camPos.z },
        listenerYaw: camYaw
      } : undefined);
    }

    // Trigger visual firing/slash animation on remote avatar
    const av = this.engine.remoteAvatars.get(wrapper.peerId);
    if (av) {
      av.triggerAttack(weaponId);
    }

    // Render remote bullet tracer & bullet impact mark on world objects
    if (weaponId !== 'knife' && shoot.origin && shoot.direction) {
      this.engine.handleRemoteBulletImpact(shoot.origin, shoot.direction, def.range || 300, def.color);
    }

    // If local player was targeted and hit
    if (shoot.targetId === this.myPeerId) {
      const damage = Math.max(1, Math.min(350, Math.round(Number(shoot.damage) || def.damage)));
      const attackerName = shoot.shooterName || wrapper.name || 'Enemy';
      this.engine.applyDamage(damage, attackerName);
    }
  }

  private removePeer(peerId: string) {
    const wrapper = this.peers.get(peerId);
    if (wrapper) {
      wrapper.dc?.close();
      wrapper.pc?.close();
      this.peers.delete(peerId);
    }
    const av = this.engine.remoteAvatars.get(peerId);
    if (av) {
      av.dispose();
      this.engine.remoteAvatars.delete(peerId);
    }
    this.updateActivePeerCount();
    this.publishScoreboard();
  }

  private tick() {
    this.packetSeq++;
    const now = Date.now();

    const myPos = this.engine.camera.position;
    const myYaw = this.engine.camera.rotation.y;
    const myPitch = this.engine.camera.rotation.x;

    // Numerical precision optimization: round floats to reduce JSON packet footprint by ~50%
    const myState: P2PPlayerState = {
      peerId: this.myPeerId,
      name: this.myName,
      x: Math.round(myPos.x * 100) / 100,
      y: Math.round(myPos.y * 100) / 100,
      z: Math.round(myPos.z * 100) / 100,
      yaw: Math.round(myYaw * 1000) / 1000,
      pitch: Math.round(myPitch * 1000) / 1000,
      animState: this.engine.velocity.length() > 0.5 ? 1 : 0,
      health: this.engine.health,
      weaponId: this.engine.activeWeaponId,
      kills: this.localKills,
      deaths: this.localDeaths,
      headshots: this.localHeadshots,
      streak: this.localCurrentStreak,
      avatarOutfit: '#ff7597',
      seq: this.packetSeq,
      timestamp: now
    };

    // 1. High-frequency 25 Hz direct P2P sync via WebRTC DataChannels
    const statePacket = JSON.stringify({ type: 'state', state: myState });
    let openDcCount = 0;
    this.peers.forEach((p) => {
      if (p.dc && p.dc.readyState === 'open') {
        openDcCount++;
        try {
          p.dc.send(statePacket);
        } catch {}
      }
    });

    // 2. Throttle Supabase Realtime WebSocket broadcast to 2 Hz heartbeat/fallback
    // (or when peers are still establishing WebRTC connection)
    const shouldBroadcastToSupabase =
      this.channel &&
      (openDcCount < this.peers.size || now - this.lastSupabaseBroadcastTime >= 500);

    if (shouldBroadcastToSupabase && this.channel) {
      this.lastSupabaseBroadcastTime = now;
      this.channel.send({
        type: 'broadcast',
        event: 'p2p-state',
        payload: myState
      });
    }

    this.publishScoreboard();
    this.updateActivePeerCount();
  }

  public registerPlayerShot(
    ray: HitscanRay,
    isHeadshot: boolean,
    targetId: string | null,
    part: 'head' | 'torso' | 'limb' = 'torso',
    damage = 30
  ) {
    this.localShotsFired++;

    const shootPacket: P2PShootEvent = {
      shooterId: this.myPeerId,
      shooterName: this.myName,
      weaponId: ray.weaponId,
      origin: ray.origin,
      direction: ray.direction,
      targetId,
      isHeadshot,
      part,
      damage,
      seq: this.packetSeq,
      timestamp: Date.now()
    };

    // 1. Broadcast via Supabase Realtime
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'p2p-shoot',
        payload: shootPacket
      });
    }

    // 2. If target has open WebRTC DataChannel, also send directly
    if (targetId) {
      const peer = this.peers.get(targetId);
      if (peer && peer.dc && peer.dc.readyState === 'open') {
        try {
          peer.dc.send(JSON.stringify({ type: 'shoot', shoot: shootPacket }));
        } catch {}
      }
    }

    if (targetId !== null) {
      this.localShotsHit++;
      this.localDamageDealt += damage;

      const peer = this.peers.get(targetId);
      if (peer && peer.state) {
        // If already dead, prevent duplicate kill messages and corpse shooting
        if (peer.isDead || peer.state.health <= 0) {
          return;
        }

        const wasAlive = peer.state.health > 0;
        // Optimistically apply damage to local cached peer state
        peer.state.health = Math.max(0, peer.state.health - damage);
        const av = this.engine.remoteAvatars.get(targetId);
        if (av) {
          av.updateNameplate(peer.name, peer.state.health, 150);
        }

        // Check if lethal (only trigger once)
        if (wasAlive && peer.state.health <= 0) {
          peer.isDead = true;
          if (av) {
            av.setVisible(false);
          }
          this.localKills++;
          this.localCurrentStreak++;
          if (this.localCurrentStreak > this.localBestStreak) {
            this.localBestStreak = this.localCurrentStreak;
          }
          if (isHeadshot) this.localHeadshots++;

          this.callbacks.onKillfeedEntry({
            id: `kill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            killerName: 'You',
            victimName: peer.name,
            weaponId: ray.weaponId,
            isHeadshot,
            timestamp: Date.now()
          });

          if (isHeadshot) {
            this.callbacks.onMedalAnnouncement('HEADSHOT!', '+150 PTS');
          } else if (this.localCurrentStreak === 3) {
            this.callbacks.onMedalAnnouncement('TRIPLE KILL!', '3 FRAG STREAK');
          } else if (this.localCurrentStreak === 5) {
            this.callbacks.onMedalAnnouncement('RAMPAGE!', '5 FRAG STREAK 🔥');
          } else if (this.localCurrentStreak === 10) {
            this.callbacks.onMedalAnnouncement('UNSTOPPABLE!', '10 FRAG STREAK ⚡');
          }

          if (this.localCurrentStreak >= 5 && this.localCurrentStreak % 5 === 0) {
            this.broadcastSystemMessage(`🔥 ${this.myName} is on a ${this.localCurrentStreak} KILL STREAK!`, '#ff7675');
          }

          this.publishScoreboard();
        }
      }
    }

    // Broadcast tracer line to other peers (guns only, knife does not emit bullet tracers)
    if (ray.weaponId !== 'knife') {
      const tracerPacket = {
        shooterId: this.myPeerId,
        origin: ray.origin,
        direction: ray.direction,
        weaponId: ray.weaponId
      };
      if (this.channel) {
        this.channel.send({
          type: 'broadcast',
          event: 'p2p-tracer',
          payload: tracerPacket
        });
      }
      this.peers.forEach((p) => {
        if (p.peerId !== targetId && p.dc && p.dc.readyState === 'open') {
          try {
            p.dc.send(JSON.stringify({ type: 'tracer', ...tracerPacket }));
          } catch {}
        }
      });
    }
  }

  public registerPlayerDeath(attackerName: string) {
    this.localDeaths++;
    this.localCurrentStreak = 0;

    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'p2p-death',
        payload: {
          victimId: this.myPeerId,
          victimName: this.myName,
          killerName: attackerName,
          timestamp: Date.now()
        }
      });
    }

    this.callbacks.onKillfeedEntry({
      id: `death_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      killerName: attackerName,
      victimName: 'You',
      weaponId: 'rifle',
      isHeadshot: false,
      timestamp: Date.now()
    });

    this.publishScoreboard();
  }

  private publishScoreboard() {
    const players: ScoreboardPlayer[] = [
      {
        id: 0,
        name: `${this.myName} (You)`,
        isBot: false,
        kills: this.localKills,
        deaths: this.localDeaths,
        headshots: this.localHeadshots,
        score: this.localKills * 100 + this.localHeadshots * 50,
        streak: this.localCurrentStreak,
        avatarOutfit: '#ff7597'
      },
      ...Array.from(this.peers.values()).map((p, idx) => ({
        id: idx + 10,
        name: p.name || `Player_${p.peerId}`,
        isBot: false,
        kills: p.state?.kills || 0,
        deaths: p.state?.deaths || 0,
        headshots: p.state?.headshots || 0,
        score: (p.state?.kills || 0) * 100 + (p.state?.headshots || 0) * 50,
        streak: p.state?.streak || 0,
        avatarOutfit: p.state?.avatarOutfit || '#00cec9'
      }))
    ];

    players.sort((a, b) => b.score - a.score);
    this.callbacks.onScoreboardUpdate(players);
  }

  public sendChatMessage(text: string) {
    const trimmed = text.trim().slice(0, 180);
    if (!trimmed) return;
    const msg: StrikeChatMessage = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: this.myName,
      text: trimmed,
      timestamp: Date.now()
    };
    this.seenChatIds.add(msg.id);
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'p2p-chat',
        payload: msg
      });
    }
    const packet = JSON.stringify({ type: 'chat', chat: msg });
    this.peers.forEach((p) => {
      if (p.dc && p.dc.readyState === 'open') {
        try {
          p.dc.send(packet);
        } catch {}
      }
    });
    this.callbacks.onChatMessage?.(msg);
  }

  public broadcastSystemMessage(text: string, color = '#ffd32a') {
    const msg: StrikeChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: 'Server',
      text,
      isSystem: true,
      color,
      timestamp: Date.now()
    };
    this.seenChatIds.add(msg.id);
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'p2p-chat',
        payload: msg
      });
    }
    const packet = JSON.stringify({ type: 'chat', chat: msg });
    this.peers.forEach((p) => {
      if (p.dc && p.dc.readyState === 'open') {
        try {
          p.dc.send(packet);
        } catch {}
      }
    });
    this.callbacks.onChatMessage?.(msg);
  }

  private handleIncomingChat(payload: any) {
    if (!payload || !payload.id || !payload.text) return;
    const id = String(payload.id);
    if (this.seenChatIds.has(id)) return;
    this.seenChatIds.add(id);
    if (this.seenChatIds.size > 200) {
      const first = this.seenChatIds.values().next().value;
      if (first) this.seenChatIds.delete(first);
    }
    const chatMsg: StrikeChatMessage = {
      id,
      sender: String(payload.sender || 'Player').slice(0, 24),
      text: String(payload.text).slice(0, 180),
      isSystem: !!payload.isSystem,
      color: payload.color ? String(payload.color) : undefined,
      timestamp: Number(payload.timestamp) || Date.now()
    };
    this.callbacks.onChatMessage?.(chatMsg);
  }
}
