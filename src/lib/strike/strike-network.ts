import * as THREE from 'three';
import {
  WeaponId,
  PlayerSnapshot,
  ScoreboardPlayer,
  KillfeedEntry,
  HitscanRay,
  PACKET_OPCODES
} from './strike-types';
import {
  encodeInputPacket,
  encodeShootPacket,
  decodeSnapshotPacket,
  decodeKillEventPacket
} from './strike-binary';
import { StrikeEngine } from './strike-engine';
import { ThirdPersonAvatarModel } from './strike-avatars';
import { WEAPON_CATALOG, strikeAudio } from './strike-weapons';

export interface NetworkCallbacks {
  onScoreboardUpdate: (players: ScoreboardPlayer[]) => void;
  onKillfeedEntry: (entry: KillfeedEntry) => void;
  onMedalAnnouncement: (title: string, sub: string) => void;
  onConnectionStatus: (connected: boolean, ping: number) => void;
}

interface BotEntity {
  id: number;
  name: string;
  avatarOutfit: string;
  hairColor: string;
  weaponId: WeaponId;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  pitch: number;
  health: number;
  isDead: boolean;
  respawnTime: number;
  currentWaypointIdx: number;
  targetId: number | null;
  reactionTimer: number;
  lastShotTime: number;
  kills: number;
  deaths: number;
  headshots: number;
  streak: number;
  ping: number;
}

export class StrikeNetworkManager {
  private engine: StrikeEngine;
  private callbacks: NetworkCallbacks;
  private socket: WebSocket | null = null;
  private isConnected = false;
  private ping = 24;

  // Local simulated room bots
  private bots: BotEntity[] = [];
  private nextEntityId = 2;
  private serverTick = 0;
  private tickIntervalId: any = null;

  // Local match records
  public localKills = 0;
  public localDeaths = 0;
  public localHeadshots = 0;
  public localBestStreak = 0;
  public localCurrentStreak = 0;
  public localDamageDealt = 0;
  public localShotsFired = 0;
  public localShotsHit = 0;

  constructor(engine: StrikeEngine, callbacks: NetworkCallbacks) {
    this.engine = engine;
    this.callbacks = callbacks;
  }

  public start(playerName = 'Commander') {
    this.initBots();
    this.tryConnectWebSocket();

    // Start 25 Hz simulation / sync loop
    this.tickIntervalId = setInterval(() => {
      this.tick();
    }, 40); // 25 Hz = 40ms
  }

