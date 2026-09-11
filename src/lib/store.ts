import { createStore, produce } from 'solid-js/store';
import { createSignal } from 'solid-js';
import { CalendarEventItem } from './ical';
import { getPersonality, getRandomGreeting, PersonalityArchetype } from './personality';
import { callLLM } from './llm';
import { parseIntent, hasIntent, DialogIntent } from './intents';
import { validateCalendarEventInput, sanitizeSettings, clampNumber } from './validation';
import { sanitizeRawState } from './validate';
import { getLootboxCost, rollLootRarity, DUPLICATE_COMPENSATION } from './economy';

export const STORAGE_KEY = 'waifu_space_data_v1';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'waifu';
  text: string;
  timestamp: string;
  emotion?: string;
}

export interface RpgCosmeticItem {
  id: string;
  name: string;
  category: 'outfit' | 'accessory' | 'hairstyle';
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mystical';
  description: string;
  icon: string;
}

export const COSMETIC_CATALOG: RpgCosmeticItem[] = [
  // Outfits
  { id: 'seifuku', name: 'Sailor Seifuku', category: 'outfit', rarity: 'common', description: 'Classic Japanese school uniform with navy sailor collar.', icon: '🏫' },
  { id: 'casual', name: 'Cozy Hoodie', category: 'outfit', rarity: 'common', description: 'Soft oversized pastel hoodie for relaxing at home.', icon: '🛋️' },
  { id: 'maid', name: 'Maid Uniform', category: 'outfit', rarity: 'rare', description: 'Elegant frilled black-and-white café maid outfit.', icon: '☕' },
  { id: 'kimono', name: 'Summer Kimono', category: 'outfit', rarity: 'rare', description: 'Traditional indigo yukata with gold obi and sakura blossoms.', icon: '👘' },
  { id: 'gothic', name: 'Gothic Lolita', category: 'outfit', rarity: 'epic', description: 'Dark Victorian gothic dress adorned with crimson ribbons.', icon: '🥀' },
  { id: 'miko', name: 'Shrine Maiden (Miko)', category: 'outfit', rarity: 'epic', description: 'Sacred red hakama and white robe blessed by shrine spirits.', icon: '⛩️' },
  { id: 'magical', name: 'Magical Girl', category: 'outfit', rarity: 'legendary', description: 'Sparkling cosmic dress imbued with pure starlight.', icon: '✨' },
  { id: 'armor', name: 'Guardian Knight Armor', category: 'outfit', rarity: 'legendary', description: 'Polished silver breastplate & pauldrons forged for battle.', icon: '🛡️' },

  // Accessories
  { id: 'none', name: 'None', category: 'accessory', rarity: 'common', description: 'No accessory equipped.', icon: '✖️' },
  { id: 'ribbon', name: 'Red Ribbon', category: 'accessory', rarity: 'common', description: 'Cute silk bow tied gracefully into her hair.', icon: '🎀' },
  { id: 'glasses', name: 'Stylish Glasses', category: 'accessory', rarity: 'common', description: 'Chic frames that give an intellectual charm.', icon: '👓' },
  { id: 'maid_headband', name: 'Maid Headband', category: 'accessory', rarity: 'rare', description: 'Crisp white lace maid headdress.', icon: '🤍' },
  { id: 'flower_pin', name: 'Sakura Hairpin', category: 'accessory', rarity: 'rare', description: 'Delicate cherry blossom petal pin with soft morning dew.', icon: '🌸' },
  { id: 'headphones', name: 'Cyber Headphones', category: 'accessory', rarity: 'rare', description: 'Glowing cyan headphones tuned to lo-fi beats.', icon: '🎧' },
  { id: 'cat_ears', name: 'Fluffy Cat Ears', category: 'accessory', rarity: 'epic', description: 'Twitching soft feline ears with tiny golden bells.', icon: '🐱' },
  { id: 'bunny_ears', name: 'Bunny Ears', category: 'accessory', rarity: 'epic', description: 'Playful velvet rabbit ears that bounce when she moves.', icon: '🐰' },
  { id: 'succubus_horns', name: 'Shadow Horns', category: 'accessory', rarity: 'epic', description: 'Curved obsidian horns radiating soft ethereal twilight.', icon: '😈' },
  { id: 'kitsune_mask', name: 'Kitsune Mask', category: 'accessory', rarity: 'legendary', description: 'Mystical fox spirit festival mask worn on the side of her hair.', icon: '🦊' },
  { id: 'halo', name: 'Angel Halo', category: 'accessory', rarity: 'legendary', description: 'Gleaming celestial halo floating serenely above her crown.', icon: '😇' },
  { id: 'phoenix_pin', name: 'Phoenix Plume', category: 'accessory', rarity: 'legendary', description: 'Blazing golden feather hairpin with warm immortal embers.', icon: '🪶' },
  { id: 'kitsune_aurora', name: 'Aurora Spirit Mask', category: 'accessory', rarity: 'mystical', description: 'Sacred celestial kitsune mask infused with shifting aurora borealis light.', icon: '🦊✨' },
  { id: 'starlight_crown', name: 'Crown of Cosmos', category: 'accessory', rarity: 'mystical', description: 'Transcendent diadem forged from pure crystallized cosmic nebula.', icon: '👑✨' },

  // Hairstyles
  { id: 'twintails', name: 'Classic Twintails', category: 'hairstyle', rarity: 'common', description: 'Bouncy twin ponytails tied high on both sides.', icon: '👧' },
  { id: 'long', name: 'Long Straight', category: 'hairstyle', rarity: 'common', description: 'Flowing silky hair reaching down past her shoulders.', icon: '💇‍♀️' },
  { id: 'short_bob', name: 'Short Bob', category: 'hairstyle', rarity: 'rare', description: 'Cute, sporty chin-length bob cut.', icon: '💁‍♀️' },
  { id: 'ponytail', name: 'High Ponytail', category: 'hairstyle', rarity: 'rare', description: 'Energetic ponytail fastened with a ribbon.', icon: '👱‍♀️' },
  { id: 'wavy', name: 'Wavy Curls', category: 'hairstyle', rarity: 'epic', description: 'Romantic flowing waves with gentle volume.', icon: '👩‍🦱' }
];

