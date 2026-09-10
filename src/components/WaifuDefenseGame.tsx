import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { state, recordDefenseWaveVictory, showToast } from '../lib/store';
import { t } from '../lib/i18n';

interface TowerPlot {
  id: number;
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
  type: 'scout' | 'warrior' | 'shaman' | 'brute' | 'boss';
  hp: number;
  maxHp: number;
  speed: number;
  x: number;
  y: number;
  pathIndex: number;
  slowUntil: number;
  goldValue: number;
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

export function WaifuDefenseGame() {
  let canvasRef: HTMLCanvasElement | undefined;
  let animFrameId: number;

  // Game signals
  const [wave, setWave] = createSignal(1);
  const [waveInProgress, setWaveInProgress] = createSignal(false);
  const [energy, setEnergy] = createSignal(120);
  const [waifuHp, setWaifuHp] = createSignal(100);
  const [selectedPlot, setSelectedPlot] = createSignal<TowerPlot | null>(null);
  const [selectedBuildType, setSelectedBuildType] = createSignal<'archer' | 'frost' | 'thunder' | 'sanctuary'>('archer');
  const [gameStatus, setGameStatus] = createSignal<'ready' | 'playing' | 'victory' | 'gameover'>('ready');
  const [ultimateCooldown, setUltimateCooldown] = createSignal(0);
  const [lastWaveReward, setLastWaveReward] = createSignal<{ coins: number; exp: number } | null>(null);

  // Tower configs
  const TOWER_SPECS = {
    archer: { name: 'Sakura Archer', cost: 45, icon: '🏹', range: 130, damage: 20, cd: 650, desc: 'Rapid single target arrows' },
    frost: { name: 'Frost Shrine', cost: 65, icon: '❄️', range: 110, damage: 10, cd: 1100, desc: 'AOE slow + frost spikes' },
    thunder: { name: 'Thunder Ward', cost: 95, icon: '⚡', range: 145, damage: 50, cd: 1400, desc: 'High-voltage lightning strike' },
    sanctuary: { name: 'Spirit Beacon', cost: 75, icon: '🌸', range: 100, damage: 5, cd: 2000, desc: 'Empowers towers & heals Waifu' }
  };

  // Fixed path coordinates (Canvas 800 x 480)
  const WAYPOINTS = [
    { x: 0, y: 240 },
    { x: 170, y: 240 },
    { x: 170, y: 110 },
    { x: 380, y: 110 },
    { x: 380, y: 370 },
    { x: 570, y: 370 },
    { x: 570, y: 240 },
    { x: 740, y: 240 }
  ];

  // Plots
  const initialPlots: TowerPlot[] = [
    { id: 1, x: 90, y: 160, tower: null },
    { id: 2, x: 90, y: 320, tower: null },
    { id: 3, x: 260, y: 180, tower: null },
    { id: 4, x: 260, y: 50, tower: null },
    { id: 5, x: 470, y: 180, tower: null },
    { id: 6, x: 470, y: 440, tower: null },
    { id: 7, x: 650, y: 160, tower: null },
    { id: 8, x: 650, y: 320, tower: null }
  ];

  let plots: TowerPlot[] = [...initialPlots];
  let enemies: Enemy[] = [];
  let projectiles: Projectile[] = [];
  let particles: Particle[] = [];
  let spawnQueue: { type: Enemy['type']; delay: number }[] = [];
  let nextSpawnTime = 0;
  let lastEnergyTick = Date.now();
  let nextProjId = 1;
  let nextEnemyId = 1;

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

  const startWave = () => {
    const curWave = wave();
    setWaveInProgress(true);
    setGameStatus('playing');
    setLastWaveReward(null);

    // Build spawn queue based on wave level
    spawnQueue = [];
    const count = 5 + curWave * 3;
    for (let i = 0; i < count; i++) {
      let type: Enemy['type'] = 'scout';
      if (curWave >= 2 && i % 3 === 0) type = 'warrior';
      if (curWave >= 3 && i % 5 === 0) type = 'shaman';
      if (curWave >= 4 && i % 4 === 0) type = 'brute';
      spawnQueue.push({ type, delay: i * (curWave > 3 ? 800 : 1100) });
    }

    // Boss at wave 5 or multiples of 5
    if (curWave % 5 === 0) {
      spawnQueue.push({ type: 'boss', delay: (count + 1) * 900 });
    }

    nextSpawnTime = Date.now() + 500;
  };

  const spawnEnemy = (type: Enemy['type']) => {
    const curWave = wave();
    let hp = 45 + curWave * 12;
    let speed = 0.8;
    let goldValue = 6 + curWave * 2;

    if (type === 'warrior') {
      hp = 90 + curWave * 25;
      speed = 0.55;
      goldValue = 12 + curWave * 3;
    } else if (type === 'shaman') {
      hp = 120 + curWave * 30;
      speed = 0.45;
      goldValue = 18 + curWave * 4;
    } else if (type === 'brute') {
      hp = 280 + curWave * 60;
      speed = 0.32;
      goldValue = 28 + curWave * 5;
    } else if (type === 'boss') {
      hp = 900 + curWave * 200;
      speed = 0.24;
      goldValue = 80 + curWave * 15;
    }

    enemies.push({
      id: nextEnemyId++,
      type,
      hp,
      maxHp: hp,
      speed,
      x: WAYPOINTS[0].x,
      y: WAYPOINTS[0].y,
      pathIndex: 0,
      slowUntil: 0,
      goldValue
    });
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
        setEnergy(prev => prev + e.goldValue);
        return false;
      }
      return true;
    });

    showToast('🌸 SAKURA NOVA! All goblin forces devastated!');
  };

  // Build / upgrade / sell tower
  const buildTowerOnPlot = (plot: TowerPlot, type: 'archer' | 'frost' | 'thunder' | 'sanctuary') => {
    const spec = TOWER_SPECS[type];
    if (energy() < spec.cost) {
      showToast(`Not enough energy! Requires ${spec.cost} ⚡`);
      return;
    }

    setEnergy(prev => prev - spec.cost);
    plot.tower = {
      type,
      level: 1,
      lastShotTime: 0,
      range: spec.range,
      damage: spec.damage,
      cooldown: spec.cd
    };
    createBurst(plot.x, plot.y, '#a0ffe6', 15);
    setSelectedPlot({ ...plot });
  };

  const upgradeTower = (plot: TowerPlot) => {
    if (!plot.tower) return;
    const upgradeCost = Math.round(TOWER_SPECS[plot.tower.type].cost * 0.8 * plot.tower.level);
    if (energy() < upgradeCost) {
      showToast(`Need ${upgradeCost} ⚡ to upgrade!`);
      return;
    }

    setEnergy(prev => prev - upgradeCost);
    plot.tower.level += 1;
    plot.tower.damage = Math.round(plot.tower.damage * 1.4);
    plot.tower.range = Math.round(plot.tower.range * 1.15);
    createBurst(plot.x, plot.y, '#ffd700', 20);
    setSelectedPlot({ ...plot });
    showToast(`Upgraded ${TOWER_SPECS[plot.tower.type].name} to Lv ${plot.tower.level}! ⚔️`);
  };

  const sellTower = (plot: TowerPlot) => {
    if (!plot.tower) return;
    const refund = Math.round(TOWER_SPECS[plot.tower.type].cost * 0.6 * plot.tower.level);
    setEnergy(prev => prev + refund);
    plot.tower = null;
    createBurst(plot.x, plot.y, '#aaa', 10);
    setSelectedPlot({ ...plot });
    showToast(`Sold tower for +${refund} ⚡ energy.`);
  };

  const resetGame = () => {
    plots.forEach(p => (p.tower = null));
    enemies = [];
    projectiles = [];
    particles = [];
    spawnQueue = [];
    setWave(1);
    setEnergy(120);
    setWaifuHp(100);
    setGameStatus('ready');
    setWaveInProgress(false);
    setSelectedPlot(null);
  };

  // Game Loop
  onMount(() => {
    const canvas = canvasRef;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Ultimate cooldown countdown
    const ultInterval = setInterval(() => {
      if (ultimateCooldown() > 0) {
        setUltimateCooldown(prev => Math.max(0, prev - 1));
      }
    }, 1000);

    const gameLoop = () => {
      const now = Date.now();

      // Energy regen (+4 energy / sec)
      if (now - lastEnergyTick >= 1000) {
        setEnergy(prev => Math.min(500, prev + 4));
        lastEnergyTick = now;
      }

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
        const nextWp = WAYPOINTS[enemy.pathIndex + 1];

        if (!nextWp) {
          // Reached Waifu Shrine!
          const dmg = enemy.type === 'boss' ? 35 : enemy.type === 'brute' ? 20 : 10;
          setWaifuHp(prev => {
            const next = Math.max(0, prev - dmg);
            if (next <= 0) {
              setGameStatus('gameover');
              setWaveInProgress(false);
              playSfx('lose');
            }
            return next;
          });
          createBurst(740, 240, '#ff4d4d', 20);
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
      plots.forEach(plot => {
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
          let closestDist = Infinity;
          let target: Enemy | null = null;

          enemies.forEach(e => {
            const dist = Math.hypot(e.x - plot.x, e.y - plot.y);
            if (dist <= t.range && dist < closestDist) {
              closestDist = dist;
              target = e;
            }
          });

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
          setEnergy(prev => prev + e.goldValue);
          createBurst(e.x, e.y, '#ff4081', 12);
          return false;
        }
        return true;
      });

      // 5. Check Wave Victory
      if (waveInProgress() && spawnQueue.length === 0 && enemies.length === 0 && waifuHp() > 0) {
        setWaveInProgress(false);
        setGameStatus('victory');
        playSfx('victory');

        const curWave = wave();
        const coinsWon = 30 + curWave * 15;
        const expWon = 45 + curWave * 20;

        recordDefenseWaveVictory(curWave, coinsWon, expWon);
        setLastWaveReward({ coins: coinsWon, exp: expWon });
        showToast(t('defense.waveClearedToast', { wave: curWave, coins: coinsWon, exp: expWon }));
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

      // Draw Pathway
      ctx.lineWidth = 42;
      ctx.strokeStyle = 'rgba(255, 180, 205, 0.18)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      WAYPOINTS.forEach((wp, idx) => {
        if (idx === 0) ctx.moveTo(wp.x, wp.y);
        else ctx.lineTo(wp.x, wp.y);
      });
      ctx.stroke();

      // Inner pathway lane
      ctx.lineWidth = 30;
      ctx.strokeStyle = 'rgba(255, 140, 180, 0.35)';
      ctx.stroke();

      // Draw Plots
      plots.forEach(plot => {
        const isSelected = selectedPlot()?.id === plot.id;
        ctx.beginPath();
        ctx.arc(plot.x, plot.y, 22, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(255, 105, 180, 0.4)' : 'rgba(255, 255, 255, 0.08)';
        ctx.fill();
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.strokeStyle = isSelected ? '#ff69b4' : 'rgba(255, 255, 255, 0.25)';
        ctx.stroke();

        if (plot.tower) {
          const spec = TOWER_SPECS[plot.tower.type];
          ctx.font = '20px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(spec.icon, plot.x, plot.y);

          // Tower Level badge
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = '#ffecb3';
          ctx.fillText(`Lv${plot.tower.level}`, plot.x, plot.y + 16);

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
        } else {
          ctx.font = '14px sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+', plot.x, plot.y);
        }
      });

      // Draw Waifu Shrine Base (End of path)
      ctx.beginPath();
      ctx.arc(740, 240, 36, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 182, 193, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#ff69b4';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = '32px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⛩️', 740, 238);

      // Draw Enemies
      enemies.forEach(e => {
        // Goblin body
        ctx.beginPath();
        const radius = e.type === 'boss' ? 22 : e.type === 'brute' ? 16 : 12;
        ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);

        if (e.type === 'boss') ctx.fillStyle = '#b71c1c';
        else if (e.type === 'brute') ctx.fillStyle = '#e65100';
        else if (e.type === 'shaman') ctx.fillStyle = '#4a148c';
        else ctx.fillStyle = '#2e7d32';

        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Icon
        ctx.font = e.type === 'boss' ? '18px sans-serif' : '12px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.type === 'boss' ? '👹' : e.type === 'shaman' ? '🧙' : '👺', e.x, e.y);

        // HP bar
        const hpBarW = radius * 2 + 6;
        const pct = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(e.x - hpBarW / 2, e.y - radius - 8, hpBarW, 4);
        ctx.fillStyle = pct > 0.4 ? '#4caf50' : '#f44336';
        ctx.fillRect(e.x - hpBarW / 2, e.y - radius - 8, hpBarW * pct, 4);
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
    });
  });

  // Canvas Click Handler
  const handleCanvasClick = (e: MouseEvent) => {
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 480 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check if clicked a plot
    const clickedPlot = plots.find(p => Math.hypot(p.x - clickX, p.y - clickY) <= 26);
    if (clickedPlot) {
      setSelectedPlot(clickedPlot);
    } else {
      setSelectedPlot(null);
    }
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
          <span class="hud-label">{t('defense.energy')}</span>
          <span class="hud-value energy-val">⚡ {energy()}</span>
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
              ⚔️ {t('defense.startWave', { wave: gameStatus() === 'victory' ? wave() + 1 : wave() })}
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

        {/* OVERLAYS */}
        <Show when={gameStatus() === 'victory' && lastWaveReward()}>
          <div class="game-overlay-banner victory-banner">
            <h3>🎉 {t('defense.waveDefended', { wave: wave() })}</h3>
            <p>{t('defense.victoryDesc')}</p>
            <div class="rewards-row">
              <span>+🪙 {lastWaveReward()!.coins} Coins</span>
              <span>+🌟 {lastWaveReward()!.exp} Waifu XP</span>
            </div>
            <button
              class="btn-primary"
              onClick={() => {
                setWave(prev => prev + 1);
                startWave();
              }}
            >
              {t('defense.startWave', { wave: wave() + 1 })} ➡️
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
                          onClick={() => buildTowerOnPlot(plot(), typeKey as any)}
                        >
                          <span class="tower-icon">{spec.icon}</span>
                          <div class="tower-meta">
                            <strong>{t(`defense.towers.${typeKey}`)}</strong>
                            <small>⚡ {spec.cost} {t('defense.energy')}</small>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={plot().tower}>
                {tower => (
                  <div class="tower-upgrade-panel">
                    <div class="tower-current-info">
                      <span class="panel-icon">{TOWER_SPECS[tower().type].icon}</span>
                      <div class="panel-details">
                        <h4>{t(`defense.towers.${tower().type}`)} (Level {tower().level})</h4>
                        <p>Damage: {tower().damage} | Range: {tower().range}px</p>
                      </div>
                    </div>

                    <div class="tower-action-btns">
                      <button
                        class="btn-upgrade"
                        onClick={() => upgradeTower(plot())}
                      >
                        ⚡ {t('defense.upgrade', { level: tower().level + 1, cost: Math.round(TOWER_SPECS[tower().type].cost * 0.8 * tower().level) })}
                      </button>
                      <button
                        class="btn-sell"
                        onClick={() => sellTower(plot())}
                      >
                        🪙 {t('defense.sell', { cost: Math.round(TOWER_SPECS[tower().type].cost * 0.6 * tower().level) })}
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
