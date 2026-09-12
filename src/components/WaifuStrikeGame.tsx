import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { StrikeBabylonEngine } from '../lib/strike/strike-babylon-engine';
import { StrikeP2PManager } from '../lib/strike/strike-p2p';
import { StrikeWeatherManager, WeatherType } from '../lib/strike/strike-weather';
import {
  WeaponDef,
  ScoreboardPlayer,
  KillfeedEntry,
  StrikeMatchStats,
  StrikeChatMessage,
  StrikeKeybindings,
  DEFAULT_KEYBINDINGS,
  StrikeGraphicsSettings,
  DEFAULT_GRAPHICS_SETTINGS,
  GRAPHICS_PRESETS,
  GraphicsPreset,
  ShadowQuality,
  GrenadeType,
  PlayerLoadout,
  DEFAULT_LOADOUT,
  GRENADE_CATALOG
} from '../lib/strike/strike-types';
import { WEAPON_CATALOG, strikeAudio } from '../lib/strike/strike-weapons';
import { t } from '../lib/i18n';
import { state, addCoins, gainBondExp } from '../lib/store';
import '../styles/strike.css';

const ACTION_LABELS: Record<keyof StrikeKeybindings, string> = {
  forward: 'Move Forward',
  backward: 'Move Backward',
  left: 'Strafe Left',
  right: 'Strafe Right',
  jump: 'Jump',
  crouch: 'Crouch',
  walk: 'Walk / Sneak',
  reload: 'Reload Weapon',
  quickswitch: 'Quickswitch Weapon',
  weapon1: 'Primary Weapon',
  weapon2: 'Alternate Weapon',
  weapon3: 'Sidearm (Deagle)',
  weapon4: 'Melee (Knife / Katana)',
  grenade: 'Throw Grenade',
  loadout: 'Loadout Menu',
  scoreboard: 'Hold Scoreboard',
  fullscreen: 'Fullscreen'
};

function formatKeyName(code: string): string {
  if (!code) return '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Space';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
  if (code === 'Tab') return 'Tab';
  return code;
}

interface WaifuStrikeGameProps {
  onExit?: () => void;
}