export interface AffectionMilestone {
  level: number;
  title: string;
  rewardType: 'coins' | 'cosmetic' | 'title';
  rewardValue: string | number;
  rewardLabel: string;
  description: string;
  icon: string;
}

export const AFFECTION_MILESTONES: AffectionMilestone[] = [
  { level: 2, title: 'Acquaintance', rewardType: 'coins', rewardValue: 75, rewardLabel: '75 Coins', description: 'Akari begins to look forward to your presence.', icon: '🪙' },
  { level: 3, title: 'Friend', rewardType: 'cosmetic', rewardValue: 'flower_pin', rewardLabel: 'Sakura Hairpin', description: 'Unlocks the delicate Sakura hair ornament.', icon: '🌸' },
  { level: 5, title: 'Close Friend', rewardType: 'cosmetic', rewardValue: 'maid', rewardLabel: 'Maid Uniform', description: 'Unlocks the frilly Maid Outfit in your Wardrobe.', icon: '☕' },
  { level: 7, title: 'Trusted Confidant', rewardType: 'coins', rewardValue: 200, rewardLabel: '200 Coins', description: 'Akari trusts you with her deepest thoughts.', icon: '🪙' },
  { level: 8, title: 'Sweetheart', rewardType: 'cosmetic', rewardValue: 'kimono', rewardLabel: 'Summer Kimono', description: 'Unlocks the traditional festival Kimono dress.', icon: '👘' },
  { level: 10, title: 'Soulmate', rewardType: 'cosmetic', rewardValue: 'bunny_ears', rewardLabel: 'Bunny Ears', description: 'Unlocks the playful Bunny Ears accessory.', icon: '🐰' },
  { level: 12, title: 'Inseparable', rewardType: 'coins', rewardValue: 500, rewardLabel: '500 Coins', description: 'A massive treasury gift for staying by her side.', icon: '💰' },
  { level: 15, title: 'Eternal Devotion', rewardType: 'cosmetic', rewardValue: 'magical', rewardLabel: 'Magical Girl Outfit', description: 'Unlocks the legendary Magical Girl cosmic dress!', icon: '✨' },
  { level: 20, title: 'Celestial Bond', rewardType: 'cosmetic', rewardValue: 'halo', rewardLabel: 'Angel Halo', description: 'Unlocks the divine glowing Angel Halo.', icon: '😇' }
];

export interface RpgState {
  coins: number;
  unlockedOutfits: string[];
  unlockedAccessories: string[];
  unlockedHairstyles: string[];
  showcaseItems: string[]; // up to 6 featured item IDs
  claimedAffectionMilestones: number[];
  defenseHighWave: number;
  defenseStats: {
    totalVictories: number;
    goblinsDefeated: number;
  };
}

