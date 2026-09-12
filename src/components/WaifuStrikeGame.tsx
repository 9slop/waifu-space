import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { StrikeBabylonEngine } from '../lib/strike/strike-babylon-engine';
import { StrikeP2PManager } from '../lib/strike/strike-p2p';
import { StrikeWeatherManager, WeatherType } from '../lib/strike/strike-weather';
import { WeaponDef, ScoreboardPlayer, KillfeedEntry, StrikeMatchStats } from '../lib/strike/strike-types';
import { WEAPON_CATALOG, strikeAudio } from '../lib/strike/strike-weapons';
import { t } from '../lib/i18n';
import { state, addCoins, gainBondExp } from '../lib/store';
import '../styles/strike.css';

interface WaifuStrikeGameProps {
  onExit?: () => void;
}

export function WaifuStrikeGame(props: WaifuStrikeGameProps) {
  let containerRef!: HTMLDivElement;
  let canvasRef!: HTMLCanvasElement;

  const [engine, setEngine] = createSignal<StrikeBabylonEngine | null>(null);
  const [network, setNetwork] = createSignal<StrikeP2PManager | null>(null);

  const [health, setHealth] = createSignal(150);
  const [maxHealth] = createSignal(150);
  const [ammo, setAmmo] = createSignal({ mag: 30, reserve: 90 });
  const [activeWeapon, setActiveWeapon] = createSignal<WeaponDef>(WEAPON_CATALOG.rifle);

  const [hitmarker, setHitmarker] = createSignal<{ isHeadshot: boolean; id: number } | null>(null);
  const [isScoped, setIsScoped] = createSignal(false);
  const [showControlsOverlay, setShowControlsOverlay] = createSignal(true);
  const [showScoreboard, setShowScoreboard] = createSignal(false);
  const [showSummaryModal, setShowSummaryModal] = createSignal(false);
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  const [killfeed, setKillfeed] = createSignal<KillfeedEntry[]>([]);
  const [medal, setMedal] = createSignal<{ title: string; sub: string } | null>(null);
  const [scoreboard, setScoreboard] = createSignal<ScoreboardPlayer[]>([]);
  const [connected, setConnected] = createSignal(false);
  const [peerCount, setPeerCount] = createSignal(0);

  // Match Summary Data
  const [matchSummary, setMatchSummary] = createSignal<StrikeMatchStats | null>(null);
  const [matchRewards, setMatchRewards] = createSignal<{ coins: number; exp: number } | null>(null);

  // Settings
  const [mouseSens, setMouseSens] = createSignal(1.2);
  const [audioVol, setAudioVol] = createSignal(50);
  const [weather, setWeather] = createSignal<WeatherType>('normal');

  let matchStartTime = Date.now();

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef?.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed', err);
    }
  };

  onMount(() => {
    matchStartTime = Date.now();

    let net: StrikeP2PManager | null = null;

    const eng = new StrikeBabylonEngine(canvasRef, {
      onHealthChange: (hp) => setHealth(hp),
      onAmmoChange: (mag, reserve) => setAmmo({ mag, reserve }),
      onWeaponChange: (w) => {
        setActiveWeapon(w);
      },
      onHitmarker: (isHeadshot) => {
        setHitmarker({ isHeadshot, id: Date.now() });
        setTimeout(() => setHitmarker(null), 250);
      },
      onLocalShoot: (ray, isHeadshot, targetId, part, damage) => {
        net?.registerPlayerShot(ray, isHeadshot, targetId, part, damage);
      },
      onKillAnnouncement: (text) => {
        setMedal({ title: text, sub: '' });
        setTimeout(() => setMedal(null), 2000);
      },
      onScoreboardToggle: (visible) => {
        setShowScoreboard(visible);
      },
      onScopeChange: (scoped) => {
        setIsScoped(scoped);
      },
      onPlayerDeath: (attacker) => {
        net?.registerPlayerDeath(attacker);
      },
      onToggleFullscreen: () => {
        toggleFullscreen();
      }
    });

    eng.setSensitivity(1.2);

    const weatherManager = new StrikeWeatherManager(eng.scene, eng.camera, (w) => {
      setWeather(w);
    });
    setWeather(weatherManager.currentWeather);

    net = new StrikeP2PManager(eng, {
      onScoreboardUpdate: (players) => setScoreboard(players),
      onKillfeedEntry: (entry) => {
        setKillfeed((prev) => [entry, ...prev.slice(0, 4)]);
        setTimeout(() => {
          setKillfeed((prev) => prev.filter((e) => e.id !== entry.id));
        }, 5000);
      },
      onMedalAnnouncement: (title, sub) => {
        setMedal({ title, sub });
        setTimeout(() => setMedal(null), 2000);
      },
      onConnectionStatus: (conn, peers) => {
        setConnected(conn);
        setPeerCount(peers);
      }
    });

    setEngine(eng);
    setNetwork(net);

    // Fetch Supabase credentials for Realtime Matchmaking & P2P DataChannels
    fetch('/api/strike/config')
      .then((res) => res.json())
      .then((cfg) => {
        net?.start(state.user?.username || 'Commander', cfg?.supabaseUrl, cfg?.supabaseAnonKey);
      })
      .catch(() => {
        net?.start(state.user?.username || 'Commander');
      });

    const handleResize = () => eng.handleResize();
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      weatherManager.dispose();
      eng.dispose();
      net?.stop();
    });
  });

  const handleStartPlay = () => {
    setShowControlsOverlay(false);
    canvasRef?.focus?.();
    const eng = engine();
    if (eng) {
      eng.startPlaying();
      eng.requestPointerLock();
    }
  };

  const handleLeaveMatch = async () => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
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

    // Save match stats via API
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
    <div ref={containerRef} class="strike-viewport-container" role="region" aria-label="Waifu Strike FPS">
      {/* 3D Babylon.js WebGL Canvas Viewport */}
      <canvas
        ref={canvasRef}
        class="strike-canvas-wrapper"
        tabindex="1"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          outline: 'none'
        }}
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
      <div class="strike-top-banner" onPointerDown={(e) => e.stopPropagation()}>
        <span class="strike-room-tag">⚡ {t('strike.modeTitle') || 'Waifu Strike DM'}</span>
        <span>⛩️ {t('strike.mapName') || 'Kyoto'}</span>
        <span class="strike-weather-tag" style={{
          color: weather() === 'rain' ? '#70a1ff' : weather() === 'snow' ? '#ffffff' : '#ff9ff3',
          background: 'rgba(255, 255, 255, 0.08)',
          padding: '2px 8px',
          'border-radius': '6px',
          'font-size': '0.85rem'
        }}>
          {weather() === 'rain' ? '🌧️ Rain' : weather() === 'snow' ? '❄️ Snow' : '🌸 Sakura'}
        </span>
        <Show when={peerCount() > 0}>
          <span style={{ color: '#2ed573' }}>👥 {peerCount()} P2P Peer{peerCount() > 1 ? 's' : ''}</span>
        </Show>
        <button
          class="btn-fullscreen-toggle"
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: isFullscreen() ? 'rgba(0, 206, 201, 0.25)' : 'rgba(255, 255, 255, 0.1)',
            border: isFullscreen() ? '1px solid #00cec9' : '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            padding: '2px 10px',
            'border-radius': '6px',
            cursor: 'pointer'
          }}
          onClick={toggleFullscreen}
          title="Toggle Fullscreen (F)"
        >
          {isFullscreen() ? '🗗 Exit Fullscreen [F]' : '⛶ Fullscreen [F]'}
        </button>
        <button
          class="btn-controls-toggle"
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            padding: '2px 10px',
            'border-radius': '6px',
            cursor: 'pointer'
          }}
          onClick={() => {
            if (typeof document !== 'undefined' && document.pointerLockElement) {
              document.exitPointerLock?.();
            }
            engine()?.pausePlaying();
            setShowControlsOverlay(true);
          }}
        >
          ⚙️ Controls
        </button>
        <button
          class="btn-leave-match"
          onPointerDown={(e) => e.stopPropagation()}
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
          <div class={`hud-health-val ${health() <= 25 ? 'low' : ''}`}>
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

        {/* Ammo & Active Weapon Card */}
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
                <span>Quickswitch</span>
                <span class="strike-ctrl-key">Q</span>
              </div>
              <div class="strike-ctrl-pill">
                <span>Cycle Weapons</span>
                <span class="strike-ctrl-key">Scroll / 1-4</span>
              </div>
              <div class="strike-ctrl-pill">
                <span>Scoreboard</span>
                <span class="strike-ctrl-key">Hold Tab</span>
              </div>
              <div class="strike-ctrl-pill">
                <span>Fullscreen</span>
                <span class="strike-ctrl-key">F</span>
              </div>
            </div>

            {/* In-Game Sensitivity & Audio Sliders */}
            <div style={{ 'margin-top': '16px', 'border-top': '1px solid rgba(255, 255, 255, 0.1)', 'padding-top': '14px', display: 'flex', 'flex-direction': 'column', gap: '10px' }}>
              <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'font-size': '0.85rem' }}>
                <span>Mouse Sensitivity ({mouseSens().toFixed(1)})</span>
                <input
                  type="range"
                  min="0.5"
                  max="6.0"
                  step="0.1"
                  value={mouseSens()}
                  onInput={(e) => {
                    const val = parseFloat(e.currentTarget.value);
                    setMouseSens(val);
                    engine()?.setSensitivity(val);
                  }}
                  style={{ width: '130px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'font-size': '0.85rem' }}>
                <span>SFX Volume ({audioVol()}%)</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={audioVol()}
                  onInput={(e) => {
                    const val = parseInt(e.currentTarget.value, 10);
                    setAudioVol(val);
                    strikeAudio.setVolume(val / 100);
                  }}
                  style={{ width: '130px', cursor: 'pointer' }}
                />
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
                'margin-top': '14px'
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
              <span style={{ color: '#00cec9' }}>Cyber Shrine Courtyard (P2P)</span>
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
        <div class="strike-lock-overlay">
          <div class="strike-summary-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🎉 {t('strike.summaryTitle') || 'Match Report'}</h2>
            <p style={{ color: '#a4b0be' }}>
              {t('strike.summarySubtitle') || 'Endless casual deathmatch session results'}
            </p>

            <div class="strike-stat-grid">
              <div class="strike-stat-tile">
                <div class="strike-stat-num">{matchSummary()!.kills}</div>
                <div class="strike-stat-lbl">{t('strike.kills') || 'Kills'}</div>
              </div>
              <div class="strike-stat-tile">
                <div class="strike-stat-num" style={{ color: '#ff7675' }}>
                  {matchSummary()!.deaths}
                </div>
                <div class="strike-stat-lbl">{t('strike.deaths') || 'Deaths'}</div>
              </div>
              <div class="strike-stat-tile">
                <div class="strike-stat-num" style={{ color: '#ffd32a' }}>
                  {matchSummary()!.headshots}
                </div>
                <div class="strike-stat-lbl">{t('strike.headshots') || 'Headshots'}</div>
              </div>
              <div class="strike-stat-tile">
                <div class="strike-stat-num" style={{ color: '#ff7597' }}>
                  {matchSummary()!.bestStreak}
                </div>
                <div class="strike-stat-lbl">{t('strike.bestStreak') || 'Best Streak'}</div>
              </div>
              <div class="strike-stat-tile">
                <div class="strike-stat-num">{matchSummary()!.damageDealt}</div>
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

            {/* Rewards Card */}
            <Show when={matchRewards()}>
              <div style={{
                background: 'rgba(255, 215, 0, 0.1)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                padding: '12px',
                'border-radius': '12px',
                margin: '16px 0',
                display: 'flex',
                'justify-content': 'space-around'
              }}>
                <div>
                  <span style={{ 'font-size': '1.2rem', 'font-weight': 'bold', color: '#ffd700' }}>
                    +{matchRewards()!.coins}
                  </span>
                  <div style={{ 'font-size': '0.75rem', color: '#a4b0be' }}>Gold Coins</div>
                </div>
                <div>
                  <span style={{ 'font-size': '1.2rem', 'font-weight': 'bold', color: '#ff7597' }}>
                    +{matchRewards()!.exp}
                  </span>
                  <div style={{ 'font-size': '0.75rem', color: '#a4b0be' }}>Bond EXP</div>
                </div>
              </div>
            </Show>

            <button
              class="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #00cec9, #0984e3)',
                color: '#fff',
                border: 'none',
                padding: '12px 36px',
                'border-radius': '12px',
                'font-weight': 'bold',
                cursor: 'pointer',
                'font-size': '1.1rem'
              }}
              onClick={handleFinishSummary}
            >
              ✓ Done & Return to Hub
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
