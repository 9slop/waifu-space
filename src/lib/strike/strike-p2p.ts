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
  onConnectionStatus: (connected: boolean, ping: number, peerCount: number) => void;
}

interface PeerConnectionWrapper {
  peerId: string;
  name: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  state: P2PPlayerState | null;
}

interface BotEntity {
  id: string;
  name: string;
  avatarOutfit: string;
  hairColor: string;
  weaponId: WeaponId;
  position: Vector3;
  yaw: number;
  pitch: number;
  health: number;
  isDead: boolean;
  respawnTime: number;
  currentWaypointIdx: number;
  lastShotTime: number;
  kills: number;
  deaths: number;
  headshots: number;
  streak: number;
  ping: number;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export class StrikeP2PManager {
  private engine: StrikeBabylonEngine;
  private callbacks: P2PNetworkCallbacks;

  public myPeerId: string;
  public myName: string = 'Commander';

  // Supabase Realtime
  private supabase: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;

  // WebRTC P2P Peers
  private peers: Map<string, PeerConnectionWrapper> = new Map();

  // Tactical AI Bots
  private bots: BotEntity[] = [];
  private tickInterval: any = null;
  private tickCount = 0;

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

    // 1. Initialize Bots for immediate local play & offline fallback
    this.initBots();

    // 2. Connect to Supabase Realtime if credentials exist
    if (supabaseUrl && supabaseKey) {
      this.initSupabaseRealtime(supabaseUrl, supabaseKey);
    } else {
      this.callbacks.onConnectionStatus(true, 18, 0);
    }

    // 3. Start 25 Hz simulation & P2P sync tick
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
      this.supabase = createClient(url, key, {
        auth: { persistSession: false }
      });

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
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (key !== this.myPeerId) {
            this.connectToPeer(key, (newPresences[0] as any)?.name || 'Player');
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          this.removePeer(key);
        })
        // Broadcast: WebRTC Signaling
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          this.handleSignalMessage(payload as P2PSignalPayload);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await this.channel?.track({
              peerId: this.myPeerId,
              name: this.myName,
              joinedAt: Date.now()
            });
            this.callbacks.onConnectionStatus(true, 28, this.peers.size);
          }
        });
    } catch {
      // Graceful fallback to solo bots
      this.callbacks.onConnectionStatus(true, 20, 0);
    }
  }

  private handlePresenceSync(presenceState: Record<string, any[]>) {
    const activeKeys = Object.keys(presenceState);
    for (const peerId of activeKeys) {
      if (peerId !== this.myPeerId && !this.peers.has(peerId)) {
        // Initiator rule: smaller peer ID offers connection to avoid collision
        if (this.myPeerId < peerId) {
          const peerData = presenceState[peerId]?.[0];
          this.connectToPeer(peerId, peerData?.name || 'Player');
        }
      }
    }
    this.callbacks.onConnectionStatus(true, 28, this.peers.size);
  }

  private async connectToPeer(peerId: string, peerName: string) {
    if (this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    const wrapper: PeerConnectionWrapper = {
      peerId,
      name: peerName,
      pc,
      dc: null,
      state: null
    };
    this.peers.set(peerId, wrapper);

    // Create DataChannel (un-ordered, low-latency UDP behavior)
    const dc = pc.createDataChannel('strike-p2p', {
      ordered: false,
      maxRetransmits: 0
    });
    wrapper.dc = dc;
    this.setupDataChannel(wrapper, dc);

    // ICE Candidate gathering
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          to: peerId,
          from: this.myPeerId,
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Create Offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal({
        to: peerId,
        from: this.myPeerId,
        type: 'offer',
        sdp: offer
      });
    } catch {
      // Peer connection failure fallback
    }
  }

  private async handleSignalMessage(msg: P2PSignalPayload) {
    if (msg.to !== this.myPeerId) return;

    if (msg.type === 'offer') {
      let wrapper = this.peers.get(msg.from);
      if (!wrapper) {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        wrapper = {
          peerId: msg.from,
          name: 'Player',
          pc,
          dc: null,
          state: null
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
      this.callbacks.onConnectionStatus(true, 24, this.peers.size);

      // Create 3D Avatar for this peer
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
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'state') {
          wrapper.state = data.state;
          const av = this.engine.remoteAvatars.get(wrapper.peerId);
          if (av && data.state) {
            av.root.position = Vector3.Lerp(av.root.position, new Vector3(data.state.x, data.state.y, data.state.z), 0.4);
            av.root.rotation.y = data.state.yaw;
            av.updateAnimation(data.state.animState, performance.now() * 0.001);
          }
        } else if (data.type === 'shoot') {
          const shoot = data.shoot as P2PShootEvent;
          strikeAudio.playGunfire(shoot.weaponId);
          if (shoot.targetId === this.myPeerId) {
            this.engine.applyDamage(shoot.damage, wrapper.name);
          }
        }
      } catch {}
    };

    dc.onclose = () => {
      this.removePeer(wrapper.peerId);
    };
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
    this.callbacks.onConnectionStatus(true, 28, this.peers.size);
  }

  private initBots() {
    const botArchetypes = [
      { name: 'Bot Asuka', outfit: '#ff6584', hair: '#ff7597', weapon: 'rifle' as WeaponId },
      { name: 'Bot Rei', outfit: '#00cec9', hair: '#74b9ff', weapon: 'sniper' as WeaponId },
      { name: 'Bot Kaguya', outfit: '#2d3436', hair: '#2d3436', weapon: 'pistol' as WeaponId },
      { name: 'Bot Rem', outfit: '#0984e3', hair: '#74b9ff', weapon: 'rifle' as WeaponId },
      { name: 'Bot Kurisu', outfit: '#e17055', hair: '#d63031', weapon: 'rifle' as WeaponId }
    ];

    const waypoints = this.engine.mapData?.botWaypoints || [Vector3.Zero()];

    this.bots = botArchetypes.map((spec, i) => {
      const id = `bot_${i + 1}`;
      const wp = waypoints[i % waypoints.length] || new Vector3(0, 1, 0);

      // Create 3D Babylon Avatar
      const avatar = new BabylonAvatarModel(
        id,
        {
          name: spec.name,
          hairColor: spec.hair,
          outfitColor: spec.outfit
        },
        this.engine.scene
      );
      avatar.setWeapon(spec.weapon);
      avatar.root.position = wp.clone();
      this.engine.remoteAvatars.set(id, avatar);

      return {
        id,
        name: spec.name,
        avatarOutfit: spec.outfit,
        hairColor: spec.hair,
        weaponId: spec.weapon,
        position: wp.clone(),
        yaw: Math.random() * Math.PI * 2,
        pitch: 0,
        health: 100,
        isDead: false,
        respawnTime: 0,
        currentWaypointIdx: i,
        lastShotTime: 0,
        kills: Math.floor(Math.random() * 3),
        deaths: Math.floor(Math.random() * 2),
        headshots: 0,
        streak: 0,
        ping: 28 + Math.floor(Math.random() * 15)
      };
    });
  }

  private tick() {
    this.tickCount++;
    const now = performance.now();
    const dt = 0.04;

    // 1. Broadcast local player state over open WebRTC DataChannels
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
      ping: 24,
      avatarOutfit: '#ff7597'
    };

    const statePacket = JSON.stringify({ type: 'state', state: myState });
    this.peers.forEach((p) => {
      if (p.dc && p.dc.readyState === 'open') {
        p.dc.send(statePacket);
      }
    });

    // 2. Simulate AI Bots (Waypoints, sighting, shooting)
    const waypoints = this.engine.mapData?.botWaypoints || [Vector3.Zero()];
    const spawns = this.engine.mapData?.spawnPoints || [{ position: new Vector3(0, 1, 0), yaw: 0 }];

    for (const bot of this.bots) {
      if (bot.isDead) {
        if (now >= bot.respawnTime) {
          const sp = spawns[Math.floor(Math.random() * spawns.length)];
          bot.position = sp.position.clone();
          bot.health = 100;
          bot.isDead = false;
          const av = this.engine.remoteAvatars.get(bot.id);
          if (av) {
            av.root.setEnabled(true);
            av.root.position = bot.position.clone();
          }
        }
        continue;
      }

      // Check distance to player
      const distToPlayer = Vector3.Distance(bot.position, myPos);
      const canSeePlayer = !this.engine.isDead && distToPlayer < 32;

      if (canSeePlayer) {
        const dir = myPos.subtract(bot.position).normalize();
        bot.yaw = Math.atan2(dir.x, dir.z);

        const def = WEAPON_CATALOG[bot.weaponId];
        const shotCooldown = (60 / def.fireRateRpm) * 1000;
        if (now - bot.lastShotTime > shotCooldown) {
          bot.lastShotTime = now;
          const hitChance = bot.weaponId === 'sniper' ? 0.35 : 0.45;
          if (Math.random() < hitChance) {
            const isHeadshot = Math.random() < 0.2;
            const mult = isHeadshot ? def.headshotMultiplier : 1.0;
            const dmg = Math.round(def.damage * mult * 0.4);
            this.engine.applyDamage(dmg, bot.name);
          }
          strikeAudio.playGunfire(bot.weaponId);
        }
      } else {
        // Patrol waypoints
        const targetWp = waypoints[bot.currentWaypointIdx];
        if (targetWp) {
          const dist = Vector3.Distance(bot.position, targetWp);
          if (dist < 1.5) {
            bot.currentWaypointIdx = (bot.currentWaypointIdx + 1) % waypoints.length;
          } else {
            const moveDir = targetWp.subtract(bot.position).normalize();
            bot.yaw = Math.atan2(moveDir.x, moveDir.z);
            bot.position.addInPlace(moveDir.scale(3.8 * dt));
          }
        }
      }

      // Update 3D avatar position
      const av = this.engine.remoteAvatars.get(bot.id);
      if (av) {
        av.root.position = bot.position.clone();
        av.root.rotation.y = bot.yaw;
        av.updateAnimation(canSeePlayer ? 0 : 1, now * 0.001);
      }
    }

    // 3. Publish Scoreboard every 10 ticks
    if (this.tickCount % 10 === 0) {
      this.publishScoreboard();
    }
  }

  public registerPlayerShot(ray: HitscanRay, isHeadshot: boolean, targetId: string | null) {
    this.localShotsFired++;

    if (targetId) {
      this.localShotsHit++;
      const def = WEAPON_CATALOG[ray.weaponId];
      const mult = isHeadshot ? def.headshotMultiplier : 1.0;
      const damage = Math.round(def.damage * mult);
      this.localDamageDealt += damage;

      // Check if target is an AI bot
      const bot = this.bots.find((b) => b.id === targetId);
      if (bot && !bot.isDead) {
        bot.health -= damage;
        if (bot.health <= 0) {
          bot.isDead = true;
          bot.deaths++;
          bot.respawnTime = performance.now() + 2500;
          this.localKills++;
          this.localCurrentStreak++;
          if (this.localCurrentStreak > this.localBestStreak) {
            this.localBestStreak = this.localCurrentStreak;
          }
          if (isHeadshot) this.localHeadshots++;

          // Hide avatar
          const av = this.engine.remoteAvatars.get(bot.id);
          if (av) av.root.setEnabled(false);

          // Killfeed entry
          this.callbacks.onKillfeedEntry({
            id: `kill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            killerName: 'You',
            victimName: bot.name,
            weaponId: ray.weaponId,
            isHeadshot,
            timestamp: Date.now()
          });

          // Medal announcement
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

      // Check if target is a P2P peer
      const peer = this.peers.get(targetId);
      if (peer && peer.dc && peer.dc.readyState === 'open') {
        const shootPacket: P2PShootEvent = {
          shooterId: this.myPeerId,
          weaponId: ray.weaponId,
          origin: ray.origin,
          direction: ray.direction,
          targetId,
          isHeadshot,
          damage
        };
        peer.dc.send(JSON.stringify({ type: 'shoot', shoot: shootPacket }));
      }
    }
  }

  public registerPlayerDeath(attackerName: string) {
    this.localDeaths++;
    this.localCurrentStreak = 0;

    const killerBot = this.bots.find((b) => b.name === attackerName);
    if (killerBot) {
      killerBot.kills++;
      killerBot.streak++;
    }

    this.callbacks.onKillfeedEntry({
      id: `death_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      killerName: attackerName,
      victimName: 'You',
      weaponId: killerBot?.weaponId || 'rifle',
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
        ping: 24,
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
        ping: p.state?.ping || 32,
        avatarOutfit: p.state?.avatarOutfit || '#00cec9'
      })),
      ...this.bots.map((b, idx) => ({
        id: idx + 1,
        name: b.name,
        isBot: true,
        kills: b.kills,
        deaths: b.deaths,
        headshots: b.headshots,
        score: b.kills * 100 + b.headshots * 50,
        streak: b.streak,
        ping: b.ping,
        avatarOutfit: b.avatarOutfit
      }))
    ];

    players.sort((a, b) => b.score - a.score);
    this.callbacks.onScoreboardUpdate(players);
  }
}
