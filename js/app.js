// Application Bootstrap & Orchestrator

import { store } from './state.js';
import { STOCK_WALLPAPERS } from './assets/wallpapers.js';
import { SpeechEngine } from './waifu/speech.js';
import { DialogueEngine } from './waifu/dialogue.js';
import { WaifuAvatar } from './waifu/avatar.js';
import { GoogleCalendar } from './calendar/calendar.js';
import { ChatUI } from './ui/chat.js';
import { SettingsUI } from './ui/settings.js';
import { SakuraParticleSystem } from './ui/particles.js';
import { getRandomGreeting } from './waifu/personality.js';

class WaifuSpaceApp {
  constructor() {
    this.store = store;
    this.speech = new SpeechEngine(this.store);
    this.dialogue = new DialogueEngine(this.store, this.speech);
    this.avatar = null;
    this.calendar = null;
    this.chatUI = null;
    this.settingsUI = null;
    this.particles = null;

    this.init();
  }

  init() {
    this.applyTheme();
    this.applyWallpaper();
    this.initParticles();
    this.bindNavigation();
    this.mountViews();
    this.initGlobalHelpers();
    this.checkTaskDeadlines();

    // Trigger personality-based greeting on initial load if no recent messages
    const messages = this.store.get('chat.messages');
    if (!messages || messages.length === 0) {
      const greeting = getRandomGreeting(this.store.get('waifu.personality'));
      this.dialogue.respond(greeting.text, greeting.mood);
    }
  }

  applyTheme() {
    const theme = this.store.get('settings.theme') || 'sakura';
    const customAccent = this.store.get('settings.customAccent') || '#ff6584';

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--primary-accent', customAccent);
  }

  applyWallpaper() {
    const bgContainer = document.getElementById('app-wallpaper');
    const overlay = document.getElementById('wallpaper-overlay');
    if (!bgContainer) return;

    const wpType = this.store.get('settings.wallpaperType');
    const wpId = this.store.get('settings.wallpaperId');
    const customUrl = this.store.get('settings.customWallpaperUrl');
    const blur = this.store.get('settings.wallpaperBlur') ?? 2;
    const dim = this.store.get('settings.wallpaperDim') ?? 45;

    let imageUrl = '';
    let fallbackGradient = 'linear-gradient(135deg, #1f1435 0%, #3e1b4b 50%, #d85c7a 100%)';

    if (wpType === 'custom' && customUrl) {
      imageUrl = customUrl;
    } else {
      const found = STOCK_WALLPAPERS.find(w => w.id === wpId) || STOCK_WALLPAPERS[0];
      imageUrl = found.url;
      fallbackGradient = found.fallback || fallbackGradient;
    }

    // Set fallback gradient immediately so wallpaper is never black or blank
    bgContainer.style.background = fallbackGradient;
    bgContainer.style.backgroundSize = 'cover';
    bgContainer.style.backgroundPosition = 'center center';
    bgContainer.style.backgroundRepeat = 'no-repeat';

    if (imageUrl) {
      const img = new Image();
      img.onload = () => {
        bgContainer.style.backgroundImage = `url("${imageUrl}")`;
      };
      img.onerror = () => {
        // Keep fallback gradient if image fails
        console.warn(`Wallpaper image failed to load (${imageUrl}), using fallback atmosphere gradient.`);
      };
      img.src = imageUrl;
    }

    bgContainer.style.filter = `blur(${blur}px)`;
    if (overlay) {
      overlay.style.backgroundColor = `rgba(10, 10, 15, ${dim / 100})`;
    }
  }

  initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const enabled = this.store.get('settings.sakuraParticles') ?? true;
    this.particles = new SakuraParticleSystem(canvas, enabled);
  }

  bindNavigation() {
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  switchTab(tabName) {
    this.store.set('activeTab', tabName);

    // Update nav active states
    document.querySelectorAll('.nav-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });

    // Update page container views
    document.querySelectorAll('.app-page-view').forEach(p => {
      p.classList.toggle('active', p.id === `page-${tabName}`);
    });

    // If switching to calendar, trigger refresh layout
    if (tabName === 'calendar' && this.calendar) {
      this.calendar.renderMainCalendar();
    }
  }

  mountViews() {
    // 1. Mount Main Waifu & Chat Stage
    const mainContainer = document.getElementById('page-main');
    this.avatar = new WaifuAvatar(document.createElement('div'), this.store);
    window.__waifuAvatar = this.avatar;

    this.chatUI = new ChatUI(mainContainer, this.store, this.dialogue, this.avatar);

    // 2. Mount Google Calendar
    const calendarContainer = document.getElementById('page-calendar');
    this.calendar = new GoogleCalendar(calendarContainer, this.store, this.dialogue);

    // 3. Mount Settings
    const settingsContainer = document.getElementById('page-settings');
    this.settingsUI = new SettingsUI(settingsContainer, this.store, this.avatar, this.speech);

    // Initial tab
    const initialTab = this.store.get('activeTab') || 'main';
    this.switchTab(initialTab);
  }

  checkTaskDeadlines() {
    // Periodically check if any tasks are impending
    setInterval(() => {
      const now = new Date().getTime();
      const events = this.store.get('calendar.events');
      const upcoming = events.find(e => {
        if (e.type !== 'task' || e.completed) return false;
        const diff = new Date(e.start).getTime() - now;
        return diff > 0 && diff <= 900000; // within next 15 minutes
      });

      if (upcoming && !upcoming._notified) {
        upcoming._notified = true;
        const persona = this.store.get('waifu.personality');
        let note = `Reminder: "${upcoming.title}" is due soon!`;
        if (persona === 'tsundere') note = `Baka! Your task "${upcoming.title}" is starting in less than 15 minutes! Don't slack!`;
        else if (persona === 'yandere') note = `Darling, finish "${upcoming.title}" quickly so you can focus on me~`;

        window.__showToast?.(note);
        this.dialogue.respond(note, 'pout');
      }
    }, 60000);
  }

  initGlobalHelpers() {
    window.__switchTab = (tab) => this.switchTab(tab);
    window.__applyWallpaper = () => this.applyWallpaper();
    window.__applyTheme = () => this.applyTheme();
    window.__toggleParticles = (enable) => {
      if (this.particles) this.particles.toggle(enable);
    };

    window.__showToast = (message) => {
      const toast = document.getElementById('app-toast');
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('visible');
      clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
      }, 3500);
    };
  }
}

// Bootstrap once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.__waifuApp = new WaifuSpaceApp();
});
