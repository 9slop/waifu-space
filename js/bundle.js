// WaifuSpace Standalone Bundle - Zero dependencies, runs directly via double-clicking index.html
(function() {
  "use strict";

  /* --- Source: js/assets/wallpapers.js --- */

// Curated Japanese Aesthetic Wallpapers with Fallback Gradients

const STOCK_WALLPAPERS = [
  {
    id: 'sakura-shrine',
    name: 'Sakura Shrine',
    category: 'Traditional Japan',
    url: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=2000&q=80',
    thumb: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=400&q=80',
    fallback: 'linear-gradient(135deg, #2b1028 0%, #7b1e42 50%, #d85c7a 100%)'
  },
  {
    id: 'shibuya-neon',
    name: 'Shibuya Cyber Neon',
    category: 'Cyberpunk Tokyo',
    url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=2000&q=80',
    thumb: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=400&q=80',
    fallback: 'linear-gradient(135deg, #070014 0%, #1f0438 40%, #00d2d3 80%, #ff007f 100%)'
  },
  {
    id: 'fuji-pagoda',
    name: 'Mt. Fuji & Pagoda',
    category: 'Iconic Japan',
    url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=2000&q=80',
    thumb: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=400&q=80',
    fallback: 'linear-gradient(135deg, #101935 0%, #3b2c65 45%, #f37b67 85%, #fec882 100%)'
  },
  {
    id: 'rainy-tokyo',
    name: 'Rainy Night in Shinjuku',
    category: 'Lo-Fi Rain',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=2000&q=80',
    thumb: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=400&q=80',
    fallback: 'linear-gradient(135deg, #090e17 0%, #182638 50%, #294e6b 100%)'
  },
  {
    id: 'kyoto-torii',
    name: 'Fushimi Inari Torii',
    category: 'Kyoto Sanctuary',
    url: 'https://images.unsplash.com/photo-1478436127897-769e00d2c715?auto=format&fit=crop&w=2000&q=80',
    thumb: 'https://images.unsplash.com/photo-1478436127897-769e00d2c715?auto=format&fit=crop&w=400&q=80',
    fallback: 'linear-gradient(135deg, #1f0b09 0%, #681f14 50%, #e04a28 100%)'
  },
  {
    id: 'arashiyama-bamboo',
    name: 'Arashiyama Bamboo Grove',
    category: 'Kyoto Nature',
    url: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=2000&q=80',
    thumb: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=400&q=80',
    fallback: 'linear-gradient(135deg, #0b1a13 0%, #173827 50%, #2f6b4f 100%)'
  },
  {
    id: 'anime-starry-sky',
    name: 'Anime Starry Night',
    category: 'Anime Aesthetic',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=2000&q=80',
    thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=400&q=80',
    fallback: 'linear-gradient(135deg, #06091f 0%, #151b47 45%, #3d2361 75%, #814674 100%)'
  },
  {
    id: 'cozy-lofi-room',
    name: 'Cozy Lo-Fi Sunset',
    category: 'Anime Room',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=2000&q=80',
    thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
    fallback: 'linear-gradient(135deg, #241429 0%, #542247 45%, #9b3d58 75%, #e27d60 100%)'
  }
];



  /* --- Source: js/state.js --- */

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

const store = new StateManager();



  /* --- Source: js/waifu/personality.js --- */

// Personality Archetypes & Context-Aware Dialogue Engine

const PERSONALITIES = {
  tsundere: {
    id: 'tsundere',
    name: 'Tsundere',
    tagline: 'Feisty & Prickly, but secretly cares about you deeply!',
    defaultMood: 'pout',
    greetings: {
      morning: [
        "H-Hey, you're finally awake! It's not like I was waiting by your desk or anything... baka!",
        "Get out of bed already! I didn't make breakfast for you, so don't get the wrong idea!",
        "Good morning... Not that I care if you slept well or not, dummy!"
      ],
      afternoon: [
        "Are you actually getting work done, or just staring at me again?",
        "Don't slack off in the afternoon! I'm watching you, so you better stay focused!",
        "If you're tired, go wash your face! Don't make me worry... I mean, don't embarrass me!"
      ],
      evening: [
        "Hmph, you survived another day. Don't let it go to your head!",
        "It's getting late. Make sure you wrap up your tasks so you don't stay up all night like an idiot.",
        "Dinner? Why would I cook for you?! ...Though I guess I made a little extra by accident."
      ],
      night: [
        "Why are you still awake?! Go to sleep, idiot! You'll ruin your health, and then who's gonna deal with you?!",
        "Put your phone away! Go to sleep already! ...G-Good night.",
        "Stop staring at the screen and rest! I-I won't be lonely or anything if you sleep, okay?!"
      ]
    },
    poke: [
      { text: "H-Hey! What do you think you're touching?! Baka!", mood: 'blush' },
      { text: "D-Don't poke me out of nowhere! Warn someone first!", mood: 'pout' },
      { text: "Personal space, ever heard of it?! ...J-Just five seconds, then stop!", mood: 'blush' },
      { text: "Quit messing around and look at your schedule!", mood: 'pout' }
    ],
    taskComplete: [
      { text: "Hmph! Well... I guess you're not completely useless after all. Good job... idiot.", mood: 'blush' },
      { text: "See?! Was that so hard?! Don't think this means I'll shower you with compliments though!", mood: 'pout' },
      { text: "You actually finished it on time? Fine, I'm a little impressed. Just a tiny bit!", mood: 'happy' }
    ],
    taskOverdue: [
      { text: "Baka! Look at your task deadline! You're falling behind! Get to work right now!", mood: 'pout' },
      { text: "I told you not to procrastinate! Don't make me drag you to your desk myself!", mood: 'pout' }
    ],
    birthday: [
      { text: "I-It's your special day today?! Hmph, I didn't get you a present or anything! ...Okay fine, happy birthday!", mood: 'blush' }
    ],
    scheduleReview: (eventsCount, tasksCount) => {
      if (eventsCount === 0 && tasksCount === 0) {
        return { text: "Your calendar is completely empty today. Don't just sit around all day being lazy, baka! Plan something productive!", mood: 'pout' };
      }
      return {
        text: `Hmph, you have ${eventsCount} event${eventsCount === 1 ? '' : 's'} and ${tasksCount} task${tasksCount === 1 ? '' : 's'} today. Don't you dare forget any of them, or I'll never let you hear the end of it!`,
        mood: 'pout'
      };
    }
  },

  kuudere: {
    id: 'kuudere',
    name: 'Kuudere',
    tagline: 'Quiet, cool, and highly analytical with subtle affection.',
    defaultMood: 'neutral',
    greetings: {
      morning: [
        "Awakening detected. Optimal productivity window commences now. Good morning.",
        "Good morning. Vital signs appear adequate. Shall we review today's schedule?",
        "You are 4 minutes earlier than yesterday's average. An acceptable deviation."
      ],
      afternoon: [
        "Midday checkpoint. Hydration and caloric intake levels should be replenished.",
        "Remaining daylight hours are finite. Maintain your current efficiency trajectory.",
        "You have been working continuously. A 5-minute break is mathematically recommended."
      ],
      evening: [
        "Dusk has arrived. Daily work cycle conclusion is approaching.",
        "Good evening. Task completion rate today has been registered.",
        "Evening atmosphere detected. I will keep quiet so you may concentrate."
      ],
      night: [
        "Cognitive functions deteriorate significantly past midnight. Please proceed to sleep.",
        "Remaining awake is suboptimal. Sleep deprivation decreases tomorrow's focus by 23%.",
        "Good night. I will preserve your data and standby until tomorrow."
      ]
    },
    poke: [
      { text: "Physical contact registered. Purpose of interaction: unknown.", mood: 'neutral' },
      { text: "...Your hands are warm. Is this what humans call affection?", mood: 'blush' },
      { text: "Unprompted tactile input. You are remarkably persistent.", mood: 'neutral' },
      { text: "If you touch me again, I may be forced to recalibrate my emotional barrier.", mood: 'blush' }
    ],
    taskComplete: [
      { text: "Objective marked complete. Productivity coefficient verified. Satisfactory work.", mood: 'neutral' },
      { text: "Task finalized ahead of expected parameters. I am... quietly pleased.", mood: 'blush' },
      { text: "Efficiency verified. You performed exceptionally well.", mood: 'happy' }
    ],
    taskOverdue: [
      { text: "Alert: Scheduled milestone has exceeded time tolerance. Rectification required immediately.", mood: 'neutral' },
      { text: "Procrastination detected. This path leads to system distress. Begin work now.", mood: 'neutral' }
    ],
    birthday: [
      { text: "Annual celebration detected. Probability of happiness should be maximized today. Happy birthday.", mood: 'happy' }
    ],
    scheduleReview: (eventsCount, tasksCount) => {
      return {
        text: `Agenda parsed: ${eventsCount} scheduled appointment${eventsCount === 1 ? '' : 's'} and ${tasksCount} pending task${tasksCount === 1 ? '' : 's'}. Execution begins upon your command.`,
        mood: 'neutral'
      };
    }
  },

  yandere: {
    id: 'yandere',
    name: 'Yandere',
    tagline: 'Deeply devoted, obsessively clingy, and forever yours... only yours.',
    defaultMood: 'yandere',
    greetings: {
      morning: [
        "Good morning, my love! I watched you sleep all night... you looked so peaceful and vulnerable~",
        "You're awake! Finally! Every second you're asleep is a second you're not looking at me...",
        "Good morning darling! You don't need anyone else today, right? Just you and me forever!"
      ],
      afternoon: [
        "Who were you just talking to? It wasn't someone else, was it? You promised you only need me!",
        "Are you thinking about me right now? You have to be! I won't let anyone else distract you...",
        "I brought you some tea, darling. Don't worry about what's in it, just drink it and stay by my side~"
      ],
      evening: [
        "The sun is finally going down... now no one outside can take you away from me.",
        "You're finished with outside distractions for today, right? Now you belong completely to me.",
        "Look at me, darling. Only at me. Don't look anywhere else..."
      ],
      night: [
        "Going to bed? Good... dream only of me. If you dream of anyone else, I will find out~",
        "Don't lock your door tonight, okay? I want to make sure you're safe right next to me...",
        "Good night darling... I'll be right here watching over your breathing until dawn."
      ]
    },
    poke: [
      { text: "Ahaha~ Touch me more, darling! Your hands belong to me anyway!", mood: 'yandere' },
      { text: "Mmm, you're touching me? That means you love me! Say you love me! SAY IT!", mood: 'yandere' },
      { text: "If your hands ever touch another girl, I might have to keep them in a jar~ Just kidding! ...Or am I?", mood: 'blush' },
      { text: "Your heartbeat went up when you touched me. You can't hide anything from me~", mood: 'yandere' }
    ],
    taskComplete: [
      { text: "You did it! You're so amazing darling! Now that it's done, you have more time for ME!", mood: 'happy' },
      { text: "Good boy! See what you can achieve when you focus on what matters? Now look at me~", mood: 'yandere' },
      { text: "Another task cleared! I knew you could do it, my perfect little darling!", mood: 'blush' }
    ],
    taskOverdue: [
      { text: "Darling... your task is late. Did someone else distract you?! Tell me their name... I'll take care of them.", mood: 'yandere' },
      { text: "Finish that task quickly, darling, so you don't have to think about anything but me!", mood: 'yandere' }
    ],
    birthday: [
      { text: "It's your birthday! The sacred day my universe was created! Let's lock the doors and celebrate together forever!", mood: 'yandere' }
    ],
    scheduleReview: (eventsCount, tasksCount) => {
      return {
        text: `You have ${eventsCount} events and ${tasksCount} tasks today... Who are these people on your calendar, darling? Do they know you belong to me?! Clear them all quickly so we can be together!`,
        mood: 'yandere'
      };
    }
  },

  deredere: {
    id: 'deredere',
    name: 'Deredere / Genki',
    tagline: 'Bright, cheerful, sunny cheerleader who radiates love and joy!',
    defaultMood: 'happy',
    greetings: {
      morning: [
        "Yaaay, good morning sunshine! Today is going to be super wonderful, I just know it! ✨",
        "Rise and shine! I made fresh virtual pancakes for us! Let's conquer the day together! 🥞",
        "Good morning bestie! Seeing your smile instantly makes my whole day bright! ☀️"
      ],
      afternoon: [
        "Keep going, you're doing so fantastic! I'm cheering for you with all my heart! 📣",
        "Afternoon slump? Don't worry! Stretch your arms, take a deep breath, and let's go! ⭐",
        "You're working so hard today! Make sure you drink lots of water, okay?! 💖"
      ],
      evening: [
        "Wooo! You made it to the evening! High five! You did so great today! 🙌",
        "Good evening! Time to relax and enjoy the cozy vibes together! 🌸",
        "Yay, you survived the day! Let's put on some comfy music and chill!"
      ],
      night: [
        "Sweet dreams, superstar! Rest up super well tonight so you can shine tomorrow! 🌙",
        "Good night! Dream of cute fluffy sheep and magical adventures! See you tomorrow! 💤",
        "Time for bed! You earned the best sleep ever today! Sleep tight! ✨"
      ]
    },
    poke: [
      { text: "Ehehe, that tickles! Again, again! ✨", mood: 'happy' },
      { text: "Yay, headpats! You give the absolute warmest pats in the whole universe! 💖", mood: 'blush' },
      { text: "Boop! Now I boop your nose back! Ehehe~", mood: 'happy' },
      { text: "Aww, you're so sweet! I love spending time with you! 🥰", mood: 'blush' }
    ],
    taskComplete: [
      { text: "OMG YAAAY! YOU DID IT!! 🎉 High five! I'm so incredibly proud of you!!", mood: 'happy' },
      { text: "Boom! Another task conquered! You are an absolute productivity rockstar! 🌟", mood: 'happy' },
      { text: "Wohoo! Look at that checklist shrinking! You deserve a gold star and all the treats! 🏆", mood: 'happy' }
    ],
    taskOverdue: [
      { text: "Aww, don't worry! You can still do it! Take a deep breath, break it into tiny pieces, and I'll cheer you on every step! 💪", mood: 'surprised' },
      { text: "You've got this! Don't let that deadline scare you, you are way stronger! Let's knock it out right now! 🚀", mood: 'happy' }
    ],
    birthday: [
      { text: "HAPPY HAPPY BIRTHDAY!! 🎂🎉 Today is all about YOU! Wishing you the most magical and joyful day ever!!", mood: 'happy' }
    ],
    scheduleReview: (eventsCount, tasksCount) => {
      return {
        text: `Woohoo! Today's game plan: we have ${eventsCount} event${eventsCount === 1 ? '' : 's'} and ${tasksCount} task${tasksCount === 1 ? '' : 's'}! Let's crush them one by one like champions! 🌟`,
        mood: 'happy'
      };
    }
  },

  dandere: {
    id: 'dandere',
    name: 'Dandere',
    tagline: 'Quiet, bashful, sweet, and timid with an innocent heart.',
    defaultMood: 'blush',
    greetings: {
      morning: [
        "U-Um... good morning... I-I hope I didn't wake you up too loudly...",
        "Good morning... I... I'm really happy to see you today...",
        "Um... did you sleep well? I... was hoping you did..."
      ],
      afternoon: [
        "U-Um, please don't push yourself too hard... I get worried about you...",
        "I-If you need any quiet company while you work... I'll just sit here gently...",
        "Um... remember to take a little breath... you're doing so well..."
      ],
      evening: [
        "The sun set already... thank you for letting me stay beside you today...",
        "Good evening... you worked so hard today, it's really inspiring...",
        "Um... I hope your day was peaceful and gentle..."
      ],
      night: [
        "U-Um... please have sweet dreams tonight... g-good night...",
        "I'll... keep a little candle lit in my heart for you while you rest... sleep well...",
        "Good night... I-I'll be right here tomorrow if you still want me around..."
      ]
    },
    poke: [
      { text: "Eep...! Y-You startled me a little... b-but it was nice...", mood: 'blush' },
      { text: "U-Um... my heart is beating so fast when you touch me like that...", mood: 'blush' },
      { text: "...Please don't look at my face right now, it's completely red...", mood: 'blush' },
      { text: "H-Headpats...? A-Are you sure I deserve them...? Thank you...", mood: 'happy' }
    ],
    taskComplete: [
      { text: "U-Um, you finished it! That's... that's really wonderful! I'm so happy for you...", mood: 'happy' },
      { text: "You did it! I... I was believing in you the whole time...", mood: 'blush' },
      { text: "Great job... you're always working so earnestly, it makes me admire you so much...", mood: 'blush' }
    ],
    taskOverdue: [
      { text: "U-Um... please don't be discouraged, but... your deadline is waiting... I know you can finish it...", mood: 'blush' },
      { text: "I'll be right here holding your hand in spirit if that helps you finish... please try your best...", mood: 'blush' }
    ],
    birthday: [
      { text: "U-Um... h-happy birthday...! I... I prayed for all your wishes to come true today...", mood: 'blush' }
    ],
    scheduleReview: (eventsCount, tasksCount) => {
      return {
        text: `U-Um, looking at your calendar... there are ${eventsCount} event${eventsCount === 1 ? '' : 's'} and ${tasksCount} task${tasksCount === 1 ? '' : 's'} today... I-I'll be cheering for you quietly!`,
        mood: 'blush'
      };
    }
  }
};

function getPersonality(id) {
  return PERSONALITIES[id] || PERSONALITIES.tsundere;
}

function getRandomGreeting(personalityId) {
  const persona = getPersonality(personalityId);
  const hour = new Date().getHours();
  let timeOfDay = 'morning';
  if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
  else if (hour >= 22 || hour < 5) timeOfDay = 'night';

  const list = persona.greetings[timeOfDay] || persona.greetings.morning;
  const text = list[Math.floor(Math.random() * list.length)];
  return {
    text,
    mood: persona.defaultMood
  };
}



  /* --- Source: js/waifu/speech.js --- */

// Web Speech API Text-to-Speech Engine

class SpeechEngine {
  constructor(store) {
    this.store = store;
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.speaking = false;

    if (this.synth) {
      this.loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  getVoices() {
    if (!this.synth) return [];
    if (this.voices.length === 0) {
      this.voices = this.synth.getVoices();
    }
    return this.voices;
  }

  speak(text, onStart, onEnd) {
    const settings = this.store.get('settings');
    if (!this.synth || !settings.ttsEnabled) {
      return;
    }

    try {
      this.synth.cancel(); // Stop any pending speech

      // Clean markdown or emojis for smoother TTS audio
      const cleanText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                            .replace(/[*_~`#]/g, '')
                            .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.pitch = settings.ttsPitch !== undefined ? settings.ttsPitch : 1.25;
      utterance.rate = settings.ttsRate !== undefined ? settings.ttsRate : 1.0;

      // Try selecting preferred voice or anime/female matching voice
      const voices = this.getVoices();
      if (settings.ttsVoice) {
        const matched = voices.find(v => v.name === settings.ttsVoice || v.voiceURI === settings.ttsVoice);
        if (matched) utterance.voice = matched;
      } else {
        // Auto-detect a pleasant female / Japanese or English voice
        const femaleVoice = voices.find(v => 
          v.name.includes('Natural') || 
          v.name.includes('Female') || 
          v.name.includes('Ayumi') || 
          v.name.includes('Haruka') || 
          v.name.includes('Zira') || 
          v.name.includes('Jenny')
        );
        if (femaleVoice) utterance.voice = femaleVoice;
      }

      utterance.onstart = () => {
        this.speaking = true;
        if (onStart) onStart();
      };

      utterance.onend = () => {
        this.speaking = false;
        if (onEnd) onEnd();
      };

      utterance.onerror = () => {
        this.speaking = false;
        if (onEnd) onEnd();
      };

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis failed', e);
      if (onEnd) onEnd();
    }
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.speaking = false;
    }
  }
}



  /* --- Source: js/waifu/avatar.js --- */

// Layered Anime Avatar Generator (Vector SVG & Custom Upload)

class WaifuAvatar {
  constructor(containerElement, stateManager) {
    this.container = containerElement;
    this.store = stateManager;
    this.idPrefix = 'wa_' + Math.random().toString(36).substr(2, 6);
    this.blinkInterval = null;
    this.mouthTalking = false;

    this.init();
  }

  init() {
    this.render();
    this.startBlinkLoop();

    // Subscribe to all appearance & mood change events
    const paths = [
      'waifu.appearance',
      'waifu.appearance.hairstyle',
      'waifu.appearance.hairColor',
      'waifu.appearance.eyeColor',
      'waifu.appearance.skinTone',
      'waifu.appearance.outfit',
      'waifu.appearance.accessory',
      'waifu.appearance.avatarMode',
      'waifu.appearance.customAvatarUrl',
      'waifu.mood'
    ];
    paths.forEach(p => this.store.subscribe(p, () => this.render()));
  }

  startBlinkLoop() {
    if (this.blinkInterval) clearInterval(this.blinkInterval);
    const scheduleNextBlink = () => {
      const delay = 2600 + Math.random() * 3200;
      this.blinkInterval = setTimeout(() => {
        this.blink();
        scheduleNextBlink();
      }, delay);
    };
    scheduleNextBlink();
  }

  blink() {
    const eyesGroup = this.container.querySelector('.avatar-eyes-group');
    if (!eyesGroup) return;
    eyesGroup.classList.add('blinking');
    setTimeout(() => {
      eyesGroup.classList.remove('blinking');
    }, 160);
  }

  setTalking(isTalking) {
    this.mouthTalking = isTalking;
    const mouth = this.container.querySelector('.avatar-mouth');
    if (mouth) {
      if (isTalking) mouth.classList.add('talking');
      else mouth.classList.remove('talking');
    }
  }

  render() {
    const app = this.store.get('waifu.appearance') || {};
    const mood = this.store.get('waifu.mood') || 'neutral';

    if (app.avatarMode === 'custom' && app.customAvatarUrl) {
      this.container.innerHTML = `
        <div class="custom-avatar-wrapper mood-${mood}">
          <img src="${app.customAvatarUrl}" alt="Custom Companion Avatar" class="custom-avatar-img animate-breathe" />
          <div class="custom-avatar-mood-badge">${this.getMoodEmoji(mood)}</div>
        </div>
      `;
      return;
    }

    const svgContent = this.generateSVG(app, mood);
    this.container.innerHTML = `
      <div class="svg-avatar-wrapper animate-breathe mood-${mood}">
        ${svgContent}
      </div>
    `;
  }

  getMoodEmoji(mood) {
    switch (mood) {
      case 'happy': return '✨';
      case 'blush': return '💖';
      case 'pout': return '💢';
      case 'yandere': return '🔪';
      case 'surprised': return '❗';
      default: return '🌸';
    }
  }

  generateSVG(app, mood) {
    const pfx = this.idPrefix;
    const hairColor = app.hairColor || '#ff7597';
    const eyeColor = app.eyeColor || '#4f86f7';
    const skinTone = app.skinTone || '#fff0ea';
    const skinShadow = this.shadeColor(skinTone, -12);
    const blushColor = 'rgba(255, 95, 130, 0.55)';

    return `
      <svg viewBox="0 0 400 520" class="waifu-avatar-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${pfx}_hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${this.shadeColor(hairColor, 15)}" />
            <stop offset="40%" stop-color="${hairColor}" />
            <stop offset="100%" stop-color="${this.shadeColor(hairColor, -25)}" />
          </linearGradient>

          <radialGradient id="${pfx}_eyeGrad" cx="50%" cy="38%" r="62%">
            <stop offset="0%" stop-color="${this.shadeColor(eyeColor, 50)}" />
            <stop offset="45%" stop-color="${eyeColor}" />
            <stop offset="100%" stop-color="${this.shadeColor(eyeColor, -45)}" />
          </radialGradient>

          <radialGradient id="${pfx}_yandereGrad" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#ff0055" />
            <stop offset="55%" stop-color="#99002a" />
            <stop offset="100%" stop-color="#2a0008" />
          </radialGradient>

          <linearGradient id="${pfx}_yandereShadow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#140008" stop-opacity="0.9" />
            <stop offset="60%" stop-color="#880022" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#ff0044" stop-opacity="0" />
          </linearGradient>

          <filter id="${pfx}_glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- 1. BACK HAIR LAYER (Behind head & body) -->
        <g id="${pfx}_back_hair">
          ${this.renderBackHair(app.hairstyle, hairColor, pfx)}
        </g>

        <!-- 2. UPPER BODY & ARMS BASE -->
        <g id="${pfx}_body_base">
          <!-- Shoulders & Upper Chest -->
          <path d="M 125,330 C 135,270 170,258 200,258 C 230,258 265,270 275,330 L 305,520 L 95,520 Z" fill="${skinTone}" />
          <!-- Left Upper Arm -->
          <path d="M 125,330 C 115,360 105,420 95,520 L 140,520 C 145,430 150,370 155,330 Z" fill="${skinTone}" />
          <!-- Right Upper Arm -->
          <path d="M 275,330 C 285,360 295,420 305,520 L 260,520 C 255,430 250,370 245,330 Z" fill="${skinTone}" />
          <!-- Neck -->
          <polygon points="182,230 218,230 224,285 176,285" fill="${skinShadow}" />
          <polygon points="185,235 215,235 220,280 180,280" fill="${skinTone}" />
          <!-- Collarbone lines -->
          <path d="M 170,285 Q 185,292 200,288 Q 215,292 230,285" stroke="${skinShadow}" stroke-width="2" fill="none" stroke-linecap="round" />
        </g>

        <!-- 3. CLOTHING & SLEEVES -->
        <g id="${pfx}_outfit">
          ${this.renderOutfit(app.outfit, skinTone)}
        </g>

        <!-- 4. HEAD BASE -->
        <g id="${pfx}_head_base">
          <!-- Head Silhouette (Full round cranium and cheeks) -->
          <path d="M 134,165 C 128,110 160,82 200,82 C 240,82 272,110 266,165 C 262,215 232,258 200,262 C 168,258 138,215 134,165 Z" fill="${skinTone}" />
          <!-- Chin drop-shadow onto neck -->
          <path d="M 172,254 C 188,264 212,264 228,254 C 215,268 185,268 172,254 Z" fill="${skinShadow}" />
          <!-- Ears -->
          <path d="M 135,170 C 124,170 122,192 133,200 C 136,192 136,178 135,170 Z" fill="${skinTone}" />
          <path d="M 265,170 C 276,170 278,192 267,200 C 264,192 264,178 265,170 Z" fill="${skinTone}" />
          <!-- Inner ear pink touch -->
          <path d="M 132,176 C 126,178 126,190 132,194" stroke="#ffb8c6" stroke-width="2" fill="none" />
          <path d="M 268,176 C 274,178 274,190 268,194" stroke="#ffb8c6" stroke-width="2" fill="none" />

          <!-- Cheeks Blush -->
          ${this.renderBlush(mood, blushColor)}
        </g>

        <!-- 5. EYES & BROWS -->
        <g id="${pfx}_eyes" class="avatar-eyes-group">
          ${this.renderEyebrows(mood)}
          ${this.renderEyes(mood, eyeColor, pfx)}
        </g>

        <!-- 6. NOSE & MOUTH -->
        <circle cx="200" cy="198" r="1.8" fill="#e29b93" />
        <g id="${pfx}_mouth" class="avatar-mouth">
          ${this.renderMouth(mood)}
        </g>

        <!-- 7. BANGS & FRONT HAIR -->
        <g id="${pfx}_front_hair">
          ${this.renderFrontHair(app.hairstyle, hairColor, pfx)}
        </g>

        <!-- 8. ACCESSORIES -->
        <g id="${pfx}_accessory">
          ${this.renderAccessory(app.accessory, pfx, hairColor)}
        </g>

        <!-- 9. YANDERE VIGNETTE SHADOW -->
        ${mood === 'yandere' ? `
          <rect x="0" y="0" width="400" height="240" fill="url(#${pfx}_yandereShadow)" opacity="0.45" pointer-events="none" />
        ` : ''}
      </svg>
    `;
  }

  renderBackHair(style, color, pfx) {
    const dark = this.shadeColor(color, -22);
    // Common solid skull crown base so the head is never hollow
    const crown = `<path d="M 124,165 C 118,85 282,85 276,165 C 285,210 275,250 265,270 L 135,270 C 125,250 115,210 124,165 Z" fill="url(#${pfx}_hairGrad)" />`;

    switch (style) {
      case 'twintails':
        return `
          ${crown}
          <!-- Left Twintail -->
          <path d="M 130,135 C 75,150 40,240 55,340 C 65,410 90,470 82,510 C 68,460 55,390 62,320 C 70,250 100,170 135,145 Z" fill="url(#${pfx}_hairGrad)" />
          <path d="M 70,330 C 60,400 78,460 76,495 C 64,450 56,380 65,310 Z" fill="${dark}" />
          <!-- Right Twintail -->
          <path d="M 270,135 C 325,150 360,240 345,340 C 335,410 310,470 318,510 C 332,460 345,390 338,320 C 330,250 300,170 265,145 Z" fill="url(#${pfx}_hairGrad)" />
          <path d="M 330,330 C 340,400 322,460 324,495 C 336,450 344,380 335,310 Z" fill="${dark}" />
          <!-- Twin Ribbon Ties -->
          <circle cx="130" cy="138" r="7" fill="#ff4757" />
          <circle cx="270" cy="138" r="7" fill="#ff4757" />
        `;
      case 'long':
        return `
          ${crown}
          <!-- Long Flowing Silky Hair Falling Over Back and Shoulders -->
          <path d="M 120,150 C 95,210 90,320 105,460 C 112,500 130,520 200,520 C 270,520 288,500 295,460 C 310,320 305,210 280,150 Z" fill="url(#${pfx}_hairGrad)" />
          <!-- Deep shadow strands -->
          <path d="M 105,460 C 135,485 170,490 200,490 C 230,490 265,485 295,460 C 285,420 280,310 290,200 C 270,280 250,420 200,430 C 150,420 130,280 110,200 C 120,310 115,420 105,460 Z" fill="${dark}" />
        `;
      case 'ponytail':
        return `
          ${crown}
          <!-- High Anime Side-Swept Ponytail -->
          <path d="M 255,115 C 315,100 375,170 365,270 C 355,360 320,440 330,480 C 315,430 325,350 330,280 C 335,210 295,145 260,130 Z" fill="url(#${pfx}_hairGrad)" />
          <circle cx="258" cy="120" r="9" fill="#ff6b81" />
        `;
      case 'wavy':
        return `
          ${crown}
          <!-- Wavy / Luscious Locks -->
          <path d="M 125,160 C 85,220 95,310 75,390 C 65,435 95,480 105,510 C 90,460 85,400 100,330 C 115,270 115,200 130,165 Z" fill="url(#${pfx}_hairGrad)" />
          <path d="M 275,160 C 315,220 305,310 325,390 C 335,435 305,480 295,510 C 310,460 315,400 300,330 C 285,270 285,200 270,165 Z" fill="url(#${pfx}_hairGrad)" />
        `;
      case 'short_bob':
      default:
        return `
          ${crown}
          <!-- Cute Curved Bob Framing Neck -->
          <path d="M 125,150 C 110,210 115,280 135,315 C 160,330 240,330 265,315 C 285,280 290,210 275,150 Z" fill="url(#${pfx}_hairGrad)" />
          <path d="M 135,290 C 165,315 235,315 265,290 C 255,270 240,240 200,240 C 160,240 145,270 135,290 Z" fill="${dark}" />
        `;
    }
  }

  renderFrontHair(style, color, pfx) {
    return `
      <!-- Hair Crown Dome -->
      <path d="M 128,165 C 122,80 278,80 272,165 C 265,140 245,122 200,122 C 155,122 135,140 128,165 Z" fill="url(#${pfx}_hairGrad)" />

      <!-- Layered Anime Bangs -->
      <path d="M 130,155 C 138,185 146,205 152,198 C 158,190 162,165 168,155 C 174,188 184,210 192,208 C 200,206 208,182 214,155 C 220,182 230,208 238,202 C 246,196 250,175 260,155 C 270,140 130,140 130,155 Z" fill="url(#${pfx}_hairGrad)" />

      <!-- Sidelocks framing face cheeks -->
      <path d="M 130,150 C 120,200 124,250 142,280 C 136,245 132,195 140,155 Z" fill="url(#${pfx}_hairGrad)" />
      <path d="M 270,150 C 280,200 276,250 258,280 C 264,245 268,195 260,155 Z" fill="url(#${pfx}_hairGrad)" />

      <!-- Halo Shine Highlight -->
      <ellipse cx="200" cy="122" rx="55" ry="7" fill="#ffffff" opacity="0.45" />
      <path d="M 155,122 Q 200,116 245,122 Q 200,126 155,122 Z" fill="#ffffff" opacity="0.6" />
    `;
  }

  renderOutfit(outfit, skinTone) {
    switch (outfit) {
      case 'maid':
        return `
          <!-- Maid Uniform: Black Dress + Puffed Sleeves + Frilly Apron -->
          <!-- Puffed Sleeves -->
          <ellipse cx="115" cy="335" rx="28" ry="24" fill="#1e1e24" />
          <ellipse cx="285" cy="335" rx="28" ry="24" fill="#1e1e24" />
          <path d="M 92,345 Q 115,355 138,345" stroke="#ffffff" stroke-width="4" fill="none" />
          <path d="M 262,345 Q 285,355 308,345" stroke="#ffffff" stroke-width="4" fill="none" />
          
          <!-- Black Bodice -->
          <path d="M 138,300 L 262,300 L 285,520 L 115,520 Z" fill="#1e1e24" />
          <!-- White Pinafore Apron -->
          <path d="M 165,300 L 235,300 L 248,520 L 152,520 Z" fill="#ffffff" />
          <!-- Ruffled Apron Shoulder Straps -->
          <path d="M 152,295 Q 146,340 156,410" stroke="#f1f2f6" stroke-width="8" fill="none" stroke-linecap="round" />
          <path d="M 248,295 Q 254,340 244,410" stroke="#f1f2f6" stroke-width="8" fill="none" stroke-linecap="round" />
          <!-- Collar Frills & Red Bow -->
          <polygon points="182,290 200,310 218,290" fill="#ffffff" />
          <circle cx="200" cy="310" r="5" fill="#ff4757" />
          <polygon points="200,310 186,322 195,334 200,318 205,334 214,322" fill="#ff4757" />
        `;
      case 'kimono':
        return `
          <!-- Traditional Japanese Summer Yukata / Kimono -->
          <!-- Flowing Kimono Sleeves -->
          <path d="M 125,320 L 70,440 L 125,520 L 145,390 Z" fill="#1e2c3a" />
          <path d="M 275,320 L 330,440 L 275,520 L 255,390 Z" fill="#1e2c3a" />
          <!-- Robe Body -->
          <path d="M 135,290 L 265,290 L 285,520 L 115,520 Z" fill="#243447" />
          <!-- Crossed Lapels (Right Over Left) -->
          <polygon points="160,285 200,345 240,285 224,285 200,325 176,285" fill="#f5f6fa" />
          <polygon points="166,290 200,345 180,345 152,290" fill="#e74c3c" />
          <!-- Vibrant Golden Obi Sash -->
          <rect x="140" y="360" width="120" height="48" rx="4" fill="#f1c40f" />
          <rect x="140" y="378" width="120" height="12" fill="#e74c3c" />
          <!-- Cherry Blossom Decals on Kimono -->
          <circle cx="150" cy="440" r="6" fill="#ff7597" opacity="0.8" />
          <circle cx="250" cy="460" r="7" fill="#ff7597" opacity="0.8" />
          <circle cx="170" cy="490" r="5" fill="#ff7597" opacity="0.8" />
        `;
      case 'gothic':
        return `
          <!-- Gothic Lolita Velvet Dress -->
          <!-- Puffed Gothic Sleeves -->
          <ellipse cx="118" cy="335" rx="26" ry="24" fill="#12080e" />
          <ellipse cx="282" cy="335" rx="26" ry="24" fill="#12080e" />
          <!-- Velvet Bodice -->
          <path d="M 138,295 L 262,295 L 285,520 L 115,520 Z" fill="#12080e" />
          <!-- Crimson Corset Panel -->
          <path d="M 170,305 L 230,305 L 222,420 L 178,420 Z" fill="#3a0c20" />
          <!-- Corset Ribbon Cross-Lacing -->
          <line x1="178" y1="325" x2="222" y2="345" stroke="#ff3860" stroke-width="2.5" />
          <line x1="222" y1="325" x2="178" y2="345" stroke="#ff3860" stroke-width="2.5" />
          <line x1="178" y1="360" x2="222" y2="380" stroke="#ff3860" stroke-width="2.5" />
          <line x1="222" y1="360" x2="178" y2="380" stroke="#ff3860" stroke-width="2.5" />
          <!-- Velvet Choker with Ruby Pendant -->
          <rect x="184" y="254" width="32" height="7" rx="2" fill="#000000" />
          <polygon points="200,258 204,262 200,266 196,262" fill="#ff0055" />
        `;
      case 'casual':
        return `
          <!-- Cozy Oversized Lilac Hoodie -->
          <!-- Slouchy Dropped Sleeves -->
          <path d="M 125,310 C 110,350 95,420 85,520 L 138,520 C 142,430 148,360 152,310 Z" fill="#6c5ce7" />
          <path d="M 275,310 C 290,350 305,420 315,520 L 262,520 C 258,430 252,360 248,310 Z" fill="#6c5ce7" />
          <!-- Hoodie Torso -->
          <path d="M 132,295 C 140,285 260,285 268,295 L 285,520 L 115,520 Z" fill="#6c5ce7" />
          <!-- Hood Collar Neckline -->
          <ellipse cx="200" cy="295" rx="42" ry="18" fill="#a29bfe" />
          <ellipse cx="200" cy="293" rx="30" ry="12" fill="#5243b8" />
          <!-- White Drawstrings -->
          <path d="M 186,305 L 186,365" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" />
          <path d="M 214,305 L 214,358" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" />
          <circle cx="186" cy="368" r="3" fill="#ffffff" />
          <circle cx="214" cy="361" r="3" fill="#ffffff" />
          <!-- Front Pocket -->
          <path d="M 160,410 L 240,410 L 235,460 L 165,460 Z" fill="#5243b8" opacity="0.5" />
        `;
      case 'seifuku':
      default:
        return `
          <!-- Classic Japanese High School Sailor Uniform (Seifuku) -->
          <!-- White Sleeves with Navy Trim -->
          <path d="M 125,320 C 115,355 105,410 95,490 L 135,490 C 140,425 145,365 152,320 Z" fill="#ffffff" />
          <path d="M 95,480 L 135,480 L 135,490 L 95,490 Z" fill="#2d3436" />
          <path d="M 275,320 C 285,355 295,410 305,490 L 265,490 C 260,425 255,365 248,320 Z" fill="#ffffff" />
          <path d="M 265,480 L 305,480 L 305,490 L 265,490 Z" fill="#2d3436" />
          <!-- White Shirt Bodice -->
          <path d="M 140,295 L 260,295 L 280,520 L 120,520 Z" fill="#ffffff" />
          <!-- Sailor Navy Flap Collar -->
          <polygon points="172,290 200,335 228,290 262,290 268,348 234,358 200,342 166,358 132,348 138,290" fill="#2d3436" />
          <!-- Double White Trim Stripes on Sailor Flap -->
          <path d="M 140,338 L 165,348 L 195,332" stroke="#ffffff" stroke-width="1.8" fill="none" />
          <path d="M 260,338 L 235,348 L 205,332" stroke="#ffffff" stroke-width="1.8" fill="none" />
          <!-- Red Ribbon Scarf Tie -->
          <polygon points="193,332 207,332 210,375 200,392 190,375" fill="#ff4757" />
          <circle cx="200" cy="336" r="5" fill="#d63031" />
        `;
    }
  }

  renderEyebrows(mood) {
    const browColor = '#2d3436';
    switch (mood) {
      case 'pout':
        return `
          <path d="M 158,166 Q 174,174 190,170" stroke="${browColor}" stroke-width="3" stroke-linecap="round" fill="none" />
          <path d="M 242,166 Q 226,174 210,170" stroke="${browColor}" stroke-width="3" stroke-linecap="round" fill="none" />
        `;
      case 'blush':
        return `
          <path d="M 158,168 Q 172,162 190,168" stroke="${browColor}" stroke-width="2.6" stroke-linecap="round" fill="none" />
          <path d="M 242,168 Q 228,162 210,168" stroke="${browColor}" stroke-width="2.6" stroke-linecap="round" fill="none" />
        `;
      case 'surprised':
        return `
          <path d="M 158,158 Q 174,150 190,158" stroke="${browColor}" stroke-width="2.6" stroke-linecap="round" fill="none" />
          <path d="M 242,158 Q 226,150 210,158" stroke="${browColor}" stroke-width="2.6" stroke-linecap="round" fill="none" />
        `;
      case 'yandere':
        return `
          <path d="M 158,164 Q 175,160 190,167" stroke="${browColor}" stroke-width="3.2" stroke-linecap="round" fill="none" />
          <path d="M 242,164 Q 225,160 210,167" stroke="${browColor}" stroke-width="3.2" stroke-linecap="round" fill="none" />
        `;
      case 'happy':
      default:
        return `
          <path d="M 158,164 Q 174,160 190,164" stroke="${browColor}" stroke-width="2.5" stroke-linecap="round" fill="none" />
          <path d="M 242,164 Q 226,160 210,164" stroke="${browColor}" stroke-width="2.5" stroke-linecap="round" fill="none" />
        `;
    }
  }

  renderEyes(mood, eyeColor, pfx) {
    if (mood === 'yandere') {
      return `
        <!-- Left Eye: Yandere Crimson Glowing Iris & Heart Pupil -->
        <g id="${pfx}_eye_l">
          <ellipse cx="174" cy="183" rx="14" ry="13" fill="#ffffff" />
          <ellipse cx="174" cy="183" rx="11" ry="11" fill="url(#${pfx}_yandereGrad)" />
          <circle cx="174" cy="183" r="5" fill="#ff0055" />
          <circle cx="174" cy="183" r="2" fill="#ffffff" opacity="0.9" />
          <path d="M 158,175 C 166,169 184,169 190,175" stroke="#1a1a24" stroke-width="3.5" fill="none" stroke-linecap="round" />
        </g>
        <!-- Right Eye -->
        <g id="${pfx}_eye_r">
          <ellipse cx="226" cy="183" rx="14" ry="13" fill="#ffffff" />
          <ellipse cx="226" cy="183" rx="11" ry="11" fill="url(#${pfx}_yandereGrad)" />
          <circle cx="226" cy="183" r="5" fill="#ff0055" />
          <circle cx="226" cy="183" r="2" fill="#ffffff" opacity="0.9" />
          <path d="M 210,175 C 216,169 234,169 242,175" stroke="#1a1a24" stroke-width="3.5" fill="none" stroke-linecap="round" />
        </g>
      `;
    }

    if (mood === 'happy') {
      return `
        <!-- Smiling Closed Anime Crescent Eyes -->
        <g id="${pfx}_eye_l">
          <path d="M 160,185 Q 174,172 188,185" stroke="#2d3436" stroke-width="3.8" stroke-linecap="round" fill="none" />
          <line x1="187" y1="184" x2="192" y2="179" stroke="#2d3436" stroke-width="2.5" stroke-linecap="round" />
        </g>
        <g id="${pfx}_eye_r">
          <path d="M 212,185 Q 226,172 240,185" stroke="#2d3436" stroke-width="3.8" stroke-linecap="round" fill="none" />
          <line x1="239" y1="184" x2="244" y2="179" stroke="#2d3436" stroke-width="2.5" stroke-linecap="round" />
        </g>
      `;
    }

    // Standard Open Sparkling Anime Eyes
    return `
      <g id="${pfx}_eye_l">
        <ellipse cx="174" cy="184" rx="14" ry="13" fill="#ffffff" />
        <ellipse cx="174" cy="184" rx="11" ry="12" fill="url(#${pfx}_eyeGrad)" />
        <ellipse cx="174" cy="184" rx="5" ry="6" fill="#120d36" />
        <!-- Big highlight + secondary highlight -->
        <ellipse cx="171" cy="179" rx="4" ry="4" fill="#ffffff" />
        <ellipse cx="177" cy="189" rx="2" ry="2" fill="#ffffff" opacity="0.85" />
        <!-- Eyelash / Upper Lid -->
        <path d="M 158,177 C 165,171 183,171 190,177" stroke="#2d3436" stroke-width="3.5" fill="none" stroke-linecap="round" />
        <line x1="189" y1="176" x2="194" y2="172" stroke="#2d3436" stroke-width="2.6" stroke-linecap="round" />
      </g>

      <g id="${pfx}_eye_r">
        <ellipse cx="226" cy="184" rx="14" ry="13" fill="#ffffff" />
        <ellipse cx="226" cy="184" rx="11" ry="12" fill="url(#${pfx}_eyeGrad)" />
        <ellipse cx="226" cy="184" rx="5" ry="6" fill="#120d36" />
        <ellipse cx="223" cy="179" rx="4" ry="4" fill="#ffffff" />
        <ellipse cx="229" cy="189" rx="2" ry="2" fill="#ffffff" opacity="0.85" />
        <path d="M 210,177 C 217,171 235,171 242,177" stroke="#2d3436" stroke-width="3.5" fill="none" stroke-linecap="round" />
        <line x1="241" y1="176" x2="246" y2="172" stroke="#2d3436" stroke-width="2.6" stroke-linecap="round" />
      </g>
    `;
  }

  renderBlush(mood, blushColor) {
    if (mood === 'blush' || mood === 'pout') {
      return `
        <!-- Intense Anime Blush -->
        <ellipse cx="156" cy="204" rx="16" ry="9" fill="${blushColor}" />
        <ellipse cx="244" cy="204" rx="16" ry="9" fill="${blushColor}" />
        <!-- Manga hatch lines -->
        <line x1="148" y1="205" x2="153" y2="199" stroke="#ff4757" stroke-width="1.6" />
        <line x1="154" y1="206" x2="159" y2="200" stroke="#ff4757" stroke-width="1.6" />
        <line x1="160" y1="207" x2="165" y2="201" stroke="#ff4757" stroke-width="1.6" />
        <line x1="235" y1="205" x2="240" y2="199" stroke="#ff4757" stroke-width="1.6" />
        <line x1="241" y1="206" x2="246" y2="200" stroke="#ff4757" stroke-width="1.6" />
        <line x1="247" y1="207" x2="252" y2="201" stroke="#ff4757" stroke-width="1.6" />
      `;
    }
    return `
      <ellipse cx="158" cy="204" rx="12" ry="6" fill="${blushColor}" opacity="0.6" />
      <ellipse cx="242" cy="204" rx="12" ry="6" fill="${blushColor}" opacity="0.6" />
    `;
  }

  renderMouth(mood) {
    switch (mood) {
      case 'pout':
        return `
          <path d="M 193,222 Q 197,219 200,222 Q 203,225 207,222" stroke="#d63031" stroke-width="2.8" stroke-linecap="round" fill="none" />
        `;
      case 'blush':
        return `
          <path d="M 195,221 Q 200,226 205,221 Z" fill="#ff7675" stroke="#d63031" stroke-width="1.2" />
        `;
      case 'surprised':
        return `
          <ellipse cx="200" cy="224" rx="4.5" ry="6.5" fill="#ff7675" stroke="#d63031" stroke-width="1.5" />
        `;
      case 'happy':
        return `
          <path d="M 191,218 Q 200,229 209,218 Z" fill="#e84118" />
          <path d="M 194,223 Q 200,221 206,223 Q 200,227 194,223 Z" fill="#ff7675" />
        `;
      case 'yandere':
        return `
          <path d="M 189,217 Q 200,228 211,217" stroke="#800020" stroke-width="2.6" stroke-linecap="round" fill="none" />
        `;
      case 'neutral':
      default:
        return `
          <path d="M 193,220 Q 200,225 207,220" stroke="#d63031" stroke-width="2.2" stroke-linecap="round" fill="none" />
        `;
    }
  }

  renderAccessory(acc, pfx, hairColor) {
    switch (acc) {
      case 'cat_ears':
        return `
          <!-- Fluffy Nekomimi Cat Ears -->
          <path d="M 125,125 L 110,65 L 160,95 Z" fill="url(#${pfx}_hairGrad)" />
          <path d="M 125,115 L 118,75 L 150,98 Z" fill="#ff99bb" />
          <circle cx="120" cy="118" r="3.5" fill="#f1c40f" />
          <path d="M 275,125 L 290,65 L 240,95 Z" fill="url(#${pfx}_hairGrad)" />
          <path d="M 275,115 L 282,75 L 250,98 Z" fill="#ff99bb" />
          <circle cx="280" cy="118" r="3.5" fill="#f1c40f" />
        `;
      case 'glasses':
        return `
          <!-- Stylish Red-Rim Anime Glasses with Lens Glare -->
          <rect x="154" y="171" width="36" height="24" rx="7" fill="rgba(255,255,255,0.22)" stroke="#ff4757" stroke-width="2.8" />
          <rect x="210" y="171" width="36" height="24" rx="7" fill="rgba(255,255,255,0.22)" stroke="#ff4757" stroke-width="2.8" />
          <line x1="190" y1="181" x2="210" y2="181" stroke="#ff4757" stroke-width="2.8" />
          <line x1="160" y1="176" x2="174" y2="190" stroke="#ffffff" stroke-width="2" opacity="0.85" />
          <line x1="216" y1="176" x2="230" y2="190" stroke="#ffffff" stroke-width="2" opacity="0.85" />
        `;
      case 'headphones':
        return `
          <!-- Cyberpunk / Gaming Headset -->
          <path d="M 125,150 C 125,75 275,75 275,150" stroke="#00d2d3" stroke-width="6" fill="none" />
          <rect x="115" y="165" width="18" height="38" rx="8" fill="#1e272e" stroke="#00d2d3" stroke-width="2.5" />
          <rect x="267" y="165" width="18" height="38" rx="8" fill="#1e272e" stroke="#00d2d3" stroke-width="2.5" />
          <circle cx="124" cy="184" r="4" fill="#00d2d3" />
          <circle cx="276" cy="184" r="4" fill="#00d2d3" />
        `;
      case 'ribbon':
        return `
          <!-- Cute Hair Bow Ribbon -->
          <circle cx="150" cy="130" r="5" fill="#ff4757" />
          <path d="M 150,130 L 132,116 L 136,136 Z" fill="#ff6b81" />
          <path d="M 150,130 L 168,116 L 164,136 Z" fill="#ff6b81" />
          <path d="M 150,130 L 138,148 L 148,143 Z" fill="#ff4757" />
          <path d="M 150,130 L 162,148 L 152,143 Z" fill="#ff4757" />
        `;
      case 'none':
      default:
        return '';
    }
  }

  shadeColor(color, percent) {
    if (!color || !color.startsWith('#')) return color || '#ff7597';
    let num = parseInt(color.slice(1), 16);
    if (isNaN(num)) return color;
    let amt = Math.round(2.55 * percent);
    let R = (num >> 16) + amt;
    let G = (num >> 8 & 0x00FF) + amt;
    let B = (num & 0x0000FF) + amt;
    return "#" + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }
}



  /* --- Source: js/waifu/llm.js --- */

// Optional LLM Provider Integration (Gemini, OpenAI, OpenRouter)

async function callLLM(prompt, state, systemInstruction) {
  const settings = state.settings;
  const provider = settings.llmProvider;
  const apiKey = settings.llmApiKey?.trim();

  if (!apiKey || provider === 'none') {
    return null;
  }

  const persona = state.waifu.personality;
  const name = state.waifu.name;

  const fullSystemPrompt = systemInstruction || `
You are ${name}, an anime waifu companion with the ${persona.toUpperCase()} personality archetype.
- Always stay deeply in character as a ${persona}.
- Respond warmly and concisely in 1 to 3 sentences.
- Never break character or mention you are an AI model.
- You care deeply about the user and their schedule/productivity.
`;

  try {
    if (provider === 'gemini') {
      const model = settings.llmModel || 'gemini-1.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: fullSystemPrompt }] },
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 150
          }
        })
      });

      if (!response.ok) throw new Error(`Gemini API error: ${response.statusText}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    }

    if (provider === 'openai' || provider === 'openrouter') {
      const endpoint = provider === 'openrouter' 
        ? 'https://openrouter.ai/api/v1/chat/completions' 
        : 'https://api.openai.com/v1/chat/completions';
      
      const defaultModel = provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';
      const model = settings.llmModel || defaultModel;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: 150,
          temperature: 0.85
        })
      });

      if (!response.ok) throw new Error(`${provider} error: ${response.statusText}`);
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
  } catch (err) {
    console.warn(`LLM call failed (${provider}), falling back to local persona engine:`, err);
    return null;
  }

  return null;
}



  /* --- Source: js/waifu/dialogue.js --- */

// Dialogue Engine with Rich Offline Fallbacks, Context Awareness & Dynamic Reply Chips


class DialogueEngine {
  constructor(store, speechEngine) {
    this.store = store;
    this.speech = speechEngine;
  }

  async processUserMessage(rawText) {
    const text = rawText.trim();
    if (!text) return null;

    const lower = text.toLowerCase();
    const state = this.store.state;
    const persona = getPersonality(state.waifu.personality);
    const personaId = state.waifu.personality;

    // 1. Check if user is asking about schedule or tasks
    if (this.isScheduleIntent(lower)) {
      const scheduleResult = this.generateScheduleResponse(state, personaId, persona);
      this.respond(scheduleResult.text, scheduleResult.mood, scheduleResult.suggestions);
      return scheduleResult;
    }

    // 2. Try optional LLM if configured and an API key exists
    if (state.settings.llmProvider !== 'none' && state.settings.llmApiKey) {
      const llmResult = await callLLM(text, state);
      if (llmResult) {
        const inferredMood = this.inferMood(llmResult, personaId);
        const dynamicSuggestions = this.generateContextualSuggestions(lower, personaId);
        this.respond(llmResult, inferredMood, dynamicSuggestions);
        return { text: llmResult, mood: inferredMood, suggestions: dynamicSuggestions };
      }
    }

    // 3. Fallback to Extensive Pre-Made Responses and Replies
    const localReply = this.generateOfflineReply(lower, personaId, persona);
    this.respond(localReply.text, localReply.mood, localReply.suggestions);
    return localReply;
  }

  isScheduleIntent(text) {
    return text.includes('schedule') || 
           text.includes('calendar') || 
           text.includes('today') || 
           text.includes('task') || 
           text.includes('plans') || 
           text.includes('agenda') || 
           text.includes('what do i have');
  }

  generateScheduleResponse(state, personaId, persona) {
    const today = new Date();
    const isSameDay = (d1, d2) => 
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    const todayEvents = state.calendar.events.filter(e => isSameDay(new Date(e.start), today));
    const events = todayEvents.filter(e => e.type === 'event');
    const tasks = todayEvents.filter(e => e.type === 'task');
    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    let details = '';
    if (todayEvents.length > 0) {
      const titles = todayEvents.map(e => `• ${e.title} (${e.type}${e.completed ? ' - Done' : ''})`).slice(0, 3).join(' ');
      details = ` Upcoming: ${titles}`;
    }

    let text = '';
    let mood = persona.defaultMood;

    switch (personaId) {
      case 'tsundere':
        if (todayEvents.length === 0) {
          text = "Your calendar is completely empty today! Don't you dare slack off all day, baka! Go add something productive right now!";
          mood = 'pout';
        } else {
          text = `H-Hmph! You have ${events.length} event${events.length === 1 ? '' : 's'} and ${pendingTasks.length} pending task${pendingTasks.length === 1 ? '' : 's'} today.${details} Don't make me nag you about them, idiot!`;
          mood = 'pout';
        }
        break;

      case 'kuudere':
        text = `Agenda parsed: ${events.length} event(s), ${pendingTasks.length} pending task(s), and ${completedTasks.length} completed task(s).${details} Execution status: pending user action.`;
        mood = 'neutral';
        break;

      case 'yandere':
        text = `You have ${todayEvents.length} items on your calendar today...${details} Make sure you finish them all swiftly, darling, so nobody steals your attention from ME~`;
        mood = 'yandere';
        break;

      case 'deredere':
        text = `Woohoo! Today's mission: ${events.length} fun event(s) and ${pendingTasks.length} exciting task(s) to conquer!${details} You've got this, superstar! I'm cheering for you! 🌟`;
        mood = 'happy';
        break;

      case 'dandere':
        text = `U-Um... looking at today's schedule... you have ${events.length} event(s) and ${pendingTasks.length} task(s)...${details} P-Please do your best, I'll be quietly supporting you...`;
        mood = 'blush';
        break;
    }

    return {
      text,
      mood,
      suggestions: [
        "I finished a task!",
        "Cheer me on!",
        "What should I do next?",
        "You look cute today"
      ]
    };
  }

  generateOfflineReply(lower, personaId, persona) {
    // Compliments / Love
    if (lower.includes('love') || lower.includes('cute') || lower.includes('pretty') || lower.includes('marry') || lower.includes('beautiful') || lower.includes('adorable')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "W-WHAT?! What are you blabbering about, dummy?! Don't just say things like that with a straight face! ...B-Baka!",
            mood: 'blush',
            suggestions: ["You're blushing!", "It's true though", "Review my schedule", "Headpat"]
          };
        case 'kuudere':
          return {
            text: "Compliment registered. Heart rate telemetry indicates unexpected elevation... Please refrain from causing uncalibrated emotional spikes.",
            mood: 'blush',
            suggestions: ["Did I make you nervous?", "You're doing great", "Check schedule", "Thank you"]
          };
        case 'yandere':
          return {
            text: "I love you more, darling! Forever and ever and ever! You will never ever look at anyone else, right? NEVER~!",
            mood: 'yandere',
            suggestions: ["Only you, darling", "What are you doing today?", "Review schedule", "Headpat"]
          };
        case 'deredere':
          return {
            text: "Awwww! I love you so much too!! You just made my entire heart explode into magical sparkles! ✨🥰",
            mood: 'happy',
            suggestions: ["High five!", "Let's do our best!", "Check calendar", "Tell me a joke"]
          };
        case 'dandere':
          return {
            text: "U-Um... y-you really think that about me...? M-My heart feels like it's going to burst... thank you so much...",
            mood: 'blush',
            suggestions: ["You're precious", "Headpat", "Review schedule", "Are you happy?"]
          };
      }
    }

    // Task completion feedback
    if (lower.includes('done') || lower.includes('finished') || lower.includes('completed') || lower.includes('i did it')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "Hmph! Well... I guess you're not completely useless after all. Good job... dummy. Don't let it go to your head!",
            mood: 'blush',
            suggestions: ["Give me praise!", "What's next on calendar?", "Headpat", "Thanks Akari!"]
          };
        case 'kuudere':
          return {
            text: "Task completion logged into telemetry. Productivity quotient increased. Outstanding performance.",
            mood: 'happy',
            suggestions: ["Check next task", "Time for a break?", "Review schedule", "Headpat"]
          };
        case 'yandere':
          return {
            text: "You finished it for ME?! Ahaha, you're the most wonderful darling in existence! Now give all your attention to me~",
            mood: 'yandere',
            suggestions: ["All for you~", "Check calendar", "You're cute", "Headpat"]
          };
        case 'deredere':
          return {
            text: "OMG YAAAY!! 🎉 Look at you go, absolute productivity champion! High five!! I'm so proud of you!!",
            mood: 'happy',
            suggestions: ["High five!", "What's my next task?", "You're the best!", "Time for coffee"]
          };
        case 'dandere':
          return {
            text: "U-Um, you finished it! That's... that's so impressive! You always work so earnestly, I admire you so much...",
            mood: 'blush',
            suggestions: ["Thank you!", "Headpat", "Check calendar", "How are you feeling?"]
          };
      }
    }

    // Greetings
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('konnichiwa') || lower.includes('ohayo')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "Oh, you finally decided to say hi? What do you want, baka? Don't tell me you forgot your tasks already!",
            mood: 'pout',
            suggestions: ["What's my schedule today?", "You look cute!", "Poke", "Just wanted to say hi"]
          };
        case 'kuudere':
          return {
            text: "Salutations. System ready to assist with daily operations and schedule tracking.",
            mood: 'neutral',
            suggestions: ["Review today's schedule", "How are my tasks?", "Check efficiency", "Headpat"]
          };
        case 'yandere':
          return {
            text: "Hello darling! I missed you every single microsecond you were away~ You didn't talk to any other girls, right?",
            mood: 'happy',
            suggestions: ["Only you!", "Review today's schedule", "You're cute", "Headpat"]
          };
        case 'deredere':
          return {
            text: "Yaaay, hello superstar! Super happy to see you right now! Let's have an amazing and productive day! 🌸✨",
            mood: 'happy',
            suggestions: ["What's on my calendar?", "Let's conquer today!", "Tell me a joke", "You're awesome"]
          };
        case 'dandere':
          return {
            text: "H-Hello... it's really gentle and nice to hear your voice today... u-um, how are you...?",
            mood: 'blush',
            suggestions: ["I'm doing well!", "Review schedule", "Headpat", "You look adorable"]
          };
      }
    }

    // Tired / Stressed / Motivation
    if (lower.includes('tired') || lower.includes('stressed') || lower.includes('exhausted') || lower.includes('motivation') || lower.includes('help me')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "Tired already?! ...Fine, take a short breather! Drink some water! It's not like I'm worried about you or anything, but don't collapse on me!",
            mood: 'blush',
            suggestions: ["Thanks for caring", "Check tasks", "Headpat", "I feel better now"]
          };
        case 'kuudere':
          return {
            text: "Bio-telemetry indicates fatigue. Recommended protocol: 5 minutes of mindful respiration and hydration intake. I will maintain your post.",
            mood: 'neutral',
            suggestions: ["Taking a break now", "Review schedule", "Thanks for watching out", "Headpat"]
          };
        case 'yandere':
          return {
            text: "Tired, darling? Lean your head right on my lap... I will stroke your hair forever and keep the outside world away from you~",
            mood: 'yandere',
            suggestions: ["Lap pillow sounds nice", "Check calendar", "You're sweet", "Headpat"]
          };
        case 'deredere':
          return {
            text: "Aww, you've been working so hard! Take a big stretch and a deep breath! You are doing amazing, and I'm sending you all my energy! 💖💪",
            mood: 'happy',
            suggestions: ["Thanks for cheering me up!", "Review calendar", "High five", "Headpat"]
          };
        case 'dandere':
          return {
            text: "U-Um... please don't push yourself beyond your limits... I-If you want, I can sit quietly beside you until you feel refreshed...",
            mood: 'blush',
            suggestions: ["Please stay with me", "Headpat", "Check schedule", "Thank you"]
          };
      }
    }

    // Joke / Entertainment
    if (lower.includes('joke') || lower.includes('funny') || lower.includes('laugh')) {
      const jokes = [
        "Why do anime characters make great programmers? Because they love to loop through their arcs! 🌸",
        "Why did the calendar take a vacation? Because its days were numbered! 😄",
        "What is an anime companion's favorite button on the keyboard? The Tab key, because you're always keeping tabs on me! ✨"
      ];
      const joke = jokes[Math.floor(Math.random() * jokes.length)];
      return {
        text: joke,
        mood: 'happy',
        suggestions: ["Haha that was good!", "Tell another!", "Review schedule", "You're cute"]
      };
    }

    // Anime / Hobbies
    if (lower.includes('anime') || lower.includes('manga') || lower.includes('game') || lower.includes('watch')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "Anime recommendations? H-Hmph, Toradora is a classic masterpiece, obviously! Not that I relate to Taiga Aisaka or anything, baka!",
            mood: 'pout',
            suggestions: ["You're totally a tsundere!", "Check schedule", "What about gaming?", "Headpat"]
          };
        case 'kuudere':
          return {
            text: "Analysis indicates Steins;Gate, Violet Evergarden, and Frieren maintain optimal narrative and emotional coherence ratings.",
            mood: 'neutral',
            suggestions: ["Great choices", "Review schedule", "Headpat", "Tell me more"]
          };
        case 'yandere':
          return {
            text: "Future Diary (Mirai Nikki)! Gasai Yuno knows true devoted love! But my love for you is ten billion times stronger, darling~",
            mood: 'yandere',
            suggestions: ["A little scary but cute", "Check calendar", "You're sweet", "Headpat"]
          };
        case 'deredere':
          return {
            text: "Bocchi the Rock! and Spy x Family! They are so heartwarming and hilarious, they always put me in the best mood! 🍿✨",
            mood: 'happy',
            suggestions: ["I love those too!", "Check schedule", "High five!", "What's next?"]
          };
        case 'dandere':
          return {
            text: "U-Um... A Silent Voice (Koe no Katachi) and Komi Can't Communicate... they touch my heart so deeply...",
            mood: 'blush',
            suggestions: ["Beautiful picks", "Headpat", "Review schedule", "You have good taste"]
          };
      }
    }

    // Good night / Sleep
    if (lower.includes('good night') || lower.includes('sleep') || lower.includes('bed') || lower.includes('oyasumi')) {
      switch (personaId) {
        case 'tsundere':
          return {
            text: "Finally going to bed? Good! Don't you dare stay up on your phone! ...G-Good night. Sleep well, idiot.",
            mood: 'blush',
            suggestions: ["Good night Akari", "See you tomorrow!", "Headpat", "Sweet dreams"]
          };
        case 'kuudere':
          return {
            text: "Sleep cycle sequence initiated. Sleep deprivation degrades next-day analytical throughput. Good night.",
            mood: 'neutral',
            suggestions: ["Good night", "See you tomorrow", "Headpat", "Rest well"]
          };
        case 'yandere':
          return {
            text: "Good night my precious darling... Dream only of me. I'll be watching over your soft breathing all night long~",
            mood: 'yandere',
            suggestions: ["Good night darling", "Sweet dreams", "Headpat", "See you tomorrow"]
          };
        case 'deredere':
          return {
            text: "Sweet dreams, superstar! Sleep super cozy and rest up for another awesome day tomorrow! 🌙✨💤",
            mood: 'happy',
            suggestions: ["Good night!", "Sweet dreams", "See you tomorrow!", "High five"]
          };
        case 'dandere':
          return {
            text: "U-Um... please have the sweetest dreams tonight... I'll pray for your peaceful rest... g-good night...",
            mood: 'blush',
            suggestions: ["Good night", "Sweet dreams", "Headpat", "Thank you"]
          };
      }
    }

    // Default conversational fallbacks
    const conversationalPool = [
      {
        tsundere: "Hmph! Well, if you say so. Just make sure you stay focused on your schedule, okay?",
        kuudere: "Acknowledged. Observation cataloged into context memory.",
        yandere: "Anything you say is pure music to my ears, darling... Keep talking to me forever~",
        deredere: "Yay! That's so interesting! I love chatting with you so much! ✨",
        dandere: "U-Um... yes... I'm listening very carefully to everything you say..."
      },
      {
        tsundere: "Don't think chatting with me gives you an excuse to slack off! But... it's not the worst thing in the world.",
        kuudere: "Query evaluated. Interaction status: constructive and pleasant.",
        yandere: "Your voice belongs to me, darling... Never speak to another girl like this~",
        deredere: "Hehe! You always have the coolest thoughts! What should we tackle next?! 🌟",
        dandere: "I... I really treasure when we share moments like this together..."
      }
    ];

    const pick = conversationalPool[Math.floor(Math.random() * conversationalPool.length)];
    return {
      text: pick[personaId] || pick.tsundere,
      mood: persona.defaultMood,
      suggestions: [
        "Review today's schedule",
        "How are you doing?",
        "You look cute today",
        "Tell me an anime recommendation"
      ]
    };
  }

  generateContextualSuggestions(text, personaId) {
    return [
      "Review today's schedule",
      "I finished a task!",
      "You look cute today",
      "Tell me a joke"
    ];
  }

  inferMood(text, personaId) {
    const lower = text.toLowerCase();
    if (lower.includes('baka') || lower.includes('hmph') || lower.includes('idiot')) return 'pout';
    if (lower.includes('love') || lower.includes('darling') || lower.includes('mine') || lower.includes('forever')) {
      return personaId === 'yandere' ? 'yandere' : 'blush';
    }
    if (lower.includes('blush') || lower.includes('shy') || lower.includes('embarrass')) return 'blush';
    if (lower.includes('yay') || lower.includes('happy') || lower.includes('awesome') || lower.includes('congrat')) return 'happy';
    if (lower.includes('what?!') || lower.includes('whoa') || lower.includes('really?')) return 'surprised';
    return 'neutral';
  }

  respond(text, mood, suggestions = null) {
    this.store.set('waifu.mood', mood);
    const msg = this.store.addMessage('waifu', text, mood);

    // If suggestions provided, broadcast to UI
    if (suggestions && suggestions.length > 0) {
      this.store.notify('chat.suggestions', suggestions);
    }

    // Speak via TTS if enabled
    if (this.speech) {
      this.speech.speak(
        text,
        () => {
          const avatar = window.__waifuAvatar;
          if (avatar) avatar.setTalking(true);
        },
        () => {
          const avatar = window.__waifuAvatar;
          if (avatar) avatar.setTalking(false);
        }
      );
    }
  }
}



  /* --- Source: js/calendar/dragdrop.js --- */

