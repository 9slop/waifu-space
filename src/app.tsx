import { createSignal, onMount, onCleanup, createEffect, Suspense, Show } from 'solid-js';
import { Router, A, useNavigate } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import {
  state,
  loadState,
  loadCloudProgress,
  showToast,
  triggerWaifuResponse,
  setUserAccount,
  isLeaderboardOpen,
  closeLeaderboard
} from './lib/store';
import { defenseGameActive, setDefenseGameActive } from './lib/defense-bridge';
import { t } from './lib/i18n';
import { configureDmRuntime, initDm, disconnectDm, dmState } from './lib/dm/store';
import { startPresenceAutoDetect } from './lib/dm/presence-auto';
import { startNotificationScheduler, stopNotificationScheduler, sendNotification } from './lib/notifications';
import { SakuraCanvas } from './components/SakuraCanvas';
import { ToastNotification } from './components/ToastNotification';
import { AuthModal } from './components/AuthModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { AvatarFrameOverlay } from './components/AvatarFrame';
import {
  PhFlowerLotus,
  PhCalendar,
  PhGameController,
  PhUserCircle,
  PhCoins,
  PhSparkle,
  PhDoor,
  PhWarning,
  PhRunning,
  PhTimer,
  PhBellRinging
} from './components/icons';

// Global Styles
import './styles/themes.css';
import './styles/style.css';
import './styles/waifu.css';
import './styles/calendar.css';
import './styles/settings.css';
import './styles/rpg.css';
import './styles/timebudget.css';
import './styles/discord.css';

// Legacy theme names from older builds map onto the new palettes.
const LEGACY_THEME_MAP: Record<string, string> = {
  sakura: 'catppuccin',
  amoled: 'catppuccin',
  cyberpunk: 'dracula',
  midnight: 'rose-pine',
  matcha: 'nord',
  sunset: 'gruvbox'
};

function normalizeTheme(theme: string | undefined): string {
  if (!theme) return 'catppuccin';
  return LEGACY_THEME_MAP[theme] ?? theme;
}

function resolveThemeMode(): 'dark' | 'light' {
  const mode = state.settings.themeMode;
  if (mode === 'auto') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return mode;
}

function applyTheme() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', normalizeTheme(state.settings.theme));
  root.setAttribute('data-mode', resolveThemeMode());
  if (state.settings.customAccent) {
    root.style.setProperty('--primary-accent', state.settings.customAccent);
  } else {
    root.style.removeProperty('--primary-accent');
  }
}