export function WaifuStrikeGame(props: WaifuStrikeGameProps) {
  let containerRef!: HTMLDivElement;
  let canvasRef!: HTMLCanvasElement;
  let chatInputRef: HTMLInputElement | undefined;
  let chatScrollRef: HTMLDivElement | undefined;

  const [engine, setEngine] = createSignal<StrikeBabylonEngine | null>(null);
  const [network, setNetwork] = createSignal<StrikeP2PManager | null>(null);

  const [health, setHealth] = createSignal(150);
  const [maxHealth] = createSignal(150);
  const [ammo, setAmmo] = createSignal({ mag: 30, reserve: 90 });
  const [activeWeapon, setActiveWeapon] = createSignal<WeaponDef>(WEAPON_CATALOG.rifle);

  const [hitmarker, setHitmarker] = createSignal<{ isHeadshot: boolean; id: number } | null>(null);
  const [isScoped, setIsScoped] = createSignal(false);
  const [damageVignette, setDamageVignette] = createSignal(0);
  const [showControlsOverlay, setShowControlsOverlay] = createSignal(true);
  const [showScoreboard, setShowScoreboard] = createSignal(false);
  const [showSummaryModal, setShowSummaryModal] = createSignal(false);
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  // ESC Pause Menu Tabs & Key Rebinding
  const [escTab, setEscTab] = createSignal<'controls' | 'graphics'>('controls');
  const loadSavedKeybindings = (): StrikeKeybindings => {
    try {
      const saved = localStorage.getItem('waifu_strike_keybindings');
      if (saved) return { ...DEFAULT_KEYBINDINGS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_KEYBINDINGS };
  };
  const [keybindings, setKeybindings] = createSignal<StrikeKeybindings>(loadSavedKeybindings());
  const [rebindingAction, setRebindingAction] = createSignal<keyof StrikeKeybindings | null>(null);
  const [showEscMenu, setShowEscMenu] = createSignal(false);

  let isClosingEscMenu = false;
  const closeEscMenu = () => {
    isClosingEscMenu = true;
    setShowEscMenu(false);
    engine()?.requestPointerLock();
    setTimeout(() => {
      isClosingEscMenu = false;
    }, 350);
  };

  // Graphics Settings (Low as default for universal device accessibility)
  const loadSavedGraphics = (): StrikeGraphicsSettings => {
    try {
      const saved = localStorage.getItem('waifu_strike_graphics');
      if (saved) return { ...DEFAULT_GRAPHICS_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_GRAPHICS_SETTINGS };
  };
  const [graphicsSettings, setGraphicsSettings] = createSignal<StrikeGraphicsSettings>(loadSavedGraphics());

  const updateGraphicsSettings = (partial: Partial<StrikeGraphicsSettings>) => {
    const updated = { ...graphicsSettings(), ...partial };
    setGraphicsSettings(updated);
    try {
      localStorage.setItem('waifu_strike_graphics', JSON.stringify(updated));
    } catch {}
    engine()?.setGraphicsSettings(updated);
  };

  const applyGraphicsPreset = (preset: GraphicsPreset) => {
    const presetConfig = GRAPHICS_PRESETS[preset];
    if (presetConfig) {
      updateGraphicsSettings(presetConfig);
    }
  };

  // Synchronize pause state: halt local player movement and shooting when in ESC or Loadout menu
  createEffect(() => {
    const eng = engine();
    if (eng) {
      eng.setPaused(showEscMenu() || isLoadoutOpen());
    }
  });

  const [killfeed, setKillfeed] = createSignal<KillfeedEntry[]>([]);
  const [medal, setMedal] = createSignal<{ title: string; sub: string } | null>(null);
  const [chatMessages, setChatMessages] = createSignal<StrikeChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = createSignal(false);
  const [chatInputText, setChatInputText] = createSignal('');
  const [scoreboard, setScoreboard] = createSignal<ScoreboardPlayer[]>([]);
  const [connected, setConnected] = createSignal(false);
  const [peerCount, setPeerCount] = createSignal(0);

  // Tactical Loadout & Grenades
  const loadSavedLoadout = (): PlayerLoadout => {
    try {
      const saved = localStorage.getItem('waifu_strike_loadout');
      if (saved) return { ...DEFAULT_LOADOUT, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_LOADOUT };
  };
  const [loadout, setLoadout] = createSignal<PlayerLoadout>(loadSavedLoadout());
  const [grenadeCount, setGrenadeCount] = createSignal(1);
  const [grenadeType, setGrenadeType] = createSignal<GrenadeType>(loadout().grenade);
  const [isInSmoke, setIsInSmoke] = createSignal(false);
  const [isLoadoutOpen, setIsLoadoutOpen] = createSignal(false);

  const updateLoadout = (partial: Partial<PlayerLoadout>) => {
    const updated = { ...loadout(), ...partial };
    setLoadout(updated);
    try {
      localStorage.setItem('waifu_strike_loadout', JSON.stringify(updated));
    } catch {}
    engine()?.setLoadout(updated);
  };

  const handleSelectPrimary = (weapon: 'rifle' | 'sniper') => {
    updateLoadout({ primary: weapon });
    const eng = engine();
    if (eng && (eng.activeWeaponId === 'rifle' || eng.activeWeaponId === 'sniper')) {
      eng.switchWeapon(weapon);
    }
  };

  const handleSelectMelee = (weapon: 'knife' | 'katana') => {
    updateLoadout({ melee: weapon });
    const eng = engine();
    if (eng && (eng.activeWeaponId === 'knife' || eng.activeWeaponId === 'katana')) {
      eng.switchWeapon(weapon);
    }
  };

  const handleSelectGrenade = (grenade: GrenadeType) => {
    updateLoadout({ grenade });
  };

  const handleCloseLoadout = () => {
    setIsLoadoutOpen(false);
    engine()?.requestPointerLock();
  };

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
      onDamageReceived: (dmg) => {
        setDamageVignette(Math.min(1.0, 0.45 + dmg * 0.015));
        setTimeout(() => {
          setDamageVignette((v) => Math.max(0, v * 0.4));
          setTimeout(() => setDamageVignette(0), 180);
        }, 120);
      },
      onToggleFullscreen: () => {
        toggleFullscreen();
      },
      onGrenadeCountChange: (count, type) => {
        setGrenadeCount(count);
        setGrenadeType(type);
      },
      onSmokeChange: (inSmoke) => {
        setIsInSmoke(inSmoke);
      },
      onLocalGrenadeThrow: (type, origin, velocity) => {
        net?.broadcastGrenadeThrow(type, origin, velocity);
      },
      onLoadoutToggle: (visible) => {
        if (showControlsOverlay() || showSummaryModal()) return;
        if (visible) {
          if (typeof document !== 'undefined' && document.pointerLockElement) {
            document.exitPointerLock?.();
          }
        }
        setIsLoadoutOpen(visible);
      }
    });

    eng.setSensitivity(mouseSens());
    eng.setKeybindings(keybindings());
    eng.setGraphicsSettings(graphicsSettings());
    eng.setLoadout(loadout());

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
        }, 3000);
      },
      onMedalAnnouncement: (title, sub) => {
        setMedal({ title, sub });
        setTimeout(() => setMedal(null), 3000);
      },
      onChatMessage: (msg) => {
        setChatMessages((prev) => [...prev.slice(-49), msg]);
        setTimeout(() => {
          if (chatScrollRef) {
            chatScrollRef.scrollTop = chatScrollRef.scrollHeight;
          }
        }, 20);
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

    const handlePointerLockChange = () => {
      if (isClosingEscMenu) return;
      const plEl = document.pointerLockElement || (document as any).mozPointerLockElement;
      if (!plEl && !showControlsOverlay() && !showSummaryModal() && !isChatOpen() && !isLoadoutOpen()) {
        setShowEscMenu(true);
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const rebindTarget = rebindingAction();
      if (rebindTarget) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape') {
          setRebindingAction(null);
          return;
        }
        const updated = { ...keybindings(), [rebindTarget]: e.code };
        setKeybindings(updated);
        setRebindingAction(null);
        try {
          localStorage.setItem('waifu_strike_keybindings', JSON.stringify(updated));
        } catch {}
        engine()?.setKeybindings(updated);
        return;
      }

      if (showControlsOverlay() || showSummaryModal()) return;

      if ((e.code === (keybindings().loadout || 'KeyB')) && !isChatOpen() && !showEscMenu()) {
        e.preventDefault();
        if (isLoadoutOpen()) {
          setIsLoadoutOpen(false);
          engine()?.requestPointerLock();
        } else {
          if (typeof document !== 'undefined' && document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          setIsLoadoutOpen(true);
        }
      } else if ((e.code === 'Enter' || e.code === 'KeyT') && !isChatOpen() && !showEscMenu() && !isLoadoutOpen()) {
        e.preventDefault();
        if (typeof document !== 'undefined' && document.pointerLockElement) {
          document.exitPointerLock?.();
        }
        setIsChatOpen(true);
        setTimeout(() => {
          chatInputRef?.focus();
        }, 30);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (isChatOpen()) {
          setIsChatOpen(false);
          setChatInputText('');
          engine()?.requestPointerLock();
        } else if (isLoadoutOpen()) {
          setIsLoadoutOpen(false);
          engine()?.requestPointerLock();
        } else if (showEscMenu()) {
          closeEscMenu();
        } else {
          if (typeof document !== 'undefined' && document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          setShowEscMenu(true);
        }
      }
    };

    // Tab switch & Page close automatic cleanup
    const handleVisibilityChange = () => {
      if (document.hidden) {
        eng.pausePlaying();
        eng.setPaused(true);
      } else {
        if (!showEscMenu()) {
          eng.setPaused(false);
        }
      }
    };

    const handleBeforeUnload = () => {
      net?.stop();
      eng.dispose();
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      weatherManager.dispose();
      eng.dispose();
      net?.stop();
    });
  });

  const handleResumeMatch = () => {
    closeEscMenu();
  };

  const handleResetKeybindings = () => {
    const def = { ...DEFAULT_KEYBINDINGS };
    setKeybindings(def);
    setRebindingAction(null);
    try {
      localStorage.removeItem('waifu_strike_keybindings');
    } catch {}
    engine()?.setKeybindings(def);
  };

  const handleToggleRtx = (enabled: boolean) => {
    updateGraphicsSettings({ shadows: enabled ? 'rtx' : 'off' });
  };

  const handleSendChat = (e: Event) => {
    e.preventDefault();
    const text = chatInputText().trim();
    if (text) {
      network()?.sendChatMessage(text);
      setChatInputText('');
    }
    setIsChatOpen(false);
    engine()?.requestPointerLock();
  };

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

      {/* Red Damage Edge Vignette */}
      <Show when={damageVignette() > 0}>
        <div
          class="strike-damage-vignette"
          style={{ opacity: damageVignette().toFixed(2) }}
        />
      </Show>

      {/* Dense Tactical Smoke View Obstruction */}
      <Show when={isInSmoke()}>
        <div
          class="strike-smoke-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            'z-index': 18,
            'pointer-events': 'none',
            background: 'radial-gradient(circle, rgba(215, 222, 232, 0.94) 0%, rgba(170, 180, 195, 0.97) 100%)',
            'backdrop-filter': 'blur(14px)',
            transition: 'opacity 0.25s ease'
          }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            opacity: 0.35,
            color: '#334155',
            'font-family': 'monospace',
            'font-size': '11px',
            'font-weight': 'bold',
            'letter-spacing': '0.25em'
          }}>
            [ VISION OBSTRUCTED - SMOKE SCREEN ]
          </div>
        </div>
      </Show>

      {/* ESC Pause & Settings Menu */}
      <Show when={showEscMenu()}>
        <div
          class="strike-esc-overlay"
          onClick={() => {
            if (!rebindingAction()) {
              handleResumeMatch();
            }
          }}
        >
          <div class="strike-esc-modal" onClick={(e) => e.stopPropagation()}>
            <div class="strike-esc-header">
              <div class="strike-esc-title">
                <h2>⛩️ {t('strike.mapName') || 'Kyoto'} (Tactical 3-Lane)</h2>
                <div class="strike-esc-mode">⚡ {t('strike.modeTitle') || 'Waifu Strike DM'}</div>
              </div>
              <div class="strike-esc-player-count">
                👥 {peerCount() + 1} Player{peerCount() > 0 ? 's' : ''} Online
              </div>
            </div>

            {/* Quick Actions */}
            <div class="strike-esc-actions-bar">
              <button class="btn-esc-resume" onClick={handleResumeMatch}>
                ▶ Resume Match [Esc]
              </button>
            </div>

            {/* Tabs Header */}
            <div class="strike-esc-tabs">
              <button
                class={`strike-esc-tab-btn ${escTab() === 'controls' ? 'active' : ''}`}
                onClick={() => setEscTab('controls')}
              >
                🎮 Controls
              </button>
              <button
                class={`strike-esc-tab-btn ${escTab() === 'graphics' ? 'active' : ''}`}
                onClick={() => setEscTab('graphics')}
              >
                🖥️ Graphics
              </button>
            </div>

            {/* Settings Sections */}
            <div class="strike-esc-content">
              {/* Controls Tab */}
              <Show when={escTab() === 'controls'}>
                <div class="strike-esc-section">
                  <h3>🎮 Controls & Key Rebinding</h3>
                  <p class="strike-esc-hint">Click any key button below to rebind. Press Esc to cancel.</p>

                  <div class="strike-rebind-grid">
                    <For each={Object.entries(ACTION_LABELS) as [keyof StrikeKeybindings, string][]}>
                      {([action, label]) => (
                        <div class="strike-rebind-row">
                          <span>{label}</span>
                          <button
                            class={`strike-rebind-btn ${rebindingAction() === action ? 'is-rebinding' : ''}`}
                            onClick={() => setRebindingAction(rebindingAction() === action ? null : action)}
                          >
                            {rebindingAction() === action ? 'Press key...' : formatKeyName(keybindings()[action])}
                          </button>
                        </div>
                      )}
                    </For>
                  </div>

                  <button class="btn-esc-reset-keys" onClick={handleResetKeybindings}>
                    ↺ Reset to Default Controls
                  </button>
                </div>

                <div class="strike-esc-section">
                  <h3>⚙️ Mouse & Audio</h3>

                  {/* Mouse Sensitivity */}
                  <div class="strike-setting-row">
                    <div>
                      <span class="strike-setting-label">Mouse Sensitivity ({mouseSens().toFixed(1)})</span>
                      <div class="strike-setting-sub">Camera rotation look sensitivity</div>
                    </div>
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
                      style={{ width: '140px', cursor: 'pointer' }}
                    />
                  </div>

                  {/* SFX Volume */}
                  <div class="strike-setting-row">
                    <div>
                      <span class="strike-setting-label">SFX Volume ({audioVol()}%)</span>
                      <div class="strike-setting-sub">Gunfire, footsteps, and tactical announcements</div>
                    </div>
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
                      style={{ width: '140px', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Fullscreen Toggle */}
                  <div class="strike-setting-row">
                    <div>
                      <span class="strike-setting-label">Display Mode</span>
                      <div class="strike-setting-sub">
                        {isFullscreen() ? 'Currently in Fullscreen mode' : 'Currently in Windowed mode'}
                      </div>
                    </div>
                    <button
                      class="btn-fullscreen-toggle"
                      style={{
                        background: isFullscreen() ? 'rgba(0, 206, 201, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                        border: isFullscreen() ? '1px solid #00cec9' : '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        padding: '6px 14px',
                        'border-radius': '6px',
                        cursor: 'pointer',
                        'font-size': '0.85rem'
                      }}
                      onClick={toggleFullscreen}
                    >
                      {isFullscreen() ? '🗗 Exit Fullscreen' : '⛶ Fullscreen'}
                    </button>
                  </div>
                </div>
              </Show>

              {/* Graphics Tab */}
              <Show when={escTab() === 'graphics'}>
                {/* Quality Presets */}
                <div class="strike-esc-section">
                  <h3>🖥️ Quality Presets</h3>
                  <p class="strike-esc-hint">Default is Low for smooth framerates on all devices.</p>
                  <div class="strike-preset-grid">
                    <div
                      class={`strike-preset-card ${graphicsSettings().preset === 'low' ? 'active' : ''}`}
                      onClick={() => applyGraphicsPreset('low')}
                    >
                      <div class="strike-preset-name">Low (Default)</div>
                      <div class="strike-preset-desc">Shadows OFF, max FPS</div>
                    </div>
                    <div
                      class={`strike-preset-card ${graphicsSettings().preset === 'medium' ? 'active' : ''}`}
                      onClick={() => applyGraphicsPreset('medium')}
                    >
                      <div class="strike-preset-name">Medium</div>
                      <div class="strike-preset-desc">Low shadows, 2x filter</div>
                    </div>
                    <div
                      class={`strike-preset-card ${graphicsSettings().preset === 'high' ? 'active' : ''}`}
                      onClick={() => applyGraphicsPreset('high')}
                    >
                      <div class="strike-preset-name">High</div>
                      <div class="strike-preset-desc">Med shadows, 4x filter</div>
                    </div>
                    <div
                      class={`strike-preset-card ${graphicsSettings().preset === 'ultra' ? 'active' : ''}`}
                      onClick={() => applyGraphicsPreset('ultra')}
                    >
                      <div class="strike-preset-name">Ultra RTX</div>
                      <div class="strike-preset-desc">PCSS Soft Shadows, 1.25x</div>
                    </div>
                  </div>
                </div>

                {/* Granular Visual Settings */}
                <div class="strike-esc-section">
                  <h3>⚙️ Granular Visual Settings</h3>

                  {/* Shadows Setting */}
                  <div class="strike-setting-row">
                    <div>
                      <span class="strike-setting-label">Shadow Quality</span>
                      <div class="strike-setting-sub">Real-time dynamic sun & map shadows</div>
                    </div>
                    <div class="strike-segmented-ctrl">
                      <button
                        class={`strike-segment-btn ${graphicsSettings().shadows === 'off' ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ shadows: 'off' })}
                      >
                        Off
                      </button>
                      <button
                        class={`strike-segment-btn ${graphicsSettings().shadows === 'low' ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ shadows: 'low' })}
                      >
                        Low
                      </button>
                      <button
                        class={`strike-segment-btn ${graphicsSettings().shadows === 'medium' ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ shadows: 'medium' })}
                      >
                        Medium
                      </button>
                      <button
                        class={`strike-segment-btn ${graphicsSettings().shadows === 'rtx' ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ shadows: 'rtx' })}
                      >
                        RTX Soft
                      </button>
                    </div>
                  </div>

                  {/* Render Scale */}
                  <div class="strike-setting-row">
                    <div>
                      <span class="strike-setting-label">Hardware Render Scale</span>
                      <div class="strike-setting-sub">Canvas internal resolution scaling</div>
                    </div>
                    <div class="strike-segmented-ctrl">
                      <button
                        class={`strike-segment-btn ${graphicsSettings().renderScale === 0.75 ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ renderScale: 0.75 })}
                      >
                        0.75x (Fast)
                      </button>
                      <button
                        class={`strike-segment-btn ${graphicsSettings().renderScale === 1.0 ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ renderScale: 1.0 })}
                      >
                        1.0x (Native)
                      </button>
                      <button
                        class={`strike-segment-btn ${graphicsSettings().renderScale === 1.25 ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ renderScale: 1.25 })}
                      >
                        1.25x (Crisp)
                      </button>
                    </div>
                  </div>

                  {/* Texture Filtering */}
                  <div class="strike-setting-row">
                    <div>
                      <span class="strike-setting-label">Texture Filtering</span>
                      <div class="strike-setting-sub">Reduces oblique texture blur and shimmering</div>
                    </div>
                    <div class="strike-segmented-ctrl">
                      <button
                        class={`strike-segment-btn ${graphicsSettings().anisotropicFiltering === 1 ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ anisotropicFiltering: 1 })}
                      >
                        1x (Fast)
                      </button>
                      <button
                        class={`strike-segment-btn ${graphicsSettings().anisotropicFiltering === 2 ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ anisotropicFiltering: 2 })}
                      >
                        2x
                      </button>
                      <button
                        class={`strike-segment-btn ${graphicsSettings().anisotropicFiltering === 4 ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ anisotropicFiltering: 4 })}
                      >
                        4x
                      </button>
                      <button
                        class={`strike-segment-btn ${graphicsSettings().anisotropicFiltering === 8 ? 'active' : ''}`}
                        onClick={() => updateGraphicsSettings({ anisotropicFiltering: 8 })}
                      >
                        8x Aniso
                      </button>
                    </div>
                  </div>

                  {/* Field of View */}
                  <div class="strike-setting-row">
                    <div>
                      <span class="strike-setting-label">Field of View ({graphicsSettings().fov || 85}°)</span>
                      <div class="strike-setting-sub">Horizontal camera field of vision (CS default ~85-90°)</div>
                    </div>
                    <input
                      type="range"
                      min="70"
                      max="105"
                      step="1"
                      value={graphicsSettings().fov || 85}
                      onInput={(e) => {
                        const val = parseInt(e.currentTarget.value, 10);
                        updateGraphicsSettings({ fov: val });
                      }}
                      style={{ width: '140px', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Post-Processing Toggle */}
                  <div class="strike-setting-row">
                    <div>
                      <span class="strike-setting-label">Post-Processing & Glow</span>
                      <div class="strike-setting-sub">Vignette shading and bloom enhancements</div>
                    </div>
                    <label class="strike-toggle-switch">
                      <input
                        type="checkbox"
                        checked={graphicsSettings().postProcessing}
                        onChange={(e) => updateGraphicsSettings({ postProcessing: e.currentTarget.checked })}
                      />
                      <span class="strike-toggle-slider" />
                    </label>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Tactical Loadout Customization Modal [B] */}
      <Show when={isLoadoutOpen()}>
        <div class="strike-loadout-overlay" onClick={handleCloseLoadout}>
          <div class="strike-loadout-modal" onClick={(e) => e.stopPropagation()}>
            <div class="strike-loadout-header">
              <div>
                <h2>🎒 Tactical Armory & Loadout</h2>
                <div class="strike-loadout-sub">
                  Select your primary rifle, sidearm, melee blade, and tactical ordnance [Press B or Esc to close]
                </div>
              </div>
              <button class="strike-loadout-close" onClick={handleCloseLoadout}>✕</button>
            </div>

            <div class="strike-loadout-body">
              {/* Category 1: PRIMARY WEAPONS */}
              <div class="strike-loadout-cat">
                <div class="strike-loadout-cat-title">
                  <span>🔫 PRIMARY WEAPON</span>
                  <span class="strike-loadout-cat-hint">Select your main firearm</span>
                </div>
                <div class="strike-loadout-grid">
                  {/* Sakura Rifle */}
                  <div
                    class={`strike-loadout-card ${loadout().primary === 'rifle' ? 'is-equipped' : ''}`}
                    onClick={() => handleSelectPrimary('rifle')}
                  >
                    <div class="loadout-card-top">
                      <span class="loadout-card-tag">Assault Rifle</span>
                      <Show when={loadout().primary === 'rifle'}>
                        <span class="loadout-equipped-badge">EQUIPPED</span>
                      </Show>
                    </div>
                    <div class="loadout-card-name">🌸 Sakura Rifle (AR-47)</div>
                    <div class="loadout-card-desc">Fully automatic assault rifle forged from Kyoto high-tensile steel. Balanced recoil and lethal headshots.</div>
                    <div class="loadout-stats-grid">
                      <div class="loadout-stat"><span class="stat-lbl">Damage</span><span class="stat-val">34 (102 Head)</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Fire Rate</span><span class="stat-val">600 RPM</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Magazine</span><span class="stat-val">30 / 90</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Mobility</span><span class="stat-val">6.0 m/s</span></div>
                    </div>
                  </div>

                  {/* Aether Railgun */}
                  <div
                    class={`strike-loadout-card ${loadout().primary === 'sniper' ? 'is-equipped' : ''}`}
                    onClick={() => handleSelectPrimary('sniper')}
                  >
                    <div class="loadout-card-top">
                      <span class="loadout-card-tag">Marksman Railgun</span>
                      <Show when={loadout().primary === 'sniper'}>
                        <span class="loadout-equipped-badge">EQUIPPED</span>
                      </Show>
                    </div>
                    <div class="loadout-card-name">⚡ Aether Railgun (SR-99)</div>
                    <div class="loadout-card-desc">Electromagnetic particle sniper rifle with long-range zoom scope. Massive stopping power across sightlines.</div>
                    <div class="loadout-stats-grid">
                      <div class="loadout-stat"><span class="stat-lbl">Damage</span><span class="stat-val">52 (78 Head)</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Optic</span><span class="stat-val">Zoom Scope</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Magazine</span><span class="stat-val">5 / 25</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Mobility</span><span class="stat-val">5.2 m/s</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category 2: SECONDARY WEAPON */}
              <div class="strike-loadout-cat">
                <div class="strike-loadout-cat-title">
                  <span>🔫 SECONDARY SIDEARM</span>
                  <span class="strike-loadout-cat-hint">Standard issue heavy sidearm</span>
                </div>
                <div class="strike-loadout-grid">
                  <div class="strike-loadout-card is-equipped">
                    <div class="loadout-card-top">
                      <span class="loadout-card-tag">Heavy Hand Cannon</span>
                      <span class="loadout-equipped-badge">EQUIPPED</span>
                    </div>
                    <div class="loadout-card-name">🦅 Neo Deagle (.50 AE)</div>
                    <div class="loadout-card-desc">High-caliber semi-automatic hand cannon with devastating stopping power and high armor penetration.</div>
                    <div class="loadout-stats-grid">
                      <div class="loadout-stat"><span class="stat-lbl">Damage</span><span class="stat-val">40 (80 Head)</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Fire Rate</span><span class="stat-val">260 RPM</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Magazine</span><span class="stat-val">7 / 35</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Mobility</span><span class="stat-val">6.2 m/s</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category 3: HAND / MELEE WEAPONS */}
              <div class="strike-loadout-cat">
                <div class="strike-loadout-cat-title">
                  <span>🗡️ HAND / MELEE WEAPON</span>
                  <span class="strike-loadout-cat-hint">Choose between sprint agility or lethal sword damage</span>
                </div>
                <div class="strike-loadout-grid">
                  {/* Kitsune Knife */}
                  <div
                    class={`strike-loadout-card ${loadout().melee === 'knife' ? 'is-equipped' : ''}`}
                    onClick={() => handleSelectMelee('knife')}
                  >
                    <div class="loadout-card-top">
                      <span class="loadout-card-tag">Agile Combat Blade</span>
                      <Show when={loadout().melee === 'knife'}>
                        <span class="loadout-equipped-badge">EQUIPPED</span>
                      </Show>
                    </div>
                    <div class="loadout-card-name">🦊 Kitsune Knife</div>
                    <div class="loadout-card-desc">Ultra-lightweight titanium combat dagger. Maximizes movement and sprint speed for swift rotations.</div>
                    <div class="loadout-stats-grid">
                      <div class="loadout-stat"><span class="stat-lbl">Slash</span><span class="stat-val">35 DMG</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Heavy</span><span class="stat-val">65 DMG</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Backstab</span><span class="stat-val">200 DMG (Instant)</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Sprint Speed</span><span class="stat-val" style={{ color: '#00cec9' }}>7.0 m/s (Fastest)</span></div>
                    </div>
                  </div>

                  {/* Muramasa Katana */}
                  <div
                    class={`strike-loadout-card ${loadout().melee === 'katana' ? 'is-equipped' : ''}`}
                    onClick={() => handleSelectMelee('katana')}
                  >
                    <div class="loadout-card-top">
                      <span class="loadout-card-tag">Heavy Samurai Blade</span>
                      <Show when={loadout().melee === 'katana'}>
                        <span class="loadout-equipped-badge">EQUIPPED</span>
                      </Show>
                    </div>
                    <div class="loadout-card-name">⚔️ Muramasa Katana</div>
                    <div class="loadout-card-desc">Forged folded-steel katana with extended reach and devastating damage. Heavier carry weight reduces speed.</div>
                    <div class="loadout-stats-grid">
                      <div class="loadout-stat"><span class="stat-lbl">Slash</span><span class="stat-val" style={{ color: '#ff7597' }}>55 DMG</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Heavy</span><span class="stat-val" style={{ color: '#ff7597' }}>95 DMG</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Backstab</span><span class="stat-val">220 DMG (Instant)</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Sprint Speed</span><span class="stat-val">6.2 m/s (Heavy)</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category 4: TACTICAL GRENADE */}
              <div class="strike-loadout-cat">
                <div class="strike-loadout-cat-title">
                  <span>💣 TACTICAL GRENADE (Pick 1)</span>
                  <span class="strike-loadout-cat-hint">Thrown ordnance equipped every round [G]</span>
                </div>
                <div class="strike-loadout-grid">
                  {/* Molotov */}
                  <div
                    class={`strike-loadout-card ${loadout().grenade === 'molotov' ? 'is-equipped' : ''}`}
                    onClick={() => handleSelectGrenade('molotov')}
                  >
                    <div class="loadout-card-top">
                      <span class="loadout-card-tag">Incendiary</span>
                      <Show when={loadout().grenade === 'molotov'}>
                        <span class="loadout-equipped-badge">EQUIPPED</span>
                      </Show>
                    </div>
                    <div class="loadout-card-name">🍾 Kitsune Molotov</div>
                    <div class="loadout-card-desc">Detonates on ground contact into a 4.5m pool of roaring fire. Denies chokepoints and burns enemies.</div>
                    <div class="loadout-stats-grid">
                      <div class="loadout-stat"><span class="stat-lbl">Damage</span><span class="stat-val">20 DMG/sec (5/0.25s)</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Duration</span><span class="stat-val">6.0s</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Area</span><span class="stat-val">4.5m Radius</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Fuse</span><span class="stat-val">Instant Impact</span></div>
                    </div>
                  </div>

                  {/* Smoke */}
                  <div
                    class={`strike-loadout-card ${loadout().grenade === 'smoke' ? 'is-equipped' : ''}`}
                    onClick={() => handleSelectGrenade('smoke')}
                  >
                    <div class="loadout-card-top">
                      <span class="loadout-card-tag">Vision Denial</span>
                      <Show when={loadout().grenade === 'smoke'}>
                        <span class="loadout-equipped-badge">EQUIPPED</span>
                      </Show>
                    </div>
                    <div class="loadout-card-name">💨 Mist Veil Smoke</div>
                    <div class="loadout-card-desc">Deploys an expanding 5.5m dense aerosol screen for 16s to obstruct sniper sightlines and facilitate safe crosses.</div>
                    <div class="loadout-stats-grid">
                      <div class="loadout-stat"><span class="stat-lbl">Vision</span><span class="stat-val" style={{ color: '#00cec9' }}>Obstructed</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Duration</span><span class="stat-val">16.0s</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Area</span><span class="stat-val">5.5m Radius</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Fuse</span><span class="stat-val">1.5s</span></div>
                    </div>
                  </div>

                  {/* HE Grenade */}
                  <div
                    class={`strike-loadout-card ${loadout().grenade === 'he' ? 'is-equipped' : ''}`}
                    onClick={() => handleSelectGrenade('he')}
                  >
                    <div class="loadout-card-top">
                      <span class="loadout-card-tag">Explosive Frag</span>
                      <Show when={loadout().grenade === 'he'}>
                        <span class="loadout-equipped-badge">EQUIPPED</span>
                      </Show>
                    </div>
                    <div class="loadout-card-name">💣 Type-97 HE Grenade</div>
                    <div class="loadout-card-desc">High-explosive fragmentation grenade dealing devastating blast damage to clear corners and clustered squads.</div>
                    <div class="loadout-stats-grid">
                      <div class="loadout-stat"><span class="stat-lbl">Damage</span><span class="stat-val" style={{ color: '#ffd32a' }}>100 at Center</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Blast Radius</span><span class="stat-val">6.5m Falloff</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Effect</span><span class="stat-val">Screen Shake</span></div>
                      <div class="loadout-stat"><span class="stat-lbl">Fuse</span><span class="stat-val">1.8s</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="strike-loadout-footer">
              <div class="loadout-summary-chips">
                <span class="loadout-chip">Primary: {loadout().primary === 'rifle' ? '🌸 Sakura Rifle' : '⚡ Aether Railgun'}</span>
                <span class="loadout-chip">Melee: {loadout().melee === 'katana' ? '⚔️ Muramasa Katana' : '🦊 Kitsune Knife'}</span>
                <span class="loadout-chip">Grenade: {GRENADE_CATALOG[loadout().grenade]?.icon || '💣'} {GRENADE_CATALOG[loadout().grenade]?.name || 'HE Grenade'}</span>
              </div>
              <button class="btn-loadout-confirm" onClick={handleCloseLoadout}>
                ✔ Equip & Resume Match [Esc / B]
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Tactical Chat Box */}
      <div class="strike-chat-container" onPointerDown={(e) => e.stopPropagation()}>
        <Show when={chatMessages().length > 0 || isChatOpen()}>
          <div ref={chatScrollRef} class={`strike-chat-messages ${isChatOpen() ? 'active' : ''}`}>
            <For each={chatMessages()}>
              {(msg) => (
                <div class={`strike-chat-msg ${msg.isSystem ? 'is-system' : ''}`} style={{ color: msg.color || undefined }}>
                  <Show when={!msg.isSystem}>
                    <span class="strike-chat-sender" style={{ color: '#00cec9' }}>{msg.sender}:</span>
                  </Show>
                  <Show when={msg.isSystem}>
                    <span class="strike-chat-sender" style={{ color: msg.color || '#ffd32a' }}>[{msg.sender}]</span>
                  </Show>
                  <span>{msg.text}</span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={isChatOpen()}>
          <form class="strike-chat-input-bar" onSubmit={handleSendChat}>
            <input
              ref={chatInputRef}
              type="text"
              class="strike-chat-input"
              placeholder="Type message... (Enter to send, Esc to cancel)"
              maxlength="180"
              value={chatInputText()}
              onInput={(e) => setChatInputText(e.currentTarget.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsChatOpen(false);
                  setChatInputText('');
                  engine()?.requestPointerLock();
                }
              }}
            />
            <button type="submit" class="strike-chat-submit">Send</button>
          </form>
        </Show>
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
            class={`hud-weapon-slot ${activeWeapon().id === loadout().primary ? 'active' : ''}`}
            onClick={() => engine()?.switchWeapon(loadout().primary)}
          >
            <span class="hud-slot-key">[1]</span>
            <span>{loadout().primary === 'rifle' ? 'Rifle' : 'Railgun'}</span>
          </div>
          <div
            class={`hud-weapon-slot ${(loadout().primary === 'rifle' ? activeWeapon().id === 'sniper' : activeWeapon().id === 'rifle') ? 'active' : ''}`}
            onClick={() => engine()?.switchWeapon(loadout().primary === 'rifle' ? 'sniper' : 'rifle')}
          >
            <span class="hud-slot-key">[2]</span>
            <span>{loadout().primary === 'rifle' ? 'Railgun' : 'Rifle'}</span>
          </div>
          <div
            class={`hud-weapon-slot ${activeWeapon().id === 'pistol' ? 'active' : ''}`}
            onClick={() => engine()?.switchWeapon('pistol')}
          >
            <span class="hud-slot-key">[3]</span>
            <span>Deagle</span>
          </div>
          <div
            class={`hud-weapon-slot ${activeWeapon().id === loadout().melee ? 'active' : ''}`}
            onClick={() => engine()?.switchWeapon(loadout().melee)}
          >
            <span class="hud-slot-key">[4]</span>
            <span>{loadout().melee === 'katana' ? 'Katana' : 'Knife'}</span>
          </div>
          <div
            class={`hud-weapon-slot ${grenadeCount() > 0 ? '' : 'disabled'}`}
            title="Press G to throw grenade"
            onClick={() => engine()?.throwGrenade()}
          >
            <span class="hud-slot-key">[G]</span>
            <span>{GRENADE_CATALOG[loadout().grenade]?.icon || '💣'} x{grenadeCount()}</span>
          </div>
          <div
            class="hud-weapon-slot"
            title="Press B to customize loadout"
            onClick={() => setIsLoadoutOpen(true)}
          >
            <span class="hud-slot-key">[B]</span>
            <span>Loadout</span>
          </div>
        </div>

        {/* Ammo & Active Weapon Card */}
        <div class="hud-ammo-card">
          <div>
            <span class="hud-ammo-mag">
              {activeWeapon().id === 'knife' || activeWeapon().id === 'katana' ? '∞' : ammo().mag}
            </span>
            <Show when={activeWeapon().id !== 'knife' && activeWeapon().id !== 'katana'}>
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
              <div class="strike-ctrl-pill">
                <span>Chat</span>
                <span class="strike-ctrl-key">Enter / T</span>
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
              <span style={{ color: '#00cec9' }}>Kyoto Tactical Map (P2P)</span>
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
