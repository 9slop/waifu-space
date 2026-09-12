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
import { WallpaperBackground } from './components/WallpaperBackground';
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
  PhRunning
} from './components/icons';

// Global Styles
import './styles/themes.css';
import './styles/style.css';
import './styles/waifu.css';
import './styles/calendar.css';
import './styles/settings.css';
import './styles/rpg.css';

function AppLayout(props: { children: any }) {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = createSignal(false);
  const [isAuthChecking, setIsAuthChecking] = createSignal(true);
  const [pendingNavHref, setPendingNavHref] = createSignal<string | null>(null);
  let deadlineInterval: any = null;

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
    document.documentElement.setAttribute('data-theme', state.settings.theme || 'sakura');
    if (state.settings.customAccent) {
      document.documentElement.style.setProperty('--primary-accent', state.settings.customAccent);
    }

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

        showToast(note);
        triggerWaifuResponse(note, 'pout');
      }
    }, 60000);

    onCleanup(() => {
      clearInterval(deadlineInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    });
  });

  createEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', state.settings.theme || 'sakura');
      if (state.settings.customAccent) {
        document.documentElement.style.setProperty('--primary-accent', state.settings.customAccent);
      }
    }
  });

  const authModalOpen = () => !isAuthChecking() && (!state.user || showAuthModal());
  const canDismissAuth = () => !!state.user;

  return (
    <div class="app-shell">
      {/* BACKGROUND WALLPAPER & AMBIENT LAYERS */}
      <WallpaperBackground />
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