function AppLayout(props: { children: any }) {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = createSignal(false);
  const [isAuthChecking, setIsAuthChecking] = createSignal(true);
  const [pendingNavHref, setPendingNavHref] = createSignal<string | null>(null);
  let deadlineInterval: any = null;
  let autoDetectStop: (() => void) | null = null;

  const handleNavClick = (e: MouseEvent, href: string) => {
    if (defenseGameActive()) {
      e.preventDefault();
      setPendingNavHref(href);
    }
  };

  const confirmLeaveDefense = () => {
    const href = pendingNavHref();
    if (href) {
      setDefenseGameActive(false);
      setPendingNavHref(null);
      navigate(href);
    }
  };

  onMount(() => {
    loadState();

    const handle = startPresenceAutoDetect();
    autoDetectStop = handle.stop;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (defenseGameActive()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Restore session via cookie or token
    const restoreSession = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: state.user?.token ? { Authorization: `Bearer ${state.user.token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user && data.token) {
            setUserAccount({
              ...data.user,
              token: data.token
            });
            await loadCloudProgress(data.token);
            return;
          }
        }
      } catch {
        // Offline or network error: keep offline state
      } finally {
        setIsAuthChecking(false);
      }

      if (state.user?.token) {
        loadCloudProgress(state.user.token);
      }
    };
    void restoreSession();

    // Apply theme
    applyTheme();

    // Re-resolve 'auto' theme mode when the OS light/dark preference changes
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: light)');
    const onColorSchemeChange = () => {
      if (state.settings.themeMode === 'auto') applyTheme();
    };
    colorSchemeQuery.addEventListener('change', onColorSchemeChange);

    // Impending task deadline alerts
    deadlineInterval = setInterval(() => {
      const now = Date.now();
      const events = state.calendar.events;
      const upcoming = events.find(e => {
        if (e.type !== 'task' || e.completed) return false;
        const diff = new Date(e.start).getTime() - now;
        return diff > 0 && diff <= 900000; // 15 min
      });

      if (upcoming && !upcoming._notified) {
        upcoming._notified = true;
        const persona = state.waifu.personality;
        let note = `Reminder: "${upcoming.title}" is due soon!`;
        if (persona === 'tsundere') note = `Baka! Your task "${upcoming.title}" is starting in less than 15 minutes! Don't slack!`;
        else if (persona === 'yandere') note = `Darling, finish "${upcoming.title}" quickly so you can focus on me~`;

        triggerWaifuResponse(note, 'pout');
        sendNotification(note, note);
      }
    }, 60000);

    onCleanup(() => {
      colorSchemeQuery.removeEventListener('change', onColorSchemeChange);
      clearInterval(deadlineInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      autoDetectStop?.();
      autoDetectStop = null;
    });
  });

  createEffect(() => {
    applyTheme();
  });

  // Browser-notification scheduler runs globally (every page of the SPA), so a
  // task/event reminder fires whether or not the calendar tab is the active one.
  // The scheduler owns its own visibility/focus catch-up. createEffect never
  // runs during SSR, so this is safe on the server.
  createEffect(() => {
    if (state.settings.notificationsEnabled) {
      startNotificationScheduler();
    } else {
      stopNotificationScheduler();
    }
  });

  // DM realtime is wired once for the whole session and stays alive on every
  // page of the SPA: incoming calls must ring and messages must arrive live
  // whichever tab the peer is on. `getAuth` reads the reactive store so a
  // login/logout is reflected immediately; the effect only re-runs when the
  // user identity actually changes (not on token refreshes from /api/auth/me).
  createEffect(() => {
    const uid = state.user?.id ?? null;
    if (uid) {
      configureDmRuntime({
        getAuth: () => {
          const user = state.user;
          if (!user?.token || !user.id) return null;
          return { token: user.token, id: user.id, username: user.username, avatarUrl: user.avatarUrl };
        }
      });
      void initDm();
    } else {
      void disconnectDm();
    }
  });

  const authModalOpen = () => !isAuthChecking() && (!state.user || showAuthModal());
  const canDismissAuth = () => !!state.user;

  return (
    <div class="app-shell">
      {/* AMBIENT LAYERS (wallpapers render on the profile page only) */}
      <SakuraCanvas />

      {/* TOP NAVIGATION BAR */}
      <header class="app-header">
        <A href="/" class="app-brand" onClick={e => handleNavClick(e, '/')}>
          <span class="brand-icon"><PhFlowerLotus /></span>
          <span class="brand-name">WaifuSpace</span>
          <span class="brand-tag">v2.0.0</span>
        </A>

        {/* PRIMARY TABS */}
        <nav class="nav-tabs">
          <A href="/calendar" class="nav-tab-btn" activeClass="active" onClick={e => handleNavClick(e, '/calendar')}>
            <span><PhCalendar /></span>
            <span>{t('nav.calendar')}</span>
          </A>
          <A href="/minigames" class="nav-tab-btn" activeClass="active" onClick={e => handleNavClick(e, '/minigames')}>
            <span><PhGameController /></span>
            <span>{t('nav.minigames')}</span>
          </A>
          <A href="/timebudget" class="nav-tab-btn" activeClass="active" onClick={e => handleNavClick(e, '/timebudget')}>
            <span><PhTimer /></span>
            <span>{t('timebudget.nav')}</span>
          </A>
          <A href="/profile" class="nav-tab-btn" activeClass="active" onClick={e => handleNavClick(e, '/profile')}>
            <span><PhUserCircle /></span>
            <span>{t('nav.profile')}</span>
          </A>
        </nav>

        {/* RIGHT HEADER META */}
        <div class="header-right">
          <A href="/minigames" class="header-coin-pill" title={t('nav.coinTooltip')} onClick={e => handleNavClick(e, '/minigames')}>
            <span><PhCoins /></span>
            <span>{state.rpg ? state.rpg.coins : 0}</span>
          </A>

          <Show when={state.user && dmState.totalUnread > 0}>
            <A href="/" class="header-dm-unread-pill" data-testid="header-dm-unread" title={t('dm.section')} end={true} onClick={e => handleNavClick(e, '/')}>
              <span><PhBellRinging /></span>
              <span class="header-dm-unread-count">{dmState.totalUnread > 99 ? '99+' : dmState.totalUnread}</span>
            </A>
          </Show>

          <Show when={state.user} fallback={
            <button
              class="header-action-pill btn-login-pill"
              data-testid="header-btn-login"
              onClick={() => setShowAuthModal(true)}
            >
              <span><PhSparkle /></span>
              <span>{t('nav.login')}</span>
            </button>
          }>
            <div class="user-profile-badge">
              <A href="/profile" class="user-badge-link" title={state.user?.username} onClick={e => handleNavClick(e, '/profile')}>
                <div class="user-avatar-tiny-wrap">
                <Show when={state.user?.avatarUrl} fallback={<span class="user-avatar-tiny"><PhFlowerLotus /></span>}>
                  <img
                    src={state.user?.avatarUrl}
                    alt={state.user?.username || 'Avatar'}
                    class="user-avatar-tiny-img"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </Show>
                <AvatarFrameOverlay frameId={state.waifu?.appearance?.avatarFrame} class="user-avatar-tiny-frame" />
              </div>
                <span class="user-badge-name">{state.user?.username}</span>
              </A>
              <button
                class="btn-header-logout"
                title={t('nav.logout')}
                onClick={() => {
                  void fetch('/api/auth/me', { method: 'POST' }).catch(() => {});
                  setUserAccount(null);
                  showToast(t('auth.logoutSuccess'));
                }}
              >
                <PhDoor />
              </button>
            </div>
          </Show>
        </div>
      </header>

      {/* MAIN CONTENT ROUTE */}
      <main class="app-content">
        <Suspense>{props.children}</Suspense>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav class="mobile-bottom-nav" aria-label="Mobile Navigation">
        <A href="/" class="mobile-nav-item" activeClass="active" end={true} onClick={e => handleNavClick(e, '/')}>
          <span class="mobile-nav-icon"><PhFlowerLotus /></span>
          <span class="mobile-nav-label">{t('nav.companion')}</span>
        </A>
        <A href="/calendar" class="mobile-nav-item" activeClass="active" onClick={e => handleNavClick(e, '/calendar')}>
          <span class="mobile-nav-icon"><PhCalendar /></span>
          <span class="mobile-nav-label">{t('nav.calendar')}</span>
        </A>
        <A href="/minigames" class="mobile-nav-item" activeClass="active" onClick={e => handleNavClick(e, '/minigames')}>
          <span class="mobile-nav-icon"><PhGameController /></span>
          <span class="mobile-nav-label">{t('nav.minigames')}</span>
        </A>
        <A href="/timebudget" class="mobile-nav-item" activeClass="active" onClick={e => handleNavClick(e, '/timebudget')}>
          <span class="mobile-nav-icon"><PhTimer /></span>
          <span class="mobile-nav-label">{t('timebudget.nav')}</span>
        </A>
        <A href="/profile" class="mobile-nav-item" activeClass="active" onClick={e => handleNavClick(e, '/profile')}>
          <span class="mobile-nav-icon"><PhUserCircle /></span>
          <span class="mobile-nav-label">{t('nav.profile')}</span>
        </A>
      </nav>

      {/* MODALS */}
      <AuthModal
        isOpen={authModalOpen()}
        canClose={canDismissAuth()}
        onClose={() => setShowAuthModal(false)}
      />

      <LeaderboardModal
        isOpen={isLeaderboardOpen()}
        onClose={closeLeaderboard}
      />

      {/* DEFENSE NAVIGATION LEAVE MODAL */}
      <Show when={pendingNavHref()}>
        <div class="defense-leave-overlay" data-testid="global-defense-leave-modal">
          <div class="defense-leave-modal">
            <h3><PhWarning /> {t('defense.confirmLeaveTitle')}</h3>
            <p>{t('defense.confirmLeaveDesc')}</p>
            <div class="defense-leave-actions">
              <button class="btn-stay" onClick={() => setPendingNavHref(null)}>
                <PhGameController /> {t('defense.stayInGame')}
              </button>
              <button class="btn-leave" onClick={confirmLeaveDefense}>
                <PhRunning /> {t('defense.leaveAnyway')}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* GLOBAL TOAST NOTIFICATION */}
      <ToastNotification />
    </div>
  );
}

export default function App() {
  return (
    <Router
      root={props => (
        <AppLayout>{props.children}</AppLayout>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
