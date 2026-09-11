import { createSignal, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import { state, recordDefenseWaveVictory, showToast } from '../lib/store';
import { getDefenseCoinsReward, getDefenseExpReward } from '../lib/economy';
import {
  TOWER_SPECS,
  ENEMY_SPECS,
  MAX_TOWER_LEVEL,
  getTowerBuildCost,
  getTowerUpgradeCost,
  getTowerRefund,
  getEnemyHp,
  getEnemySilver,
  getDefenseWavePlan,
  getWaveClearSilver,
  getWaveClearSilverBonus,
  SILVER_STARTER,
  EnemyType
} from '../lib/defense-balance';
import {
  generateDefenseMap,
  getTileAtPixel,
  DefenseMap,
  TILE_SIZE
} from '../lib/defense-map';
import { setDefenseGameActive } from '../lib/defense-bridge';
import { t } from '../lib/i18n';

interface TowerPlot {
  id: number;
  col: number;
  row: number;
  x: number;
  y: number;
  tower: PlacedTower | null;
}

interface PlacedTower {
  type: 'archer' | 'frost' | 'thunder' | 'sanctuary';
  level: number;
  lastShotTime: number;
  range: number;
  damage: number;
  cooldown: number; // ms
}

interface Enemy {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  x: number;
  y: number;
  pathIndex: number;
  slowUntil: number;
  silverValue: number;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetEnemyId: number;
  speed: number;
  damage: number;
  type: 'arrow' | 'frost' | 'lightning';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
  life: number;
}

interface WaveReward {
  coins: number;
  exp: number;
  silverEarned: number;
}

export function WaifuDefenseGame() {
  let canvasRef: HTMLCanvasElement | undefined;
  let animFrameId: number;

  // Game signals
  const [wave, setWave] = createSignal(1);
  const [waveInProgress, setWaveInProgress] = createSignal(false);
  const [silver, setSilver] = createSignal(SILVER_STARTER);
  const [waifuHp, setWaifuHp] = createSignal(100);
  const [selectedPlot, setSelectedPlot] = createSignal<TowerPlot | null>(null);
  const [selectedBuildType, setSelectedBuildType] = createSignal<'archer' | 'frost' | 'thunder' | 'sanctuary'>('archer');
  const [gameStatus, setGameStatus] = createSignal<'ready' | 'playing' | 'victory' | 'gameover'>('ready');
  const [ultimateCooldown, setUltimateCooldown] = createSignal(0);
  const [lastWaveReward, setLastWaveReward] = createSignal<WaveReward | null>(null);
  const [bossBar, setBossBar] = createSignal<{ pct: number; wave: number; isMiniBoss: boolean } | null>(null);

  // Procedural Map & Free-Placement Grid
  let currentMap: DefenseMap = generateDefenseMap();
  const placedTowers = new Map<number, TowerPlot>();

  let enemies: Enemy[] = [];
  let projectiles: Projectile[] = [];
  let particles: Particle[] = [];
  let spawnQueue: { type: Enemy['type']; delay: number }[] = [];
  let nextSpawnTime = 0;
  let nextProjId = 1;
  let nextEnemyId = 1;
  let waveStartTime = 0;

  // Server-authoritative silver ledger. Spends (signed deltas) are buffered and
  // flushed to the server on each wave clear so the balance cannot be faked.
  let pendingSpends: number[] = [];

  // Sound effects generator via Web Audio API
  const playSfx = (type: 'shoot' | 'hit' | 'nova' | 'victory' | 'lose') => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'shoot') {
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'hit') {
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.11);
      } else if (type === 'nova') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'victory') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(783.99, now + 0.24);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  const createBurst = (x: number, y: number, color: string, count = 8) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 1 + Math.random() * 3;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        alpha: 1,
        color,
        size: 3 + Math.random() * 3,
        life: 0.8
      });
    }
  };

  // Server-authoritative game session. A fresh game resets silver to the
  // starter amount on the server (never passively regenerated).
  const ensureSession = async () => {
    try {
      const token = state.user?.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('ws_auth_token') : null);
      if (!token) {
        setSilver(SILVER_STARTER);
        return;
      }
      const res = await fetch('/api/defense/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && typeof data.silver === 'number') {
          setSilver(data.silver);
          return;
        }
      }
    } catch {
      // server offline -> plain local starter silver
    }
    setSilver(SILVER_STARTER);
  };

  const hasAnyTower = () => placedTowers.size > 0;

  createEffect(() => {
    // Subscribe to plot selection so rebuilding towers refreshes progress state.
    selectedPlot();
    setDefenseGameActive(gameStatus() === 'playing' || gameStatus() === 'victory' || hasAnyTower());
  });

  const startWave = () => {
    const curWave = wave();
    setWaveInProgress(true);
    setGameStatus('playing');
    setLastWaveReward(null);
    setBossBar(null);
    waveStartTime = Date.now();

    // Deterministic plan shared with the server (boss waves every 10th wave, mini-boss on waves 5, 15, 25...).
    const plan = getDefenseWavePlan(curWave);
    const spacing = Math.max(450, 1000 - curWave * 25);
    spawnQueue = plan.spawns.map((type, i) => ({ type, delay: i * spacing }));
    nextSpawnTime = Date.now() + 500;
  };

  const spawnEnemy = (type: Enemy['type']) => {
    const curWave = wave();
    const spec = ENEMY_SPECS[type];
    const firstWp = currentMap.waypoints[0] || { x: 0, y: 240 };
    enemies.push({
      id: nextEnemyId++,
      type,
      hp: getEnemyHp(type, curWave),
      maxHp: getEnemyHp(type, curWave),
      speed: spec.speed,
      x: firstWp.x,
      y: firstWp.y,
      pathIndex: 0,
      slowUntil: 0,
      silverValue: getEnemySilver(type, curWave)
    });
  };

  const creditSilver = (value: number) => {
    setSilver(prev => Math.max(0, prev + Math.max(0, value)));
  };

  const triggerSakuraNova = () => {
    if (ultimateCooldown() > 0) return;
    setUltimateCooldown(20);
    playSfx('nova');

    // Visual wave
    createBurst(400, 240, '#ff77aa', 50);

    // Deal 320 damage to all active monsters
    enemies.forEach(e => {
      e.hp -= 320;
      createBurst(e.x, e.y, '#ff4081', 12);
    });

    // Filter dead
    enemies = enemies.filter(e => {
      if (e.hp <= 0) {
        creditSilver(e.silverValue);
        return false;
      }
      return true;
    });

    showToast('🌸 SAKURA NOVA! All goblin forces devastated!');
  };

  // Build / upgrade / sell tower (all paid in gamemode silver)
  const buildTowerOnPlot = (plot: TowerPlot, type: 'archer' | 'frost' | 'thunder' | 'sanctuary') => {
    const spec = TOWER_SPECS[type];
    const cost = getTowerBuildCost(type);
    if (silver() < cost) {
      showToast(t('defense.needSilver', { cost }));
      return;
    }

    setSilver(prev => prev - cost);
    pendingSpends.push(-cost);
    const newTower: PlacedTower = {
      type,
      level: 1,
      lastShotTime: 0,
      range: spec.range,
      damage: spec.damage,
      cooldown: spec.cd
    };
    const updatedPlot: TowerPlot = {
      ...plot,
      tower: newTower
    };
    placedTowers.set(plot.id, updatedPlot);
    createBurst(plot.x, plot.y, '#a0ffe6', 15);
    setSelectedPlot({ ...updatedPlot, tower: { ...newTower } });
  };

  const upgradeTower = (plot: TowerPlot) => {
    const existing = placedTowers.get(plot.id);
    if (!existing || !existing.tower) return;
    if (existing.tower.level >= MAX_TOWER_LEVEL) {
      showToast(t('defense.maxLevelReached', { level: MAX_TOWER_LEVEL }) || `Tower is already at max level ${MAX_TOWER_LEVEL}!`);
      return;
    }
    const upgradeCost = getTowerUpgradeCost(existing.tower.type, existing.tower.level);
    if (silver() < upgradeCost) {
      showToast(t('defense.needSilverUpgrade', { cost: upgradeCost }));
      return;
    }

    setSilver(prev => prev - upgradeCost);
    pendingSpends.push(-upgradeCost);
    const nextLevel = existing.tower.level + 1;
    const updatedTower: PlacedTower = {
      ...existing.tower,
      level: nextLevel,
      damage: Math.round(existing.tower.damage * 1.4),
      range: Math.round(existing.tower.range * 1.15)
    };
    const updatedPlot: TowerPlot = {
      ...existing,
      tower: updatedTower
    };
    placedTowers.set(plot.id, updatedPlot);
    createBurst(plot.x, plot.y, '#ffd700', 20);
    // Direct refresh of selectedPlot ensures consecutive upgrades update immediately
    setSelectedPlot({ ...updatedPlot, tower: { ...updatedTower } });
    showToast(t('defense.upgradedToast', { name: t(`defense.towers.${updatedTower.type}`), level: nextLevel }));
  };

  const sellTower = (plot: TowerPlot) => {
    const existing = placedTowers.get(plot.id);
    if (!existing || !existing.tower) return;
    const refund = getTowerRefund(existing.tower.type, existing.tower.level);
    setSilver(prev => prev + refund);
    pendingSpends.push(refund);
    placedTowers.delete(plot.id);
    createBurst(plot.x, plot.y, '#aaa', 10);
    setSelectedPlot(null);
    showToast(t('defense.soldToast', { refund }));
  };

  const resetGame = () => {
    currentMap = generateDefenseMap();
    placedTowers.clear();
    enemies = [];
    projectiles = [];
    particles = [];
    spawnQueue = [];
    pendingSpends = [];
    setWave(1);
    setSilver(SILVER_STARTER);
    setWaifuHp(100);
    setGameStatus('ready');
    setWaveInProgress(false);
    setSelectedPlot(null);
    setBossBar(null);
    ensureSession();
  };

  // Game Loop
  onMount(() => {
    const canvas = canvasRef;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ensureSession();

    // Ultimate cooldown countdown
    const ultInterval = setInterval(() => {
      if (ultimateCooldown() > 0) {
        setUltimateCooldown(prev => Math.max(0, prev - 1));
      }
    }, 1000);

    const gameLoop = () => {
      const now = Date.now();

      // 1. Spawning
      if (waveInProgress() && spawnQueue.length > 0 && now >= nextSpawnTime) {
        const item = spawnQueue.shift();
        if (item) {
          spawnEnemy(item.type);
          nextSpawnTime = now + 900;
        }
      }

      // 2. Update Enemies Movement
      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const nextWp = currentMap.waypoints[enemy.pathIndex + 1];

        if (!nextWp) {
          // Reached Waifu Shrine!
          const dmg = ENEMY_SPECS[enemy.type].shrineDamage;
          setWaifuHp(prev => {
            const next = Math.max(0, prev - dmg);
            if (next <= 0) {
              setGameStatus('gameover');
              setWaveInProgress(false);
              playSfx('lose');
            }
            return next;
          });
          createBurst(currentMap.shrineLocation.x, currentMap.shrineLocation.y, '#ff4d4d', 20);
          playSfx('hit');
          enemies.splice(i, 1);
          continue;
        }

        const dx = nextWp.x - enemy.x;
        const dy = nextWp.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        const isSlowed = now < enemy.slowUntil;
        const speed = isSlowed ? enemy.speed * 0.5 : enemy.speed;

        if (dist <= speed) {
          enemy.x = nextWp.x;
          enemy.y = nextWp.y;
          enemy.pathIndex++;
        } else {
          enemy.x += (dx / dist) * speed;
          enemy.y += (dy / dist) * speed;
        }
      }

      // 3. Update Towers Attack
      placedTowers.forEach(plot => {
        if (!plot.tower) return;
        const t = plot.tower;

        // Sanctuary periodic waifu heal & aura
        if (t.type === 'sanctuary') {
          if (now - t.lastShotTime >= t.cooldown) {
            t.lastShotTime = now;
            setWaifuHp(prev => Math.min(100, prev + 3 * t.level));
            createBurst(plot.x, plot.y, '#ffb7d5', 8);
          }
          return;
        }

        // Other towers target closest enemy in range
        if (now - t.lastShotTime >= t.cooldown) {
          const target: Enemy | null = enemies.reduce<Enemy | null>((closest, e) => {
            const dist = Math.hypot(e.x - plot.x, e.y - plot.y);
            if (dist <= t.range && dist < (closest === null ? Infinity : Math.hypot(closest.x - plot.x, closest.y - plot.y))) {
              return e;
            }
            return closest;
          }, null);

          if (target) {
            t.lastShotTime = now;
            playSfx('shoot');

            if (t.type === 'archer') {
              projectiles.push({
                id: nextProjId++,
                x: plot.x,
                y: plot.y,
                targetX: target.x,
                targetY: target.y,
                targetEnemyId: target.id,
                speed: 7,
                damage: t.damage,
                type: 'arrow'
              });
            } else if (t.type === 'frost') {
              // AOE frost blast
              enemies.forEach(e => {
                if (Math.hypot(e.x - plot.x, e.y - plot.y) <= t.range) {
                  e.hp -= t.damage;
                  e.slowUntil = now + 2500;
                  createBurst(e.x, e.y, '#90e0ef', 6);
                }
              });
            } else if (t.type === 'thunder') {
              // Instant chain lightning
              let hits = 0;
              enemies.forEach(e => {
                if (hits < 3 && Math.hypot(e.x - plot.x, e.y - plot.y) <= t.range) {
                  e.hp -= t.damage;
                  createBurst(e.x, e.y, '#ffeb3b', 8);
                  hits++;
                }
              });
            }
          }
        }
      });

      // 4. Update Projectiles
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        const target = enemies.find(e => e.id === p.targetEnemyId);
        const tx = target ? target.x : p.targetX;
        const ty = target ? target.y : p.targetY;

        const dx = tx - p.x;
        const dy = ty - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= p.speed || dist < 6) {
          if (target) {
            target.hp -= p.damage;
            createBurst(target.x, target.y, '#ff80bf', 6);
            playSfx('hit');
          }
          projectiles.splice(i, 1);
        } else {
          p.x += (dx / dist) * p.speed;
          p.y += (dy / dist) * p.speed;
        }
      }

      // Check dead enemies
      enemies = enemies.filter(e => {
        if (e.hp <= 0) {
          creditSilver(e.silverValue);
          createBurst(e.x, e.y, '#ff4081', 12);
          return false;
        }
        return true;
      });

      // Boss / Mini-boss health bar overlay
      const boss = enemies.find(e => e.type === 'boss' || e.type === 'miniboss');
      setBossBar(boss ? {
        pct: Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100)),
        wave: wave(),
        isMiniBoss: boss.type === 'miniboss'
      } : null);

      // 5. Check Wave Victory
      if (waveInProgress() && spawnQueue.length === 0 && enemies.length === 0 && waifuHp() > 0) {
        setWaveInProgress(false);
        setGameStatus('victory');
        setBossBar(null);
        playSfx('victory');

        const curWave = wave();
        const durationMs = Math.max(1000, Date.now() - waveStartTime);
        const spendSnapshot = pendingSpends;

        const applyVictory = (coinsWon: number, expWon: number, silverEarned: number, goblins = 10) => {
          recordDefenseWaveVictory(curWave, coinsWon, expWon, goblins);
          setLastWaveReward({ coins: coinsWon, exp: expWon, silverEarned });
          setWave(curWave + 1);
          showToast(t('defense.waveClearedToast', { wave: curWave, coins: coinsWon, exp: expWon }));
        };

        // Offline / server-unreachable fallback: locally valid rewards only.
        const recordLocalVictory = () => {
          const coinsWon = getDefenseCoinsReward(curWave);
          const expWon = getDefenseExpReward(curWave);
          creditSilver(getWaveClearSilverBonus(curWave));
          pendingSpends = [];
          applyVictory(coinsWon, expWon, getWaveClearSilver(curWave));
        };

        (async () => {
          try {
            const token = state.user?.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('ws_auth_token') : null);
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/defense/complete-wave', {
              method: 'POST',
              headers,
              body: JSON.stringify({ wave: curWave, durationMs, spends: spendSnapshot })
            });

            if (res.ok) {
              const data = await res.json();
              if (data.verified) {
                pendingSpends = [];
                // Authoritative silver from the server ledger; kills are also
                // worth their per-enemy value which the plan already includes.
                setSilver(data.silver);
                applyVictory(data.coinsReward, data.expReward, data.silverEarned, data.goblinsDefeated);
                return;
              }
            }
            // Server rejected the wave -> do NOT grant rewards locally (anti-cheat)
            showToast(t('defense.waveWithheldToast'));
            setLastWaveReward({ coins: 0, exp: 0, silverEarned: 0 });
            return;
          } catch {
            // Server offline / not deployed: fall back to local validation for offline play
          }

          recordLocalVictory();
        })();
      }

      // 6. Update Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.03;
        pt.alpha = Math.max(0, pt.life);
        if (pt.life <= 0) {
          particles.splice(i, 1);
        }
      }

      // 7. RENDER
      ctx.clearRect(0, 0, 800, 480);

      // Background grass / field
      ctx.fillStyle = '#181b2a';
      ctx.fillRect(0, 0, 800, 480);

      // Subtle grid background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      for (let c = 0; c <= currentMap.cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * TILE_SIZE, 0);
        ctx.lineTo(c * TILE_SIZE, 480);
        ctx.stroke();
      }
      for (let r = 0; r <= currentMap.rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * TILE_SIZE);
        ctx.lineTo(800, r * TILE_SIZE);
        ctx.stroke();
      }

      // Draw Pathway outer border
      ctx.lineWidth = 42;
      ctx.strokeStyle = 'rgba(255, 180, 205, 0.18)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      currentMap.waypoints.forEach((wp, idx) => {
        if (idx === 0) ctx.moveTo(wp.x, wp.y);
        else ctx.lineTo(wp.x, wp.y);
      });
      ctx.stroke();

      // Inner pathway lane
      ctx.lineWidth = 30;
      ctx.strokeStyle = 'rgba(255, 140, 180, 0.35)';
      ctx.stroke();

      // Draw Obstacles (rocks, trees, lanterns)
      for (let r = 0; r < currentMap.rows; r++) {
        for (let c = 0; c < currentMap.cols; c++) {
          const tile = currentMap.tiles[r][c];
          if (tile.type === 'obstacle' && tile.obstacleIcon) {
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tile.obstacleIcon, tile.x, tile.y);
          }
        }
      }

      // Draw Waifu Shrine Base (Vector Torii Shrine Gate)
      drawToriiGate(ctx, currentMap.shrineLocation.x, currentMap.shrineLocation.y);

      // Draw Placed Towers
      placedTowers.forEach(plot => {
        if (!plot.tower) return;
        const isSelected = selectedPlot()?.id === plot.id;
        ctx.beginPath();
        ctx.arc(plot.x, plot.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(255, 105, 180, 0.45)' : 'rgba(255, 255, 255, 0.12)';
        ctx.fill();
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.strokeStyle = isSelected ? '#ff69b4' : 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();

        const spec = TOWER_SPECS[plot.tower.type];
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(spec.icon, plot.x, plot.y);

        // Tower Level badge
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#ffecb3';
        ctx.fillText(`Lv${plot.tower.level}`, plot.x, plot.y + 15);

        // Draw range circle if selected
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(plot.x, plot.y, plot.tower.range, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 105, 180, 0.08)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 105, 180, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // If an empty tile is selected, draw placement preview
      const sel = selectedPlot();
      if (sel && !sel.tower) {
        ctx.beginPath();
        ctx.arc(sel.x, sel.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 105, 180, 0.3)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ff69b4';
        ctx.stroke();

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', sel.x, sel.y);

        // Preview build range
        const previewSpec = TOWER_SPECS[selectedBuildType()];
        ctx.beginPath();
        ctx.arc(sel.x, sel.y, previewSpec.range, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 105, 180, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 105, 180, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Enemies
      enemies.forEach(e => {
        const spec = ENEMY_SPECS[e.type];

        // Pulsating aura for boss and mini-boss
        if (e.type === 'miniboss' || e.type === 'boss') {
          ctx.save();
          ctx.beginPath();
          ctx.arc(e.x, e.y, spec.radius + 6 + Math.sin(now / 150) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = e.type === 'boss' ? 'rgba(255, 68, 68, 0.8)' : 'rgba(186, 104, 200, 0.8)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(e.x, e.y, spec.radius, 0, Math.PI * 2);
        ctx.fillStyle = spec.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Icon
        ctx.font = (e.type === 'boss' || e.type === 'miniboss') ? '16px sans-serif' : '12px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(spec.icon, e.x, e.y);

        // HP bar
        const hpBarW = spec.radius * 2 + 6;
        const pct = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(e.x - hpBarW / 2, e.y - spec.radius - 8, hpBarW, 4);
        ctx.fillStyle = pct > 0.4 ? '#4caf50' : '#f44336';
        ctx.fillRect(e.x - hpBarW / 2, e.y - spec.radius - 8, hpBarW * pct, 4);
      });

      // Draw Projectiles
      projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff69b4';
        ctx.fill();
      });

      // Draw Particles
      particles.forEach(pt => {
        ctx.save();
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animFrameId = requestAnimationFrame(gameLoop);
    };

    animFrameId = requestAnimationFrame(gameLoop);

    onCleanup(() => {
      cancelAnimationFrame(animFrameId);
      clearInterval(ultInterval);
      setDefenseGameActive(false);
    });
  });

  // Vector Torii Gate rendering for Waifu Shrine base
  function drawToriiGate(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();

    // Glow under the shrine
    const radGrad = ctx.createRadialGradient(x, y, 5, x, y, 40);
    radGrad.addColorStop(0, 'rgba(255, 105, 180, 0.45)');
    radGrad.addColorStop(0.7, 'rgba(255, 182, 193, 0.15)');
    radGrad.addColorStop(1, 'rgba(255, 182, 193, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fill();

    // Shrine circle base
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 20, 35, 0.85)';
    ctx.fill();
    ctx.strokeStyle = '#ff69b4';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Vector Torii Gate
    const w = 36;
    const h = 32;
    const topY = y - h / 2;
    const botY = y + h / 2 - 2;

    // Vertical Pillars
    ctx.fillStyle = '#e53935';
    ctx.fillRect(x - w / 2 + 5, topY + 4, 4, h - 6);
    ctx.fillRect(x + w / 2 - 9, topY + 4, 4, h - 6);

    // Bases
    ctx.fillStyle = '#212121';
    ctx.fillRect(x - w / 2 + 4, botY - 3, 6, 3);
    ctx.fillRect(x + w / 2 - 10, botY - 3, 6, 3);

    // Lower crossbar
    ctx.fillStyle = '#c62828';
    ctx.fillRect(x - w / 2 + 2, topY + 11, w - 4, 3);

    // Center vertical strut
    ctx.fillStyle = '#212121';
    ctx.fillRect(x - 2, topY + 5, 4, 6);

    // Top main curved lintel
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 3, topY + 3);
    ctx.quadraticCurveTo(x, topY, x + w / 2 + 3, topY + 3);
    ctx.lineTo(x + w / 2 + 4, topY - 2);
    ctx.quadraticCurveTo(x, topY - 5, x - w / 2 - 4, topY - 2);
    ctx.closePath();
    ctx.fill();

    // Top black caps
    ctx.fillStyle = '#212121';
    ctx.fillRect(x - w / 2 - 2, topY - 3, 4, 3);
    ctx.fillRect(x + w / 2 - 2, topY - 3, 4, 3);

    // Center glowing spiritual jewel
    ctx.beginPath();
    ctx.arc(x, y + 3, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd54f';
    ctx.fill();

    ctx.restore();
  }

  // Canvas Click Handler: supports free placement across the entire grid
  const handleCanvasClick = (e: MouseEvent) => {
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 480 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // 1. Check if an existing placed tower was clicked
    let clickedTowerPlot: TowerPlot | null = null;
    placedTowers.forEach(plot => {
      if (Math.hypot(plot.x - clickX, plot.y - clickY) <= 24) {
        clickedTowerPlot = plot;
      }
    });

    if (clickedTowerPlot) {
      setSelectedPlot({ ...(clickedTowerPlot as TowerPlot) });
      return;
    }

    // 2. Check grid tile
    const tile = getTileAtPixel(currentMap, clickX, clickY);
    if (!tile) {
      setSelectedPlot(null);
      return;
    }

    if (tile.type === 'road') {
      showToast(t('defense.blockedRoad'));
      setSelectedPlot(null);
      return;
    }

    if (tile.type === 'obstacle') {
      showToast(t('defense.blockedObstacle'));
      setSelectedPlot(null);
      return;
    }

    if (tile.type === 'shrine') {
      showToast(`${state.waifu?.name || 'Waifu'} Sanctuary 🌸`);
      setSelectedPlot(null);
      return;
    }

    // 3. Valid empty tile selected for building!
    setSelectedPlot({
      id: tile.id,
      col: tile.col,
      row: tile.row,
      x: tile.x,
      y: tile.y,
      tower: null
    });
  };

  return (
    <div class="waifu-defense-wrapper">
      {/* TOP STATUS BAR */}
      <div class="defense-hud">
        <div class="hud-stat">
          <span class="hud-label">{t('defense.wave')}</span>
          <span class="hud-value wave-val">{wave()}</span>
        </div>

        <div class="hud-stat">
          <span class="hud-label">{t('defense.silver')}</span>
          <span class="hud-value silver-val">🥈 {silver()}</span>
        </div>

        <div class="hud-stat">
          <span class="hud-label">{t('defense.sanctuaryHp', { name: state.waifu?.name || 'Waifu' })}</span>
          <div class="hud-hp-bar">
            <div class="hp-fill" style={{ width: `${waifuHp()}%` }}></div>
            <span class="hp-text">{waifuHp()} / 100</span>
          </div>
        </div>

        <div class="hud-stat">
          <button
            class="btn-sakura-nova"
            disabled={ultimateCooldown() > 0}
            onClick={triggerSakuraNova}
            title={t('defense.novaTooltip')}
          >
            🌸 {t('defense.sakuraNova')} {ultimateCooldown() > 0 ? `(${ultimateCooldown()}s)` : t('defense.ready')}
          </button>
        </div>

        <div class="hud-stat">
          <Show when={!waveInProgress() && gameStatus() !== 'gameover'}>
            <button class="btn-start-wave" onClick={startWave}>
              ⚔️ {t('defense.startWave', { wave: wave() })}
            </button>
          </Show>
          <Show when={gameStatus() === 'gameover'}>
            <button class="btn-retry" onClick={resetGame}>
              🔄 {t('defense.tryAgain')}
            </button>
          </Show>
        </div>
      </div>

      {/* GAME CANVAS */}
      <div class="canvas-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          class="defense-canvas"
          onClick={handleCanvasClick}
        />

        {/* BOSS / MINI-BOSS HEALTH BAR */}
        <Show when={bossBar() && waveInProgress()}>
          <div class="boss-bar-overlay" data-testid="boss-bar">
            <div class="boss-bar-label">
              {bossBar()!.isMiniBoss ? `🦹 ${t('defense.miniboss') || 'MINI-BOSS'}` : `👹 ${t('defense.boss')}`} — {t('defense.wave')} {bossBar()!.wave}
            </div>
            <div class="boss-bar-track">
              <div
                class="boss-bar-fill"
                style={{
                  width: `${bossBar()!.pct}%`,
                  background: bossBar()!.isMiniBoss ? 'linear-gradient(90deg, #ab47bc, #e040fb)' : undefined
                }}
              ></div>
            </div>
          </div>
        </Show>

        {/* OVERLAYS */}
        <Show when={gameStatus() === 'victory' && lastWaveReward()}>
          <div class="game-overlay-banner victory-banner">
            <h3>🎉 {t('defense.waveDefended', { wave: wave() })}</h3>
            <p>{t('defense.victoryDesc')}</p>
            <div class="rewards-row">
              <span>+🪙 {lastWaveReward()!.coins} Coins</span>
              <span>+🌟 {lastWaveReward()!.exp} Waifu XP</span>
              <Show when={lastWaveReward()!.silverEarned > 0}>
                <span>+🥈 {lastWaveReward()!.silverEarned} {t('defense.silver')}</span>
              </Show>
            </div>
            <button
              class="btn-primary"
              onClick={() => {
                startWave();
              }}
            >
              {t('defense.startWave', { wave: wave() })} ➡️
            </button>
          </div>
        </Show>

        <Show when={gameStatus() === 'gameover'}>
          <div class="game-overlay-banner defeat-banner">
            <h3>💔 {t('defense.shrineFell')}</h3>
            <p>{t('defense.defeatDesc', { name: state.waifu?.name || 'Your waifu' })}</p>
            <button class="btn-primary" onClick={resetGame}>
              {t('defense.restartDefense')}
            </button>
          </div>
        </Show>
      </div>

      {/* TOWER CONTROL & BUILDING DECK */}
      <div class="tower-controls-deck">
        <Show when={selectedPlot()} fallback={
          <div class="tower-picker-hint">
            <span>💡 {t('defense.plotHint')}</span>
          </div>
        }>
          {plot => (
            <div class="plot-inspector">
              <Show when={!plot().tower}>
                <div class="build-selection">
                  <span class="inspector-title">{t('defense.constructTower', { id: plot().id })}</span>
                  <div class="tower-types-grid">
                    <For each={Object.entries(TOWER_SPECS)}>
                      {([typeKey, spec]) => (
                        <button
                          class={`btn-build-tower ${selectedBuildType() === typeKey ? 'active' : ''}`}
                          data-testid={`btn-build-${typeKey}`}
                          onClick={() => buildTowerOnPlot(plot(), typeKey as any)}
                        >
                          <span class="tower-icon">
                            <Show when={typeKey === 'sanctuary'} fallback={spec.icon}>
                              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2L15 8H9L12 2Z" fill="#ff77aa" stroke="#ff4081" />
                                <circle cx="12" cy="14" r="5" fill="#ffb6c1" stroke="#ff69b4" />
                                <path d="M6 21h12" stroke="#ff4081" stroke-linecap="round" />
                              </svg>
                            </Show>
                          </span>
                          <div class="tower-meta">
                            <div class="tower-header-row">
                              <strong>{t(`defense.towers.${typeKey}`)}</strong>
                              <span class={`tower-role-tag role-${spec.role}`}>
                                {t(`defense.tags.${spec.role}`)}
                              </span>
                            </div>
                            <small>🥈 {spec.cost} {t('defense.silver')}</small>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={plot().tower}>
                {tower => (
                  <div class="tower-upgrade-panel" data-testid="tower-upgrade-panel">
                    <div class="tower-current-info">
                      <span class="panel-icon">
                        <Show when={tower().type === 'sanctuary'} fallback={TOWER_SPECS[tower().type].icon}>
                          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L15 8H9L12 2Z" fill="#ff77aa" stroke="#ff4081" />
                            <circle cx="12" cy="14" r="5" fill="#ffb6c1" stroke="#ff69b4" />
                            <path d="M6 21h12" stroke="#ff4081" stroke-linecap="round" />
                          </svg>
                        </Show>
                      </span>
                      <div class="panel-details">
                        <h4>
                          {t(`defense.towers.${tower().type}`)} (Level {tower().level})
                          <span class={`tower-role-tag role-${TOWER_SPECS[tower().type].role}`}>
                            {t(`defense.tags.${TOWER_SPECS[tower().type].role}`)}
                          </span>
                        </h4>
                        <p>Damage: {tower().damage} | Range: {tower().range}px</p>
                      </div>
                    </div>

                    <div class="tower-action-btns">
                      <button
                        class="btn-upgrade"
                        disabled={tower().level >= MAX_TOWER_LEVEL}
                        onClick={() => upgradeTower(plot())}
                      >
                        {tower().level >= MAX_TOWER_LEVEL
                          ? (t('defense.maxLevel', { level: MAX_TOWER_LEVEL }) || `⭐ Max Level (Lv ${MAX_TOWER_LEVEL})`)
                          : `🥈 ${t('defense.upgrade', { level: tower().level + 1, cost: getTowerUpgradeCost(tower().type, tower().level) })}`}
                      </button>
                      <button
                        class="btn-sell"
                        onClick={() => sellTower(plot())}
                      >
                        🥈 {t('defense.sell', { cost: getTowerRefund(tower().type, tower().level) })}
                      </button>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}