export interface UserAccount {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  token?: string;
}

export interface AppState {
  activeTab: 'main' | 'calendar' | 'rpg' | 'settings';
  user: UserAccount | null;
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
  rpg: RpgState;
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
    language: 'en' | 'ja';
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

export const DEFAULT_RPG: RpgState = {
  coins: 200,
  unlockedOutfits: ['seifuku', 'casual'],
  unlockedAccessories: ['none', 'ribbon', 'glasses'],
  unlockedHairstyles: ['twintails', 'long', 'short_bob'],
  showcaseItems: ['ribbon', 'glasses'],
  claimedAffectionMilestones: [],
  defenseHighWave: 0,
  defenseStats: {
    totalVictories: 0,
    goblinsDefeated: 0
  }
};

export const DEFAULT_STATE: AppState = {
  activeTab: 'main',
  user: null,
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
  rpg: DEFAULT_RPG,
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
    language: 'en',
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
  scheduleCloudSync();
}

// ---------------------------------------------------------------------------
// Cloud sync (Supabase via /api/sync/progress)
// ---------------------------------------------------------------------------

let cloudSyncTimer: any = null;

const PENDING_SYNC_KEY = 'waifu_space_pending_sync_v1';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export const [cloudSyncStatus, setCloudSyncStatus] = createSignal<CloudSyncStatus>('idle');

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function buildSyncSnapshot() {
  return {
    waifu: {
      name: state.waifu.name,
      personality: state.waifu.personality,
      bondLevel: state.waifu.bondLevel,
      bondExp: state.waifu.bondExp,
      appearance: state.waifu.appearance
    },
    rpg: {
      coins: state.rpg.coins,
      unlockedOutfits: state.rpg.unlockedOutfits,
      unlockedAccessories: state.rpg.unlockedAccessories,
      unlockedHairstyles: state.rpg.unlockedHairstyles,
      claimedAffectionMilestones: state.rpg.claimedAffectionMilestones,
      defenseHighWave: state.rpg.defenseHighWave,
      defenseStats: state.rpg.defenseStats,
      showcaseItems: state.rpg.showcaseItems
    },
    settings: state.settings
  };
}

function readPendingSync(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function queuePendingSync() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ payload: buildSyncSnapshot(), updatedAt: Date.now() }));
  } catch (e) {
    console.error('Failed to queue pending cloud sync', e);
  }
}

function clearPendingSync() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_SYNC_KEY);
  } catch {
    // ignore
  }
}

export function scheduleCloudSync() {
  if (typeof window === 'undefined') return;
  if (!state.user?.token) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    void pushProgressToCloud();
  }, 2500);
}

/**
 * Pushes progress to the cloud. Best-effort: on a network failure or while the
 * browser is offline, the latest snapshot is queued locally and retried when
 * the connection comes back, so no progress is silently lost.
 */
export async function pushProgressToCloud(): Promise<boolean> {
  const token = state.user?.token;
  if (!token) return false;

  if (!isOnline()) {
    setCloudSyncStatus('offline');
    queuePendingSync();
    return false;
  }

  setCloudSyncStatus('syncing');
  try {
    const res = await fetch('/api/sync/progress', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(buildSyncSnapshot())
    });
    if (!res.ok) {
      setCloudSyncStatus('error');
      queuePendingSync();
      return false;
    }
    clearPendingSync();
    setCloudSyncStatus('synced');
    return true;
  } catch {
    setCloudSyncStatus(isOnline() ? 'error' : 'offline');
    queuePendingSync();
    return false;
  }
}

// Flush any pending debounced sync when the page is being unloaded, so a
// reload right after earning coins doesn't leave the last save behind.
if (typeof window !== 'undefined') {
  const flushPendingSync = () => {
    if (!state.user?.token) return;
    clearTimeout(cloudSyncTimer);
    void pushProgressToCloud();
  };
  window.addEventListener('pagehide', flushPendingSync);
  window.addEventListener('beforeunload', flushPendingSync);

  // Retry any queued (offline) sync as soon as the connection returns.
  window.addEventListener('online', () => {
    if (!state.user?.token) return;
    if (!readPendingSync()) return;
    clearTimeout(cloudSyncTimer);
    void pushProgressToCloud();
  });
}

/**
 * Pulls the logged-in user's saved progress from Supabase and merges it into
 * local state. Cloud data wins for RPG/waifu save fields, except that a richer
 * local save is never clobbered by the default 200-coin registration snapshot.
 */
