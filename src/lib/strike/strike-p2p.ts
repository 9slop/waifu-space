import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Vector3 } from '@babylonjs/core';
import {
  WeaponId,
  ScoreboardPlayer,
  KillfeedEntry,
  HitscanRay,
  P2PSignalPayload,
  P2PPlayerState,
  P2PShootEvent
} from './strike-types';
import { StrikeBabylonEngine } from './strike-babylon-engine';
import { BabylonAvatarModel } from './strike-babylon-avatars';
import { WEAPON_CATALOG, strikeAudio } from './strike-weapons';

export interface P2PNetworkCallbacks {
  onScoreboardUpdate: (players: ScoreboardPlayer[]) => void;
  onKillfeedEntry: (entry: KillfeedEntry) => void;
  onMedalAnnouncement: (title: string, sub: string) => void;
  onConnectionStatus: (connected: boolean, peerCount: number) => void;
}

interface PeerConnectionWrapper {
  peerId: string;
  name: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  state: P2PPlayerState | null;
  lastPacketTime: number;
  lastShootTime: number;
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
      p.dc?.close();
      p.pc.close();
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

      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel?.track({
            peerId: this.myPeerId,
            name: this.myName,
            joinedAt: Date.now()
          });
          this.callbacks.onConnectionStatus(true, this.peers.size);
        }
      });
    } catch {
      this.callbacks.onConnectionStatus(true, 0);
    }
  }

  private handlePresenceSync(state: Record<string, any[]>) {
    const activePeers = new Set<string>();
    for (const key of Object.keys(state)) {
      if (key !== this.myPeerId) {
        activePeers.add(key);
        if (!this.peers.has(key)) {
          this.initiatePeerConnection(key);
        }
      }
    }

    // Prune stale peers
    for (const peerId of this.peers.keys()) {
      if (!activePeers.has(peerId)) {
        this.removePeer(peerId);
      }
    }

    this.callbacks.onConnectionStatus(true, this.peers.size);
    this.publishScoreboard();
  }

  private handlePeerJoin(newPresences: any[]) {
    for (const p of newPresences) {
      if (p.peerId && p.peerId !== this.myPeerId) {
        if (this.myPeerId < p.peerId && !this.peers.has(p.peerId)) {
          this.initiatePeerConnection(p.peerId);
        }
      }
    }
  }

  private handlePeerLeave(leftPresences: any[]) {
    for (const p of leftPresences) {
      if (p.peerId) {
        this.removePeer(p.peerId);
      }
    }
  }

  private async initiatePeerConnection(targetPeerId: string) {
    if (this.peers.has(targetPeerId)) return;
    if (typeof RTCPeerConnection === 'undefined') return;

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      const dc = pc.createDataChannel('gameData', {
        ordered: false,
        maxRetransmits: 0
      });

      const wrapper: PeerConnectionWrapper = {
        peerId: targetPeerId,
        name: 'Player',
        pc,
        dc,
        state: null,
        lastPacketTime: Date.now(),
        lastShootTime: 0
      };
      this.peers.set(targetPeerId, wrapper);

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
      if (!wrapper) {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        wrapper = {
          peerId: msg.from,
          name: 'Player',
          pc,
          dc: null,
          state: null,
          lastPacketTime: Date.now(),
          lastShootTime: 0
        };
        this.peers.set(msg.from, wrapper);

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

      await wrapper.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
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
      if (wrapper && wrapper.pc.signalingState !== 'stable') {
        await wrapper.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      }
    } else if (msg.type === 'ice-candidate') {
      const wrapper = this.peers.get(msg.from);
      if (wrapper && msg.candidate) {
        try {
          await wrapper.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch {}
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

  private setupDataChannel(wrapper: PeerConnectionWrapper, dc: RTCDataChannel) {
    dc.onopen = () => {
      this.callbacks.onConnectionStatus(true, this.peers.size);

      // Create 3D Avatar for this human peer
      const avatar = new BabylonAvatarModel(
        wrapper.peerId,
        {
          name: wrapper.name,
          hairColor: '#ff7597',
          outfitColor: '#00cec9'
        },
        this.engine.scene
      );
      this.engine.remoteAvatars.set(wrapper.peerId, avatar);
      this.publishScoreboard();
    };

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
        } else if (data.type === 'tracer') {
          if (data.origin && data.direction && data.weaponId) {
            strikeAudio.playGunfire(data.weaponId);
          }
        }
      } catch {}
    };

    dc.onclose = () => {
      this.removePeer(wrapper.peerId);
    };
  }

  // Validates incoming player state packet with boundary and anti-teleport checks
  private handleRemoteState(wrapper: PeerConnectionWrapper, rawState: any) {
    if (!rawState || typeof rawState !== 'object') return;

    // Boundary validation (Map is 84x84m from -42 to 42)
    const x = Math.max(-41.5, Math.min(41.5, Number(rawState.x) || 0));
    const y = Math.max(-1.0, Math.min(25.0, Number(rawState.y) || 1.62));
    const z = Math.max(-41.5, Math.min(41.5, Number(rawState.z) || 0));

    // Velocity / teleport sanity check
    const now = Date.now();
    const dt = Math.max(0.01, (now - wrapper.lastPacketTime) / 1000);
    wrapper.lastPacketTime = now;

    if (wrapper.state) {
      const dist = Math.hypot(x - wrapper.state.x, z - wrapper.state.z);
      const speed = dist / dt;
      // If moving faster than plausible max CS speed (18 m/s), clamp movement
      if (speed > 18) {
        return;
      }
    }

    wrapper.state = {
      peerId: wrapper.peerId,
      name: String(rawState.name || wrapper.name).slice(0, 24),
      x,
      y,
      z,
      yaw: Number(rawState.yaw) || 0,
      pitch: Number(rawState.pitch) || 0,
      animState: Number(rawState.animState) || 0,
      health: Math.max(0, Math.min(200, Number(rawState.health) || 150)),
      weaponId: (rawState.weaponId in WEAPON_CATALOG ? rawState.weaponId : 'rifle') as WeaponId,
      kills: Math.max(0, Number(rawState.kills) || 0),
      deaths: Math.max(0, Number(rawState.deaths) || 0),
      headshots: Math.max(0, Number(rawState.headshots) || 0),
      streak: Math.max(0, Number(rawState.streak) || 0),
      avatarOutfit: rawState.avatarOutfit || '#00cec9',
      seq: Number(rawState.seq) || 0,
      timestamp: now
    };

    wrapper.name = wrapper.state.name;

    const av = this.engine.remoteAvatars.get(wrapper.peerId);
    if (av) {
      av.root.position = Vector3.Lerp(av.root.position, new Vector3(x, y - 0.77, z), 0.45);
      av.root.rotation.y = wrapper.state.yaw;
      av.updateAnimation(wrapper.state.animState, performance.now() * 0.001);
      av.setWeapon(wrapper.state.weaponId);
    }

    this.publishScoreboard();
  }

  // Validates incoming shoot packet with damage and rate-limit checks
  private handleRemoteShoot(wrapper: PeerConnectionWrapper, shoot: any) {
    if (!shoot || typeof shoot !== 'object') return;
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

    strikeAudio.playGunfire(weaponId);

    // Trigger visual firing/slash animation on remote avatar
    const av = this.engine.remoteAvatars.get(wrapper.peerId);
    if (av) {
      av.triggerAttack(weaponId);
    }

    // If local player was targeted and hit
    if (shoot.targetId === this.myPeerId) {
      const damage = Math.max(1, Math.min(350, Math.round(Number(shoot.damage) || def.damage)));
      const isHeadshot = !!shoot.isHeadshot;

      this.engine.applyDamage(damage, wrapper.name);

      if (this.engine.health <= 0) {
        this.registerPlayerDeath(wrapper.name);
      }
    }
  }

  private removePeer(peerId: string) {
    const wrapper = this.peers.get(peerId);
    if (wrapper) {
      wrapper.dc?.close();
      wrapper.pc.close();
      this.peers.delete(peerId);
    }
    const av = this.engine.remoteAvatars.get(peerId);
    if (av) {
      av.dispose();
      this.engine.remoteAvatars.delete(peerId);
    }
    this.callbacks.onConnectionStatus(true, this.peers.size);
    this.publishScoreboard();
  }

  private tick() {
    this.packetSeq++;
    const now = Date.now();

    // Broadcast local player state over open WebRTC DataChannels
    const myPos = this.engine.camera.position;
    const myYaw = this.engine.camera.rotation.y;
    const myPitch = this.engine.camera.rotation.x;

    const myState: P2PPlayerState = {
      peerId: this.myPeerId,
      name: this.myName,
      x: myPos.x,
      y: myPos.y,
      z: myPos.z,
      yaw: myYaw,
      pitch: myPitch,
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

    const statePacket = JSON.stringify({ type: 'state', state: myState });
    this.peers.forEach((p) => {
      if (p.dc && p.dc.readyState === 'open') {
        try {
          p.dc.send(statePacket);
        } catch {}
      }
    });

    this.publishScoreboard();
  }

  public registerPlayerShot(
    ray: HitscanRay,
    isHeadshot: boolean,
    targetId: string | null,
    part: 'head' | 'torso' | 'limb' = 'torso',
    damage = 30
  ) {
    this.localShotsFired++;

    if (targetId !== null) {
      this.localShotsHit++;
      this.localDamageDealt += damage;

      // Check if target is a connected P2P peer
      const peer = this.peers.get(targetId);
      if (peer && peer.dc && peer.dc.readyState === 'open') {
        const shootPacket: P2PShootEvent = {
          shooterId: this.myPeerId,
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

        try {
          peer.dc.send(JSON.stringify({ type: 'shoot', shoot: shootPacket }));
        } catch {}

        // Check if lethal
        if (peer.state && peer.state.health <= damage) {
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

          this.publishScoreboard();
        }
      }
    }

    // Broadcast tracer line to other peers
    const tracerPacket = JSON.stringify({
      type: 'tracer',
      origin: ray.origin,
      direction: ray.direction,
      weaponId: ray.weaponId
    });
    this.peers.forEach((p) => {
      if (p.peerId !== targetId && p.dc && p.dc.readyState === 'open') {
        try {
          p.dc.send(tracerPacket);
        } catch {}
      }
    });
  }

  public registerPlayerDeath(attackerName: string) {
    this.localDeaths++;
    this.localCurrentStreak = 0;

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
}