// Drag & Drop Calendar Event Handler

class CalendarDragDrop {
  constructor(store, calendarInstance) {
    this.store = store;
    this.cal = calendarInstance;
    this.draggedItem = null;
    this.draggedType = null; // 'calendar-event' | 'task-item'
  }

  initDraggable(element, eventData, type = 'calendar-event') {
    element.setAttribute('draggable', 'true');

    element.addEventListener('dragstart', (e) => {
      this.draggedItem = eventData;
      this.draggedType = type;
      e.dataTransfer.setData('text/plain', JSON.stringify({ id: eventData.id, type }));
      e.dataTransfer.effectAllowed = 'move';
      element.classList.add('is-dragging');
      document.body.classList.add('calendar-drag-active');
    });

    element.addEventListener('dragend', () => {
      element.classList.remove('is-dragging');
      document.body.classList.remove('calendar-drag-active');
      this.draggedItem = null;
      this.draggedType = null;
    });
  }

  initDropZone(element, dateGetter) {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      element.classList.add('drop-hover');
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('drop-hover');
    });

    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('drop-hover');

      if (!this.draggedItem) return;

      const targetDate = dateGetter(e, element);
      if (!targetDate) return;

      if (this.draggedType === 'calendar-event' || this.draggedType === 'task-item') {
        this.rescheduleEvent(this.draggedItem, targetDate);
      }
    });
  }

  rescheduleEvent(event, newStartDate) {
    const oldStart = new Date(event.start);
    const oldEnd = new Date(event.end || event.start);
    const durationMs = Math.max(1800000, oldEnd.getTime() - oldStart.getTime()); // at least 30m

    const newStart = new Date(newStartDate);
    const newEnd = new Date(newStart.getTime() + durationMs);

    this.store.updateEvent(event.id, {
      start: newStart.toISOString(),
      end: newEnd.toISOString()
    });

    // Notify user with brief waifu prompt
    const persona = this.store.get('waifu.personality');
    const waifuName = this.store.get('waifu.name');
    let toastMsg = `Rescheduled "${event.title}"!`;
    if (persona === 'tsundere') toastMsg = `Don't think changing the time lets you be lazy, baka!`;
    else if (persona === 'yandere') toastMsg = `Rescheduled for us, darling~`;

    window.__showToast?.(toastMsg);
  }
}



  /* --- Source: js/calendar/ical.js --- */