export async function loadCloudProgress(token?: string): Promise<void> {
  const authToken = token || state.user?.token;
  if (!authToken) return;

  if (!isOnline()) {
    // Offline fallback: keep the local save authoritative until a pull succeeds.
    setCloudSyncStatus('offline');
    return;
  }

  try {
    const res = await fetch('/api/sync/progress', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!res.ok) {
      setCloudSyncStatus('error');
      return;
    }

    const data = await res.json();
    if (!data.success) {
      setCloudSyncStatus('error');
      return;
    }

    setCloudSyncStatus('synced');

    const p = data.progress;
    if (!p) {
      // Nothing saved in the cloud yet -> upload the current local state.
      scheduleCloudSync();
      return;
    }

    const inventory: Array<{ item_id: string; category: string }> = Array.isArray(data.inventory) ? data.inventory : [];
    const showcaseItems: string[] = Array.isArray(data.showcaseItems) ? data.showcaseItems : [];

    // Never lose currency: the cloud can hold a stale snapshot (e.g. an older
    // session), so the merge always keeps the larger balance on both sides.
    const coins = Math.max(state.rpg.coins, typeof p.coins === 'number' ? p.coins : 0);

    setState(
      produce(s => {
        s.rpg.coins = coins;
        if (typeof p.bond_level === 'number' && p.bond_level > s.waifu.bondLevel) s.waifu.bondLevel = p.bond_level;
        if (typeof p.bond_exp === 'number') s.waifu.bondExp = Math.max(p.bond_exp, s.waifu.bondExp);
        if (p.waifu_name) s.waifu.name = p.waifu_name;
        if (p.waifu_personality) s.waifu.personality = p.waifu_personality;
        if (p.worn_outfit) s.waifu.appearance.outfit = p.worn_outfit;
        if (p.worn_accessory) s.waifu.appearance.accessory = p.worn_accessory;
        if (p.worn_hairstyle) s.waifu.appearance.hairstyle = p.worn_hairstyle;
        if (p.appearance_data && typeof p.appearance_data === 'object') {
          Object.assign(s.waifu.appearance, p.appearance_data);
        }
        if (p.settings_data && typeof p.settings_data === 'object') {
          const cleaned = sanitizeSettings(p.settings_data);
          Object.assign(s.settings, cleaned);
          if (cleaned.language) s.settings.language = cleaned.language;
        }
        if (Array.isArray(p.claimed_milestones) && p.claimed_milestones.length > 0) {
          s.rpg.claimedAffectionMilestones = Array.from(new Set([...(s.rpg.claimedAffectionMilestones || []), ...p.claimed_milestones]));
        }
        if (typeof p.defense_high_wave === 'number') {
          s.rpg.defenseHighWave = Math.max(s.rpg.defenseHighWave || 0, p.defense_high_wave);
        }
        s.rpg.defenseStats.totalVictories = Math.max(s.rpg.defenseStats.totalVictories || 0, p.defense_victories || 0);
        s.rpg.defenseStats.goblinsDefeated = Math.max(s.rpg.defenseStats.goblinsDefeated || 0, p.goblins_defeated || 0);

        const unlockedOutfits = new Set(s.rpg.unlockedOutfits);
        const unlockedAccessories = new Set(s.rpg.unlockedAccessories);
        const unlockedHairstyles = new Set(s.rpg.unlockedHairstyles);
        for (const item of inventory) {
          if (item.category === 'outfit') unlockedOutfits.add(item.item_id);
          else if (item.category === 'accessory') unlockedAccessories.add(item.item_id);
          else if (item.category === 'hairstyle') unlockedHairstyles.add(item.item_id);
        }
        s.rpg.unlockedOutfits = [...unlockedOutfits];
        s.rpg.unlockedAccessories = [...unlockedAccessories];
        s.rpg.unlockedHairstyles = [...unlockedHairstyles];
        if (showcaseItems.length > 0) s.rpg.showcaseItems = showcaseItems;
      })
    );
    saveState();
  } catch {
    setCloudSyncStatus(isOnline() ? 'error' : 'offline');
  }
}

function unionStrings(a: string[] | undefined, b: string[] | undefined): string[] {
  return Array.from(new Set([...(a || []), ...(b || [])]));
}