  public stop() {
    if (this.tickIntervalId) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  private tryConnectWebSocket() {
    if (typeof window === 'undefined') return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/api/strike/ws`;
      this.socket = new WebSocket(url);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        this.isConnected = true;
        this.callbacks.onConnectionStatus(true, this.ping);
      };

      this.socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          this.handleBinaryMessage(event.data);
        }
      };

      this.socket.onerror = () => {
        // Graceful fallback: local room simulation will continue
        this.isConnected = false;
        this.callbacks.onConnectionStatus(false, this.ping);
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.callbacks.onConnectionStatus(false, this.ping);
      };
    } catch {
      this.isConnected = false;
    }
  }

  private initBots() {
    const botArchetypes = [
      { name: 'Bot Asuka', outfit: '#ff6584', hair: '#ff7597', weapon: 'rifle' as WeaponId },
      { name: 'Bot Rei', outfit: '#00cec9', hair: '#74b9ff', weapon: 'sniper' as WeaponId },
      { name: 'Bot Kaguya', outfit: '#2d3436', hair: '#2d3436', weapon: 'pistol' as WeaponId },
      { name: 'Bot Rem', outfit: '#0984e3', hair: '#74b9ff', weapon: 'rifle' as WeaponId },
      { name: 'Bot Kurisu', outfit: '#e17055', hair: '#d63031', weapon: 'rifle' as WeaponId }
    ];

    this.bots = botArchetypes.map((spec, i) => {
      const id = this.nextEntityId++;
      const wp = this.engine.botWaypoints[i % this.engine.botWaypoints.length] || { x: 0, y: 0, z: 0 };

      // Instantiate 3D Avatar in scene
      const avatar = new ThirdPersonAvatarModel(id, {
        name: spec.name,
        hairColor: spec.hair,
        outfitColor: spec.outfit
      });
      avatar.setWeapon(spec.weapon);
      avatar.root.position.set(wp.x, wp.y, wp.z);
      this.engine.scene.add(avatar.root);
      this.engine.remoteAvatars.set(id, avatar);

      return {
        id,
        name: spec.name,
        avatarOutfit: spec.outfit,
        hairColor: spec.hair,
        weaponId: spec.weapon,
        position: new THREE.Vector3(wp.x, wp.y, wp.z),
        velocity: new THREE.Vector3(0, 0, 0),
        yaw: Math.random() * Math.PI * 2,
        pitch: 0,
        health: 100,
        isDead: false,
        respawnTime: 0,
        currentWaypointIdx: i,
        targetId: 0,
        reactionTimer: 0.35 + Math.random() * 0.2,
        lastShotTime: 0,
        kills: Math.floor(Math.random() * 3),
        deaths: Math.floor(Math.random() * 2),
        headshots: 0,
        streak: 0,
        ping: 28 + Math.floor(Math.random() * 18)
      };
    });
  }

  private tick() {
    this.serverTick++;

    // 1. Send local player input packet if connected
    const input = this.engine.getPlayerInput();
    if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      const binInput = encodeInputPacket(input);
      this.socket.send(binInput);
    }

    // 2. Simulate AI Bots (Tactical CS bot behavior: waypoint patrol, sight detection, shooting)
    const now = performance.now();
    const dt = 0.04;

    for (const bot of this.bots) {
      if (bot.isDead) {
        if (now >= bot.respawnTime) {
          // Respawn bot at tactical spawn
          const sp = this.engine.spawnPoints[Math.floor(Math.random() * this.engine.spawnPoints.length)];
          bot.position.set(sp.position.x, sp.position.y, sp.position.z);
          bot.health = 100;
          bot.isDead = false;
          const av = this.engine.remoteAvatars.get(bot.id);
          if (av) {
            av.root.visible = true;
            av.root.position.copy(bot.position);
          }
        }
        continue;
      }

      // Check line of sight to player
      const distToPlayer = bot.position.distanceTo(this.engine.position);
      const canSeePlayer = !this.engine.isDead && distToPlayer < 35;

      if (canSeePlayer) {
        // Aim at player
        const dir = new THREE.Vector3().subVectors(this.engine.position, bot.position).normalize();
        bot.yaw = Math.atan2(-dir.x, -dir.z);
        bot.pitch = Math.asin(dir.y);

        // Shoot with reaction delay and fire rate
        const def = WEAPON_CATALOG[bot.weaponId];
        const shotCooldown = (60 / def.fireRateRpm) * 1000;
        if (now - bot.lastShotTime > shotCooldown) {
          bot.lastShotTime = now;
          // Bot accuracy calculation
          const hitChance = bot.weaponId === 'sniper' ? 0.35 : 0.45;
          if (Math.random() < hitChance) {
            const isHeadshot = Math.random() < 0.2;
            const mult = isHeadshot ? def.headshotMultiplier : 1.0;
            const dmg = Math.round(def.damage * mult * 0.4); // balanced bot damage
            this.engine.applyDamage(dmg, bot.name);
          }
          strikeAudio.playGunfire(bot.weaponId);
        }
      } else {
        // Patrol along waypoints
        const targetWp = this.engine.botWaypoints[bot.currentWaypointIdx];
        if (targetWp) {
          const wpVec = new THREE.Vector3(targetWp.x, targetWp.y, targetWp.z);
          const distToWp = bot.position.distanceTo(wpVec);
          if (distToWp < 1.5) {
            bot.currentWaypointIdx = (bot.currentWaypointIdx + 1) % this.engine.botWaypoints.length;
          } else {
            const moveDir = new THREE.Vector3().subVectors(wpVec, bot.position).normalize();
            bot.yaw = Math.atan2(-moveDir.x, -moveDir.z);
            bot.position.addScaledVector(moveDir, 3.8 * dt);
          }
        }
      }

      // Update 3D avatar position and animation
      const av = this.engine.remoteAvatars.get(bot.id);
      if (av) {
        av.root.position.copy(bot.position);
        av.root.rotation.set(0, bot.yaw, 0, 'YXZ');
        av.headMesh.rotation.x = bot.pitch;
        av.updateAnimation(canSeePlayer ? 0 : 1, now * 0.001);
      }
    }

    // 3. Update live Scoreboard
    if (this.serverTick % 10 === 0) {
      this.publishScoreboard();
    }
  }

  public registerPlayerShot(ray: HitscanRay, isHeadshot: boolean, targetId: number | null) {
    this.localShotsFired++;

    if (targetId !== null) {
      this.localShotsHit++;
      const bot = this.bots.find(b => b.id === targetId);
      if (bot && !bot.isDead) {
        const def = WEAPON_CATALOG[ray.weaponId];
        const mult = isHeadshot ? def.headshotMultiplier : 1.0;
        const damage = Math.round(def.damage * mult);
        this.localDamageDealt += damage;
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
          if (isHeadshot) {
            this.localHeadshots++;
          }

          // Hide avatar on death
          const av = this.engine.remoteAvatars.get(bot.id);
          if (av) av.root.visible = false;

          // Killfeed event
          const entry: KillfeedEntry = {
            id: `kill_${Date.now()}_${Math.random()}`,
            killerName: 'You',
            victimName: bot.name,
            weaponId: ray.weaponId,
            isHeadshot,
            timestamp: Date.now()
          };
          this.callbacks.onKillfeedEntry(entry);

          // Medal / streak announcements
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

    // Forward shoot packet to server if connected
    if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      const binShoot = encodeShootPacket(0, ray.weaponId, ray, isHeadshot, targetId);
      this.socket.send(binShoot);
    }
  }

  public registerPlayerDeath(attackerName: string) {
    this.localDeaths++;
    this.localCurrentStreak = 0;

    const killerBot = this.bots.find(b => b.name === attackerName);
    if (killerBot) {
      killerBot.kills++;
      killerBot.streak++;
    }

    const entry: KillfeedEntry = {
      id: `death_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      killerName: attackerName,
      victimName: 'You',
      weaponId: killerBot?.weaponId || 'rifle',
      isHeadshot: false,
      timestamp: Date.now()
    };
    this.callbacks.onKillfeedEntry(entry);

    this.publishScoreboard();
  }

