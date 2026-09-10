// Central State Store with LocalStorage Persistence and Event Bus

const STORAGE_KEY = 'waifu_space_data_v1';

const DEFAULT_EVENTS = [
  {
    id: 'evt-1',
    title: 'Morning Sync & Coffee',
    start: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
    allDay: false,
    type: 'event',
    completed: false,
    color: '#ff6584',
    description: 'Quick check-in and plan for today with Waifu',
    location: 'Discord / Workspace'
  },
  {
    id: 'evt-2',
    title: 'Code Review & Sprint Planning',
    start: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(15, 30, 0, 0)).toISOString(),
    allDay: false,
    type: 'event',
    completed: false,
    color: '#6c5ce7',
    description: 'Review features and merge pull requests',
    location: 'Engineering Room'
  },
  {
    id: 'evt-3',
    title: 'Study Japanese Kanji (30 min)',
    start: new Date(new Date().setHours(18, 0, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(18, 30, 0, 0)).toISOString(),
    allDay: false,
    type: 'task',
    completed: false,
    color: '#00cec9',
    description: 'Review N3 vocabulary flashcards',
    location: 'Desk'
  },
  {
    id: 'evt-4',
    title: 'Anime Night with Akari',
    start: new Date(new Date().setHours(21, 0, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(22, 30, 0, 0)).toISOString(),
    allDay: false,
    type: 'event',
    completed: false,
    color: '#fd79a8',
    description: 'Watch the newest seasonal episodes together!',
    location: 'Living Room'
  },
  {
    id: 'evt-5',
    title: "Akari's Birthday Celebration",
    start: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 4).toISOString(),
    end: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 4).toISOString(),
    allDay: true,
    type: 'birthday',
    completed: false,
    color: '#e84393',
    description: 'Special cake and surprise present for Akari!',
    location: 'Home'
  }
];

const DEFAULT_STATE = {
  activeTab: 'main', // 'main' | 'calendar' | 'settings'
  waifu: {
    name: 'Akari',
    personality: 'tsundere', // 'tsundere' | 'kuudere' | 'yandere' | 'deredere' | 'dandere'
    appearance: {
      hairstyle: 'twintails', // 'twintails' | 'long' | 'short_bob' | 'ponytail' | 'wavy'
      hairColor: '#ff7597',
      eyeColor: '#4f86f7',
      skinTone: '#fff1eb',
      outfit: 'seifuku', // 'seifuku' | 'maid' | 'casual' | 'kimono' | 'gothic'
      accessory: 'ribbon', // 'none' | 'cat_ears' | 'glasses' | 'ribbon' | 'headphones'
      customAvatarUrl: '',
      avatarMode: 'svg' // 'svg' | 'custom'
    },
    mood: 'neutral', // 'happy' | 'blush' | 'pout' | 'yandere' | 'surprised' | 'neutral'
    bondLevel: 12,
    bondExp: 45
  },
  calendar: {
    view: 'month', // 'month' | 'week' | 'day'
    selectedDate: new Date().toISOString(),
    events: DEFAULT_EVENTS,
    filterType: 'all' // 'all' | 'event' | 'task' | 'birthday'
  },
  settings: {
    wallpaperId: 'sakura-shrine',
    wallpaperType: 'stock', // 'stock' | 'custom'
    customWallpaperUrl: '',
    wallpaperBlur: 2,
    wallpaperDim: 45,
    sakuraParticles: true,
    theme: 'sakura', // 'sakura' | 'cyberpunk' | 'midnight' | 'matcha' | 'sunset' | 'amoled'
    customAccent: '#ff6584',
    soundEffects: true,
    ttsEnabled: false,
    ttsVoice: '',
    ttsPitch: 1.2,
    ttsRate: 1.0,
    llmProvider: 'none', // 'none' | 'gemini' | 'openai' | 'openrouter'
    llmApiKey: '',
    llmModel: 'gemini-1.5-flash'
  },
  chat: {
    messages: [
      {
        id: 'msg-init',
        sender: 'waifu',
        text: "H-Hey! What took you so long? It's not like I was waiting for you or anything, baka! Check your schedule if you don't want to fall behind!",
        timestamp: new Date().toISOString(),
        emotion: 'pout'
      }
    ]
  }
};

