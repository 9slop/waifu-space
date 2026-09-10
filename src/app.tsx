import { createSignal, onMount, onCleanup, createEffect, Suspense } from 'solid-js';
import { Router, A, useLocation } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { state, loadState, showToast, triggerWaifuResponse } from './lib/store';
import { WallpaperBackground } from './components/WallpaperBackground';
import { SakuraCanvas } from './components/SakuraCanvas';
import { ToastNotification } from './components/ToastNotification';

// Global Styles
import './styles/themes.css';
import './styles/style.css';
import './styles/waifu.css';
import './styles/calendar.css';
import './styles/settings.css';
import './styles/rpg.css';

function AppLayout(props: { children: any }) {
  const [clockTime, setClockTime] = createSignal('');
  let clockInterval: any = null;
  let deadlineInterval: any = null;

  onMount(() => {
    loadState();

    // Clock
    const updateClock = () => {
      setClockTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateClock();
    clockInterval = setInterval(updateClock, 1000);

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
      clearInterval(clockInterval);
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

        {/* 3 PRIMARY TABS */}
        <nav class="nav-tabs">
          <A href="/" class="nav-tab-btn" activeClass="active" end={true}>
            <span>🌸</span>
            <span>Companion</span>
          </A>
          <A href="/calendar" class="nav-tab-btn" activeClass="active">
            <span>📅</span>
            <span>Calendar</span>
          </A>
          <A href="/rpg" class="nav-tab-btn" activeClass="active">
            <span>⚔️</span>
            <span>RPG Hub</span>
          </A>
          <A href="/settings" class="nav-tab-btn" activeClass="active">
            <span>⚙️</span>
            <span>Settings</span>
          </A>
        </nav>

        {/* RIGHT HEADER META */}
        <div class="header-right">
          <A href="/rpg" class="header-coin-pill" title="RPG Gold Coins - Click to visit RPG Hub">
            <span>🪙</span>
            <span>{state.rpg ? state.rpg.coins : 0}</span>
          </A>
          <div class="header-clock">{clockTime() || '12:00 PM'}</div>
        </div>
      </header>

      {/* MAIN CONTENT ROUTE */}
      <main class="app-content">
        <Suspense>{props.children}</Suspense>
      </main>

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