  private publishScoreboard() {
    const players: ScoreboardPlayer[] = [
      {
        id: 0,
        name: 'You (Commander)',
        isBot: false,
        kills: this.localKills,
        deaths: this.localDeaths,
        headshots: this.localHeadshots,
        score: this.localKills * 100 + this.localHeadshots * 50,
        streak: this.localCurrentStreak,
        ping: this.ping,
        avatarOutfit: '#ff7597'
      },
      ...this.bots.map(b => ({
        id: b.id,
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

    // Sort descending by score
    players.sort((a, b) => b.score - a.score);
    this.callbacks.onScoreboardUpdate(players);
  }

  private handleBinaryMessage(buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    const opcode = view.getUint8(0);

    if (opcode === PACKET_OPCODES.S2C_SNAPSHOT) {
      const snap = decodeSnapshotPacket(buffer);
      for (const p of snap.players) {
        if (p.id === 0) continue; // local player
        let avatar = this.engine.remoteAvatars.get(p.id);
        if (avatar) {
          avatar.root.position.lerp(new THREE.Vector3(p.x, p.y, p.z), 0.35);
          avatar.root.rotation.set(0, p.yaw, 0, 'YXZ');
          avatar.headMesh.rotation.x = p.pitch;
          avatar.updateAnimation(p.animState, performance.now() * 0.001);
        }
      }
    } else if (opcode === PACKET_OPCODES.S2C_KILL_EVENT) {
      const evt = decodeKillEventPacket(buffer);
      const entry: KillfeedEntry = {
        id: `kill_${Date.now()}`,
        killerName: `Player_${evt.killerId}`,
        victimName: `Player_${evt.victimId}`,
        weaponId: evt.weaponId,
        isHeadshot: evt.isHeadshot,
        timestamp: Date.now()
      };
      this.callbacks.onKillfeedEntry(entry);
    }
  }
}
