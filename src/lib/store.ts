import { createStore, produce } from 'solid-js/store';
import { createSignal } from 'solid-js';
import { CalendarEventItem } from './ical';
import { getPersonality, getRandomGreeting, PersonalityArchetype } from './personality';
import { callLLM } from './llm';

export const STORAGE_KEY = 'waifu_space_data_v1';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'waifu';
  text: string;
  timestamp: string;
  emotion?: string;
}

export interface AppState {
  activeTab: 'main' | 'calendar' | 'settings';
  waifu: {
    name: string;
    personality: string;
    appearance: {
      hairstyle: string;
      hairColor: string;
      eyeColor: string;
      skinTone: string;
      outfit: string;
      accessory: string;
      customAvatarUrl: string;
      avatarMode: 'svg' | 'custom';
    };
    mood: string;
    bondLevel: number;
    bondExp: number;
  };
  calendar: {
    view: 'month' | 'week' | 'day';
    selectedDate: string;
    events: CalendarEventItem[];
    filterEvents: boolean;
    filterTasks: boolean;
    filterBirthdays: boolean;
    searchQuery: string;
  };
  settings: {
    wallpaperId: string;
    wallpaperType: 'stock' | 'custom';
    customWallpaperUrl: string;
    wallpaperBlur: number;
    wallpaperDim: number;
    sakuraParticles: boolean;
    theme: string;
    customAccent: string;
    soundEffects: boolean;
    ttsEnabled: boolean;
    ttsVoice: string;
    ttsPitch: number;
    ttsRate: number;
    llmProvider: string;
    llmApiKey: string;
    llmModel: string;
  };
  chat: {
    messages: ChatMessage[];
    suggestions: string[];
    isTyping: boolean;
  };
}

export const DEFAULT_EVENTS: CalendarEventItem[] = [
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

export const DEFAULT_STATE: AppState = {
  activeTab: 'main',
  waifu: {
    name: 'Akari',
    personality: 'tsundere',
    appearance: {
      hairstyle: 'twintails',
      hairColor: '#ff7597',
      eyeColor: '#4f86f7',
      skinTone: '#fff1eb',
      outfit: 'seifuku',
      accessory: 'ribbon',
      customAvatarUrl: '',
      avatarMode: 'svg'
    },
    mood: 'neutral',
    bondLevel: 12,
    bondExp: 45
  },
  calendar: {
    view: 'month',
    selectedDate: new Date().toISOString(),
    events: DEFAULT_EVENTS,
    filterEvents: true,
    filterTasks: true,
    filterBirthdays: true,
    searchQuery: ''
  },
  settings: {
    wallpaperId: 'sakura-shrine',
    wallpaperType: 'stock',
    customWallpaperUrl: '',
    wallpaperBlur: 2,
    wallpaperDim: 45,
    sakuraParticles: true,
    theme: 'sakura',
    customAccent: '#ff6584',
    soundEffects: true,
    ttsEnabled: false,
    ttsVoice: '',
    ttsPitch: 1.2,
    ttsRate: 1.0,
    llmProvider: 'none',
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
    ],
    suggestions: [
      "Review today's schedule",
      "You look cute today",
      "Poke",
      "Tell me a joke"
    ],
    isTyping: false
  }
};

// Global reactive store
export const [state, setState] = createStore<AppState>(JSON.parse(JSON.stringify(DEFAULT_STATE)));

// Global signals
export const [isTalking, setIsTalking] = createSignal(false);
export const [avatarBounced, setAvatarBounced] = createSignal(false);
export const [speechBubble, setSpeechBubble] = createSignal<string>('...');
export const [speechBubbleVisible, setSpeechBubbleVisible] = createSignal(false);
let bubbleTimeout: any = null;

// Toast signal
export const [toastMessage, setToastMessage] = createSignal('');
export const [toastVisible, setToastVisible] = createSignal(false);
let toastTimeout: any = null;

export function showToast(message: string) {
  setToastMessage(message);
  setToastVisible(true);
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    setToastVisible(false);
  }, 3500);
}

// LocalStorage helpers
export function saveState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
}

export function loadState() {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setState(
        produce(s => {
          Object.assign(s, {
            ...DEFAULT_STATE,
            ...parsed,
            waifu: { ...DEFAULT_STATE.waifu, ...(parsed.waifu || {}), appearance: { ...DEFAULT_STATE.waifu.appearance, ...(parsed.waifu?.appearance || {}) } },
            calendar: { ...DEFAULT_STATE.calendar, ...(parsed.calendar || {}), events: Array.isArray(parsed.calendar?.events) ? parsed.calendar.events : DEFAULT_STATE.calendar.events },
            settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) },
            chat: { ...DEFAULT_STATE.chat, ...(parsed.chat || {}) }
          });
        })
      );
    }
  } catch (e) {
    console.warn('Failed to load state from localStorage', e);
  }
}

