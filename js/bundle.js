// WaifuSpace Standalone Bundle - Zero dependencies, runs directly via double-clicking index.html
(function() {
  "use strict";

  /* --- Source: js/assets/wallpapers.js --- */

// Curated Japanese Aesthetic Wallpapers
const STOCK_WALLPAPERS = [
  {
    id: 'sakura-shrine',
    name: 'Sakura Shrine',
    category: 'Japan Traditional',
    url: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?q=80&w=2092&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: 'shibuya-neon',
    name: 'Shibuya Cyber Neon',
    category: 'Cyberpunk Tokyo',
    url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=2070&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: 'fuji-pagoda',
    name: 'Mt. Fuji & Pagoda',
    category: 'Iconic Japan',
    url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2070&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: 'rainy-tokyo',
    name: 'Rainy Night in Shinjuku',
    category: 'Lo-Fi Rain',
    url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=2070&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: 'kyoto-torii',
    name: 'Fushimi Inari Torii',
    category: 'Kyoto Sanctuary',
    url: 'https://images.unsplash.com/photo-1478436127897-769e00d2c715?q=80&w=2070&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1478436127897-769e00d2c715?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: 'arashiyama-bamboo',
    name: 'Arashiyama Bamboo Grove',
    category: 'Kyoto Nature',
    url: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?q=80&w=2062&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: 'anime-starry-sky',
    name: 'Anime Starry Night',
    category: 'Anime Aesthetic',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2070&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: 'cozy-lofi-room',
    name: 'Cozy Lo-Fi Sunset',
    category: 'Anime Room',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2068&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop'
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

// Layered Anime Avatar Generator (SVG & Custom Upload Support)

class WaifuAvatar {
  constructor(containerElement, stateManager) {
    this.container = containerElement;
    this.store = stateManager;
    this.blinkInterval = null;
    this.isBlinking = false;
    this.mouthTalking = false;

    this.init();
  }

  init() {
    this.render();
    this.startBlinkLoop();

    // Subscribe to appearance and mood changes
    this.store.subscribe('waifu.appearance', () => this.render());
    this.store.subscribe('waifu.mood', () => this.render());
    this.store.subscribe('waifu.appearance.avatarMode', () => this.render());
    this.store.subscribe('waifu.appearance.customAvatarUrl', () => this.render());
  }

  startBlinkLoop() {
    if (this.blinkInterval) clearInterval(this.blinkInterval);
    const scheduleNextBlink = () => {
      const delay = 2500 + Math.random() * 3500;
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
    }, 180);
  }

  setTalking(isTalking) {
    this.mouthTalking = isTalking;
    const mouth = this.container.querySelector('.avatar-mouth');
    if (mouth) {
      if (isTalking) {
        mouth.classList.add('talking');
      } else {
        mouth.classList.remove('talking');
      }
    }
  }

  render() {
    const app = this.store.get('waifu.appearance');
    const mood = this.store.get('waifu.mood') || 'neutral';

    if (app.avatarMode === 'custom' && app.customAvatarUrl) {
      this.container.innerHTML = `
        <div class="custom-avatar-wrapper ${mood}">
          <img src="${app.customAvatarUrl}" alt="Custom Waifu Avatar" class="custom-avatar-img animate-breathe" />
          <div class="custom-avatar-mood-badge">${this.getMoodEmoji(mood)}</div>
        </div>
      `;
      return;
    }

    // Render layered SVG avatar
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
    const hairColor = app.hairColor || '#ff7597';
    const eyeColor = app.eyeColor || '#4f86f7';
    const skinTone = app.skinTone || '#fff0ea';
    const blushColor = 'rgba(255, 99, 132, 0.45)';
    const shadowColor = 'rgba(200, 150, 160, 0.25)';

    return `
      <svg viewBox="0 0 400 500" class="waifu-avatar-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${hairColor}" />
            <stop offset="100%" stop-color="${this.shadeColor(hairColor, -25)}" />
          </linearGradient>
          <linearGradient id="hairHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8" />
            <stop offset="100%" stop-color="${hairColor}" stop-opacity="0" />
          </linearGradient>
          <radialGradient id="eyeGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="${this.shadeColor(eyeColor, 40)}" />
            <stop offset="60%" stop-color="${eyeColor}" />
            <stop offset="100%" stop-color="${this.shadeColor(eyeColor, -40)}" />
          </radialGradient>
          <radialGradient id="yandereGaze" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ff0055" />
            <stop offset="60%" stop-color="#800020" />
            <stop offset="100%" stop-color="#2a0008" />
          </radialGradient>
          <filter id="softGaze" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        <!-- BACK HAIR -->
        <g id="back-hair">
          ${this.renderBackHair(app.hairstyle, hairColor)}
        </g>

        <!-- BODY & OUTFIT BASE -->
        <g id="body-base">
          <!-- Neck -->
          <polygon points="184,240 216,240 220,290 180,290" fill="${this.shadeColor(skinTone, -8)}" />
          <polygon points="188,248 212,248 216,285 184,285" fill="${skinTone}" />
          <!-- Shoulders & Upper Body -->
          <path d="M 140,330 C 145,280 180,270 200,270 C 220,270 255,280 260,330 L 275,500 L 125,500 Z" fill="${skinTone}" />
        </g>

        <!-- CLOTHES / OUTFIT -->
        <g id="outfit">
          ${this.renderOutfit(app.outfit)}
        </g>

        <!-- HEAD & FACE -->
        <g id="head-base">
          <!-- Face Contour -->
          <path d="M 140,160 C 135,215 170,265 200,268 C 230,265 265,215 260,160 C 255,100 145,100 140,160 Z" fill="${skinTone}" />
          <!-- Chin Shadow -->
          <path d="M 175,255 C 190,264 210,264 225,255 C 210,268 190,268 175,255 Z" fill="${shadowColor}" />
          
          <!-- Ears -->
          <path d="M 137,175 C 128,175 125,190 133,200 C 137,195 138,185 137,175 Z" fill="${skinTone}" />
          <path d="M 263,175 C 272,175 275,190 267,200 C 263,195 262,185 263,175 Z" fill="${skinTone}" />

          <!-- Blush cheeks -->
          ${this.renderBlush(mood, blushColor)}
        </g>

        <!-- EYES & EYEBROWS -->
        <g id="eyes" class="avatar-eyes-group">
          ${this.renderEyebrows(mood)}
          ${this.renderEyes(mood, eyeColor)}
        </g>

        <!-- NOSE -->
        <circle cx="200" cy="198" r="1.5" fill="#e0a39a" />

        <!-- MOUTH -->
        <g id="mouth" class="avatar-mouth">
          ${this.renderMouth(mood)}
        </g>

        <!-- BANGS & FRONT HAIR -->
        <g id="front-hair">
          ${this.renderFrontHair(app.hairstyle, hairColor)}
        </g>

        <!-- ACCESSORIES -->
        <g id="accessory">
          ${this.renderAccessory(app.accessory)}
        </g>

        <!-- YANDERE DARK VIGNETTE EFFECT -->
        ${mood === 'yandere' ? `
          <rect x="0" y="0" width="400" height="230" fill="url(#yandereShadow)" opacity="0.35" pointer-events="none" />
          <defs>
            <linearGradient id="yandereShadow" x1="0" y1="0" x2="0" y2="100%">
              <stop offset="0%" stop-color="#110008" stop-opacity="0.9" />
              <stop offset="100%" stop-color="#ff0044" stop-opacity="0" />
            </linearGradient>
          </defs>
        ` : ''}
      </svg>
    `;
  }

  renderBackHair(style, color) {
    const dark = this.shadeColor(color, -20);
    switch (style) {
      case 'twintails':
        return `
          <!-- Left Twintail -->
          <path d="M 140,150 C 90,180 50,260 70,360 C 80,410 95,440 90,460 C 80,430 75,370 85,320 C 95,270 120,200 145,170 Z" fill="url(#hairGrad)" />
          <path d="M 85,320 C 80,380 90,420 88,450 C 75,410 70,350 75,300 Z" fill="${dark}" />
          <!-- Right Twintail -->
          <path d="M 260,150 C 310,180 350,260 330,360 C 320,410 305,440 310,460 C 320,430 325,370 315,320 C 305,270 280,200 255,170 Z" fill="url(#hairGrad)" />
          <path d="M 315,320 C 320,380 310,420 312,450 C 325,410 330,350 325,300 Z" fill="${dark}" />
        `;
      case 'long':
        return `
          <path d="M 130,150 C 110,210 100,320 115,460 C 140,470 170,475 200,475 C 230,475 260,470 285,460 C 300,320 290,210 270,150 Z" fill="url(#hairGrad)" />
          <path d="M 115,460 C 150,470 250,470 285,460 C 275,440 260,340 270,220 C 255,300 240,400 200,410 C 160,400 145,300 130,220 Z" fill="${dark}" />
        `;
      case 'ponytail':
        return `
          <path d="M 240,120 C 290,130 340,190 335,280 C 330,350 300,400 310,430 C 295,380 310,320 305,260 C 300,200 260,150 240,140 Z" fill="url(#hairGrad)" />
        `;
      case 'wavy':
        return `
          <path d="M 135,160 C 100,220 110,310 90,380 C 80,420 115,450 120,470 C 105,440 100,380 120,320 C 135,270 130,200 140,160 Z" fill="url(#hairGrad)" />
          <path d="M 265,160 C 300,220 290,310 310,380 C 320,420 285,450 280,470 C 295,440 300,380 280,320 C 265,270 270,200 260,160 Z" fill="url(#hairGrad)" />
        `;
      case 'short_bob':
      default:
        return `
          <path d="M 135,150 C 120,200 125,250 140,280 C 160,290 240,290 260,280 C 275,250 280,200 265,150 Z" fill="url(#hairGrad)" />
        `;
    }
  }

  renderFrontHair(style, color) {
    const shine = 'rgba(255, 255, 255, 0.4)';
    return `
      <!-- Hair Crown & Base -->
      <path d="M 135,160 C 130,95 270,95 265,160 C 255,140 240,130 200,130 C 160,130 145,140 135,160 Z" fill="url(#hairGrad)" />
      
      <!-- Bangs -->
      <path d="M 135,155 C 145,180 155,200 160,195 C 165,190 170,165 175,155 C 180,185 190,205 198,205 C 205,205 215,180 220,155 C 225,175 235,195 242,190 C 248,185 255,170 265,155 C 260,120 140,120 135,155 Z" fill="url(#hairGrad)" />
      
      <!-- Side Strands Framing Face -->
      <path d="M 137,150 C 130,190 132,230 145,260 C 142,235 140,190 145,160 Z" fill="url(#hairGrad)" />
      <path d="M 263,150 C 270,190 268,230 255,260 C 258,235 260,190 255,160 Z" fill="url(#hairGrad)" />

      <!-- Anime Hair Gloss / Halo Highlight -->
      <ellipse cx="200" cy="125" rx="55" ry="8" fill="${shine}" opacity="0.75" />
      <path d="M 155,125 Q 200,118 245,125 Q 200,128 155,125 Z" fill="#ffffff" opacity="0.6" />
    `;
  }

  renderOutfit(outfit) {
    switch (outfit) {
      case 'maid':
        return `
          <!-- Maid Dress (Black & White Frills) -->
          <path d="M 155,285 L 245,285 L 265,420 L 135,420 Z" fill="#1e1e24" />
          <!-- White Pinafore Apron -->
          <path d="M 175,285 L 225,285 L 235,420 L 165,420 Z" fill="#ffffff" />
          <!-- Frills on straps -->
          <path d="M 165,285 Q 160,330 170,380" stroke="#f1f2f6" stroke-width="6" fill="none" />
          <path d="M 235,285 Q 240,330 230,380" stroke="#f1f2f6" stroke-width="6" fill="none" />
          <!-- Collar & Maid Bow -->
          <path d="M 185,280 L 200,295 L 215,280 Z" fill="#ffffff" />
          <circle cx="200" cy="295" r="4" fill="#ff4757" />
          <path d="M 200,295 L 188,305 L 195,315 L 200,300 L 205,315 L 212,305 Z" fill="#ff4757" />
        `;
      case 'kimono':
        return `
          <!-- Japanese Summer Kimono / Yukata (Floral Indigo & Gold) -->
          <path d="M 145,280 L 255,280 L 275,440 L 125,440 Z" fill="#2c3e50" />
          <!-- Kimono Lapels (Crossed Right over Left) -->
          <polygon points="160,280 200,335 240,280 225,280 200,315 175,280" fill="#ecf0f1" />
          <polygon points="165,285 200,335 180,335 150,285" fill="#e74c3c" />
          <!-- Obi Sash (Gold / Scarlet) -->
          <rect x="155" y="340" width="90" height="35" rx="3" fill="#f1c40f" />
          <rect x="155" y="352" width="90" height="10" fill="#e74c3c" />
          <!-- Subtle Floral Blossoms on Fabric -->
          <circle cx="150" cy="390" r="5" fill="#e84393" opacity="0.7" />
          <circle cx="245" cy="410" r="6" fill="#e84393" opacity="0.7" />
          <circle cx="160" cy="425" r="4" fill="#e84393" opacity="0.7" />
        `;
      case 'gothic':
        return `
          <!-- Gothic Lolita (Dark Crimson & Velvet Black) -->
          <path d="M 150,280 L 250,280 L 270,440 L 130,440 Z" fill="#140a10" />
          <!-- Corset Lacing -->
          <path d="M 175,285 L 225,285 L 220,380 L 180,380 Z" fill="#4a0e2e" />
          <line x1="185" y1="300" x2="215" y2="315" stroke="#ff3860" stroke-width="2" />
          <line x1="215" y1="300" x2="185" y2="315" stroke="#ff3860" stroke-width="2" />
          <line x1="185" y1="325" x2="215" y2="340" stroke="#ff3860" stroke-width="2" />
          <line x1="215" y1="325" x2="185" y2="340" stroke="#ff3860" stroke-width="2" />
          <!-- Black Choker with Cross Gem -->
          <rect x="186" y="260" width="28" height="6" rx="2" fill="#000000" />
          <polygon points="200,263 203,266 200,269 197,266" fill="#ff0055" />
        `;
      case 'casual':
        return `
          <!-- Cozy Oversized Hoodie -->
          <path d="M 140,280 C 145,270 255,270 260,280 L 275,440 L 125,440 Z" fill="#6c5ce7" />
          <!-- Hood neckline -->
          <ellipse cx="200" cy="285" rx="35" ry="15" fill="#a29bfe" />
          <ellipse cx="200" cy="283" rx="25" ry="10" fill="#5848c2" />
          <!-- Hoodie Drawstrings -->
          <path d="M 188,290 L 188,340" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
          <path d="M 212,290 L 212,335" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
          <circle cx="188" cy="342" r="2.5" fill="#ffffff" />
          <circle cx="212" cy="337" r="2.5" fill="#ffffff" />
          <!-- Cute pocket motif -->
          <path d="M 170,370 L 230,370 L 225,410 L 175,410 Z" fill="#5848c2" opacity="0.6" rx="4" />
        `;
      case 'seifuku':
      default:
        return `
          <!-- Japanese High School Sailor Uniform (Seifuku) -->
          <path d="M 150,285 L 250,285 L 265,430 L 135,430 Z" fill="#ffffff" />
          <!-- Navy Sailor Flap / Collar -->
          <polygon points="175,280 200,320 225,280 255,280 260,330 230,340 200,325 170,340 140,330 145,280" fill="#2d3436" />
          <!-- White Ribbon Stripes on Collar -->
          <path d="M 148,322 L 170,332 L 195,318" stroke="#ffffff" stroke-width="1.5" fill="none" />
          <path d="M 252,322 L 230,332 L 205,318" stroke="#ffffff" stroke-width="1.5" fill="none" />
          <!-- Sailor Scarf / Red Ribbon Tie -->
          <polygon points="194,318 206,318 209,355 200,370 191,355" fill="#ff4757" />
          <circle cx="200" cy="320" r="4.5" fill="#d63031" />
        `;
    }
  }

  renderEyebrows(mood) {
    const browColor = '#2d3436';
    switch (mood) {
      case 'pout':
        // Angry / Tsundere slanted brows
        return `
          <path d="M 160,165 Q 175,172 188,168" stroke="${browColor}" stroke-width="2.5" stroke-linecap="round" fill="none" />
          <path d="M 240,165 Q 225,172 212,168" stroke="${browColor}" stroke-width="2.5" stroke-linecap="round" fill="none" />
        `;
      case 'blush':
        // Shy arched brows
        return `
          <path d="M 160,166 Q 173,161 188,166" stroke="${browColor}" stroke-width="2.5" stroke-linecap="round" fill="none" />
          <path d="M 240,166 Q 227,161 212,166" stroke="${browColor}" stroke-width="2.5" stroke-linecap="round" fill="none" />
        `;
      case 'surprised':
        // High raised brows
        return `
          <path d="M 160,158 Q 175,152 188,158" stroke="${browColor}" stroke-width="2.5" stroke-linecap="round" fill="none" />
          <path d="M 240,158 Q 225,152 212,158" stroke="${browColor}" stroke-width="2.5" stroke-linecap="round" fill="none" />
        `;
      case 'yandere':
        // Slightly tense, lowered predatory brows
        return `
          <path d="M 160,164 Q 175,160 188,166" stroke="${browColor}" stroke-width="2.8" stroke-linecap="round" fill="none" />
          <path d="M 240,164 Q 225,160 212,166" stroke="${browColor}" stroke-width="2.8" stroke-linecap="round" fill="none" />
        `;
      case 'happy':
      default:
        // Gentle relaxed brows
        return `
          <path d="M 160,164 Q 175,161 188,164" stroke="${browColor}" stroke-width="2.2" stroke-linecap="round" fill="none" />
          <path d="M 240,164 Q 225,161 212,164" stroke="${browColor}" stroke-width="2.2" stroke-linecap="round" fill="none" />
        `;
    }
  }

  renderEyes(mood, eyeColor) {
    if (mood === 'yandere') {
      return `
        <!-- Left Eye (Yandere Glowing Iris with Heart Pupil) -->
        <g id="eye-left">
          <ellipse cx="174" cy="182" rx="14" ry="12" fill="#ffffff" />
          <ellipse cx="174" cy="182" rx="11" ry="11" fill="url(#yandereGaze)" />
          <!-- Eerie Heart / Concentric Pupil -->
          <circle cx="174" cy="182" r="5" fill="#ff0055" />
          <circle cx="174" cy="182" r="2.5" fill="#ffffff" opacity="0.9" />
          <path d="M 160,175 C 166,170 182,170 188,175" stroke="#1e272e" stroke-width="3" fill="none" stroke-linecap="round" />
        </g>
        <!-- Right Eye -->
        <g id="eye-right">
          <ellipse cx="226" cy="182" rx="14" ry="12" fill="#ffffff" />
          <ellipse cx="226" cy="182" rx="11" ry="11" fill="url(#yandereGaze)" />
          <circle cx="226" cy="182" r="5" fill="#ff0055" />
          <circle cx="226" cy="182" r="2.5" fill="#ffffff" opacity="0.9" />
          <path d="M 212,175 C 218,170 234,170 240,175" stroke="#1e272e" stroke-width="3" fill="none" stroke-linecap="round" />
        </g>
      `;
    }

    if (mood === 'happy') {
      // Smiling closed crescent anime eyes
      return `
        <g id="eye-left">
          <path d="M 162,185 Q 174,173 186,185" stroke="#2d3436" stroke-width="3.5" stroke-linecap="round" fill="none" />
          <!-- Cute lash -->
          <line x1="185" y1="184" x2="190" y2="180" stroke="#2d3436" stroke-width="2.5" stroke-linecap="round" />
        </g>
        <g id="eye-right">
          <path d="M 214,185 Q 226,173 238,185" stroke="#2d3436" stroke-width="3.5" stroke-linecap="round" fill="none" />
          <line x1="237" y1="184" x2="242" y2="180" stroke="#2d3436" stroke-width="2.5" stroke-linecap="round" />
        </g>
      `;
    }

    // Standard Open Sparkling Anime Eyes
    return `
      <g id="eye-left">
        <!-- Sclera -->
        <ellipse cx="174" cy="184" rx="13" ry="12" fill="#ffffff" />
        <!-- Iris -->
        <ellipse cx="174" cy="184" rx="10" ry="11" fill="url(#eyeGrad)" />
        <!-- Pupil -->
        <ellipse cx="174" cy="184" rx="5" ry="6" fill="#1b1464" />
        <!-- Highlights -->
        <ellipse cx="171" cy="179" rx="3.5" ry="3.5" fill="#ffffff" />
        <ellipse cx="177" cy="188" rx="1.8" ry="1.8" fill="#ffffff" opacity="0.8" />
        <!-- Eyelash / Upper Lid -->
        <path d="M 160,177 C 166,172 182,172 188,177" stroke="#2d3436" stroke-width="3.2" fill="none" stroke-linecap="round" />
        <!-- Wing lash -->
        <line x1="187" y1="176" x2="192" y2="173" stroke="#2d3436" stroke-width="2.5" stroke-linecap="round" />
      </g>

      <g id="eye-right">
        <ellipse cx="226" cy="184" rx="13" ry="12" fill="#ffffff" />
        <ellipse cx="226" cy="184" rx="10" ry="11" fill="url(#eyeGrad)" />
        <ellipse cx="226" cy="184" rx="5" ry="6" fill="#1b1464" />
        <ellipse cx="223" cy="179" rx="3.5" ry="3.5" fill="#ffffff" />
        <ellipse cx="229" cy="188" rx="1.8" ry="1.8" fill="#ffffff" opacity="0.8" />
        <path d="M 212,177 C 218,172 234,172 240,177" stroke="#2d3436" stroke-width="3.2" fill="none" stroke-linecap="round" />
        <line x1="239" y1="176" x2="244" y2="173" stroke="#2d3436" stroke-width="2.5" stroke-linecap="round" />
      </g>
    `;
  }

  renderBlush(mood, blushColor) {
    if (mood === 'blush' || mood === 'pout') {
      return `
        <!-- Intense Rosy Blush -->
        <ellipse cx="158" cy="202" rx="14" ry="8" fill="${blushColor}" />
        <ellipse cx="242" cy="202" rx="14" ry="8" fill="${blushColor}" />
        <!-- Manga blush hatch lines -->
        <line x1="150" y1="204" x2="155" y2="198" stroke="#ff4757" stroke-width="1.5" />
        <line x1="155" y1="205" x2="160" y2="199" stroke="#ff4757" stroke-width="1.5" />
        <line x1="160" y1="206" x2="165" y2="200" stroke="#ff4757" stroke-width="1.5" />
        <line x1="235" y1="204" x2="240" y2="198" stroke="#ff4757" stroke-width="1.5" />
        <line x1="240" y1="205" x2="245" y2="199" stroke="#ff4757" stroke-width="1.5" />
        <line x1="245" y1="206" x2="250" y2="200" stroke="#ff4757" stroke-width="1.5" />
      `;
    }
    // Subtle natural blush
    return `
      <ellipse cx="160" cy="202" rx="10" ry="5" fill="${blushColor}" opacity="0.6" />
      <ellipse cx="240" cy="202" rx="10" ry="5" fill="${blushColor}" opacity="0.6" />
    `;
  }

  renderMouth(mood) {
    switch (mood) {
      case 'pout':
        // Cute wavy pout / tsundere mouth
        return `
          <path d="M 194,222 Q 198,220 200,222 Q 202,224 206,222" stroke="#d63031" stroke-width="2.5" stroke-linecap="round" fill="none" />
        `;
      case 'blush':
        // Tiny shy open mouth
        return `
          <path d="M 196,220 Q 200,225 204,220 Z" fill="#ff7675" stroke="#d63031" stroke-width="1.2" />
        `;
      case 'surprised':
        // Round open mouth
        return `
          <ellipse cx="200" cy="223" rx="4" ry="6" fill="#ff7675" stroke="#d63031" stroke-width="1.5" />
        `;
      case 'happy':
        // Open cheerful smile showing tongue
        return `
          <path d="M 192,218 Q 200,228 208,218 Z" fill="#e84118" />
          <path d="M 195,223 Q 200,221 205,223 Q 200,227 195,223 Z" fill="#ff7675" />
        `;
      case 'yandere':
        // Eerie wide playful smile
        return `
          <path d="M 190,217 Q 200,227 210,217" stroke="#800020" stroke-width="2.5" stroke-linecap="round" fill="none" />
        `;
      case 'neutral':
      default:
        // Gentle subtle smile
        return `
          <path d="M 194,220 Q 200,224 206,220" stroke="#d63031" stroke-width="2" stroke-linecap="round" fill="none" />
        `;
    }
  }

  renderAccessory(acc) {
    switch (acc) {
      case 'cat_ears':
        return `
          <!-- Nekomimi / Fluffy Anime Cat Ears -->
          <path d="M 130,120 L 115,70 L 160,95 Z" fill="url(#hairGrad)" />
          <path d="M 130,110 L 123,80 L 150,97 Z" fill="#ff99bb" />
          <path d="M 270,120 L 285,70 L 240,95 Z" fill="url(#hairGrad)" />
          <path d="M 270,110 L 277,80 L 250,97 Z" fill="#ff99bb" />
        `;
      case 'glasses':
        return `
          <!-- Red Rim Anime Glasses -->
          <rect x="156" y="172" width="34" height="22" rx="6" fill="rgba(255,255,255,0.25)" stroke="#ff4757" stroke-width="2.5" />
          <rect x="210" y="172" width="34" height="22" rx="6" fill="rgba(255,255,255,0.25)" stroke="#ff4757" stroke-width="2.5" />
          <line x1="190" y1="182" x2="210" y2="182" stroke="#ff4757" stroke-width="2.5" />
          <!-- Glare line on lenses -->
          <line x1="162" y1="176" x2="175" y2="188" stroke="#ffffff" stroke-width="1.8" opacity="0.8" />
          <line x1="216" y1="176" x2="229" y2="188" stroke="#ffffff" stroke-width="1.8" opacity="0.8" />
        `;
      case 'headphones':
        return `
          <!-- Cyberpunk / Anime Headset -->
          <path d="M 130,150 C 130,80 270,80 270,150" stroke="#00d2d3" stroke-width="5" fill="none" />
          <rect x="120" y="165" width="16" height="35" rx="8" fill="#1e272e" stroke="#00d2d3" stroke-width="2.5" />
          <rect x="264" y="165" width="16" height="35" rx="8" fill="#1e272e" stroke="#00d2d3" stroke-width="2.5" />
          <!-- Glowing Ear Indicator -->
          <circle cx="128" cy="182" r="3.5" fill="#00d2d3" />
          <circle cx="272" cy="182" r="3.5" fill="#00d2d3" />
        `;
      case 'ribbon':
      default:
        return `
          <!-- Cute Hair Ribbon / Bow -->
          <circle cx="150" cy="130" r="4" fill="#ff4757" />
          <path d="M 150,130 L 135,118 L 138,135 Z" fill="#ff6b81" />
          <path d="M 150,130 L 165,118 L 162,135 Z" fill="#ff6b81" />
          <path d="M 150,130 L 140,146 L 148,142 Z" fill="#ff4757" />
          <path d="M 150,130 L 158,148 L 153,142 Z" fill="#ff4757" />
        `;
    }
  }

  shadeColor(color, percent) {
    if (!color.startsWith('#')) return color;
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

// Dialogue Engine with Context Awareness and Fallback Processing


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

    // Check if user is asking about schedule or tasks
    if (this.isScheduleIntent(lower)) {
      const today = new Date();
      const events = state.calendar.events.filter(e => {
        const start = new Date(e.start);
        return start.getFullYear() === today.getFullYear() &&
               start.getMonth() === today.getMonth() &&
               start.getDate() === today.getDate();
      });
      const eventsCount = events.filter(e => e.type === 'event').length;
      const tasksCount = events.filter(e => e.type === 'task' && !e.completed).length;

      const review = persona.scheduleReview(eventsCount, tasksCount);
      this.respond(review.text, review.mood);
      return review;
    }

    // Try optional LLM if configured
    if (state.settings.llmProvider !== 'none' && state.settings.llmApiKey) {
      const llmResult = await callLLM(text, state);
      if (llmResult) {
        const inferredMood = this.inferMood(llmResult, personaId);
        this.respond(llmResult, inferredMood);
        return { text: llmResult, mood: inferredMood };
      }
    }

    // Offline Persona Dialogue Processor
    const localReply = this.generateOfflineReply(lower, personaId, persona);
    this.respond(localReply.text, localReply.mood);
    return localReply;
  }

  isScheduleIntent(text) {
    return text.includes('schedule') || 
           text.includes('calendar') || 
           text.includes('today') || 
           text.includes('tasks') || 
           text.includes('plans') || 
           text.includes('agenda') || 
           text.includes('what do i have');
  }

  generateOfflineReply(lower, personaId, persona) {
    // Compliments / Love
    if (lower.includes('love you') || lower.includes('cute') || lower.includes('pretty') || lower.includes('marry') || lower.includes('beautiful')) {
      switch (personaId) {
        case 'tsundere':
          return { text: "W-WHAT?! What are you blabbering about, dummy?! Don't just say things like that with a straight face! ...B-Baka!", mood: 'blush' };
        case 'kuudere':
          return { text: "Compliment received. Heart rate telemetry indicates unexpected elevation... Please refrain from causing system anomalies.", mood: 'blush' };
        case 'yandere':
          return { text: "I love you more, darling! Forever and ever! You will never leave me, right? Never, ever, ever~!", mood: 'yandere' };
        case 'deredere':
          return { text: "Awwww! I love you so much too!! You just made my entire heart explode into sparkles! ✨🥰", mood: 'happy' };
        case 'dandere':
          return { text: "U-Um... y-you really think that about me...? M-My heart feels like it's going to burst... thank you...", mood: 'blush' };
      }
    }

    // Greetings
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('konnichiwa') || lower.includes('ohayo')) {
      switch (personaId) {
        case 'tsundere':
          return { text: "Oh, you finally decided to say hi? What do you want, baka?", mood: 'pout' };
        case 'kuudere':
          return { text: "Salutations. Ready to proceed with current objectives.", mood: 'neutral' };
        case 'yandere':
          return { text: "Hello darling! I missed you every single microsecond you were away~", mood: 'happy' };
        case 'deredere':
          return { text: "Yaaay, hi there! Super happy to see you right now! Let's have an awesome time! 🌸", mood: 'happy' };
        case 'dandere':
          return { text: "H-Hello... it's really nice to hear your voice...", mood: 'blush' };
      }
    }

    // Good night
    if (lower.includes('good night') || lower.includes('sleep') || lower.includes('bed') || lower.includes('oyasumi')) {
      switch (personaId) {
        case 'tsundere':
          return { text: "Finally going to bed? Good! Stop ruining your sleep schedule! ...G-Good night.", mood: 'blush' };
        case 'kuudere':
          return { text: "Sleep cycle sequence initiated. Rest well to maintain optimal performance tomorrow.", mood: 'neutral' };
        case 'yandere':
          return { text: "Good night my precious darling... I'll be in your dreams... and right beside your bed~", mood: 'yandere' };
        case 'deredere':
          return { text: "Sweet dreams, superstar! Sleep tight and dream the cutest dreams! 🌙✨", mood: 'happy' };
        case 'dandere':
          return { text: "U-Um... sleep softly tonight... I'll pray for your sweet dreams... good night...", mood: 'blush' };
      }
    }

    // How are you
    if (lower.includes('how are you') || lower.includes('how r u') || lower.includes("how's it going")) {
      switch (personaId) {
        case 'tsundere':
          return { text: "I'm doing fine! Not that you need to be checking up on me or anything!", mood: 'pout' };
        case 'kuudere':
          return { text: "System diagnostics: 100% functional. Emotional state: nominal.", mood: 'neutral' };
        case 'yandere':
          return { text: "I'm always ecstatic whenever you're looking at me, darling~ As long as you stay with me!", mood: 'yandere' };
        case 'deredere':
          return { text: "I am feeling super duper energetic and ready for anything! Especially with you here! ☀️", mood: 'happy' };
        case 'dandere':
          return { text: "I-I'm doing well, thank you... talking with you always makes me feel calm...", mood: 'blush' };
      }
    }

    // Teasing or baka
    if (lower.includes('baka') || lower.includes('dummy') || lower.includes('stupid')) {
      switch (personaId) {
        case 'tsundere':
          return { text: "WHO ARE YOU CALLING A BAKA?! You're the biggest baka in the whole universe!! 💢", mood: 'pout' };
        case 'kuudere':
          return { text: "Semantic insult detected. Ignored due to lack of factual accuracy.", mood: 'neutral' };
        case 'yandere':
          return { text: "Call me whatever you want, darling... your insults sound like love songs to me~", mood: 'yandere' };
        case 'deredere':
          return { text: "Hehe, no u! You silly goose! 😄", mood: 'happy' };
        case 'dandere':
          return { text: "D-Did I do something wrong...? I-I'm really sorry...", mood: 'blush' };
      }
    }

    // Help or who are you
    if (lower.includes('who are you') || lower.includes('what can you do') || lower.includes('help')) {
      return {
        text: `I'm ${this.store.get('waifu.name')}, your personal companion! You can manage events and tasks in the Calendar tab, customize my clothes and personality in Settings, change wallpapers, and chat with me anytime!`,
        mood: 'happy'
      };
    }

    // Default conversational responses
    const defaultReplies = [
      {
        tsundere: "Hmph! Well, if you say so. Just make sure you stay productive, okay?",
        kuudere: "Acknowledged. Data point incorporated into contextual memory.",
        yandere: "Anything you say is absolute law to me, darling. I'm listening to every breath~",
        deredere: "Yay! That sounds super fun! Tell me more, tell me more! ✨",
        dandere: "U-Um... yes... I'm listening carefully..."
      },
      {
        tsundere: "Don't think this means we're best friends or anything! ...Though it's not bad talking with you.",
        kuudere: "Interaction recorded. Your presence is deemed statistically pleasant.",
        yandere: "Keep talking to me forever, darling... don't ever look away!",
        deredere: "I totally agree! You always have the coolest thoughts! 🌟",
        dandere: "I... I really like when we talk together like this..."
      }
    ];

    const pick = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
    const defaultMood = persona.defaultMood || 'neutral';
    return {
      text: pick[personaId] || pick.tsundere,
      mood: defaultMood
    };
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

  respond(text, mood) {
    this.store.set('waifu.mood', mood);
    this.store.addMessage('waifu', text, mood);

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

// Full Google Calendar Clone with Month, Week, and Day Views + Drag & Drop


class GoogleCalendar {
  constructor(containerElement, store, waifuDialogue) {
    this.container = containerElement;
    this.store = store;
    this.waifu = waifuDialogue;
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.currentView = this.store.get('calendar.view') || 'month';
    this.dragDrop = new CalendarDragDrop(store, this);

    this.init();
  }

  init() {
    this.renderShell();
    this.bindEvents();
    this.renderMainCalendar();
    this.renderMiniCalendar();
    this.renderTaskList();

    // Re-render when calendar state updates
    this.store.subscribe('calendar.events', () => {
      this.renderMainCalendar();
      this.renderTaskList();
      this.renderMiniCalendar();
    });

    this.store.subscribe('calendar.view', (newView) => {
      this.currentView = newView;
      this.renderMainCalendar();
    });
  }

  renderShell() {
    this.container.innerHTML = `
      <div class="gcal-wrapper">
        <!-- TOP TOOLBAR -->
        <header class="gcal-toolbar">
          <div class="gcal-toolbar-left">
            <button class="gcal-btn gcal-btn-primary" id="gcal-create-btn">
              <span class="btn-icon">➕</span>
              <span class="btn-text">Create</span>
            </button>
            <button class="gcal-btn gcal-btn-outline" id="gcal-today-btn">Today</button>
            <div class="gcal-nav-arrows">
              <button class="gcal-icon-btn" id="gcal-prev-btn" title="Previous">◀</button>
              <button class="gcal-icon-btn" id="gcal-next-btn" title="Next">▶</button>
            </div>
            <h2 class="gcal-title" id="gcal-title-display"></h2>
          </div>

          <div class="gcal-toolbar-right">
            <button class="gcal-btn gcal-btn-waifu" id="gcal-briefing-btn" title="Ask Waifu to review today's agenda">
              <span class="btn-icon">🌸</span>
              <span class="btn-text">Waifu Briefing</span>
            </button>
            <div class="gcal-view-selector">
              <button class="view-btn ${this.currentView === 'month' ? 'active' : ''}" data-view="month">Month</button>
              <button class="view-btn ${this.currentView === 'week' ? 'active' : ''}" data-view="week">Week</button>
              <button class="view-btn ${this.currentView === 'day' ? 'active' : ''}" data-view="day">Day</button>
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
              <h4 class="sidebar-heading">Calendars</h4>
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
              <button type="button" class="gcal-btn gcal-btn-danger" id="modal-delete-btn" style="display:none;">Delete</button>
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

    // View selector
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
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

    // Color dot picker
    const colorPicker = this.container.querySelector('#event-color-picker');
    colorPicker.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        colorPicker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });

    // Delete Button
    deleteBtn.addEventListener('click', () => {
      const id = this.container.querySelector('#event-id').value;
      if (id) {
        this.store.deleteEvent(id);
        closeModal();
      }
    });

    // Form Submit (Save / Update)
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
      } else {
        this.store.addEvent(payload);
      }

      closeModal();
    });
  }

  openEventModal(event = null, defaultDate = new Date()) {
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
      deleteBtn.style.display = 'block';

      // Set color dot
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

      // Default color
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

    return this.store.get('calendar.events').filter(e => {
      if (e.type === 'event' && !showEvents) return false;
      if (e.type === 'task' && !showTasks) return false;
      if (e.type === 'birthday' && !showBirthdays) return false;
      return true;
    });
  }

  /* ------------------- MONTH VIEW ------------------- */
  renderMonthView(stage) {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayIndex = firstDay.getDay(); // 0 = Sunday
    const totalDays = lastDay.getDate();

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days = [];

    // Prev month padding
    for (let i = startDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Next month padding to fill grid to multiple of 7
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

    // Add drag-and-drop drop zones to each cell
    stage.querySelectorAll('.month-day-cell').forEach(cell => {
      this.dragDrop.initDropZone(cell, () => cell.dataset.date);

      // Click to add event or select day
      cell.addEventListener('click', (e) => {
        if (e.target.closest('.event-pill')) return;
        this.selectedDate = new Date(cell.dataset.date);
        this.openEventModal(null, this.selectedDate);
      });
    });

    // Make pills draggable and clickable
    stage.querySelectorAll('.event-pill').forEach(pill => {
      const eventId = pill.dataset.eventId;
      const event = events.find(e => e.id === eventId);
      if (event) {
        this.dragDrop.initDraggable(pill, event, 'calendar-event');
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEventModal(event);
        });
      }
    });
  }

  renderEventPill(ev) {
    const isBirthday = ev.type === 'birthday';
    const isTask = ev.type === 'task';
    const icon = isBirthday ? '🎂 ' : (isTask ? (ev.completed ? '✅ ' : '⬜ ') : '');
    const startTime = ev.allDay ? '' : new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="event-pill ${isTask && ev.completed ? 'completed' : ''}" 
           data-event-id="${ev.id}" 
           style="background: ${ev.color || '#ff6584'};">
        <span class="pill-title">${icon}${startTime ? `<small>${startTime}</small> ` : ''}${this.escapeHTML(ev.title)}</span>
      </div>
    `;
  }

  /* ------------------- WEEK VIEW ------------------- */
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
          <div class="time-gutter-header"></div>
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
          <!-- Time Labels Column -->
          <div class="time-gutter">
            ${Array.from({ length: 24 }).map((_, h) => `
              <div class="time-slot-label">
                <span>${h === 0 ? '' : (h < 12 ? `${h} AM` : (h === 12 ? '12 PM' : `${h - 12} PM`))}</span>
              </div>
            `).join('')}
          </div>

          <!-- 7 Day Columns -->
          <div class="week-columns-wrapper">
            ${weekDays.map(day => {
              const dateStr = day.toISOString();
              const dayEvents = events.filter(e => this.isSameDay(new Date(e.start), day));
              const isToday = this.isSameDay(day, today);

              return `
                <div class="week-day-column ${isToday ? 'today-col' : ''}" data-date="${dateStr}">
                  <!-- Hourly grid lines -->
                  ${Array.from({ length: 24 }).map((_, h) => `
                    <div class="week-hour-cell" data-hour="${h}"></div>
                  `).join('')}

                  <!-- Live Red Current Time Indicator -->
                  ${isToday ? `<div class="current-time-line" style="top: ${this.getCurrentTimePercent()}%;"></div>` : ''}

                  <!-- Positioned Events -->
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

    // Wire up hour cells for drop and click-to-create
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

    // Make week event cards draggable and editable
    stage.querySelectorAll('.week-event-card').forEach(card => {
      const id = card.dataset.eventId;
      const ev = events.find(e => e.id === id);
      if (ev) {
        this.dragDrop.initDraggable(card, ev, 'calendar-event');
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEventModal(ev);
        });
      }
    });

    // Scroll to 8 AM by default
    const grid = stage.querySelector('.week-time-grid');
    if (grid) grid.scrollTop = 480; // approx 8am
  }

  renderWeekEventCard(ev) {
    const s = new Date(ev.start);
    const e = new Date(ev.end || ev.start);

    let startHour = s.getHours() + s.getMinutes() / 60;
    let endHour = e.getHours() + e.getMinutes() / 60;
    if (endHour <= startHour) endHour = startHour + 1; // at least 1 hour height
    const duration = Math.max(0.5, endHour - startHour);

    const topPx = startHour * 60; // 60px per hour
    const heightPx = Math.max(26, duration * 60 - 4);

    const timeStr = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    return `
      <div class="week-event-card" 
           data-event-id="${ev.id}" 
           style="top: ${topPx}px; height: ${heightPx}px; background: ${ev.color || '#ff6584'};">
        <div class="card-title">${this.escapeHTML(ev.title)}</div>
        <div class="card-time">${timeStr}</div>
        ${ev.location ? `<div class="card-loc">📍 ${this.escapeHTML(ev.location)}</div>` : ''}
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
          <!-- Time Gutter -->
          <div class="time-gutter">
            ${Array.from({ length: 24 }).map((_, h) => `
              <div class="time-slot-label">
                <span>${h === 0 ? '' : (h < 12 ? `${h} AM` : (h === 12 ? '12 PM' : `${h - 12} PM`))}</span>
              </div>
            `).join('')}
          </div>

          <!-- Day Column -->
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
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEventModal(ev);
        });
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
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} />
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
        this.store.toggleTask(taskId);
      });

      item.querySelector('.task-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.store.deleteEvent(taskId);
      });

      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        this.openEventModal(task);
      });
    });
  }

  triggerWaifuBriefing() {
    const today = new Date();
    const events = this.store.get('calendar.events').filter(e => this.isSameDay(new Date(e.start), today));
    const eventsCount = events.filter(e => e.type === 'event').length;
    const tasksCount = events.filter(e => e.type === 'task' && !e.completed).length;

    const persona = this.store.get('waifu.personality');
    const waifuName = this.store.get('waifu.name');
    
    // Switch to main tab to talk with Waifu
    window.__switchTab?.('main');

    setTimeout(() => {
      const p = this.waifu;
      if (p) {
        p.processUserMessage('Give me a schedule review for today!');
      }
    }, 250);
  }

  /* ------------------- UTILS ------------------- */
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

    // Subscribe to messages
    this.store.subscribe('chat.messages', () => this.renderMessages());
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
  }

  bindEvents() {
    const form = this.container.querySelector('#chat-form');
    const input = this.container.querySelector('#chat-input');
    const avatarStage = this.container.querySelector('#avatar-stage');
    const clearBtn = this.container.querySelector('#clear-chat-btn');

    // Submit chat message
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      this.store.addMessage('user', text);

      // Show typing
      this.showTyping(true);

      const reply = await this.dialogue.processUserMessage(text);
      this.showTyping(false);

      if (reply) {
        this.showSpeechBubble(reply.text);
      }
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
    mount.classList.remove('avatar-bounced');
    void mount.offsetWidth; // trigger reflow
    mount.classList.add('avatar-bounced');
  }

  async handleQuickAction(type) {
    if (type === 'poke' || type === 'headpat') {
      this.handlePoke();
      return;
    }

    let userText = '';
    if (type === 'schedule') userText = "Can you review my schedule for today?";
    else if (type === 'compliment') userText = "You look adorable today!";

    if (!userText) return;

    this.store.addMessage('user', userText);
    this.showTyping(true);
    const reply = await this.dialogue.processUserMessage(userText);
    this.showTyping(false);

    if (reply) {
      this.showSpeechBubble(reply.text);
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

    // Scroll to bottom
    list.scrollTop = list.scrollHeight;

    // Also update speech bubble with latest waifu message
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
                  <div class="wallpaper-card ${settings.wallpaperId === wp.id && settings.wallpaperType === 'stock' ? 'active' : ''}" data-wp-id="${wp.id}">
                    <img src="${wp.thumb}" alt="${wp.name}" class="wp-thumb-img" />
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
    if (wpType === 'custom' && customUrl) {
      imageUrl = customUrl;
    } else {
      const found = STOCK_WALLPAPERS.find(w => w.id === wpId) || STOCK_WALLPAPERS[0];
      imageUrl = found.url;
    }

    bgContainer.style.backgroundImage = `url("${imageUrl}")`;
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
