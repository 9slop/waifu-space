import { createSignal, onMount, onCleanup, createEffect, Suspense, Show } from 'solid-js';
import { Router, A } from '@solidjs/router';
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
import { t } from './lib/i18n';
import { WallpaperBackground } from './components/WallpaperBackground';
import { SakuraCanvas } from './components/SakuraCanvas';
import { ToastNotification } from './components/ToastNotification';
import { AuthModal } from './components/AuthModal';
import { LeaderboardModal } from './components/LeaderboardModal';

// Global Styles
import './styles/themes.css';
import './styles/style.css';
import './styles/waifu.css';
import './styles/calendar.css';
import './styles/settings.css';
import './styles/rpg.css';

function AppLayout(props: { children: any }) {
  const [showAuthModal, setShowAuthModal] = createSignal(false);
  let deadlineInterval: any = null;

  onMount(() => {
    loadState();

    // Restore cloud progress for a returning user with a saved session
    if (state.user?.token) {
      loadCloudProgress(state.user.token);
    }

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

  const authModalOpen = () => !state.user || showAuthModal();
  const canDismissAuth = () => !!state.user;

  return (
    <div class="app-shell">
      {/* BACKGROUND WALLPAPER & AMBIENT LAYERS */}
      <WallpaperBackground />
      <SakuraCanvas />

      {/* TOP NAVIGATION BAR */}
      <header class="app-header">
        <A href="/" class="app-brand">
          <span class="brand-icon">🌸</span>
          <span class="brand-name">WaifuSpace</span>
          <span class="brand-tag">v2.0.0</span>
        </A>

        {/* PRIMARY TABS */}
        <nav class="nav-tabs">
          <A href="/calendar" class="nav-tab-btn" activeClass="active">
            <span>📅</span>
            <span>{t('nav.calendar')}</span>
          </A>
          <A href="/minigames" class="nav-tab-btn" activeClass="active">
            <span>🎮</span>
            <span>{t('nav.minigames')}</span>
          </A>
          <A href="/profile" class="nav-tab-btn" activeClass="active">
            <span>👤</span>
            <span>{t('nav.profile')}</span>
          </A>
        </nav>

        {/* RIGHT HEADER META */}
        <div class="header-right">
          <A href="/minigames" class="header-coin-pill" title={t('nav.coinTooltip')}>
            <span>🪙</span>
            <span>{state.rpg ? state.rpg.coins : 0}</span>
          </A>

          <Show when={state.user} fallback={
            <button
              class="header-action-pill btn-login-pill"
              data-testid="header-btn-login"
              onClick={() => setShowAuthModal(true)}
            >
              <span>✨</span>
              <span>{t('nav.login')}</span>
            </button>
          }>
            <div class="user-profile-badge">
              <A href="/profile" class="user-badge-link" title={state.user?.username}>
                <span class="user-avatar-tiny">🌸</span>
                <span class="user-badge-name">{state.user?.username}</span>
              </A>
              <button
                class="btn-header-logout"
                title={t('nav.logout')}
                onClick={() => {
                  setUserAccount(null);
                  showToast(t('auth.logoutSuccess'));
                }}
              >
                🚪
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