// Bond progression
export function gainBondExp(amount: number) {
  setState(
    produce(s => {
      let exp = s.waifu.bondExp + amount;
      let level = s.waifu.bondLevel;
      const needed = level * 50;
      if (exp >= needed) {
        exp -= needed;
        level += 1;
        showToast(`🌸 Bond Level Up! Akari reached Lv. ${level}!`);
      }
      s.waifu.bondExp = exp;
      s.waifu.bondLevel = level;
    })
  );
  saveState();
}

// Speech synthesis
export function speakText(text: string) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth || !state.settings.ttsEnabled) return;

  try {
    synth.cancel();
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[*_~`#]/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.pitch = state.settings.ttsPitch ?? 1.25;
    utterance.rate = state.settings.ttsRate ?? 1.0;

    const voices = synth.getVoices();
    if (state.settings.ttsVoice) {
      const match = voices.find(v => v.name === state.settings.ttsVoice || v.voiceURI === state.settings.ttsVoice);
      if (match) utterance.voice = match;
    } else {
      const female = voices.find(v =>
        v.name.includes('Natural') ||
        v.name.includes('Female') ||
        v.name.includes('Ayumi') ||
        v.name.includes('Haruka') ||
        v.name.includes('Zira') ||
        v.name.includes('Jenny')
      );
      if (female) utterance.voice = female;
    }

    utterance.onstart = () => setIsTalking(true);
    utterance.onend = () => setIsTalking(false);
    utterance.onerror = () => setIsTalking(false);

    synth.speak(utterance);
  } catch (e) {
    console.warn('TTS error:', e);
    setIsTalking(false);
  }
}

// Dialogue trigger
export function triggerWaifuResponse(text: string, mood: string, suggestions?: string[]) {
  setState('waifu', 'mood', mood);
  const newMsg: ChatMessage = {
    id: 'msg-' + Date.now(),
    sender: 'waifu',
    text,
    timestamp: new Date().toISOString(),
    emotion: mood
  };
  setState('chat', 'messages', msgs => [...msgs, newMsg]);
  if (suggestions && suggestions.length > 0) {
    setState('chat', 'suggestions', suggestions);
  }

  // Speech bubble
  setSpeechBubble(text);
  setSpeechBubbleVisible(true);
  clearTimeout(bubbleTimeout);
  bubbleTimeout = setTimeout(() => {
    setSpeechBubbleVisible(false);
  }, 6000);

  // Audio speech
  speakText(text);
  saveState();
}

// User poke action
export function pokeAvatar() {
  setAvatarBounced(true);
  setTimeout(() => setAvatarBounced(false), 450);

  const persona = getPersonality(state.waifu.personality);
  const pokes = persona.poke;
  const item = pokes[Math.floor(Math.random() * pokes.length)];
  gainBondExp(8);
  triggerWaifuResponse(item.text, item.mood);
}

// Calendar date & recurrence helpers
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isEventOnDate(ev: CalendarEventItem, targetDate: Date): boolean {
  const s = new Date(ev.start);
  const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  const eventDayStart = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();

  if (targetDayStart < eventDayStart) {
    return false;
  }

  if (!ev.recurrence || ev.recurrence === 'none') {
    return isSameDay(s, targetDate);
  }

  if (ev.recurrence === 'daily') {
    return true;
  }

  if (ev.recurrence === 'weekly') {
    return targetDate.getDay() === s.getDay();
  }

  if (ev.recurrence === 'weekdays') {
    const day = targetDate.getDay();
    return day >= 1 && day <= 5;
  }

  if (ev.recurrence === 'monthly') {
    return targetDate.getDate() === s.getDate();
  }

  return isSameDay(s, targetDate);
}

export function getOccurrenceForDate(ev: CalendarEventItem, targetDate: Date): CalendarEventItem {
  if (isSameDay(new Date(ev.start), targetDate)) {
    return ev;
  }
  const s = new Date(ev.start);
  const e = new Date(ev.end || ev.start);
  const durationMs = Math.max(0, e.getTime() - s.getTime());

  const occStart = new Date(targetDate);
  occStart.setHours(s.getHours(), s.getMinutes(), s.getSeconds(), s.getMilliseconds());
  const occEnd = new Date(occStart.getTime() + durationMs);

  return {
    ...ev,
    start: occStart.toISOString(),
    end: occEnd.toISOString()
  };
}

export function getEventsForDate(events: CalendarEventItem[], targetDate: Date): CalendarEventItem[] {
  const res: CalendarEventItem[] = [];
  for (const ev of events) {
    if (isEventOnDate(ev, targetDate)) {
      res.push(getOccurrenceForDate(ev, targetDate));
    }
  }
  return res;
}

// Calendar event operations
export function addCalendarEvent(event: Partial<CalendarEventItem>): CalendarEventItem {
  const newEvent: CalendarEventItem = {
    id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    title: event.title || 'New Event',
    start: event.start || new Date().toISOString(),
    end: event.end || new Date(Date.now() + 3600000).toISOString(),
    allDay: event.allDay ?? false,
    type: event.type || 'event',
    completed: false,
    color: event.color || '#ff6584',
    description: event.description || '',
    location: event.location || '',
    recurrence: event.recurrence || 'none'
  };

  setState('calendar', 'events', events => [newEvent, ...events]);
  gainBondExp(10);
  saveState();
  return newEvent;
}

export function updateCalendarEvent(id: string, updates: Partial<CalendarEventItem>) {
  setState('calendar', 'events', events =>
    events.map(ev => (ev.id === id ? { ...ev, ...updates } : ev))
  );
  saveState();
}

export function deleteCalendarEvent(id: string) {
  setState('calendar', 'events', events => events.filter(ev => ev.id !== id));
  saveState();
}

export function toggleTask(id: string) {
  const target = state.calendar.events.find(e => e.id === id);
  if (!target) return;
  const isNowCompleted = !target.completed;
  updateCalendarEvent(id, { completed: isNowCompleted });

  if (isNowCompleted) {
    gainBondExp(15);
    const persona = getPersonality(state.waifu.personality);
    const praises = persona.taskComplete;
    const praise = praises[Math.floor(Math.random() * praises.length)];
    triggerWaifuResponse(praise.text, praise.mood);
  }
}

// Chat user message processing
export async function sendUserMessage(rawText: string) {
  const text = rawText.trim();
  if (!text) return;

  const userMsg: ChatMessage = {
    id: 'msg-' + Date.now(),
    sender: 'user',
    text,
    timestamp: new Date().toISOString()
  };
  setState('chat', 'messages', msgs => [...msgs, userMsg]);
  gainBondExp(5);
  saveState();

  setState('chat', 'isTyping', true);

  try {
    const lower = text.toLowerCase();
    const personaId = state.waifu.personality;
    const persona = getPersonality(personaId);

    // 1. Schedule intent
    if (
      lower.includes('schedule') ||
      lower.includes('calendar') ||
      lower.includes('today') ||
      lower.includes('task') ||
      lower.includes('agenda')
    ) {
      const today = new Date();
      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      const todayEvents = state.calendar.events.filter(e => isSameDay(new Date(e.start), today));
      const evCount = todayEvents.filter(e => e.type === 'event').length;
      const tkCount = todayEvents.filter(e => e.type === 'task' && !e.completed).length;

      const review = persona.scheduleReview(evCount, tkCount);
      setState('chat', 'isTyping', false);
      triggerWaifuResponse(review.text, review.mood, [
        "I finished a task!",
        "Cheer me on!",
        "What should I do next?",
        "You look cute today"
      ]);
      return;
    }

    // 2. LLM if configured
    if (state.settings.llmProvider !== 'none' && state.settings.llmApiKey) {
      const llmResult = await callLLM(text, state as any);
      if (llmResult) {
        setState('chat', 'isTyping', false);
        const mood = inferMoodFromText(llmResult, personaId);
        triggerWaifuResponse(llmResult, mood, [
          "Review today's schedule",
          "I finished a task!",
          "You look cute today",
          "Tell me a joke"
        ]);
        return;
      }
    }

    // 3. Fallback offline dialogue engine
    await new Promise(r => setTimeout(r, 400));
    const reply = generateOfflineReply(lower, personaId, persona);
    setState('chat', 'isTyping', false);
    triggerWaifuResponse(reply.text, reply.mood, reply.suggestions);
  } catch (err) {
    console.error('Dialogue error:', err);
    setState('chat', 'isTyping', false);
  }
}

function inferMoodFromText(text: string, personaId: string): string {
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

function generateOfflineReply(lower: string, personaId: string, persona: PersonalityArchetype) {
  // Compliments
  if (lower.includes('love') || lower.includes('cute') || lower.includes('pretty') || lower.includes('marry') || lower.includes('beautiful')) {
    const map: Record<string, { text: string; mood: string }> = {
      tsundere: { text: "W-WHAT?! What are you blabbering about, dummy?! Don't just say things like that with a straight face! ...B-Baka!", mood: 'blush' },
      kuudere: { text: "Compliment registered. Heart rate telemetry indicates unexpected elevation... Please refrain from causing uncalibrated emotional spikes.", mood: 'blush' },
      yandere: { text: "I love you more, darling! Forever and ever and ever! You will never ever look at anyone else, right? NEVER~!", mood: 'yandere' },
      deredere: { text: "Awwww! I love you so much too!! You just made my entire heart explode into magical sparkles! ✨🥰", mood: 'happy' },
      dandere: { text: "U-Um... y-you really think that about me...? M-My heart feels like it's going to burst... thank you so much...", mood: 'blush' }
    };
    const res = map[personaId] || map.tsundere;
    return { text: res.text, mood: res.mood, suggestions: ["You're blushing!", "It's true though", "Review schedule", "Headpat"] };
  }

  // Task done
  if (lower.includes('done') || lower.includes('finished') || lower.includes('completed') || lower.includes('i did it')) {
    const map: Record<string, { text: string; mood: string }> = {
      tsundere: { text: "Hmph! Well... I guess you're not completely useless after all. Good job... dummy. Don't let it go to your head!", mood: 'blush' },
      kuudere: { text: "Task completion logged into telemetry. Productivity quotient increased. Outstanding performance.", mood: 'happy' },
      yandere: { text: "You finished it for ME?! Ahaha, you're the most wonderful darling in existence! Now give all your attention to me~", mood: 'yandere' },
      deredere: { text: "OMG YAAAY!! 🎉 Look at you go, absolute productivity champion! High five!! I'm so proud of you!!", mood: 'happy' },
      dandere: { text: "U-Um, you finished it! That's... that's so impressive! You always work so earnestly, I admire you so much...", mood: 'blush' }
    };
    const res = map[personaId] || map.tsundere;
    return { text: res.text, mood: res.mood, suggestions: ["Give me praise!", "What's next on calendar?", "Headpat", "Thanks Akari!"] };
  }

  // Greetings
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('konnichiwa') || lower.includes('ohayo')) {
    const map: Record<string, { text: string; mood: string }> = {
      tsundere: { text: "Oh, you finally decided to say hi? What do you want, baka? Don't tell me you forgot your tasks already!", mood: 'pout' },
      kuudere: { text: "Salutations. System ready to assist with daily operations and schedule tracking.", mood: 'neutral' },
      yandere: { text: "Hello darling! I missed you every single microsecond you were away~ You didn't talk to any other girls, right?", mood: 'happy' },
      deredere: { text: "Yaaay, hello superstar! Super happy to see you right now! Let's have an amazing and productive day! 🌸✨", mood: 'happy' },
      dandere: { text: "H-Hello... it's really gentle and nice to hear your voice today... u-um, how are you...?", mood: 'blush' }
    };
    const res = map[personaId] || map.tsundere;
    return { text: res.text, mood: res.mood, suggestions: ["What's my schedule today?", "You look cute!", "Poke", "Just wanted to say hi"] };
  }

  // Joke
  if (lower.includes('joke') || lower.includes('funny') || lower.includes('laugh')) {
    const jokes = [
      "Why do anime characters make great programmers? Because they love to loop through their arcs! 🌸",
      "Why did the calendar take a vacation? Because its days were numbered! 😄",
      "What is an anime companion's favorite button on the keyboard? The Tab key, because you're always keeping tabs on me! ✨"
    ];
    return {
      text: jokes[Math.floor(Math.random() * jokes.length)],
      mood: 'happy',
      suggestions: ["Haha that was good!", "Tell another!", "Review schedule", "You're cute"]
    };
  }

  // Default conversational reply
  const defaults: Record<string, string> = {
    tsundere: "Hmph! Well, if you say so. Just make sure you stay focused on your schedule, okay?",
    kuudere: "Acknowledged. Observation cataloged into context memory.",
    yandere: "Anything you say is pure music to my ears, darling... Keep talking to me forever~",
    deredere: "Yay! That's so interesting! I love chatting with you so much! ✨",
    dandere: "U-Um... yes... I'm listening very carefully to everything you say..."
  };

  return {
    text: defaults[personaId] || defaults.tsundere,
    mood: persona.defaultMood,
    suggestions: [
      "Review today's schedule",
      "How are you doing?",
      "You look cute today",
      "Tell me a joke"
    ]
  };
}

export function clearChatHistory() {
  setState('chat', 'messages', []);
  saveState();
}

export function resetAllData() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  showToast('Reset to default settings');
}