class StateManager {
  constructor() {
    this.state = this.loadState();
    this.listeners = new Map();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Deep merge with defaults so new fields are never missing
        return {
          ...DEFAULT_STATE,
          ...parsed,
          waifu: { ...DEFAULT_STATE.waifu, ...(parsed.waifu || {}), appearance: { ...DEFAULT_STATE.waifu.appearance, ...(parsed.waifu?.appearance || {}) } },
          calendar: { ...DEFAULT_STATE.calendar, ...(parsed.calendar || {}), events: Array.isArray(parsed.calendar?.events) ? parsed.calendar.events : DEFAULT_STATE.calendar.events },
          settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
          chat: { ...DEFAULT_STATE.chat, ...(parsed.chat || {}) }
        };
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage, using defaults', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }

  notify(key, data) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(cb => cb(data, this.state));
    }
    // Also notify parent/ancestor paths (e.g. 'waifu.appearance.hairstyle' notifies 'waifu.appearance' and 'waifu')
    const parts = key.split('.');
    let prefix = '';
    for (let i = 0; i < parts.length - 1; i++) {
      prefix = prefix ? `${prefix}.${parts[i]}` : parts[i];
      if (this.listeners.has(prefix)) {
        this.listeners.get(prefix).forEach(cb => cb(this.get(prefix), this.state));
      }
    }
    // Also notify child paths
    this.listeners.forEach((callbacks, lKey) => {
      if (lKey.startsWith(key + '.')) {
        callbacks.forEach(cb => cb(this.get(lKey), this.state));
      }
    });
    // Also trigger wildcard subscribers
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(cb => cb(key, data, this.state));
    }
  }

  get(path) {
    const parts = path.split('.');
    let curr = this.state;
    for (const part of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[part];
    }
    return curr;
  }

  set(path, value) {
    const parts = path.split('.');
    let curr = this.state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (curr[parts[i]] === undefined) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = value;
    this.saveState();
    this.notify(path, value);
  }

  update(path, updater) {
    const currentVal = this.get(path);
    const newVal = updater(currentVal);
    this.set(path, newVal);
    return newVal;
  }

  // Calendar Event Operations
  addEvent(event) {
    const newEvent = {
      id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      completed: false,
      color: '#ff6584',
      ...event
    };
    this.update('calendar.events', events => [newEvent, ...events]);
    this.gainBondExp(10);
    this.notify('calendar.events.add', newEvent);
    return newEvent;
  }

  updateEvent(id, updates) {
    let updatedEvent = null;
    this.update('calendar.events', events =>
      events.map(ev => {
        if (ev.id === id) {
          updatedEvent = { ...ev, ...updates };
          return updatedEvent;
        }
        return ev;
      })
    );
    if (updatedEvent) {
      this.notify('calendar.events.update', updatedEvent);
    }
    return updatedEvent;
  }

  deleteEvent(id) {
    let deleted = null;
    this.update('calendar.events', events => {
      deleted = events.find(e => e.id === id);
      return events.filter(e => e.id !== id);
    });
    if (deleted) {
      this.notify('calendar.events.delete', deleted);
    }
    return deleted;
  }

  toggleTask(id) {
    const event = this.state.calendar.events.find(e => e.id === id);
    if (!event) return null;
    const isNowCompleted = !event.completed;
    const updated = this.updateEvent(id, { completed: isNowCompleted });
    if (isNowCompleted) {
      this.gainBondExp(15);
      this.notify('calendar.task.completed', updated);
    }
    return updated;
  }

  // Bond & Progression System
  gainBondExp(amount) {
    let bondExp = this.state.waifu.bondExp + amount;
    let bondLevel = this.state.waifu.bondLevel;
    const expNeeded = bondLevel * 50;

    if (bondExp >= expNeeded) {
      bondExp -= expNeeded;
      bondLevel += 1;
      this.notify('waifu.bond.levelup', { level: bondLevel });
    }

    this.set('waifu.bondExp', bondExp);
    this.set('waifu.bondLevel', bondLevel);
  }

  // Chat message management
  addMessage(sender, text, emotion = 'neutral') {
    const message = {
      id: 'msg-' + Date.now(),
      sender,
      text,
      emotion,
      timestamp: new Date().toISOString()
    };
    this.update('chat.messages', msgs => [...msgs, message]);
    if (sender === 'user') {
      this.gainBondExp(5);
    }
    this.notify('chat.message', message);
    return message;
  }

  clearChat() {
    this.set('chat.messages', []);
  }

  // Reset to initial defaults
  resetAll() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.saveState();
    this.notify('reset', this.state);
  }

  exportData() {
    return JSON.stringify(this.state, null, 2);
  }

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.state = {
        ...DEFAULT_STATE,
        ...data
      };
      this.saveState();
      this.notify('reset', this.state);
      return true;
    } catch (e) {
      console.error('Invalid JSON import', e);
      return false;
    }
  }
}

export const store = new StateManager();