export function loadState() {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const rawHadEvents = typeof parsed.calendar === 'object' && parsed.calendar !== null && Array.isArray(parsed.calendar.events);
      const rawHadMessages = typeof parsed.chat === 'object' && parsed.chat !== null && Array.isArray(parsed.chat.messages);

      // Schema validation & sanitization of possibly-corrupt, legacy, or
      // future-shaped data before it ever reaches the reactive store.
      const { data, issues } = sanitizeRawState(parsed);
      if (issues.length > 0) console.warn('State hydration issues:', issues);

      setState(
        produce(s => {
          Object.assign(s, {
            ...DEFAULT_STATE,
            ...data,
            user: data.user,
            waifu: {
              ...DEFAULT_STATE.waifu,
              ...(data.waifu || {}),
              appearance: { ...DEFAULT_STATE.waifu.appearance, ...(data.waifu?.appearance || {}) }
            },
            rpg: {
              ...DEFAULT_RPG,
              ...(data.rpg || {}),
              unlockedOutfits: unionStrings(DEFAULT_RPG.unlockedOutfits, data.rpg?.unlockedOutfits),
              unlockedAccessories: unionStrings(DEFAULT_RPG.unlockedAccessories, data.rpg?.unlockedAccessories),
              unlockedHairstyles: unionStrings(DEFAULT_RPG.unlockedHairstyles, data.rpg?.unlockedHairstyles)
            },
            calendar: {
              ...DEFAULT_STATE.calendar,
              ...(data.calendar || {}),
              events: rawHadEvents ? data.calendar?.events || [] : DEFAULT_STATE.calendar.events
            },
            settings: { ...DEFAULT_STATE.settings, ...(data.settings || {}) },
            chat: {
              ...DEFAULT_STATE.chat,
              ...(data.chat || {}),
              messages: rawHadMessages ? data.chat?.messages || [] : DEFAULT_STATE.chat.messages
            }
          });
        })
      );
    }
  } catch (e) {
    console.warn('Failed to load state from localStorage', e);
  }
}

// Bond progression
export function getBondExpNeeded(level: number): number {
  return Math.max(1, Math.floor(level)) * 60;
}

const INTERACTION_COOLDOWNS_MS: Record<string, number> = {
  poke: 3 * 60 * 1000,
  headpat: 5 * 60 * 1000,
  chat: 60 * 1000
};

const INTERACTION_REWARDS: Record<string, { bondExp: number; coins: number }> = {
  poke: { bondExp: 4, coins: 2 },
  headpat: { bondExp: 6, coins: 3 },
  chat: { bondExp: 2, coins: 1 }
};

const COOLDOWN_STORAGE_KEY = 'waifu_space_cooldowns_v1';

