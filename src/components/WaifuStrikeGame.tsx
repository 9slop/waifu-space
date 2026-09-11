import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { StrikeEngine } from '../lib/strike/strike-engine';
import { StrikeNetworkManager } from '../lib/strike/strike-network';
import { WeaponDef, ScoreboardPlayer, KillfeedEntry, StrikeMatchStats } from '../lib/strike/strike-types';
import { WEAPON_CATALOG, strikeAudio } from '../lib/strike/strike-weapons';
import { t } from '../lib/i18n';
import { state, addCoins, gainBondExp, showToast } from '../lib/store';
import '../styles/strike.css';

interface WaifuStrikeGameProps {
  onExit?: () => void;
}

export function WaifuStrikeGame(props: WaifuStrikeGameProps) {
  let containerRef!: HTMLDivElement;

  const [engine, setEngine] = createSignal<StrikeEngine | null>(null);
  const [network, setNetwork] = createSignal<StrikeNetworkManager | null>(null);

  const [health, setHealth] = createSignal(100);
  const [maxHealth] = createSignal(100);
  const [ammo, setAmmo] = createSignal({ mag: 30, reserve: 90 });
  const [activeWeapon, setActiveWeapon] = createSignal<WeaponDef>(WEAPON_CATALOG.rifle);

  const [hitmarker, setHitmarker] = createSignal<{ isHeadshot: boolean; id: number } | null>(null);
  const [isScoped, setIsScoped] = createSignal(false);
  const [showControlsOverlay, setShowControlsOverlay] = createSignal(true);
  const [showScoreboard, setShowScoreboard] = createSignal(false);
  const [showSummaryModal, setShowSummaryModal] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);

  const [killfeed, setKillfeed] = createSignal<KillfeedEntry[]>([]);
  const [medal, setMedal] = createSignal<{ title: string; sub: string } | null>(null);
  const [scoreboard, setScoreboard] = createSignal<ScoreboardPlayer[]>([]);
  const [ping, setPing] = createSignal(24);
  const [connected, setConnected] = createSignal(false);

  // Match Summary Data
  const [matchSummary, setMatchSummary] = createSignal<StrikeMatchStats | null>(null);
  const [matchRewards, setMatchRewards] = createSignal<{ coins: number; exp: number } | null>(null);

  // Settings
  const [mouseSens, setMouseSens] = createSignal(2.2);
  const [audioVol, setAudioVol] = createSignal(50);
  const [fovVal, setFovVal] = createSignal(85);

  let matchStartTime = Date.now();

  onMount(() => {
    matchStartTime = Date.now();

    const eng = new StrikeEngine({
      onHealthChange: (hp) => setHealth(hp),
      onAmmoChange: (mag, reserve) => setAmmo({ mag, reserve }),
      onWeaponChange: (w) => {
        setActiveWeapon(w);
        setIsScoped(false);
      },
      onHitmarker: (isHeadshot) => {
        setHitmarker({ isHeadshot, id: Date.now() });
        setTimeout(() => setHitmarker(null), 250);
      },
      onLocalShoot: (ray, isHeadshot, targetId) => {
        net?.registerPlayerShot(ray, isHeadshot, targetId);
      },
      onKillAnnouncement: (text) => {
        setMedal({ title: text, sub: '' });
        setTimeout(() => setMedal(null), 2000);
      },
      onScoreboardToggle: (visible) => {
        setShowScoreboard(visible);
      }
    });

    const net = new StrikeNetworkManager(eng, {
      onScoreboardUpdate: (players) => setScoreboard(players),
      onKillfeedEntry: (entry) => {
        setKillfeed((prev) => [entry, ...prev.slice(0, 4)]);
      },
      onMedalAnnouncement: (title, sub) => {
        setMedal({ title, sub });
        setTimeout(() => setMedal(null), 2000);
      },
      onConnectionStatus: (conn, latency) => {
        setConnected(conn);
        setPing(latency);
      }
    });

    setEngine(eng);
    setNetwork(net);

    eng.init(containerRef);
    net.start(state.user?.username || 'Commander');

    const handleResize = () => eng.handleResize();
    window.addEventListener('resize', handleResize);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      eng.destroy();
      net.stop();
    });
  });

  const handleStartPlay = () => {
    setShowControlsOverlay(false);
    engine()?.requestPointerLock();
  };

  const handleLeaveMatch = async () => {
    const net = network();
    const duration = Math.max(1, Math.round((Date.now() - matchStartTime) / 1000));
    const kills = net?.localKills || 0;
    const deaths = net?.localDeaths || 0;
    const headshots = net?.localHeadshots || 0;
    const streak = net?.localBestStreak || 0;
    const dmg = net?.localDamageDealt || 0;
    const shotsFired = net?.localShotsFired || 0;
    const shotsHit = net?.localShotsHit || 0;

    const summary: StrikeMatchStats = {
      kills,
      deaths,
      headshots,
      bestStreak: streak,
      damageDealt: dmg,
      shotsFired,
      shotsHit,
      durationSeconds: duration
    };

    setMatchSummary(summary);
    setShowSummaryModal(true);

    // Save stats via API
    try {
      const res = await fetch('/api/strike/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(state.user?.token ? { Authorization: `Bearer ${state.user.token}` } : {})
        },
        body: JSON.stringify(summary)
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setMatchRewards({ coins: data.coinsEarned, exp: data.expEarned });
        addCoins(data.coinsEarned);
        gainBondExp(data.expEarned);
      } else {
        // Fallback local calculation
        const coinsEarned = kills * 8 + (streak >= 5 ? 25 : 0);
        const expEarned = kills * 15 + headshots * 10;
        setMatchRewards({ coins: coinsEarned, exp: expEarned });
        addCoins(coinsEarned);
        gainBondExp(expEarned);
      }
    } catch {
      const coinsEarned = kills * 8;
      const expEarned = kills * 15;
      setMatchRewards({ coins: coinsEarned, exp: expEarned });
      addCoins(coinsEarned);
      gainBondExp(expEarned);
    }
  };

  const handleFinishSummary = () => {
    setShowSummaryModal(false);
    if (props.onExit) {
      props.onExit();
    }
  };

  return (
    <div class="strike-viewport-container" role="region" aria-label="Waifu Strike FPS">
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={containerRef}
        class="strike-canvas-wrapper"
        onClick={() => {
          if (!showControlsOverlay() && !showSummaryModal()) {
            engine()?.requestPointerLock();
          }
        }}
      />

      {/* Crosshair (hidden while scoped with sniper) */}
      <Show when={!isScoped()}>
        <div class="strike-crosshair">
          <div class="ch-dot" />
          <div class="ch-line ch-top" />
          <div class="ch-line ch-bottom" />
          <div class="ch-line ch-left" />
          <div class="ch-line ch-right" />
        </div>
      </Show>

      {/* Sniper ADS Scope Overlay */}
      <Show when={isScoped()}>
        <div class="strike-scope-overlay">
          <div class="scope-line-h" />
          <div class="scope-line-v" />
        </div>
      </Show>

      {/* Hitmarker Flash */}
      <Show when={hitmarker()}>
        <div class={`strike-hitmarker ${hitmarker()?.isHeadshot ? 'headshot' : ''}`}>
          <div class="hitmarker-line hm-1" />
          <div class="hitmarker-line hm-2" />
          <div class="hitmarker-line hm-3" />
          <div class="hitmarker-line hm-4" />
        </div>
      </Show>

      {/* Top Info Banner */}
      <div class="strike-top-banner">
        <span class="strike-room-tag">⚡ {t('strike.modeTitle') || 'Waifu Strike DM'}</span>
        <span>⛩️ {t('strike.mapName') || 'Cyber Shrine'}</span>
        <span>📶 {ping()}ms</span>
        <button
          class="btn-leave-match"
          style={{
            background: 'rgba(255, 71, 87, 0.3)',
            border: '1px solid #ff4757',
            color: '#fff',
            padding: '2px 10px',
            'border-radius': '6px',
            cursor: 'pointer'
          }}
          onClick={handleLeaveMatch}
        >
          🏃 {t('strike.leaveMatch') || 'Leave'}
        </button>
      </div>

      {/* Killfeed Ticker */}
      <div class="strike-killfeed">
        <For each={killfeed()}>
          {(entry) => (
            <div class="killfeed-row">
              <span class="kf-killer">{entry.killerName}</span>
              <span class="kf-weapon">{entry.weaponId.toUpperCase()}</span>
              <Show when={entry.isHeadshot}>
                <span class="kf-headshot" title="Headshot">💀</span>
              </Show>
              <span class="kf-victim">{entry.victimName}</span>
            </div>
          )}
        </For>
      </div>

      {/* Medal / Streak Announcement Popups */}
      <Show when={medal()}>
        <div class="strike-medal-box">
          <div class="medal-title">{medal()?.title}</div>
          <div class="medal-sub">{medal()?.sub}</div>
        </div>
      </Show>

      {/* Bottom HUD */}
      <div class="strike-hud-bottom">
        {/* Health */}
        <div class="hud-health-card">
          <div class={`hud-health-val ${health() <= 30 ? 'low' : ''}`}>
            + {health()}
          </div>
          <div class="hud-health-bar">
            <div
              class="hud-health-fill"
              style={{ width: `${Math.max(0, Math.min(100, (health() / maxHealth()) * 100))}%` }}
            />
          </div>
        </div>

        {/* Weapons Selector Bar */}
        <div class="hud-weapons-bar">
          <div
            class={`hud-weapon-slot ${activeWeapon().id === 'rifle' ? 'active' : ''}`}
            onClick={() => engine()?.switchWeapon('rifle')}
          >
            <span class="hud-slot-key">[1]</span>
            <span>Rifle</span>
          </div>
          <div
            class={`hud-weapon-slot ${activeWeapon().id === 'sniper' ? 'active' : ''}`}
            onClick={() => engine()?.switchWeapon('sniper')}
          >
            <span class="hud-slot-key">[2]</span>
            <span>Sniper</span>
          </div>
          <div
            class={`hud-weapon-slot ${activeWeapon().id === 'pistol' ? 'active' : ''}`}
            onClick={() => engine()?.switchWeapon('pistol')}
          >
            <span class="hud-slot-key">[3]</span>
            <span>Deagle</span>
          </div>
          <div
            class={`hud-weapon-slot ${activeWeapon().id === 'knife' ? 'active' : ''}`}
            onClick={() => engine()?.switchWeapon('knife')}
          >
            <span class="hud-slot-key">[4]</span>
            <span>Knife</span>
          </div>
        </div>

        {/* Ammo */}
        <div class="hud-ammo-card">
          <div>
            <span class="hud-ammo-mag">
              {activeWeapon().id === 'knife' ? '∞' : ammo().mag}
            </span>
            <Show when={activeWeapon().id !== 'knife'}>
              <span class="hud-ammo-reserve">/ {ammo().reserve}</span>
            </Show>
          </div>
          <div class="hud-weapon-name">{activeWeapon().name}</div>
        </div>
      </div>

      {/* Start / Controls Instruction Overlay */}
      <Show when={showControlsOverlay()}>
        <div class="strike-lock-overlay" onClick={handleStartPlay}>
          <div class="strike-lock-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🌸 {t('strike.title') || 'Waifu Strike'}</h2>
            <p style={{ color: '#a4b0be', 'margin-bottom': '16px' }}>
              {t('strike.desc') || 'Endless casual tactical deathmatch. Drop in, click to lock mouse, and frag!'}
            </p>

            <div class="strike-controls-grid">
              <div class="strike-ctrl-pill">
                <span>Move</span>
                <span class="strike-ctrl-key">W / A / S / D</span>
              </div>
              <div class="strike-ctrl-pill">
                <span>Jump</span>
                <span class="strike-ctrl-key">Space</span>
              </div>
              <div class="strike-ctrl-pill">
                <span>Crouch</span>
                <span class="strike-ctrl-key">Ctrl / C</span>
              </div>
              <div class="strike-ctrl-pill">
                <span>Walk / Sneak</span>
                <span class="strike-ctrl-key">Shift</span>
              </div>
              <div class="strike-ctrl-pill">
                <span>Shoot</span>
                <span class="strike-ctrl-key">Left Click</span>
              </div>
              <div class="strike-ctrl-pill">
                <span>Scope ADS</span>
                <span class="strike-ctrl-key">Right Click</span>
              </div>
              <div class="strike-ctrl-pill">
                <span>Reload</span>
                <span class="strike-ctrl-key">R</span>
              </div>
              <div class="strike-ctrl-pill">
                <span>Scoreboard</span>
                <span class="strike-ctrl-key">Hold Tab</span>
              </div>
            </div>

            <button
              class="btn-start-strike"
              style={{
                background: 'linear-gradient(135deg, #ff7597, #e84393)',
                color: '#fff',
                border: 'none',
                padding: '12px 32px',
                'border-radius': '12px',
                'font-weight': 'bold',
                'font-size': '1.1rem',
                cursor: 'pointer',
                'margin-top': '8px'
              }}
              onClick={handleStartPlay}
            >
              🎮 {t('strike.dropInBtn') || 'Drop In & Play'}
            </button>
          </div>
        </div>
      </Show>

      {/* Live Tab Scoreboard */}
      <Show when={showScoreboard()}>
        <div class="strike-scoreboard-overlay">
          <div class="strike-scoreboard-modal">
            <div class="scoreboard-header">
              <h3>🏆 {t('strike.scoreboardTitle') || 'Deathmatch Leaderboard'}</h3>
              <span style={{ color: '#00cec9' }}>Cyber Shrine Courtyard</span>
            </div>

            <table class="scoreboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Kills</th>
                  <th>Deaths</th>
                  <th>Headshots</th>
                  <th>K/D</th>
                  <th>Streak</th>
                  <th>Score</th>
                  <th>Ping</th>
                </tr>
              </thead>
              <tbody>
                <For each={scoreboard()}>
                  {(p, idx) => {
                    const kd = (p.kills / Math.max(1, p.deaths)).toFixed(1);
                    return (
                      <tr class={p.id === 0 ? 'is-local' : ''}>
                        <td>#{idx() + 1}</td>
                        <td style={{ color: p.avatarOutfit }}>
                          {p.id === 0 ? '⭐ ' : ''}{p.name}
                        </td>
                        <td>{p.kills}</td>
                        <td>{p.deaths}</td>
                        <td>{p.headshots}</td>
                        <td>{kd}</td>
                        <td>{p.streak}</td>
                        <td style={{ color: '#ffd32a' }}>{p.score}</td>
                        <td>{p.ping}ms</td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>

      {/* End-of-Session Match Summary Modal */}
      <Show when={showSummaryModal() && matchSummary()}>
        <div class="strike-lock-overlay" style={{ cursor: 'default' }}>
          <div class="strike-summary-modal">
            <h2>🎉 {t('strike.summaryTitle') || 'Match Report'}</h2>
            <p style={{ color: '#a4b0be' }}>
              {t('strike.summarySubtitle') || 'Endless casual deathmatch session results'}
            </p>

            <div class="strike-stat-grid">
              <div class="strike-stat-tile">
                <div class="strike-stat-num">{matchSummary()?.kills}</div>
                <div class="strike-stat-lbl">{t('strike.kills') || 'Kills'}</div>
              </div>
              <div class="strike-stat-tile">
                <div class="strike-stat-num">
                  {(matchSummary()!.kills / Math.max(1, matchSummary()!.deaths)).toFixed(2)}
                </div>
                <div class="strike-stat-lbl">K/D Ratio</div>
              </div>
              <div class="strike-stat-tile">
                <div class="strike-stat-num">{matchSummary()?.headshots}</div>
                <div class="strike-stat-lbl">{t('strike.headshots') || 'Headshots'}</div>
              </div>
              <div class="strike-stat-tile">
                <div class="strike-stat-num">{matchSummary()?.bestStreak}</div>
                <div class="strike-stat-lbl">{t('strike.bestStreak') || 'Best Streak'}</div>
              </div>
              <div class="strike-stat-tile">
                <div class="strike-stat-num">{matchSummary()?.damageDealt}</div>
                <div class="strike-stat-lbl">{t('strike.damage') || 'Damage'}</div>
              </div>
              <div class="strike-stat-tile">
                <div class="strike-stat-num">
                  {matchSummary()!.shotsFired > 0
                    ? Math.round((matchSummary()!.shotsHit / matchSummary()!.shotsFired) * 100)
                    : 0}%
                </div>
                <div class="strike-stat-lbl">{t('strike.accuracy') || 'Accuracy'}</div>
              </div>
            </div>

            <Show when={matchRewards()}>
              <div
                style={{
                  background: 'rgba(255, 215, 0, 0.1)',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  padding: '12px',
                  'border-radius': '10px',
                  margin: '16px 0',
                  color: '#ffd32a',
                  'font-weight': 'bold'
                }}
              >
                🪙 +{matchRewards()?.coins} Coins &nbsp;|&nbsp; 💖 +{matchRewards()?.exp} Bond EXP
              </div>
            </Show>

            <button
              class="btn-start-strike"
              style={{
                background: '#ff7597',
                color: '#fff',
                border: 'none',
                padding: '12px 28px',
                'border-radius': '10px',
                'font-weight': 'bold',
                cursor: 'pointer'
              }}
              onClick={handleFinishSummary}
            >
              {t('common.done') || 'Done'}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