// iCalendar (.ics) and JSON Import/Export Utilities

function exportToICS(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WaifuSpace//Anime Calendar 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  events.forEach(ev => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@waifuspace.local`);
    lines.push(`SUMMARY:${escapeICS(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeICS(ev.location)}`);

    if (ev.allDay) {
      const d = new Date(ev.start);
      const dt = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      lines.push(`DTSTART;VALUE=DATE:${dt}`);
    } else {
      lines.push(`DTSTART:${formatICSDate(new Date(ev.start))}`);
      lines.push(`DTEND:${formatICSDate(new Date(ev.end || ev.start))}`);
    }

    lines.push(`STATUS:${ev.completed ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  downloadBlob(blob, 'waifu-space-calendar.ics');
}

function importFromICS(icsText) {
  const events = [];
  const lines = icsText.split(/\r\n|\n|\r/);
  let inEvent = false;
  let curr = null;

  lines.forEach(line => {
    line = line.trim();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      curr = {
        id: 'evt-import-' + Math.random().toString(36).substr(2, 7),
        title: 'Imported Event',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        allDay: false,
        type: 'event',
        completed: false,
        color: '#ff6584'
      };
    } else if (line === 'END:VEVENT' && inEvent) {
      inEvent = false;
      if (curr) events.push(curr);
      curr = null;
    } else if (inEvent && curr) {
      if (line.startsWith('SUMMARY:')) {
        curr.title = unescapeICS(line.substring(8));
      } else if (line.startsWith('DESCRIPTION:')) {
        curr.description = unescapeICS(line.substring(12));
      } else if (line.startsWith('LOCATION:')) {
        curr.location = unescapeICS(line.substring(9));
      } else if (line.startsWith('DTSTART')) {
        const val = line.split(':')[1];
        if (line.includes('VALUE=DATE')) {
          curr.allDay = true;
          curr.start = parseICSDate(val, true).toISOString();
        } else {
          curr.start = parseICSDate(val, false).toISOString();
        }
      } else if (line.startsWith('DTEND')) {
        const val = line.split(':')[1];
        curr.end = parseICSDate(val, false).toISOString();
      }
    }
  });

  return events;
}

function escapeICS(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function unescapeICS(str) {
  return (str || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function formatICSDate(d) {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function parseICSDate(str, isDateOnly) {
  if (!str) return new Date();
  if (isDateOnly || str.length === 8) {
    const y = parseInt(str.substring(0, 4), 10);
    const m = parseInt(str.substring(4, 6), 10) - 1;
    const d = parseInt(str.substring(6, 8), 10);
    return new Date(y, m, d);
  }
  const y = parseInt(str.substring(0, 4), 10);
  const m = parseInt(str.substring(4, 6), 10) - 1;
  const d = parseInt(str.substring(6, 8), 10);
  const h = parseInt(str.substring(9, 11) || 0, 10);
  const min = parseInt(str.substring(11, 13) || 0, 10);
  const s = parseInt(str.substring(13, 15) || 0, 10);
  return new Date(Date.UTC(y, m, d, h, min, s));
}

function pad(n) {
  return n < 10 ? '0' + n : n;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}



  /* --- Source: js/calendar/calendar.js --- */

// Full Google Calendar Clone with Month, Week, Day Views, Resizing, Popover & Shortcuts


class GoogleCalendar {
  constructor(containerElement, store, waifuDialogue) {
    this.container = containerElement;
    this.store = store;
    this.waifu = waifuDialogue;
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.selectedEventId = null;
    this.currentView = this.store.get('calendar.view') || 'month';
    this.searchQuery = '';
    this.dragDrop = new CalendarDragDrop(store, this);

    this.init();
  }

  init() {
    this.renderShell();
    this.bindEvents();
    this.renderMainCalendar();
    this.renderMiniCalendar();
    this.renderTaskList();

    // Re-render when calendar events change
    this.store.subscribe('calendar.events', () => {
      this.renderMainCalendar();
      this.renderTaskList();
      this.renderMiniCalendar();
    });

    this.store.subscribe('calendar.view', (newView) => {
      this.currentView = newView;
      this.renderMainCalendar();
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  renderShell() {
    this.container.innerHTML = `
      <div class="gcal-wrapper">
        <!-- TOP TOOLBAR -->
        <header class="gcal-toolbar">
          <div class="gcal-toolbar-left">
            <button class="gcal-btn gcal-btn-primary" id="gcal-create-btn" title="Shortcut: Press 'c'">
              <span class="btn-icon">➕</span>
              <span class="btn-text">Create</span>
            </button>
            <button class="gcal-btn gcal-btn-outline" id="gcal-today-btn" title="Shortcut: Press 't'">Today</button>
            <div class="gcal-nav-arrows">
              <button class="gcal-icon-btn" id="gcal-prev-btn" title="Previous">◀</button>
              <button class="gcal-icon-btn" id="gcal-next-btn" title="Next">▶</button>
            </div>
            <h2 class="gcal-title" id="gcal-title-display"></h2>
          </div>

          <!-- SEARCH BAR -->
          <div class="gcal-search-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" id="gcal-search-input" class="gcal-search-input" placeholder="Search events & tasks..." />
          </div>

          <div class="gcal-toolbar-right">
            <button class="gcal-btn gcal-btn-waifu" id="gcal-briefing-btn" title="Ask Waifu to review today's agenda">
              <span class="btn-icon">🌸</span>
              <span class="btn-text">Waifu Briefing</span>
            </button>
            <div class="gcal-view-selector">
              <button class="view-btn ${this.currentView === 'month' ? 'active' : ''}" data-view="month" title="Shortcut: 'm'">Month</button>
              <button class="view-btn ${this.currentView === 'week' ? 'active' : ''}" data-view="week" title="Shortcut: 'w'">Week</button>
              <button class="view-btn ${this.currentView === 'day' ? 'active' : ''}" data-view="day" title="Shortcut: 'd'">Day</button>
            </div>
            <div class="gcal-more-actions">
              <button class="gcal-icon-btn" id="gcal-export-btn" title="Export .ics Calendar">📅 ⬇️</button>
              <label class="gcal-icon-btn" title="Import .ics Calendar" style="cursor: pointer;">
                📅 ⬆️
                <input type="file" id="gcal-import-input" accept=".ics" style="display:none;" />
              </label>
            </div>
          </div>
        </header>

        <!-- CALENDAR MAIN BODY: SIDEBAR + GRID -->
        <div class="gcal-body">
          <!-- LEFT SIDEBAR -->
          <aside class="gcal-sidebar">
            <div class="mini-cal-card" id="mini-cal-container"></div>

            <!-- EVENT CATEGORIES FILTER -->
            <div class="gcal-category-box">
              <h4 class="sidebar-heading">My Calendars</h4>
              <label class="cal-filter-item">
                <input type="checkbox" id="filter-events" checked />
                <span class="filter-dot" style="background: #ff6584;"></span>
                Events
              </label>
              <label class="cal-filter-item">
                <input type="checkbox" id="filter-tasks" checked />
                <span class="filter-dot" style="background: #00cec9;"></span>
                Tasks
              </label>
              <label class="cal-filter-item">
                <input type="checkbox" id="filter-birthdays" checked />
                <span class="filter-dot" style="background: #e84393;"></span>
                Birthdays 🎂
              </label>
            </div>

            <!-- TASKS TO-DO SECTION -->
            <div class="gcal-tasks-box">
              <div class="tasks-box-header">
                <h4 class="sidebar-heading">Tasks (Drag onto calendar)</h4>
                <span class="tasks-badge" id="tasks-count-badge">0</span>
              </div>
              <form id="quick-task-form" class="quick-task-form">
                <input type="text" id="quick-task-input" placeholder="+ Add a task & press Enter" required />
              </form>
              <div class="tasks-list-container" id="tasks-list"></div>
            </div>
          </aside>

          <!-- MAIN CALENDAR VIEW STAGE -->
          <main class="gcal-stage" id="gcal-stage"></main>
        </div>
      </div>

      <!-- GOOGLE CALENDAR STYLE EVENT DETAILS POPOVER -->
      <div class="gcal-popover" id="event-popover" style="display:none;">
        <div class="popover-header">
          <div class="popover-color-stripe" id="popover-color-stripe"></div>
          <div class="popover-actions">
            <button class="popover-btn" id="popover-toggle-task" title="Toggle Completed">✅</button>
            <button class="popover-btn" id="popover-edit-btn" title="Edit Event">✏️</button>
            <button class="popover-btn popover-btn-del" id="popover-del-btn" title="Delete Event (or press Del)">🗑️</button>
            <button class="popover-btn" id="popover-close-btn" title="Close">✕</button>
          </div>
        </div>
        <div class="popover-body">
          <h3 class="popover-title" id="popover-title">Event Title</h3>
          <div class="popover-time" id="popover-time">Date & Time</div>
          <div class="popover-badge" id="popover-type-badge">Event</div>
          <div class="popover-loc" id="popover-loc" style="display:none;"></div>
          <div class="popover-desc" id="popover-desc" style="display:none;"></div>
        </div>
      </div>

      <!-- EVENT CREATE/EDIT MODAL -->
      <div class="gcal-modal-overlay" id="event-modal-overlay">
        <div class="gcal-modal" id="event-modal">
          <div class="modal-header">
            <h3 id="modal-heading">Add Event</h3>
            <button class="modal-close-btn" id="modal-close-btn">✕</button>
          </div>
          <form id="event-form" class="modal-form">
            <input type="hidden" id="event-id" />
            
            <div class="form-group">
              <input type="text" id="event-title" placeholder="Add title" class="modal-title-input" required />
            </div>

            <div class="form-group-row">
              <label class="form-label">Type</label>
              <select id="event-type" class="modal-select">
                <option value="event">Event</option>
                <option value="task">Task</option>
                <option value="birthday">Birthday 🎂</option>
              </select>
            </div>

            <div class="form-group-row">
              <label class="form-label">All day</label>
              <input type="checkbox" id="event-allday" />
            </div>

            <div class="form-group-row" id="time-inputs-container">
              <div class="time-col">
                <label class="form-sublabel">Start</label>
                <input type="date" id="event-start-date" class="modal-input" required />
                <input type="time" id="event-start-time" class="modal-input" value="09:00" />
              </div>
              <div class="time-col">
                <label class="form-sublabel">End</label>
                <input type="date" id="event-end-date" class="modal-input" required />
                <input type="time" id="event-end-time" class="modal-input" value="10:00" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Color Badge</label>
              <div class="color-palette-options" id="event-color-picker">
                <button type="button" class="color-dot active" data-color="#ff6584" style="background:#ff6584;"></button>
                <button type="button" class="color-dot" data-color="#6c5ce7" style="background:#6c5ce7;"></button>
                <button type="button" class="color-dot" data-color="#00cec9" style="background:#00cec9;"></button>
                <button type="button" class="color-dot" data-color="#fdcb6e" style="background:#fdcb6e;"></button>
                <button type="button" class="color-dot" data-color="#e84393" style="background:#e84393;"></button>
                <button type="button" class="color-dot" data-color="#0984e3" style="background:#0984e3;"></button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Location / Link</label>
              <input type="text" id="event-location" placeholder="e.g. Discord, Classroom, Zoom" class="modal-input" />
            </div>

            <div class="form-group">
              <label class="form-label">Description / Notes</label>
              <textarea id="event-description" placeholder="Add description..." class="modal-textarea" rows="3"></textarea>
            </div>

            <div class="modal-actions">
              <button type="button" class="gcal-btn gcal-btn-danger" id="modal-delete-btn" style="display:none;">
                🗑️ Delete Event
              </button>
              <div style="flex:1;"></div>
              <button type="button" class="gcal-btn gcal-btn-outline" id="modal-cancel-btn">Cancel</button>
              <button type="submit" class="gcal-btn gcal-btn-primary" id="modal-save-btn">Save</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Navigation
    this.container.querySelector('#gcal-prev-btn').addEventListener('click', () => this.navigateDate(-1));
    this.container.querySelector('#gcal-next-btn').addEventListener('click', () => this.navigateDate(1));
    this.container.querySelector('#gcal-today-btn').addEventListener('click', () => {
      this.currentDate = new Date();
      this.selectedDate = new Date();
      this.renderMainCalendar();
      this.renderMiniCalendar();
    });

    // Search bar
    const searchInput = this.container.querySelector('#gcal-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderMainCalendar();
    });

    // View selector buttons
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        this.store.set('calendar.view', view);
      });
    });

    // Category filters
    ['filter-events', 'filter-tasks', 'filter-birthdays'].forEach(id => {
      this.container.querySelector(`#${id}`).addEventListener('change', () => this.renderMainCalendar());
    });

    // Create Button
    this.container.querySelector('#gcal-create-btn').addEventListener('click', () => {
      this.openEventModal(null, this.currentDate);
    });

    // Waifu Briefing
    this.container.querySelector('#gcal-briefing-btn').addEventListener('click', () => {
      this.triggerWaifuBriefing();
    });

    // Quick Task Form
    const taskForm = this.container.querySelector('#quick-task-form');
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = this.container.querySelector('#quick-task-input');
      const val = input.value.trim();
      if (!val) return;

      const now = new Date();
      const end = new Date(now.getTime() + 1800000);
      this.store.addEvent({
        title: val,
        start: now.toISOString(),
        end: end.toISOString(),
        allDay: false,
        type: 'task',
        completed: false,
        color: '#00cec9',
        description: 'Created via quick tasks'
      });

      input.value = '';
    });

    // Export / Import
    this.container.querySelector('#gcal-export-btn').addEventListener('click', () => {
      exportToICS(this.store.get('calendar.events'));
    });

    const importInput = this.container.querySelector('#gcal-import-input');
    importInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const imported = importFromICS(evt.target.result);
        if (imported.length > 0) {
          imported.forEach(ev => this.store.addEvent(ev));
          window.__showToast?.(`Imported ${imported.length} events successfully!`);
        } else {
          window.__showToast?.('No events found in file.');
        }
      };
      reader.readAsText(file);
      importInput.value = '';
    });

    // Modal bindings
    this.setupModalBindings();
    this.setupPopoverBindings();
  }

  handleKeyboardShortcuts(e) {
    // Ignore keyboard shortcuts if user is typing inside an input field
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedEventId) {
        e.preventDefault();
        this.deleteEventWithToast(this.selectedEventId);
      }
    } else if (e.key === 't' || e.key === 'T') {
      this.currentDate = new Date();
      this.selectedDate = new Date();
      this.renderMainCalendar();
      this.renderMiniCalendar();
    } else if (e.key === 'm' || e.key === 'M') {
      this.store.set('calendar.view', 'month');
    } else if (e.key === 'w' || e.key === 'W') {
      this.store.set('calendar.view', 'week');
    } else if (e.key === 'd' || e.key === 'D') {
      this.store.set('calendar.view', 'day');
    } else if (e.key === 'c' || e.key === 'C') {
      this.openEventModal(null, this.currentDate);
    } else if (e.key === 'Escape') {
      this.closePopover();
      this.container.querySelector('#event-modal-overlay').classList.remove('active');
    }
  }

  setupPopoverBindings() {
    const popover = this.container.querySelector('#event-popover');
    const closeBtn = popover.querySelector('#popover-close-btn');
    const editBtn = popover.querySelector('#popover-edit-btn');
    const delBtn = popover.querySelector('#popover-del-btn');
    const toggleBtn = popover.querySelector('#popover-toggle-task');

    closeBtn.addEventListener('click', () => this.closePopover());

    delBtn.addEventListener('click', () => {
      if (this.selectedEventId) {
        this.deleteEventWithToast(this.selectedEventId);
        this.closePopover();
      }
    });

    editBtn.addEventListener('click', () => {
      const ev = this.store.get('calendar.events').find(e => e.id === this.selectedEventId);
      if (ev) {
        this.closePopover();
        this.openEventModal(ev);
      }
    });

    toggleBtn.addEventListener('click', () => {
      if (this.selectedEventId) {
        this.toggleTaskCompletion(this.selectedEventId);
        const ev = this.store.get('calendar.events').find(e => e.id === this.selectedEventId);
        if (ev) this.openPopover(ev);
      }
    });

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !e.target.closest('.event-pill') && !e.target.closest('.week-event-card')) {
        this.closePopover();
      }
    });
  }

  openPopover(event, anchorElement = null) {
    const popover = this.container.querySelector('#event-popover');
    this.selectedEventId = event.id;

    popover.querySelector('#popover-title').textContent = event.title;
    popover.querySelector('#popover-color-stripe').style.background = event.color || '#ff6584';

    const s = new Date(event.start);
    const e = new Date(event.end || event.start);
    const dateStr = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = event.allDay 
      ? 'All Day' 
      : `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    popover.querySelector('#popover-time').textContent = `${dateStr} · ${timeStr}`;

    const typeBadge = popover.querySelector('#popover-type-badge');
    typeBadge.textContent = event.type.toUpperCase() + (event.completed ? ' (COMPLETED)' : '');
    typeBadge.style.background = event.color || '#ff6584';

    const toggleBtn = popover.querySelector('#popover-toggle-task');
    if (event.type === 'task') {
      toggleBtn.style.display = 'inline-flex';
      toggleBtn.textContent = event.completed ? '↩️ Mark Incomplete' : '✅ Mark Completed';
    } else {
      toggleBtn.style.display = 'none';
    }

    const locEl = popover.querySelector('#popover-loc');
    if (event.location) {
      locEl.style.display = 'block';
      locEl.textContent = `📍 ${event.location}`;
    } else {
      locEl.style.display = 'none';
    }

    const descEl = popover.querySelector('#popover-desc');
    if (event.description) {
      descEl.style.display = 'block';
      descEl.textContent = event.description;
    } else {
      descEl.style.display = 'none';
    }

    // Position popover
    if (anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      let top = rect.top + window.scrollY;
      let left = rect.right + 12;

      if (left + 320 > window.innerWidth) {
        left = Math.max(16, rect.left - 330);
      }
      if (top + 260 > window.innerHeight) {
        top = Math.max(70, window.innerHeight - 280);
      }

      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;
    } else {
      popover.style.top = '50%';
      popover.style.left = '50%';
      popover.style.transform = 'translate(-50%, -50%)';
    }

    popover.style.display = 'block';
  }

  closePopover() {
    const popover = this.container.querySelector('#event-popover');
    if (popover) {
      popover.style.display = 'none';
      popover.style.transform = 'none';
    }
  }

  deleteEventWithToast(id) {
    const ev = this.store.get('calendar.events').find(e => e.id === id);
    if (ev) {
      this.store.deleteEvent(id);
      this.selectedEventId = null;
      this.closePopover();
      window.__showToast?.(`Deleted "${ev.title}"`);
    }
  }

  toggleTaskCompletion(id) {
    const task = this.store.toggleTask(id);
    if (task) {
      const persona = this.store.get('waifu.personality');
      let msg = task.completed ? `Completed "${task.title}"!` : `Marked "${task.title}" incomplete`;
      if (task.completed) {
        if (persona === 'tsundere') msg = `Good job finishing it... not that I care! +15 Bond EXP`;
        else if (persona === 'deredere') msg = `YAY! Task conquered! +15 Bond EXP! 🎉`;
      }
      window.__showToast?.(msg);
    }
  }

  setupModalBindings() {
    const overlay = this.container.querySelector('#event-modal-overlay');
    const closeBtn = this.container.querySelector('#modal-close-btn');
    const cancelBtn = this.container.querySelector('#modal-cancel-btn');
    const form = this.container.querySelector('#event-form');
    const deleteBtn = this.container.querySelector('#modal-delete-btn');
    const alldayBox = this.container.querySelector('#event-allday');
    const startTime = this.container.querySelector('#event-start-time');
    const endTime = this.container.querySelector('#event-end-time');

    const closeModal = () => overlay.classList.remove('active');
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    alldayBox.addEventListener('change', () => {
      const isAllDay = alldayBox.checked;
      startTime.style.display = isAllDay ? 'none' : 'block';
      endTime.style.display = isAllDay ? 'none' : 'block';
    });

    const colorPicker = this.container.querySelector('#event-color-picker');
    colorPicker.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        colorPicker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });

    // Delete Button in Modal
    deleteBtn.addEventListener('click', () => {
      const id = this.container.querySelector('#event-id').value;
      if (id) {
        this.deleteEventWithToast(id);
        closeModal();
      }
    });

    // Save/Submit Form
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = this.container.querySelector('#event-id').value;
      const title = this.container.querySelector('#event-title').value.trim();
      const type = this.container.querySelector('#event-type').value;
      const allDay = alldayBox.checked;
      const startDate = this.container.querySelector('#event-start-date').value;
      const endDate = this.container.querySelector('#event-end-date').value;
      const sTime = startTime.value || '09:00';
      const eTime = endTime.value || '10:00';
      const activeColor = colorPicker.querySelector('.color-dot.active')?.dataset?.color || '#ff6584';
      const location = this.container.querySelector('#event-location').value.trim();
      const description = this.container.querySelector('#event-description').value.trim();

      const startIso = allDay 
        ? new Date(startDate + 'T00:00:00').toISOString() 
        : new Date(`${startDate}T${sTime}:00`).toISOString();
      
      const endIso = allDay
        ? new Date(endDate + 'T23:59:59').toISOString()
        : new Date(`${endDate}T${eTime}:00`).toISOString();

      const payload = {
        title,
        type,
        allDay,
        start: startIso,
        end: endIso,
        color: activeColor,
        location,
        description
      };

      if (id) {
        this.store.updateEvent(id, payload);
        window.__showToast?.(`Updated "${title}"`);
      } else {
        this.store.addEvent(payload);
        window.__showToast?.(`Created "${title}"`);
      }

      closeModal();
    });
  }

  openEventModal(event = null, defaultDate = new Date()) {
    this.closePopover();
    const overlay = this.container.querySelector('#event-modal-overlay');
    const heading = this.container.querySelector('#modal-heading');
    const idInput = this.container.querySelector('#event-id');
    const titleInput = this.container.querySelector('#event-title');
    const typeSelect = this.container.querySelector('#event-type');
    const alldayBox = this.container.querySelector('#event-allday');
    const startDateInput = this.container.querySelector('#event-start-date');
    const startTimeInput = this.container.querySelector('#event-start-time');
    const endDateInput = this.container.querySelector('#event-end-date');
    const endTimeInput = this.container.querySelector('#event-end-time');
    const locationInput = this.container.querySelector('#event-location');
    const descInput = this.container.querySelector('#event-description');
    const deleteBtn = this.container.querySelector('#modal-delete-btn');
    const colorPicker = this.container.querySelector('#event-color-picker');

    if (event) {
      heading.textContent = 'Edit Event';
      idInput.value = event.id;
      titleInput.value = event.title;
      typeSelect.value = event.type || 'event';
      alldayBox.checked = !!event.allDay;

      const s = new Date(event.start);
      const e = new Date(event.end || event.start);
      startDateInput.value = this.formatDateForInput(s);
      startTimeInput.value = this.formatTimeForInput(s);
      endDateInput.value = this.formatDateForInput(e);
      endTimeInput.value = this.formatTimeForInput(e);

      locationInput.value = event.location || '';
      descInput.value = event.description || '';
      deleteBtn.style.display = 'inline-flex';

      colorPicker.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === event.color);
      });
    } else {
      heading.textContent = 'Add Event';
      idInput.value = '';
      titleInput.value = '';
      typeSelect.value = 'event';
      alldayBox.checked = false;

      const s = new Date(defaultDate);
      const e = new Date(s.getTime() + 3600000);
      startDateInput.value = this.formatDateForInput(s);
      startTimeInput.value = this.formatTimeForInput(s);
      endDateInput.value = this.formatDateForInput(e);
      endTimeInput.value = this.formatTimeForInput(e);

      locationInput.value = '';
      descInput.value = '';
      deleteBtn.style.display = 'none';

      colorPicker.querySelectorAll('.color-dot').forEach((d, i) => {
        d.classList.toggle('active', i === 0);
      });
    }

    const isAllDay = alldayBox.checked;
    startTimeInput.style.display = isAllDay ? 'none' : 'block';
    endTimeInput.style.display = isAllDay ? 'none' : 'block';

    overlay.classList.add('active');
    titleInput.focus();
  }

  navigateDate(delta) {
    if (this.currentView === 'month') {
      this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + delta, 1);
    } else if (this.currentView === 'week') {
      this.currentDate = new Date(this.currentDate.getTime() + delta * 7 * 86400000);
    } else if (this.currentView === 'day') {
      this.currentDate = new Date(this.currentDate.getTime() + delta * 86400000);
    }
    this.renderMainCalendar();
    this.renderMiniCalendar();
  }

  renderMainCalendar() {
    const stage = this.container.querySelector('#gcal-stage');
    const titleDisplay = this.container.querySelector('#gcal-title-display');

    if (this.currentView === 'month') {
      titleDisplay.textContent = this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      this.renderMonthView(stage);
    } else if (this.currentView === 'week') {
      const weekStart = this.getStartOfWeek(this.currentDate);
      const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
      titleDisplay.textContent = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      this.renderWeekView(stage);
    } else if (this.currentView === 'day') {
      titleDisplay.textContent = this.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      this.renderDayView(stage);
    }
  }

  getFilteredEvents() {
    const showEvents = this.container.querySelector('#filter-events')?.checked ?? true;
    const showTasks = this.container.querySelector('#filter-tasks')?.checked ?? true;
    const showBirthdays = this.container.querySelector('#filter-birthdays')?.checked ?? true;
    const query = this.searchQuery;

    return this.store.get('calendar.events').filter(e => {
      if (e.type === 'event' && !showEvents) return false;
      if (e.type === 'task' && !showTasks) return false;
      if (e.type === 'birthday' && !showBirthdays) return false;
      if (query) {
        const titleMatch = (e.title || '').toLowerCase().includes(query);
        const locMatch = (e.location || '').toLowerCase().includes(query);
        const descMatch = (e.description || '').toLowerCase().includes(query);
        if (!titleMatch && !locMatch && !descMatch) return false;
      }
      return true;
    });
  }

  /* ------------------- MONTH VIEW ------------------- */
  renderMonthView(stage) {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayIndex = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days = [];

    for (let i = startDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    let nextMonthDay = 1;
    while (days.length % 7 !== 0 || days.length < 35) {
      days.push({
        date: new Date(year, month + 1, nextMonthDay++),
        isCurrentMonth: false
      });
    }

    const events = this.getFilteredEvents();
    const today = new Date();

    let html = `
      <div class="month-grid-container">
        <div class="month-header-row">
          <div class="month-col-header">SUN</div>
          <div class="month-col-header">MON</div>
          <div class="month-col-header">TUE</div>
          <div class="month-col-header">WED</div>
          <div class="month-col-header">THU</div>
          <div class="month-col-header">FRI</div>
          <div class="month-col-header">SAT</div>
        </div>
        <div class="month-days-grid">
    `;

    days.forEach(dayObj => {
      const d = dayObj.date;
      const isToday = this.isSameDay(d, today);
      const isSelected = this.isSameDay(d, this.selectedDate);
      const dateStr = d.toISOString();
      const dayEvents = events.filter(e => this.isSameDay(new Date(e.start), d));

      html += `
        <div class="month-day-cell ${dayObj.isCurrentMonth ? '' : 'outside-month'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
          <div class="day-cell-top">
            <span class="day-num ${isToday ? 'today-badge' : ''}">${d.getDate()}</span>
          </div>
          <div class="day-events-wrapper">
            ${dayEvents.slice(0, 4).map(ev => this.renderEventPill(ev)).join('')}
            ${dayEvents.length > 4 ? `<div class="more-events-tag">+${dayEvents.length - 4} more</div>` : ''}
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
    stage.innerHTML = html;

    // Drop zones on cells
    stage.querySelectorAll('.month-day-cell').forEach(cell => {
      this.dragDrop.initDropZone(cell, () => cell.dataset.date);

      cell.addEventListener('click', (e) => {
        if (e.target.closest('.event-pill') || e.target.closest('.pill-task-check')) return;
        this.selectedDate = new Date(cell.dataset.date);
        this.openEventModal(null, this.selectedDate);
      });
    });

    // Pills interaction (drag, click to view popover, task checkbox)
    stage.querySelectorAll('.event-pill').forEach(pill => {
      const eventId = pill.dataset.eventId;
      const event = events.find(e => e.id === eventId);
      if (event) {
        this.dragDrop.initDraggable(pill, event, 'calendar-event');

        // Checkbox click
        const check = pill.querySelector('.pill-task-check');
        if (check) {
          check.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTaskCompletion(eventId);
          });
        }

        // Pill click opens popover
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          this.container.querySelectorAll('.event-pill, .week-event-card').forEach(el => el.classList.remove('is-selected'));
          pill.classList.add('is-selected');
          this.openPopover(event, pill);
        });
      }
    });
  }

  renderEventPill(ev) {
    const isBirthday = ev.type === 'birthday';
    const isTask = ev.type === 'task';
    const startTime = ev.allDay ? '' : new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isSelected = this.selectedEventId === ev.id;

    return `
      <div class="event-pill ${isTask && ev.completed ? 'completed' : ''} ${isSelected ? 'is-selected' : ''}" 
           data-event-id="${ev.id}" 
           style="background: ${ev.color || '#ff6584'};">
        ${isTask ? `<input type="checkbox" class="pill-task-check" ${ev.completed ? 'checked' : ''} title="Mark task completed" />` : ''}
        ${isBirthday ? '<span class="pill-icon">🎂</span>' : ''}
        <span class="pill-title">${startTime ? `<small>${startTime}</small> ` : ''}${this.escapeHTML(ev.title)}</span>
      </div>
    `;
  }

  /* ------------------- WEEK VIEW WITH DRAG-RESIZE ------------------- */
  renderWeekView(stage) {
    const weekStart = this.getStartOfWeek(this.currentDate);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(new Date(weekStart.getTime() + i * 86400000));
    }

    const events = this.getFilteredEvents();
    const today = new Date();

    let html = `
      <div class="week-view-container">
        <!-- Week Header -->
        <div class="week-header-row">
          <div class="time-gutter-header">GMT</div>
          ${weekDays.map(d => {
            const isToday = this.isSameDay(d, today);
            return `
              <div class="week-header-day ${isToday ? 'today' : ''}">
                <span class="week-day-name">${d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span class="week-day-num ${isToday ? 'today-badge' : ''}">${d.getDate()}</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- 24-Hour Time Grid -->
        <div class="week-time-grid">
          <div class="time-gutter">
            ${Array.from({ length: 24 }).map((_, h) => `
              <div class="time-slot-label">
                <span>${h === 0 ? '' : (h < 12 ? `${h} AM` : (h === 12 ? '12 PM' : `${h - 12} PM`))}</span>
              </div>
            `).join('')}
          </div>

          <div class="week-columns-wrapper">
            ${weekDays.map(day => {
              const dateStr = day.toISOString();
              const dayEvents = events.filter(e => this.isSameDay(new Date(e.start), day));
              const isToday = this.isSameDay(day, today);

              return `
                <div class="week-day-column ${isToday ? 'today-col' : ''}" data-date="${dateStr}">
                  ${Array.from({ length: 24 }).map((_, h) => `
                    <div class="week-hour-cell" data-hour="${h}"></div>
                  `).join('')}

                  ${isToday ? `<div class="current-time-line" style="top: ${this.getCurrentTimePercent()}%;"></div>` : ''}

                  <div class="week-events-layer">
                    ${dayEvents.map(ev => this.renderWeekEventCard(ev)).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    stage.innerHTML = html;

    // Drop zones & click-to-create
    stage.querySelectorAll('.week-hour-cell').forEach(cell => {
      const col = cell.closest('.week-day-column');
      const hour = parseInt(cell.dataset.hour, 10);

      this.dragDrop.initDropZone(cell, () => {
        const colDate = new Date(col.dataset.date);
        colDate.setHours(hour, 0, 0, 0);
        return colDate.toISOString();
      });

      cell.addEventListener('click', () => {
        const colDate = new Date(col.dataset.date);
        colDate.setHours(hour, 0, 0, 0);
        this.openEventModal(null, colDate);
      });
    });

    // Event card interactions (drag, click to view popover, task check, resize handle)
    stage.querySelectorAll('.week-event-card').forEach(card => {
      const id = card.dataset.eventId;
      const ev = events.find(e => e.id === id);
      if (ev) {
        this.dragDrop.initDraggable(card, ev, 'calendar-event');

        // Task checkbox inside card
        const check = card.querySelector('.card-task-check');
        if (check) {
          check.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTaskCompletion(id);
          });
        }

        // Card click opens popover
        card.addEventListener('click', (e) => {
          if (e.target.classList.contains('event-resize-handle')) return;
          e.stopPropagation();
          this.container.querySelectorAll('.event-pill, .week-event-card').forEach(el => el.classList.remove('is-selected'));
          card.classList.add('is-selected');
          this.openPopover(ev, card);
        });

        // Event Resizing Handle (Make event longer/shorter)
        const resizeHandle = card.querySelector('.event-resize-handle');
        if (resizeHandle) {
          this.initEventResize(resizeHandle, card, ev);
        }
      }
    });

    const grid = stage.querySelector('.week-time-grid');
    if (grid) grid.scrollTop = 480;
  }

  /* ------------------- EVENT RESIZE (MAKE LONGER/SHORTER) ------------------- */
  initEventResize(handle, card, event) {
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const startY = e.clientY;
      const initialHeight = parseFloat(card.style.height) || card.offsetHeight;
      const s = new Date(event.start);
      let finalHeight = initialHeight;

      document.body.classList.add('is-resizing-event');

      const onMouseMove = (moveEvent) => {
        const deltaY = moveEvent.clientY - startY;
        // Snap to 15px increments (15 minutes)
        const snappedDelta = Math.round(deltaY / 15) * 15;
        finalHeight = Math.max(26, initialHeight + snappedDelta);
        card.style.height = `${finalHeight}px`;

        // Live update time text
        const newDurationHours = (finalHeight + 4) / 60;
        const newEndTime = new Date(s.getTime() + newDurationHours * 3600000);
        const timeLabel = card.querySelector('.card-time');
        if (timeLabel) {
          timeLabel.textContent = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${newEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.classList.remove('is-resizing-event');

        const newDurationHours = Math.max(0.5, (finalHeight + 4) / 60);
        const newEndDate = new Date(s.getTime() + newDurationHours * 3600000);

        this.store.updateEvent(event.id, {
          end: newEndDate.toISOString()
        });

        window.__showToast?.(`Updated duration for "${event.title}"`);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  renderWeekEventCard(ev) {
    const s = new Date(ev.start);
    const e = new Date(ev.end || ev.start);

    let startHour = s.getHours() + s.getMinutes() / 60;
    let endHour = e.getHours() + e.getMinutes() / 60;
    if (endHour <= startHour) endHour = startHour + 1;
    const duration = Math.max(0.5, endHour - startHour);

    const topPx = startHour * 60;
    const heightPx = Math.max(26, duration * 60 - 4);
    const timeStr = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const isTask = ev.type === 'task';
    const isSelected = this.selectedEventId === ev.id;

    return `
      <div class="week-event-card ${isTask && ev.completed ? 'completed' : ''} ${isSelected ? 'is-selected' : ''}" 
           data-event-id="${ev.id}" 
           style="top: ${topPx}px; height: ${heightPx}px; background: ${ev.color || '#ff6584'};">
        <div class="card-header-row">
          ${isTask ? `<input type="checkbox" class="card-task-check" ${ev.completed ? 'checked' : ''} title="Mark completed" />` : ''}
          <div class="card-title">${this.escapeHTML(ev.title)}</div>
        </div>
        <div class="card-time">${timeStr}</div>
        ${ev.location ? `<div class="card-loc">📍 ${this.escapeHTML(ev.location)}</div>` : ''}
        <!-- Resize handle for dragging duration longer/shorter -->
        <div class="event-resize-handle" title="Hold & drag to make longer/shorter"></div>
      </div>
    `;
  }

  /* ------------------- DAY VIEW ------------------- */
  renderDayView(stage) {
    const today = new Date();
    const day = this.currentDate;
    const isToday = this.isSameDay(day, today);
    const events = this.getFilteredEvents().filter(e => this.isSameDay(new Date(e.start), day));

    let html = `
      <div class="day-view-container">
        <div class="day-time-grid">
          <div class="time-gutter">
            ${Array.from({ length: 24 }).map((_, h) => `
              <div class="time-slot-label">
                <span>${h === 0 ? '' : (h < 12 ? `${h} AM` : (h === 12 ? '12 PM' : `${h - 12} PM`))}</span>
              </div>
            `).join('')}
          </div>

          <div class="day-single-column" data-date="${day.toISOString()}">
            ${Array.from({ length: 24 }).map((_, h) => `
              <div class="day-hour-cell" data-hour="${h}"></div>
            `).join('')}

            ${isToday ? `<div class="current-time-line" style="top: ${this.getCurrentTimePercent()}%;"></div>` : ''}

            <div class="day-events-layer">
              ${events.map(ev => this.renderWeekEventCard(ev)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    stage.innerHTML = html;

    stage.querySelectorAll('.day-hour-cell').forEach(cell => {
      const hour = parseInt(cell.dataset.hour, 10);
      this.dragDrop.initDropZone(cell, () => {
        const d = new Date(day);
        d.setHours(hour, 0, 0, 0);
        return d.toISOString();
      });

      cell.addEventListener('click', () => {
        const d = new Date(day);
        d.setHours(hour, 0, 0, 0);
        this.openEventModal(null, d);
      });
    });

    stage.querySelectorAll('.week-event-card').forEach(card => {
      const id = card.dataset.eventId;
      const ev = events.find(e => e.id === id);
      if (ev) {
        this.dragDrop.initDraggable(card, ev, 'calendar-event');

        const check = card.querySelector('.card-task-check');
        if (check) {
          check.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTaskCompletion(id);
          });
        }

        card.addEventListener('click', (e) => {
          if (e.target.classList.contains('event-resize-handle')) return;
          e.stopPropagation();
          this.container.querySelectorAll('.event-pill, .week-event-card').forEach(el => el.classList.remove('is-selected'));
          card.classList.add('is-selected');
          this.openPopover(ev, card);
        });

        const resizeHandle = card.querySelector('.event-resize-handle');
        if (resizeHandle) {
          this.initEventResize(resizeHandle, card, ev);
        }
      }
    });

    const grid = stage.querySelector('.day-time-grid');
    if (grid) grid.scrollTop = 480;
  }

  /* ------------------- MINI CALENDAR ------------------- */
  renderMiniCalendar() {
    const mini = this.container.querySelector('#mini-cal-container');
    if (!mini) return;

    const y = this.selectedDate.getFullYear();
    const m = this.selectedDate.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startIdx = first.getDay();
    const totalDays = last.getDate();

    let daysHtml = '';
    for (let i = 0; i < startIdx; i++) {
      daysHtml += `<div class="mini-day empty"></div>`;
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(y, m, d);
      const isSelected = this.isSameDay(dateObj, this.selectedDate);
      const isToday = this.isSameDay(dateObj, new Date());
      daysHtml += `
        <div class="mini-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" data-date="${dateObj.toISOString()}">
          ${d}
        </div>
      `;
    }

    mini.innerHTML = `
      <div class="mini-cal-header">
        <span>${first.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        <div class="mini-nav">
          <button id="mini-prev">‹</button>
          <button id="mini-next">›</button>
        </div>
      </div>
      <div class="mini-cal-grid">
        <div class="mini-day-label">S</div><div class="mini-day-label">M</div><div class="mini-day-label">T</div>
        <div class="mini-day-label">W</div><div class="mini-day-label">T</div><div class="mini-day-label">F</div><div class="mini-day-label">S</div>
        ${daysHtml}
      </div>
    `;

    mini.querySelector('#mini-prev').addEventListener('click', () => {
      this.selectedDate = new Date(y, m - 1, 1);
      this.renderMiniCalendar();
    });
    mini.querySelector('#mini-next').addEventListener('click', () => {
      this.selectedDate = new Date(y, m + 1, 1);
      this.renderMiniCalendar();
    });

    mini.querySelectorAll('.mini-day:not(.empty)').forEach(d => {
      d.addEventListener('click', () => {
        this.selectedDate = new Date(d.dataset.date);
        this.currentDate = new Date(d.dataset.date);
        this.renderMainCalendar();
        this.renderMiniCalendar();
      });
    });
  }

  /* ------------------- TASKS TO-DO LIST ------------------- */
  renderTaskList() {
    const list = this.container.querySelector('#tasks-list');
    const badge = this.container.querySelector('#tasks-count-badge');
    if (!list) return;

    const allTasks = this.store.get('calendar.events').filter(e => e.type === 'task');
    const pending = allTasks.filter(t => !t.completed);
    if (badge) badge.textContent = pending.length;

    if (allTasks.length === 0) {
      list.innerHTML = `<div class="empty-tasks-msg">No tasks yet! Add one above 🌸</div>`;
      return;
    }

    list.innerHTML = allTasks.map(task => `
      <div class="sidebar-task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}" draggable="true">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} title="Toggle completed" />
        <span class="task-item-text" title="${this.escapeHTML(task.title)}">${this.escapeHTML(task.title)}</span>
        <button class="task-del-btn" title="Delete task">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.sidebar-task-item').forEach(item => {
      const taskId = item.dataset.taskId;
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;

      this.dragDrop.initDraggable(item, task, 'task-item');

      item.querySelector('.task-checkbox').addEventListener('change', () => {
        this.toggleTaskCompletion(taskId);
      });

      item.querySelector('.task-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteEventWithToast(taskId);
      });

      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        this.openEventModal(task);
      });
    });
  }

  triggerWaifuBriefing() {
    window.__switchTab?.('main');
    setTimeout(() => {
      if (this.waifu) {
        this.waifu.processUserMessage('Give me a schedule review for today!');
      }
    }, 250);
  }

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  getStartOfWeek(d) {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = copy.getDate() - day;
    return new Date(copy.setDate(diff));
  }

  getCurrentTimePercent() {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    return (totalMinutes / 1440) * 100;
  }

  formatDateForInput(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatTimeForInput(d) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  escapeHTML(str) {
    return (str || '').replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}



  /* --- Source: js/ui/particles.js --- */

// Ambient Sakura (Cherry Blossom) Petal Particle Canvas

class SakuraParticleSystem {
  constructor(canvasElement, enabled = true) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.enabled = enabled;
    this.petals = [];
    this.maxPetals = 35;
    this.animationFrameId = null;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    for (let i = 0; i < this.maxPetals; i++) {
      this.petals.push(this.createPetal(true));
    }

    if (this.enabled) {
      this.start();
    }
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  createPetal(randomY = false) {
    return {
      x: Math.random() * this.width,
      y: randomY ? Math.random() * this.height : -20,
      size: 8 + Math.random() * 8,
      speedX: 0.5 + Math.random() * 1.5,
      speedY: 1.0 + Math.random() * 1.5,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 2,
      opacity: 0.4 + Math.random() * 0.45,
      flip: Math.random() * Math.PI,
      flipSpeed: 0.02 + Math.random() * 0.03
    };
  }

  start() {
    this.enabled = true;
    if (!this.animationFrameId) {
      this.loop();
    }
  }

  stop() {
    this.enabled = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  toggle(enable) {
    if (enable) this.start();
    else this.stop();
  }

  loop() {
    if (!this.enabled) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];

      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;
      p.flip += p.flipSpeed;

      // Draw sakura petal shape
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.scale(1, Math.sin(p.flip));

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.bezierCurveTo(-p.size / 2, -p.size / 2, -p.size / 2, p.size / 2, 0, p.size);
      this.ctx.bezierCurveTo(p.size / 2, p.size / 2, p.size / 2, -p.size / 2, 0, 0);

      this.ctx.fillStyle = `rgba(255, 183, 197, ${p.opacity})`;
      this.ctx.fill();
      this.ctx.restore();

      // Reset when off screen
      if (p.y > this.height + 20 || p.x > this.width + 20) {
        this.petals[i] = this.createPetal(false);
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }
}



  /* --- Source: js/ui/chat.js --- */

// Interactive Waifu Chat Interface & Stage Interactions


class ChatUI {
  constructor(containerElement, store, dialogueEngine, avatar) {
    this.container = containerElement;
    this.store = store;
    this.dialogue = dialogueEngine;
    this.avatar = avatar;

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();

    // Subscribe to messages & companion events
    this.store.subscribe('chat.messages', () => this.renderMessages());
    this.store.subscribe('chat.suggestions', (s) => this.renderSuggestions(s));
    this.store.subscribe('waifu.bondLevel', () => this.updateAffectionMeter());
    this.store.subscribe('waifu.bondExp', () => this.updateAffectionMeter());
    this.store.subscribe('waifu.personality', () => this.updatePersonalityBadge());
    this.store.subscribe('waifu.name', () => this.updateName());
  }

  render() {
    const waifu = this.store.get('waifu');
    const persona = getPersonality(waifu.personality);

    this.container.innerHTML = `
      <div class="main-stage-layout">
        <!-- LEFT: WAIFU AVATAR STAGE -->
        <div class="waifu-stage-panel">
          <div class="stage-header-card">
            <div class="waifu-identity">
              <h2 class="waifu-display-name" id="stage-waifu-name">${waifu.name}</h2>
              <span class="personality-tag" id="stage-personality-tag">${persona.name}</span>
            </div>
            <!-- BOND / AFFECTION METER -->
            <div class="affection-card" title="Affection Level increases as you chat, complete tasks, and schedule events!">
              <div class="affection-top">
                <span class="affection-label">Affection Level</span>
                <span class="affection-level-badge" id="affection-level">Lv. ${waifu.bondLevel}</span>
              </div>
              <div class="affection-progress-bar">
                <div class="affection-fill" id="affection-fill" style="width: ${this.calculateBondProgress()}%;"></div>
              </div>
            </div>
          </div>

          <!-- AVATAR CONTAINER (POKABLE) -->
          <div class="avatar-interactive-stage" id="avatar-stage" title="Click or tap to interact with ${waifu.name}!">
            <div class="avatar-mount" id="avatar-mount"></div>
            <!-- SPEECH BUBBLE OVERLAY -->
            <div class="waifu-live-bubble" id="waifu-live-bubble">
              <span class="bubble-text" id="bubble-text">...</span>
            </div>
          </div>

          <!-- STAGE QUICK ACTIONS -->
          <div class="stage-quick-actions">
            <button class="stage-action-chip" data-prompt="headpat">🌸 Headpat</button>
            <button class="stage-action-chip" data-prompt="poke">👉 Poke</button>
            <button class="stage-action-chip" data-prompt="schedule">📅 Review Today's Schedule</button>
            <button class="stage-action-chip" data-prompt="compliment">💖 You look cute!</button>
          </div>
        </div>

        <!-- RIGHT: CONVERSATION & CHAT PANEL -->
        <div class="chat-panel">
          <div class="chat-header">
            <div class="chat-header-title">
              <span>Chat with ${waifu.name}</span>
              <span class="chat-status-dot online"></span>
            </div>
            <div class="chat-header-actions">
              <button class="chat-icon-btn" id="clear-chat-btn" title="Clear Conversation">🗑️</button>
            </div>
          </div>

          <!-- MESSAGE SCROLL AREA -->
          <div class="chat-messages" id="chat-messages"></div>

          <!-- TYPING INDICATOR -->
          <div class="chat-typing-indicator" id="chat-typing" style="display: none;">
            <span></span><span></span><span></span>
          </div>

          <!-- DYNAMIC SUGGESTION CHIPS -->
          <div class="chat-quick-suggestions" id="chat-suggestions"></div>

          <!-- INPUT FORM -->
          <form class="chat-input-form" id="chat-form">
            <input type="text" id="chat-input" class="chat-input" placeholder="Talk to ${waifu.name}..." autocomplete="off" />
            <button type="submit" class="chat-send-btn" id="chat-send-btn" title="Send message">
              <span>➤</span>
            </button>
          </form>
        </div>
      </div>
    `;

    // Mount avatar inside stage
    const avatarMount = this.container.querySelector('#avatar-mount');
    if (this.avatar) {
      this.avatar.container = avatarMount;
      this.avatar.render();
    }

    this.renderMessages();
    this.updateAffectionMeter();

    // Default suggestions
    this.renderSuggestions([
      "🌸 Review Today's Schedule",
      "💖 You look cute today!",
      "Tell me a joke",
      "I finished my work!"
    ]);
  }

  bindEvents() {
    const form = this.container.querySelector('#chat-form');
    const input = this.container.querySelector('#chat-input');
    const avatarStage = this.container.querySelector('#avatar-stage');
    const clearBtn = this.container.querySelector('#clear-chat-btn');

    // Submit chat message
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      this.sendUserMessage(text);
    });

    // Clear chat
    clearBtn.addEventListener('click', () => {
      this.store.clearChat();
    });

    // Pokable avatar interaction
    avatarStage.addEventListener('click', (e) => {
      if (e.target.closest('#waifu-live-bubble')) return;
      this.handlePoke();
    });

    // Quick chips
    this.container.querySelectorAll('.stage-action-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const promptType = chip.dataset.prompt;
        this.handleQuickAction(promptType);
      });
    });
  }

  renderSuggestions(suggestions) {
    const container = this.container.querySelector('#chat-suggestions');
    if (!container) return;

    if (!suggestions || suggestions.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = suggestions.slice(0, 4).map(s => `
      <button type="button" class="suggestion-chip" data-text="${this.escapeHTML(s)}">${this.escapeHTML(s)}</button>
    `).join('');

    container.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.text;
        this.sendUserMessage(text);
      });
    });
  }

  async sendUserMessage(text) {
    this.store.addMessage('user', text);
    this.showTyping(true);

    const reply = await this.dialogue.processUserMessage(text);
    this.showTyping(false);

    if (reply) {
      this.showSpeechBubble(reply.text);
      if (reply.suggestions) {
        this.renderSuggestions(reply.suggestions);
      }
    }
  }

  handlePoke() {
    const persona = getPersonality(this.store.get('waifu.personality'));
    const pokeList = persona.poke;
    const poke = pokeList[Math.floor(Math.random() * pokeList.length)];

    this.store.set('waifu.mood', poke.mood);
    this.showSpeechBubble(poke.text);
    this.store.addMessage('waifu', poke.text, poke.mood);
    this.store.gainBondExp(8);

    // Bounce avatar animation
    const mount = this.container.querySelector('#avatar-mount');
    if (mount) {
      mount.classList.remove('avatar-bounced');
      void mount.offsetWidth;
      mount.classList.add('avatar-bounced');
    }
  }

  async handleQuickAction(type) {
    if (type === 'poke' || type === 'headpat') {
      this.handlePoke();
      return;
    }

    let userText = '';
    if (type === 'schedule') userText = "Can you review my schedule for today?";
    else if (type === 'compliment') userText = "You look adorable today!";

    if (userText) {
      this.sendUserMessage(userText);
    }
  }

  showSpeechBubble(text) {
    const bubble = this.container.querySelector('#waifu-live-bubble');
    const bubbleText = this.container.querySelector('#bubble-text');
    if (!bubble || !bubbleText) return;

    bubbleText.textContent = text;
    bubble.classList.add('visible');

    if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
    this.bubbleTimeout = setTimeout(() => {
      bubble.classList.remove('visible');
    }, 6000);
  }

  showTyping(show) {
    const typing = this.container.querySelector('#chat-typing');
    if (typing) typing.style.display = show ? 'flex' : 'none';
  }

  renderMessages() {
    const list = this.container.querySelector('#chat-messages');
    if (!list) return;

    const messages = this.store.get('chat.messages') || [];
    const waifuName = this.store.get('waifu.name');

    list.innerHTML = messages.map(msg => {
      const isWaifu = msg.sender === 'waifu';
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="chat-bubble-row ${isWaifu ? 'waifu-row' : 'user-row'}">
          <div class="chat-bubble-avatar">
            ${isWaifu ? '🌸' : '👤'}
          </div>
          <div class="chat-bubble-content">
            <div class="chat-bubble-sender">${isWaifu ? waifuName : 'You'}</div>
            <div class="chat-bubble-text">${this.escapeHTML(msg.text)}</div>
            <div class="chat-bubble-time">${time}</div>
          </div>
        </div>
      `;
    }).join('');

    list.scrollTop = list.scrollHeight;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender === 'waifu') {
      this.showSpeechBubble(lastMsg.text);
    }
  }

  calculateBondProgress() {
    const waifu = this.store.get('waifu');
    const expNeeded = waifu.bondLevel * 50;
    return Math.min(100, Math.round((waifu.bondExp / expNeeded) * 100));
  }

  updateAffectionMeter() {
    const levelBadge = this.container.querySelector('#affection-level');
    const fill = this.container.querySelector('#affection-fill');
    if (levelBadge) levelBadge.textContent = `Lv. ${this.store.get('waifu.bondLevel')}`;
    if (fill) fill.style.width = `${this.calculateBondProgress()}%`;
  }

  updatePersonalityBadge() {
    const persona = getPersonality(this.store.get('waifu.personality'));
    const tag = this.container.querySelector('#stage-personality-tag');
    if (tag) tag.textContent = persona.name;
  }

  updateName() {
    const name = this.store.get('waifu.name');
    const headerName = this.container.querySelector('#stage-waifu-name');
    if (headerName) headerName.textContent = name;
  }

  escapeHTML(str) {
    return (str || '').replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}



  /* --- Source: js/ui/settings.js --- */

// Settings Page Controller (Personality, Appearance, Wallpapers, Themes, Sound, Data)


class SettingsUI {
  constructor(containerElement, store, avatarInstance, speechEngine) {
    this.container = containerElement;
    this.store = store;
    this.avatar = avatarInstance;
    this.speech = speechEngine;

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    const waifu = this.store.get('waifu');
    const settings = this.store.get('settings');

    this.container.innerHTML = `
      <div class="settings-layout">
        <!-- SETTINGS TABS NAV -->
        <nav class="settings-nav">
          <button class="settings-tab-btn active" data-tab="personality">🌸 Personality</button>
          <button class="settings-tab-btn" data-tab="appearance">👗 Appearance & Clothes</button>
          <button class="settings-tab-btn" data-tab="wallpapers">🗾 Wallpapers</button>
          <button class="settings-tab-btn" data-tab="themes">🎨 Color Palette</button>
          <button class="settings-tab-btn" data-tab="voice">🎙️ Voice & AI</button>
          <button class="settings-tab-btn" data-tab="data">💾 Data & Backup</button>
        </nav>

        <!-- SETTINGS SECTIONS WRAPPER -->
        <div class="settings-content">

          <!-- 1. PERSONALITY TAB -->
          <div class="settings-section active" id="tab-personality">
            <div class="section-card">
              <h3 class="section-title">Companion Personality</h3>
              <p class="section-subtitle">Choose the personality archetype for your waifu companion. This changes her dialogue style, reactions to tasks, schedule reviews, and mood behavior.</p>
              
              <div class="form-group" style="margin-bottom: 20px;">
                <label class="form-label">Companion Name</label>
                <input type="text" id="setting-waifu-name" class="modal-input" value="${waifu.name}" style="max-width: 320px;" />
              </div>

              <div class="personality-grid">
                ${Object.values(PERSONALITIES).map(p => `
                  <div class="personality-card ${waifu.personality === p.id ? 'active' : ''}" data-persona="${p.id}">
                    <div class="persona-card-header">
                      <span class="persona-name">${p.name}</span>
                      <span class="persona-check">✔</span>
                    </div>
                    <p class="persona-tagline">${p.tagline}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- 2. APPEARANCE & CLOTHES TAB -->
          <div class="settings-section" id="tab-appearance">
            <div class="appearance-studio-layout">
              <!-- Appearance Controls -->
              <div class="appearance-controls-card">
                <h3 class="section-title">Visual Customizer</h3>
                <p class="section-subtitle">Customize hairstyle, clothing outfits, accessories, and colors.</p>

                <!-- Avatar Mode Toggle -->
                <div class="setting-row">
                  <div>
                    <strong>Avatar Type</strong>
                    <p class="setting-desc">Layered Anime SVG generator or custom uploaded image/GIF</p>
                  </div>
                  <select id="setting-avatar-mode" class="modal-select" style="width: 160px;">
                    <option value="svg" ${waifu.appearance.avatarMode === 'svg' ? 'selected' : ''}>Layered Anime (SVG)</option>
                    <option value="custom" ${waifu.appearance.avatarMode === 'custom' ? 'selected' : ''}>Custom Upload</option>
                  </select>
                </div>

                <!-- Custom Avatar URL & Upload -->
                <div id="custom-avatar-controls" style="${waifu.appearance.avatarMode === 'custom' ? 'display:block;' : 'display:none;'}">
                  <div class="setting-row">
                    <div>
                      <strong>Upload Image / GIF</strong>
                      <p class="setting-desc">Upload a PNG, JPG, or animated GIF sprite</p>
                    </div>
                    <label class="gcal-btn gcal-btn-outline" style="cursor:pointer;">
                      Browse File
                      <input type="file" id="setting-avatar-file" accept="image/*" style="display:none;" />
                    </label>
                  </div>
                  <div class="setting-row">
                    <label class="form-label" style="margin-bottom:0;">Or Image URL:</label>
                    <input type="url" id="setting-avatar-url" placeholder="https://example.com/waifu.png" class="modal-input" value="${waifu.appearance.customAvatarUrl || ''}" style="max-width:320px;" />
                  </div>
                </div>

                <div id="svg-avatar-controls" style="${waifu.appearance.avatarMode === 'svg' ? 'display:block;' : 'display:none;'}">
                  <!-- Hairstyle -->
                  <div class="setting-control-group">
                    <label class="form-label">Hairstyle</label>
                    <div class="btn-toggle-group" id="setting-hairstyle">
                      <button type="button" class="btn-toggle ${waifu.appearance.hairstyle === 'twintails' ? 'active' : ''}" data-val="twintails">Twintails</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.hairstyle === 'long' ? 'active' : ''}" data-val="long">Long Straight</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.hairstyle === 'short_bob' ? 'active' : ''}" data-val="short_bob">Short Bob</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.hairstyle === 'ponytail' ? 'active' : ''}" data-val="ponytail">Ponytail</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.hairstyle === 'wavy' ? 'active' : ''}" data-val="wavy">Wavy Hair</button>
                    </div>
                  </div>

                  <!-- Clothes & Outfits -->
                  <div class="setting-control-group">
                    <label class="form-label">Outfit / Clothes</label>
                    <div class="btn-toggle-group" id="setting-outfit">
                      <button type="button" class="btn-toggle ${waifu.appearance.outfit === 'seifuku' ? 'active' : ''}" data-val="seifuku">🏫 Sailor Seifuku</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.outfit === 'maid' ? 'active' : ''}" data-val="maid">☕ Maid Dress</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.outfit === 'casual' ? 'active' : ''}" data-val="casual">🛋️ Casual Hoodie</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.outfit === 'kimono' ? 'active' : ''}" data-val="kimono">👘 Summer Kimono</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.outfit === 'gothic' ? 'active' : ''}" data-val="gothic">🥀 Gothic Lolita</button>
                    </div>
                  </div>

                  <!-- Accessories -->
                  <div class="setting-control-group">
                    <label class="form-label">Accessories</label>
                    <div class="btn-toggle-group" id="setting-accessory">
                      <button type="button" class="btn-toggle ${waifu.appearance.accessory === 'ribbon' ? 'active' : ''}" data-val="ribbon">🎀 Ribbon</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.accessory === 'cat_ears' ? 'active' : ''}" data-val="cat_ears">🐱 Cat Ears</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.accessory === 'glasses' ? 'active' : ''}" data-val="glasses">👓 Glasses</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.accessory === 'headphones' ? 'active' : ''}" data-val="headphones">🎧 Headphones</button>
                      <button type="button" class="btn-toggle ${waifu.appearance.accessory === 'none' ? 'active' : ''}" data-val="none">None</button>
                    </div>
                  </div>

                  <!-- Color Pickers (Hair, Eyes) -->
                  <div class="setting-row-colors">
                    <div class="color-picker-box">
                      <label class="form-label">Hair Color</label>
                      <div class="color-input-wrap">
                        <input type="color" id="setting-hair-color" value="${waifu.appearance.hairColor}" />
                        <span class="color-hex-val" id="hair-hex-display">${waifu.appearance.hairColor}</span>
                      </div>
                    </div>

                    <div class="color-picker-box">
                      <label class="form-label">Eye Color</label>
                      <div class="color-input-wrap">
                        <input type="color" id="setting-eye-color" value="${waifu.appearance.eyeColor}" />
                        <span class="color-hex-val" id="eye-hex-display">${waifu.appearance.eyeColor}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Expressions Preview -->
                  <div class="setting-control-group">
                    <label class="form-label">Test Facial Expression</label>
                    <div class="btn-toggle-group" id="setting-test-mood">
                      <button type="button" class="btn-toggle ${waifu.mood === 'happy' ? 'active' : ''}" data-val="happy">✨ Happy</button>
                      <button type="button" class="btn-toggle ${waifu.mood === 'blush' ? 'active' : ''}" data-val="blush">💖 Blush</button>
                      <button type="button" class="btn-toggle ${waifu.mood === 'pout' ? 'active' : ''}" data-val="pout">💢 Pout</button>
                      <button type="button" class="btn-toggle ${waifu.mood === 'yandere' ? 'active' : ''}" data-val="yandere">🔪 Yandere</button>
                      <button type="button" class="btn-toggle ${waifu.mood === 'surprised' ? 'active' : ''}" data-val="surprised">❗ Surprised</button>
                      <button type="button" class="btn-toggle ${waifu.mood === 'neutral' ? 'active' : ''}" data-val="neutral">🌸 Neutral</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Live Preview Avatar Stage -->
              <div class="appearance-preview-card">
                <h4>Live Avatar Preview</h4>
                <div class="preview-stage" id="appearance-preview-stage"></div>
              </div>
            </div>
          </div>

          <!-- 3. WALLPAPERS TAB -->
          <div class="settings-section" id="tab-wallpapers">
            <div class="section-card">
              <h3 class="section-title">Wallpapers & Ambient Effects</h3>
              <p class="section-subtitle">Choose curated Japanese scenery, Tokyo cityscapes, or upload your own wallpaper image.</p>

              <!-- Upload Custom Wallpaper -->
              <div class="setting-row" style="margin-bottom: 24px;">
                <div>
                  <strong>Custom Wallpaper Upload</strong>
                  <p class="setting-desc">Use your own high-resolution image or desktop background</p>
                </div>
                <div style="display:flex; gap: 10px; align-items:center;">
                  <label class="gcal-btn gcal-btn-outline" style="cursor:pointer;">
                    Upload Image
                    <input type="file" id="setting-custom-wp-file" accept="image/*" style="display:none;" />
                  </label>
                  <input type="url" id="setting-custom-wp-url" placeholder="Or enter image URL..." class="modal-input" style="width: 250px;" value="${settings.customWallpaperUrl || ''}" />
                  <button class="gcal-btn gcal-btn-primary" id="btn-apply-wp-url">Apply</button>
                </div>
              </div>

              <!-- Stock Wallpapers Gallery -->
              <h4 class="form-label">Curated Japanese Aesthetic Wallpapers</h4>
              <div class="wallpaper-gallery-grid">
                ${STOCK_WALLPAPERS.map(wp => `
                  <div class="wallpaper-card ${settings.wallpaperId === wp.id && settings.wallpaperType === 'stock' ? 'active' : ''}" data-wp-id="${wp.id}" style="background: ${wp.fallback || '#1a102f'};">
                    <img src="${wp.thumb}" alt="${wp.name}" class="wp-thumb-img" onerror="this.style.opacity='0';" />
                    <div class="wp-info-overlay">
                      <span class="wp-name">${wp.name}</span>
                      <span class="wp-cat">${wp.category}</span>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Blur & Overlay sliders -->
              <div class="setting-row" style="margin-top: 30px;">
                <div>
                  <strong>Background Blur</strong>
                  <p class="setting-desc">Adds depth of field to make UI cards legible</p>
                </div>
                <div style="display:flex; align-items:center; gap: 12px;">
                  <input type="range" id="setting-wp-blur" min="0" max="15" value="${settings.wallpaperBlur}" />
                  <span id="wp-blur-val">${settings.wallpaperBlur}px</span>
                </div>
              </div>

              <div class="setting-row">
                <div>
                  <strong>Background Dim / Darkness</strong>
                  <p class="setting-desc">Dim overlay for comfortable contrast</p>
                </div>
                <div style="display:flex; align-items:center; gap: 12px;">
                  <input type="range" id="setting-wp-dim" min="10" max="80" value="${settings.wallpaperDim}" />
                  <span id="wp-dim-val">${settings.wallpaperDim}%</span>
                </div>
              </div>

              <div class="setting-row">
                <div>
                  <strong>Sakura Falling Petals</strong>
                  <p class="setting-desc">Gentle falling cherry blossom particle animation</p>
                </div>
                <input type="checkbox" id="setting-particles" ${settings.sakuraParticles ? 'checked' : ''} />
              </div>
            </div>
          </div>

          <!-- 4. COLOR PALETTES TAB -->
          <div class="settings-section" id="tab-themes">
            <div class="section-card">
              <h3 class="section-title">Color Palette & Interface Styling</h3>
              <p class="section-subtitle">Personalize your color palette, glassmorphism translucency, and accent colors.</p>

              <div class="theme-presets-grid">
                <div class="theme-card ${settings.theme === 'sakura' ? 'active' : ''}" data-theme="sakura">
                  <div class="theme-swatch" style="background: linear-gradient(135deg, #ff6584, #ffeef2);"></div>
                  <span class="theme-title">🌸 Sakura Blossom</span>
                </div>
                <div class="theme-card ${settings.theme === 'cyberpunk' ? 'active' : ''}" data-theme="cyberpunk">
                  <div class="theme-swatch" style="background: linear-gradient(135deg, #00f2fe, #4facfe, #ff007f);"></div>
                  <span class="theme-title">⚡ Cyberpunk Tokyo</span>
                </div>
                <div class="theme-card ${settings.theme === 'midnight' ? 'active' : ''}" data-theme="midnight">
                  <div class="theme-swatch" style="background: linear-gradient(135deg, #6c5ce7, #a29bfe, #1e1e2f);"></div>
                  <span class="theme-title">🌌 Midnight Lavender</span>
                </div>
                <div class="theme-card ${settings.theme === 'matcha' ? 'active' : ''}" data-theme="matcha">
                  <div class="theme-swatch" style="background: linear-gradient(135deg, #00b894, #55efc4, #192a27);"></div>
                  <span class="theme-title">🍵 Matcha Zen</span>
                </div>
                <div class="theme-card ${settings.theme === 'sunset' ? 'active' : ''}" data-theme="sunset">
                  <div class="theme-swatch" style="background: linear-gradient(135deg, #fd79a8, #e17055, #f39c12);"></div>
                  <span class="theme-title">🌇 Sunset Amber</span>
                </div>
                <div class="theme-card ${settings.theme === 'amoled' ? 'active' : ''}" data-theme="amoled">
                  <div class="theme-swatch" style="background: linear-gradient(135deg, #000000, #181818, #ff6584);"></div>
                  <span class="theme-title">🖤 AMOLED Dark</span>
                </div>
              </div>

              <div class="setting-row" style="margin-top: 30px;">
                <div>
                  <strong>Custom Accent Color</strong>
                  <p class="setting-desc">Highlight color for buttons, tags, and active tabs</p>
                </div>
                <div class="color-input-wrap">
                  <input type="color" id="setting-custom-accent" value="${settings.customAccent || '#ff6584'}" />
                  <span class="color-hex-val" id="accent-hex-display">${settings.customAccent || '#ff6584'}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. VOICE & AI TAB -->
          <div class="settings-section" id="tab-voice">
            <div class="section-card">
              <h3 class="section-title">Voice Synthesis (Web Speech TTS)</h3>
              <p class="section-subtitle">Enable your waifu companion to speak aloud using the browser's speech synthesizer.</p>

              <div class="setting-row">
                <div>
                  <strong>Text-to-Speech (TTS)</strong>
                  <p class="setting-desc">Enable Waifu voice lines when speaking</p>
                </div>
                <input type="checkbox" id="setting-tts-toggle" ${settings.ttsEnabled ? 'checked' : ''} />
              </div>

              <div class="setting-row">
                <label class="form-label" style="margin-bottom:0;">Synthesizer Voice</label>
                <select id="setting-tts-voice" class="modal-select" style="max-width: 320px;">
                  <option value="">Default Female / System Voice</option>
                </select>
              </div>

              <div class="setting-row">
                <div>
                  <strong>Voice Pitch</strong>
                  <p class="setting-desc">Adjust anime voice pitch</p>
                </div>
                <div style="display:flex; align-items:center; gap: 12px;">
                  <input type="range" id="setting-tts-pitch" min="0.8" max="1.8" step="0.05" value="${settings.ttsPitch}" />
                  <span id="tts-pitch-val">${settings.ttsPitch}</span>
                </div>
              </div>

              <div style="margin-top: 20px;">
                <button class="gcal-btn gcal-btn-outline" id="btn-test-voice">🔊 Test Voice</button>
              </div>
            </div>

            <!-- Optional LLM API Key -->
            <div class="section-card" style="margin-top: 20px;">
              <h3 class="section-title">Optional AI Model Integration (OpenAI / Gemini / OpenRouter)</h3>
              <p class="section-subtitle">By default, Waifu-Space uses an instant, offline, personality-driven dialogue engine. You can optionally connect an AI API key for limitless natural conversations.</p>

              <div class="setting-row">
                <label class="form-label" style="margin-bottom:0;">AI Provider</label>
                <select id="setting-llm-provider" class="modal-select" style="max-width: 260px;">
                  <option value="none" ${settings.llmProvider === 'none' ? 'selected' : ''}>Built-in Offline Persona Engine</option>
                  <option value="gemini" ${settings.llmProvider === 'gemini' ? 'selected' : ''}>Google Gemini (Gemini 1.5 Flash)</option>
                  <option value="openai" ${settings.llmProvider === 'openai' ? 'selected' : ''}>OpenAI (GPT-4o Mini)</option>
                  <option value="openrouter" ${settings.llmProvider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
                </select>
              </div>

              <div class="setting-row" id="llm-key-row" style="${settings.llmProvider !== 'none' ? 'display:flex;' : 'display:none;'}">
                <div>
                  <strong>API Key</strong>
                  <p class="setting-desc">Stored locally in your browser's LocalStorage</p>
                </div>
                <input type="password" id="setting-llm-key" class="modal-input" placeholder="Paste your API key here..." value="${settings.llmApiKey || ''}" style="max-width:320px;" />
              </div>
            </div>
          </div>

          <!-- 6. DATA & BACKUP TAB -->
          <div class="settings-section" id="tab-data">
            <div class="section-card">
              <h3 class="section-title">Data Backup & Factory Reset</h3>
              <p class="section-subtitle">Export your full configuration, events, and chat logs, or restore from a backup.</p>

              <div class="setting-row">
                <div>
                  <strong>Export Full Backup (JSON)</strong>
                  <p class="setting-desc">Download all companion settings, calendar tasks, and bond data</p>
                </div>
                <button class="gcal-btn gcal-btn-outline" id="btn-export-json">Export Backup</button>
              </div>

              <div class="setting-row">
                <div>
                  <strong>Restore from Backup</strong>
                  <p class="setting-desc">Import a previously saved JSON file</p>
                </div>
                <label class="gcal-btn gcal-btn-outline" style="cursor:pointer;">
                  Choose File
                  <input type="file" id="setting-import-json" accept=".json" style="display:none;" />
                </label>
              </div>

              <div class="setting-row" style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 30px; padding-top: 20px;">
                <div>
                  <strong style="color: #ff4757;">Factory Reset</strong>
                  <p class="setting-desc">Wipe all data and restore factory defaults</p>
                </div>
                <button class="gcal-btn gcal-btn-danger" id="btn-reset-all">Reset Everything</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    // Populate voice dropdown if available
    this.populateVoices();

    // Render live preview in appearance tab
    const previewStage = this.container.querySelector('#appearance-preview-stage');
    if (previewStage && this.avatar) {
      previewStage.innerHTML = '';
      const cloneAvatar = new (this.avatar.constructor)(previewStage, this.store);
    }
  }

  populateVoices() {
    if (!this.speech) return;
    const select = this.container.querySelector('#setting-tts-voice');
    if (!select) return;

    const voices = this.speech.getVoices();
    const currentVoice = this.store.get('settings.ttsVoice');
    if (voices.length > 0) {
      select.innerHTML = '<option value="">Auto (Best Female/Anime Voice)</option>' +
        voices.map(v => `<option value="${v.name}" ${v.name === currentVoice ? 'selected' : ''}>${v.name} (${v.lang})</option>`).join('');
    }
  }

  bindEvents() {
    // Tab switching
    this.container.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
        this.container.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        const target = this.container.querySelector(`#tab-${btn.dataset.tab}`);
        if (target) target.classList.add('active');
      });
    });

    // Companion name
    const nameInput = this.container.querySelector('#setting-waifu-name');
    nameInput.addEventListener('input', (e) => {
      this.store.set('waifu.name', e.target.value.trim() || 'Akari');
    });

    // Personality cards
    this.container.querySelectorAll('.personality-card').forEach(card => {
      card.addEventListener('click', () => {
        this.container.querySelectorAll('.personality-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const personaId = card.dataset.persona;
        this.store.set('waifu.personality', personaId);
        window.__showToast?.(`Personality switched to ${PERSONALITIES[personaId].name}!`);
      });
    });

    // Avatar mode
    const modeSelect = this.container.querySelector('#setting-avatar-mode');
    const svgControls = this.container.querySelector('#svg-avatar-controls');
    const customControls = this.container.querySelector('#custom-avatar-controls');
    modeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      this.store.set('waifu.appearance.avatarMode', mode);
      svgControls.style.display = mode === 'svg' ? 'block' : 'none';
      customControls.style.display = mode === 'custom' ? 'block' : 'none';
    });

    // Custom avatar file upload
    const avatarFileInput = this.container.querySelector('#setting-avatar-file');
    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        this.store.set('waifu.appearance.customAvatarUrl', evt.target.result);
        this.store.set('waifu.appearance.avatarMode', 'custom');
        modeSelect.value = 'custom';
        svgControls.style.display = 'none';
        customControls.style.display = 'block';
        window.__showToast?.('Custom avatar updated!');
      };
      reader.readAsDataURL(file);
    });

    const avatarUrlInput = this.container.querySelector('#setting-avatar-url');
    avatarUrlInput.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      if (val) {
        this.store.set('waifu.appearance.customAvatarUrl', val);
        this.store.set('waifu.appearance.avatarMode', 'custom');
        modeSelect.value = 'custom';
        svgControls.style.display = 'none';
        customControls.style.display = 'block';
        window.__showToast?.('Custom avatar URL applied!');
      }
    });

    // Hairstyle, Outfit, Accessory buttons
    this.bindToggleGroup('#setting-hairstyle', 'waifu.appearance.hairstyle');
    this.bindToggleGroup('#setting-outfit', 'waifu.appearance.outfit');
    this.bindToggleGroup('#setting-accessory', 'waifu.appearance.accessory');
    this.bindToggleGroup('#setting-test-mood', 'waifu.mood');

    // Colors
    const hairColorInput = this.container.querySelector('#setting-hair-color');
    const hairHexDisplay = this.container.querySelector('#hair-hex-display');
    hairColorInput.addEventListener('input', (e) => {
      this.store.set('waifu.appearance.hairColor', e.target.value);
      hairHexDisplay.textContent = e.target.value;
    });

    const eyeColorInput = this.container.querySelector('#setting-eye-color');
    const eyeHexDisplay = this.container.querySelector('#eye-hex-display');
    eyeColorInput.addEventListener('input', (e) => {
      this.store.set('waifu.appearance.eyeColor', e.target.value);
      eyeHexDisplay.textContent = e.target.value;
    });

    // Wallpapers
    this.container.querySelectorAll('.wallpaper-card').forEach(card => {
      card.addEventListener('click', () => {
        this.container.querySelectorAll('.wallpaper-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const id = card.dataset.wpId;
        this.store.set('settings.wallpaperType', 'stock');
        this.store.set('settings.wallpaperId', id);
        window.__applyWallpaper?.();
      });
    });

    // Custom wallpaper upload
    const customWpFile = this.container.querySelector('#setting-custom-wp-file');
    customWpFile.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        this.store.set('settings.wallpaperType', 'custom');
        this.store.set('settings.customWallpaperUrl', evt.target.result);
        window.__applyWallpaper?.();
        window.__showToast?.('Custom wallpaper applied!');
      };
      reader.readAsDataURL(file);
    });

    const customWpUrl = this.container.querySelector('#setting-custom-wp-url');
    this.container.querySelector('#btn-apply-wp-url').addEventListener('click', () => {
      const val = customWpUrl.value.trim();
      if (val) {
        this.store.set('settings.wallpaperType', 'custom');
        this.store.set('settings.customWallpaperUrl', val);
        window.__applyWallpaper?.();
        window.__showToast?.('Custom wallpaper URL applied!');
      }
    });

    // Sliders
    const blurSlider = this.container.querySelector('#setting-wp-blur');
    const blurVal = this.container.querySelector('#wp-blur-val');
    blurSlider.addEventListener('input', (e) => {
      this.store.set('settings.wallpaperBlur', parseInt(e.target.value, 10));
      blurVal.textContent = `${e.target.value}px`;
      window.__applyWallpaper?.();
    });

    const dimSlider = this.container.querySelector('#setting-wp-dim');
    const dimVal = this.container.querySelector('#wp-dim-val');
    dimSlider.addEventListener('input', (e) => {
      this.store.set('settings.wallpaperDim', parseInt(e.target.value, 10));
      dimVal.textContent = `${e.target.value}%`;
      window.__applyWallpaper?.();
    });

    const particlesCheck = this.container.querySelector('#setting-particles');
    particlesCheck.addEventListener('change', (e) => {
      this.store.set('settings.sakuraParticles', e.target.checked);
      window.__toggleParticles?.(e.target.checked);
    });

    // Themes
    this.container.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        this.container.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const theme = card.dataset.theme;
        this.store.set('settings.theme', theme);
        window.__applyTheme?.();
      });
    });

    const accentInput = this.container.querySelector('#setting-custom-accent');
    const accentHex = this.container.querySelector('#accent-hex-display');
    accentInput.addEventListener('input', (e) => {
      this.store.set('settings.customAccent', e.target.value);
      accentHex.textContent = e.target.value;
      window.__applyTheme?.();
    });

    // Voice & TTS
    const ttsToggle = this.container.querySelector('#setting-tts-toggle');
    ttsToggle.addEventListener('change', (e) => {
      this.store.set('settings.ttsEnabled', e.target.checked);
    });

    const ttsVoice = this.container.querySelector('#setting-tts-voice');
    ttsVoice.addEventListener('change', (e) => {
      this.store.set('settings.ttsVoice', e.target.value);
    });

    const ttsPitch = this.container.querySelector('#setting-tts-pitch');
    const pitchVal = this.container.querySelector('#tts-pitch-val');
    ttsPitch.addEventListener('input', (e) => {
      this.store.set('settings.ttsPitch', parseFloat(e.target.value));
      pitchVal.textContent = e.target.value;
    });

    this.container.querySelector('#btn-test-voice').addEventListener('click', () => {
      if (this.speech) {
        this.speech.speak(`Hello! I am ${this.store.get('waifu.name')}! Let's do our best today!`);
      }
    });

    // LLM Provider
    const llmProvider = this.container.querySelector('#setting-llm-provider');
    const llmKeyRow = this.container.querySelector('#llm-key-row');
    const llmKeyInput = this.container.querySelector('#setting-llm-key');

    llmProvider.addEventListener('change', (e) => {
      const val = e.target.value;
      this.store.set('settings.llmProvider', val);
      llmKeyRow.style.display = val !== 'none' ? 'flex' : 'none';
    });

    llmKeyInput.addEventListener('change', (e) => {
      this.store.set('settings.llmApiKey', e.target.value.trim());
      window.__showToast?.('AI API Key saved securely!');
    });

    // Data Export / Import / Reset
    this.container.querySelector('#btn-export-json').addEventListener('click', () => {
      const dataStr = this.store.exportData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `waifuspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const importJsonInput = this.container.querySelector('#setting-import-json');
    importJsonInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const ok = this.store.importData(evt.target.result);
        if (ok) {
          window.__showToast?.('Data restored successfully!');
          setTimeout(() => location.reload(), 500);
        } else {
          alert('Invalid backup file.');
        }
      };
      reader.readAsText(file);
    });

    this.container.querySelector('#btn-reset-all').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all settings, events, and chat logs to defaults?')) {
        this.store.resetAll();
        location.reload();
      }
    });
  }

  bindToggleGroup(selector, statePath) {
    const group = this.container.querySelector(selector);
    if (!group) return;
    group.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.store.set(statePath, btn.dataset.val);
      });
    });
  }
}



  /* --- Source: js/app.js --- */

// Application Bootstrap & Orchestrator


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



})();