function readCooldowns(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function getCooldownRemainingMs(action: string): number {
  const until = readCooldowns()[action] || 0;
  return Math.max(0, until - Date.now());
}

export function formatCooldown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds > 0 ? seconds + 's' : ''}`.trim() : `${seconds}s`;
}

export function tryClaimInteraction(action: string): boolean {
  const remaining = getCooldownRemainingMs(action);
  return !(remaining > 0);
}

function setInteractionCooldown(action: string) {
  if (typeof window === 'undefined') return;
  const windowMs = INTERACTION_COOLDOWNS_MS[action];
  if (!windowMs) return;
  const cd = readCooldowns();
  cd[action] = Date.now() + windowMs;
  try {
    localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(cd));
  } catch {
    // ignore
  }
}

export function gainBondExp(amount: number) {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  setState(
    produce(s => {
      let exp = Math.max(0, s.waifu.bondExp || 0) + safeAmount;
      let level = Math.max(1, s.waifu.bondLevel || 1);
      const needed = getBondExpNeeded(level);
      if (exp >= needed) {
        exp -= needed;
        level += 1;
        const bonusCoins = level * 20;
        s.rpg.coins = Math.max(0, (s.rpg.coins || 0) + bonusCoins);
        showToast(`🌸 Bond Level Up! ${s.waifu.name} reached Lv. ${level}! (+${bonusCoins} 🪙)`);
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

  if (tryClaimInteraction('poke')) {
    setInteractionCooldown('poke');
    gainBondExp(INTERACTION_REWARDS.poke.bondExp);
    addCoins(INTERACTION_REWARDS.poke.coins);
  } else {
    const remaining = formatCooldown(getCooldownRemainingMs('poke'));
    showToast(`🌸 ${state.waifu.name} is still flustered from that! Try again in ${remaining}.`);
  }

  triggerWaifuResponse(item.text, item.mood);
}

// Headpat action (affection reward with its own cooldown)
export function headpatWaifu() {
  const persona = getPersonality(state.waifu.personality);
  const pats = persona.poke;
  const pat = pats[Math.floor(Math.random() * pats.length)];

  if (tryClaimInteraction('headpat')) {
    setInteractionCooldown('headpat');
    gainBondExp(INTERACTION_REWARDS.headpat.bondExp);
    addCoins(INTERACTION_REWARDS.headpat.coins);
  } else {
    const remaining = formatCooldown(getCooldownRemainingMs('headpat'));
    showToast(`🌸 ${state.waifu.name} is already happy from that! Try again in ${remaining}.`);
  }

  triggerWaifuResponse(pat.text, pat.mood);
}

// Economy & RPG Operations
export function addCoins(amount: number) {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  setState('rpg', 'coins', c => {
    const base = Number.isFinite(c) ? Math.max(0, c) : 0;
    return clampNumber(base + safeAmount, 0, 99999999);
  });
  saveState();
}

export function spendCoins(amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const balance = Number.isFinite(state.rpg.coins) ? Math.max(0, Math.floor(state.rpg.coins)) : 0;
  if (balance < Math.floor(amount)) return false;
  setState('rpg', 'coins', clampNumber(balance - Math.floor(amount), 0, 99999999));
  saveState();
  return true;
}

export function unlockCosmetic(category: 'outfits' | 'accessories' | 'hairstyles', id: string) {
  const key = category === 'outfits' ? 'unlockedOutfits' : category === 'accessories' ? 'unlockedAccessories' : 'unlockedHairstyles';
  if (!state.rpg[key].includes(id)) {
    setState('rpg', key, list => [...list, id]);
    saveState();
  }
}

export function getUnlockedCosmeticsCount(): number {
  const outfits = state.rpg?.unlockedOutfits?.length || 0;
  const accessories = state.rpg?.unlockedAccessories?.length || 0;
  const hairstyles = state.rpg?.unlockedHairstyles?.length || 0;
  return outfits + accessories + hairstyles;
}

export function isCosmeticUnlocked(categoryOrId: string, id?: string): boolean {
  if (!id) {
    const targetId = categoryOrId;
    if (targetId === 'none') return true;
    const cat = COSMETIC_CATALOG.find(c => c.id === targetId)?.category;
    if (cat === 'outfit') return (state.rpg?.unlockedOutfits || []).includes(targetId);
    if (cat === 'accessory') return (state.rpg?.unlockedAccessories || []).includes(targetId);
    if (cat === 'hairstyle') return (state.rpg?.unlockedHairstyles || []).includes(targetId);
    return (
      (state.rpg?.unlockedOutfits || []).includes(targetId) ||
      (state.rpg?.unlockedAccessories || []).includes(targetId) ||
      (state.rpg?.unlockedHairstyles || []).includes(targetId)
    );
  }

  if (id === 'none') return true;
  const key = categoryOrId === 'outfits' || categoryOrId === 'outfit'
    ? 'unlockedOutfits'
    : categoryOrId === 'accessories' || categoryOrId === 'accessory'
    ? 'unlockedAccessories'
    : 'unlockedHairstyles';
  return (state.rpg?.[key] || []).includes(id);
}

export function claimAffectionReward(level: number): boolean {
  const milestone = AFFECTION_MILESTONES.find(m => m.level === level);
  if (!milestone) return false;
  if (state.waifu.bondLevel < level) return false;
  if ((state.rpg?.claimedAffectionMilestones || []).includes(level)) return false;

  setState('rpg', 'claimedAffectionMilestones', list => [...(list || []), level]);

  if (milestone.rewardType === 'coins' && typeof milestone.rewardValue === 'number') {
    addCoins(milestone.rewardValue);
    showToast(`🎁 Claimed ${milestone.rewardLabel} for reaching Affection Lv. ${level}!`);
  } else if (milestone.rewardType === 'cosmetic' && typeof milestone.rewardValue === 'string') {
    const item = COSMETIC_CATALOG.find(c => c.id === milestone.rewardValue);
    if (item) {
      if (item.category === 'outfit') unlockCosmetic('outfits', item.id);
      else if (item.category === 'accessory') unlockCosmetic('accessories', item.id);
      else if (item.category === 'hairstyle') unlockCosmetic('hairstyles', item.id);
    }
    showToast(`🎁 Unlocked ${milestone.rewardLabel} for reaching Affection Lv. ${level}!`);
  }

  saveState();
  return true;
}

export interface LootboxResult {
  item: RpgCosmeticItem;
  isDuplicate: boolean;
  duplicateCoins: number;
  duplicateExp: number;
}

export function toggleShowcaseItem(itemId: string): boolean {
  if (!isCosmeticUnlocked(itemId)) return false;
  const current = state.rpg?.showcaseItems || [];
  if (current.includes(itemId)) {
    setState('rpg', 'showcaseItems', list => (list || []).filter(id => id !== itemId));
    saveState();
    return true;
  }

  if (current.length >= 6) {
    showToast('Showcase case is full (max 6 items)!');
    return false;
  }

  setState('rpg', 'showcaseItems', list => [...(list || []), itemId]);
  saveState();
  return true;
}

export function setUserAccount(user: UserAccount | null) {
  setState('user', user);
  saveState();
}

/**
 * Validated settings updater: any incoming values are sanitized/clamped before
 * being persisted, so malformed UI input can never corrupt saved settings.
 */
export function updateSettings(partial: Record<string, unknown>) {
  const cleaned = sanitizeSettings(partial);
  setState('settings', prev => ({ ...prev, ...cleaned }));
  saveState();
}

export function openLootbox(boxType: 'standard' | 'royal'): LootboxResult | null {
  const cost = getLootboxCost(boxType);
  if (!spendCoins(cost)) {
    showToast('Not enough coins to open this chest!');
    return null;
  }

  const targetRarity = rollLootRarity(boxType);

  let candidates = COSMETIC_CATALOG.filter(c => c.id !== 'none' && c.rarity === targetRarity);
  if (candidates.length === 0) candidates = COSMETIC_CATALOG.filter(c => c.id !== 'none');

  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  const categoryKey = picked.category === 'outfit' ? 'unlockedOutfits' : picked.category === 'accessory' ? 'unlockedAccessories' : 'unlockedHairstyles';
  const isDuplicate = (state.rpg?.[categoryKey] || []).includes(picked.id);

  let duplicateCoins = 0;
  let duplicateExp = 0;

  if (isDuplicate) {
    const comp = DUPLICATE_COMPENSATION[picked.rarity];
    duplicateCoins = comp.coins;
    duplicateExp = comp.exp;

    addCoins(duplicateCoins);
    gainBondExp(duplicateExp);
  } else {
    unlockCosmetic(picked.category === 'outfit' ? 'outfits' : picked.category === 'accessory' ? 'accessories' : 'hairstyles', picked.id);
  }

  saveState();
  return {
    item: picked,
    isDuplicate,
    duplicateCoins,
    duplicateExp
  };
}

export function recordDefenseWaveVictory(wave: number, coinsWon?: number, expWon?: number, goblinsKilled = 10) {
  const coinsReward = coinsWon ?? (wave * 75 + 50);
  const expReward = expWon ?? (wave * 50 + 40);

  addCoins(coinsReward);
  gainBondExp(expReward);

  setState('rpg', produce(r => {
    if (!r) return;
    if (wave > (r.defenseHighWave || 0)) r.defenseHighWave = wave;
    if (!r.defenseStats) {
      r.defenseStats = { totalVictories: 0, goblinsDefeated: 0 };
    }
    r.defenseStats.totalVictories = (r.defenseStats.totalVictories || 0) + 1;
    r.defenseStats.goblinsDefeated = (r.defenseStats.goblinsDefeated || 0) + goblinsKilled;
  }));

  saveState();
  showToast(`⚔️ Wave ${wave} Cleared! (+${coinsReward} 🪙, +${expReward} EXP)`);
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
export function addCalendarEvent(event: Partial<CalendarEventItem>): CalendarEventItem | null {
  // Defensive validation: malformed payloads are rejected before they reach the store.
  const validation = validateCalendarEventInput(event);
  if (!validation.ok) {
    console.warn('addCalendarEvent rejected input:', validation.issues);
    showToast(validation.issues[0].message);
    return null;
  }

  const start = event.start || new Date().toISOString();
  let end = event.end || new Date(Date.now() + 3600000).toISOString();
  if (new Date(end).getTime() < new Date(start).getTime()) {
    end = new Date(new Date(start).getTime() + 3600000).toISOString();
  }

  const newEvent: CalendarEventItem = {
    id: event.id || ('evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
    title: (event.title || '').trim() || 'New Event',
    start,
    end,
    allDay: event.allDay ?? false,
    type: event.type || 'event',
    completed: false,
    color: event.color || '#ff6584',
    description: event.description || '',
    location: event.location || '',
    recurrence: event.recurrence || 'none'
  };

  setState('calendar', 'events', events => [newEvent, ...events]);
  gainBondExp(8);
  addCoins(10);
  saveState();
  return newEvent;
}

export function updateCalendarEvent(id: string, updates: Partial<CalendarEventItem>): boolean {
  const existing = state.calendar.events.find(ev => ev.id === id);
  if (!existing) return false;

  const merged: Partial<CalendarEventItem> = { ...existing, ...updates };
  const validation = validateCalendarEventInput(merged);
  if (!validation.ok) {
    console.warn('updateCalendarEvent rejected update:', validation.issues);
    showToast(validation.issues[0].message);
    return false;
  }

  setState('calendar', 'events', events =>
    events.map(ev => (ev.id === id ? { ...ev, ...updates } : ev))
  );
  saveState();
  return true;
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
    if (!target._rewarded) {
      updateCalendarEvent(id, { _rewarded: true });
      gainBondExp(12);
      addCoins(15);
    }
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
  if (tryClaimInteraction('chat')) {
    setInteractionCooldown('chat');
    gainBondExp(INTERACTION_REWARDS.chat.bondExp);
    addCoins(INTERACTION_REWARDS.chat.coins);
  }
  saveState();

  setState('chat', 'isTyping', true);

  try {
    const personaId = state.waifu.personality;
    const persona = getPersonality(personaId);

    // 1. Intent detection (schedule)
    if (hasIntent(parseIntent(text), 'schedule')) {
      const today = new Date();
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
    const reply = generateOfflineReply(text, personaId, persona);
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

function generateOfflineReply(text: string, personaId: string, persona: PersonalityArchetype) {
  const match = parseIntent(text);
  const intent = match.intent;
  const strong = (target: DialogIntent) => hasIntent(match, target);

  // Compliments
  if (strong('compliment')) {
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
  if (strong('taskComplete')) {
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

  // Greetings (time-of-day aware)
  if (strong('greeting')) {
    const greeting = getRandomGreeting(personaId);
    return { text: greeting.text, mood: greeting.mood, suggestions: ["What's my schedule today?", "You look cute!", "Poke", "Just wanted to say hi"] };
  }

  // Joke
  if (strong('joke')) {
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

  // Thanks
  if (strong('thanks')) {
    const map: Record<string, { text: string; mood: string }> = {
      tsundere: { text: "H-Hmph! It's not like I did it so I could hear you say thanks... I was just bored anyway. Baka!", mood: 'blush' },
      kuudere: { text: "Acknowledgment received. Behavioral records updated to prioritize your future assistance requests.", mood: 'neutral' },
      yandere: { text: "Hehe, you're welcome, darling! I would do absolutely anything for you~ Absolutely anything at all.", mood: 'yandere' },
      deredere: { text: "Aww, thank YOU for always being so dependable! Helping you is my favorite thing in the whole world! 💖", mood: 'happy' },
      dandere: { text: "N-No need to thank me... I'm just happy that I could help you, even a little...", mood: 'blush' }
    };
    const res = map[personaId] || map.tsundere;
    return { text: res.text, mood: res.mood, suggestions: ["Review today's schedule", "You're the best!", "Poke", "Tell me a joke"] };
  }

  // Help
  if (strong('help')) {
    return {
      text: "I can review your schedule, remind you of tasks, cheer you on when you finish things, crack a joke, or just keep you company! Try asking \"What's on my calendar today?\" or just say hi.",
      mood: persona.defaultMood,
      suggestions: ["What's on my calendar today?", "Tell me a joke", "You look cute today", "Thanks!"]
    };
  }

  // Fallback: recognized but low-confidence / unmatched input.
  if (intent !== 'default' && match.confidence > 0) {
    // Recognized signal but too weak to commit — acknowledge it generically.
    const fallbacks: Record<string, string> = {
      tsundere: "Hmph! I heard you, dummy. I just need you to be a bit clearer, okay?",
      kuudere: "Input received. Confidence insufficient for a precise response. Please restate your request.",
      yandere: "Hehe, tell me again, darling? I want to hear every single word twice~",
      deredere: "Hehe, I caught a little of that! Could you say it again for me? ✨",
      dandere: "U-Um, I'm not sure I understood... would you mind saying that once more...?"
    };
    return {
      text: fallbacks[personaId] || fallbacks.tsundere,
      mood: persona.defaultMood,
      suggestions: ["Review today's schedule", "How are you doing?", "You look cute today", "Tell me a joke"]
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
