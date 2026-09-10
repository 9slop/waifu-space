import { createSignal, onMount, For, Show } from 'solid-js';
import {
  state,
  setState,
  saveState,
  showToast,
  resetAllData,
  speakText,
  isCosmeticUnlocked
} from '../lib/store';
import { PERSONALITIES } from '../lib/personality';
import { STOCK_WALLPAPERS } from '../lib/wallpapers';
import { WaifuAvatar } from './WaifuAvatar';

export function SettingsStudio() {
  const [activeTab, setActiveTab] = createSignal<
    'personality' | 'appearance' | 'wallpapers' | 'themes' | 'voice' | 'data'
  >('personality');

  const [availableVoices, setAvailableVoices] = createSignal<SpeechSynthesisVoice[]>([]);

  onMount(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const load = () => {
        setAvailableVoices(window.speechSynthesis.getVoices());
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  });

  const testVoice = () => {
    speakText(`Hello! I am ${state.waifu.name}. My voice is configured and ready!`);
  };

  const handleCustomAvatarFile = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = evt => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        setState('waifu', 'appearance', 'customAvatarUrl', dataUrl);
        setState('waifu', 'appearance', 'avatarMode', 'custom');
        saveState();
        showToast('Custom sprite updated!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportData = () => {
    if (typeof window === 'undefined') return;
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waifu-space-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!');
  };

  const handleImportData = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        setState(parsed);
        saveState();
        showToast('Backup restored successfully!');
      } catch (err) {
        showToast('Failed to import JSON: Invalid file format');
      }
    };
    reader.readAsText(file);
    input.value = '';
  };

  const handleResetConfirm = () => {
    if (confirm('Are you sure you want to reset all data to factory defaults? All tasks and settings will be reset.')) {
      resetAllData();
    }
  };

  const hairColorPresets = ['#ff7597', '#4f86f7', '#6c5ce7', '#ffeaa7', '#2d3436', '#d63031', '#00cec9', '#a29bfe'];
  const eyeColorPresets = ['#4f86f7', '#ff7597', '#fdcb6e', '#00cec9', '#6c5ce7', '#e17055', '#2d3436', '#ff4757'];

  return (
    <div class="settings-layout">
      {/* SETTINGS TABS NAV */}
      <nav class="settings-nav">
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'personality' ? 'active' : ''}`}
          onClick={() => setActiveTab('personality')}
        >
          🌸 Personality
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          👗 Appearance & Clothes
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'wallpapers' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallpapers')}
        >
          🗾 Wallpapers
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'themes' ? 'active' : ''}`}
          onClick={() => setActiveTab('themes')}
        >
          🎨 Color Palette
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'voice' ? 'active' : ''}`}
          onClick={() => setActiveTab('voice')}
        >
          🎙️ Voice & AI
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          💾 Data & Backup
        </button>
      </nav>

      {/* SETTINGS SECTIONS WRAPPER */}
      <div class="settings-content">
        {/* 1. PERSONALITY TAB */}
        <Show when={activeTab() === 'personality'}>
          <div class="settings-section active">
            <div class="section-card">
              <h3 class="section-title">Companion Personality</h3>
              <p class="section-subtitle">
                Choose the personality archetype for your waifu companion. This changes her dialogue style, reactions to tasks, schedule reviews, and mood behavior.
              </p>

              <div class="form-group" style={{ 'margin-bottom': '20px' }}>
                <label class="form-label">Companion Name</label>
                <input
                  type="text"
                  class="modal-input"
                  style={{ 'max-width': '320px' }}
                  value={state.waifu.name}
                  onInput={e => {
                    setState('waifu', 'name', e.currentTarget.value);
                    saveState();
                  }}
                />
              </div>

              <div class="personality-grid">
                <For each={Object.values(PERSONALITIES)}>
                  {p => (
                    <div
                      class={`personality-card ${state.waifu.personality === p.id ? 'active' : ''}`}
                      onClick={() => {
                        setState('waifu', 'personality', p.id);
                        setState('waifu', 'mood', p.defaultMood);
                        saveState();
                        showToast(`Switched personality archetype to ${p.name}!`);
                      }}
                    >
                      <div class="persona-card-header">
                        <span class="persona-name">{p.name}</span>
                        {state.waifu.personality === p.id && <span class="persona-check">✔</span>}
                      </div>
                      <p class="persona-tagline">{p.tagline}</p>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>
        </Show>

        {/* 2. APPEARANCE TAB */}
        <Show when={activeTab() === 'appearance'}>
          <div class="settings-section active">
            <div class="appearance-studio-layout">
              {/* Controls */}
              <div class="appearance-controls-card">
                <h3 class="section-title">Visual Customizer</h3>
                <p class="section-subtitle">
                  Customize hairstyle, outfits, accessories, and colors.
                </p>

                {/* Avatar Type */}
                <div class="setting-row">
                  <div>
                    <strong>Avatar Type</strong>
                    <p class="setting-desc">Layered Anime SVG generator or custom image/GIF</p>
                  </div>
                  <select
                    class="modal-select"
                    style={{ width: '170px' }}
                    value={state.waifu.appearance.avatarMode}
                    onChange={e => {
                      setState('waifu', 'appearance', 'avatarMode', e.currentTarget.value as any);
                      saveState();
                    }}
                  >
                    <option value="svg">Layered Anime (SVG)</option>
                    <option value="custom">Custom Upload</option>
                  </select>
                </div>

                {state.waifu.appearance.avatarMode === 'custom' ? (
                  <div style={{ 'margin-top': '16px' }}>
                    <div class="setting-row">
                      <div>
                        <strong>Upload Image / GIF</strong>
                        <p class="setting-desc">PNG, JPG, or animated GIF sprite</p>
                      </div>
                      <label class="gcal-btn gcal-btn-outline" style={{ cursor: 'pointer' }}>
                        Browse File
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleCustomAvatarFile}
                        />
                      </label>
                    </div>
                    <div class="setting-row" style={{ 'margin-top': '10px' }}>
                      <label class="form-label">Or Image URL:</label>
                      <input
                        type="url"
                        class="modal-input"
                        placeholder="https://example.com/waifu.png"
                        value={state.waifu.appearance.customAvatarUrl}
                        onInput={e => {
                          setState('waifu', 'appearance', 'customAvatarUrl', e.currentTarget.value);
                          saveState();
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Hairstyle */}
                    <div class="setting-row">
                      <div>
                        <strong>Hairstyle</strong>
                        <p class="setting-desc">Modular vector anime hairstyles</p>
                      </div>
                      <select
                        class="modal-select"
                        style={{ width: '170px' }}
                        value={state.waifu.appearance.hairstyle}
                        onChange={e => {
                          setState('waifu', 'appearance', 'hairstyle', e.currentTarget.value);
                          saveState();
                        }}
                      >
                        <option value="twintails">Twintails</option>
                        <option value="long">Long Straight</option>
                        <option value="short_bob">Short Bob</option>
                        <option value="ponytail">Ponytail</option>
                        <option value="wavy">Wavy Hair</option>
                      </select>
                    </div>

                    {/* Outfit */}
                    <div class="setting-row">
                      <div>
                        <strong>Outfit Wardrobe</strong>
                        <p class="setting-desc">Change outfits & costumes</p>
                      </div>
                      <select
                        class="modal-select"
                        style={{ width: '190px' }}
                        value={state.waifu.appearance.outfit}
                        onChange={e => {
                          const val = e.currentTarget.value;
                          if (!isCosmeticUnlocked('outfits', val)) {
                            showToast('🔒 This outfit is locked! Unlock it from a Lootbox or Affection Road.');
                            e.currentTarget.value = state.waifu.appearance.outfit;
                            return;
                          }
                          setState('waifu', 'appearance', 'outfit', val);
                          saveState();
                        }}
                      >
                        <option value="seifuku">{isCosmeticUnlocked('outfits', 'seifuku') ? '🏫 Sailor Seifuku' : '🔒 🏫 Sailor Seifuku'}</option>
                        <option value="casual">{isCosmeticUnlocked('outfits', 'casual') ? '🛋️ Cozy Hoodie' : '🔒 🛋️ Cozy Hoodie'}</option>
                        <option value="maid">{isCosmeticUnlocked('outfits', 'maid') ? '☕ Maid Uniform' : '🔒 ☕ Maid Uniform'}</option>
                        <option value="kimono">{isCosmeticUnlocked('outfits', 'kimono') ? '👘 Summer Kimono' : '🔒 👘 Summer Kimono'}</option>
                        <option value="gothic">{isCosmeticUnlocked('outfits', 'gothic') ? '🥀 Gothic Lolita' : '🔒 🥀 Gothic Lolita'}</option>
                        <option value="miko">{isCosmeticUnlocked('outfits', 'miko') ? '⛩️ Shrine Maiden (Miko)' : '🔒 ⛩️ Shrine Maiden'}</option>
                        <option value="magical">{isCosmeticUnlocked('outfits', 'magical') ? '✨ Magical Girl' : '🔒 ✨ Magical Girl'}</option>
                        <option value="armor">{isCosmeticUnlocked('outfits', 'armor') ? '🛡️ Guardian Armor' : '🔒 🛡️ Guardian Armor'}</option>
                      </select>
                    </div>

                    {/* Accessory */}
                    <div class="setting-row">
                      <div>
                        <strong>Accessories</strong>
                        <p class="setting-desc">Headbands, ears, glasses</p>
                      </div>
                      <select
                        class="modal-select"
                        style={{ width: '190px' }}
                        value={state.waifu.appearance.accessory}
                        onChange={e => {
                          const val = e.currentTarget.value;
                          if (!isCosmeticUnlocked('accessories', val)) {
                            showToast('🔒 This accessory is locked! Unlock it from a Lootbox or Affection Road.');
                            e.currentTarget.value = state.waifu.appearance.accessory;
                            return;
                          }
                          setState('waifu', 'appearance', 'accessory', val);
                          saveState();
                        }}
                      >
                        <option value="none">None</option>
                        <option value="ribbon">{isCosmeticUnlocked('accessories', 'ribbon') ? '🎀 Ribbon' : '🔒 🎀 Ribbon'}</option>
                        <option value="glasses">{isCosmeticUnlocked('accessories', 'glasses') ? '👓 Red-rim Glasses' : '🔒 👓 Red-rim Glasses'}</option>
                        <option value="flower_pin">{isCosmeticUnlocked('accessories', 'flower_pin') ? '🌸 Sakura Hairpin' : '🔒 🌸 Sakura Hairpin'}</option>
                        <option value="headphones">{isCosmeticUnlocked('accessories', 'headphones') ? '🎧 Cyber Headphones' : '🔒 🎧 Cyber Headphones'}</option>
                        <option value="cat_ears">{isCosmeticUnlocked('accessories', 'cat_ears') ? '🐱 Cat Ears' : '🔒 🐱 Cat Ears'}</option>
                        <option value="bunny_ears">{isCosmeticUnlocked('accessories', 'bunny_ears') ? '🐰 Bunny Ears' : '🔒 🐰 Bunny Ears'}</option>
                        <option value="kitsune_mask">{isCosmeticUnlocked('accessories', 'kitsune_mask') ? '🦊 Kitsune Mask' : '🔒 🦊 Kitsune Mask'}</option>
                        <option value="halo">{isCosmeticUnlocked('accessories', 'halo') ? '😇 Angel Halo' : '🔒 😇 Angel Halo'}</option>
                      </select>
                    </div>

                    {/* Hair Color */}
                    <div class="setting-row">
                      <div>
                        <strong>Hair Color</strong>
                        <p class="setting-desc">Select preset or custom hex color</p>
                      </div>
                      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                        <For each={hairColorPresets}>
                          {c => (
                            <button
                              type="button"
                              class="color-dot"
                              style={{ background: c }}
                              onClick={() => {
                                setState('waifu', 'appearance', 'hairColor', c);
                                saveState();
                              }}
                            />
                          )}
                        </For>
                        <input
                          type="color"
                          value={state.waifu.appearance.hairColor}
                          onInput={e => {
                            setState('waifu', 'appearance', 'hairColor', e.currentTarget.value);
                            saveState();
                          }}
                        />
                      </div>
                    </div>

                    {/* Eye Color */}
                    <div class="setting-row">
                      <div>
                        <strong>Eye Color</strong>
                        <p class="setting-desc">Iris gradient tint</p>
                      </div>
                      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                        <For each={eyeColorPresets}>
                          {c => (
                            <button
                              type="button"
                              class="color-dot"
                              style={{ background: c }}
                              onClick={() => {
                                setState('waifu', 'appearance', 'eyeColor', c);
                                saveState();
                              }}
                            />
                          )}
                        </For>
                        <input
                          type="color"
                          value={state.waifu.appearance.eyeColor}
                          onInput={e => {
                            setState('waifu', 'appearance', 'eyeColor', e.currentTarget.value);
                            saveState();
                          }}
                        />
                      </div>
                    </div>

                    {/* Mood / Expression Preview */}
                    <div class="setting-row">
                      <div>
                        <strong>Expression Preview</strong>
                        <p class="setting-desc">Test reactive expressions</p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <For each={['neutral', 'happy', 'blush', 'pout', 'yandere', 'surprised']}>
                          {m => (
                            <button
                              type="button"
                              class={`suggestion-chip ${state.waifu.mood === m ? 'active' : ''}`}
                              onClick={() => {
                                setState('waifu', 'mood', m);
                                saveState();
                              }}
                            >
                              {m}
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Live Preview Stage */}
              <div class="appearance-preview-card">
                <div style={{ width: '280px', height: '360px', margin: '0 auto' }}>
                  <WaifuAvatar />
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* 3. WALLPAPERS TAB */}
        <Show when={activeTab() === 'wallpapers'}>
          <div class="settings-section active">
            <div class="section-card">
              <h3 class="section-title">Japanese Aesthetic Wallpapers</h3>
              <p class="section-subtitle">
                Select from curated stock anime / Japanese scenery wallpapers or use your own image.
              </p>

              <div class="wallpaper-grid">
                <For each={STOCK_WALLPAPERS}>
                  {wp => (
                    <div
                      class={`wallpaper-card ${state.settings.wallpaperType === 'stock' && state.settings.wallpaperId === wp.id ? 'active' : ''}`}
                      onClick={() => {
                        setState('settings', 'wallpaperType', 'stock');
                        setState('settings', 'wallpaperId', wp.id);
                        saveState();
                        showToast(`Changed wallpaper to ${wp.name}`);
                      }}
                    >
                      <img src={wp.thumb} alt={wp.name} class="wallpaper-thumb" />
                      <div class="wallpaper-info">
                        <span class="wallpaper-name">{wp.name}</span>
                        <span class="wallpaper-cat">{wp.category}</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <div class="setting-row" style={{ 'margin-top': '24px' }}>
                <div>
                  <strong>Custom Wallpaper URL</strong>
                  <p class="setting-desc">Paste an image link from the web</p>
                </div>
                <input
                  type="url"
                  class="modal-input"
                  style={{ 'max-width': '340px' }}
                  placeholder="https://images.unsplash.com/..."
                  value={state.settings.customWallpaperUrl}
                  onInput={e => {
                    setState('settings', 'customWallpaperUrl', e.currentTarget.value);
                    if (e.currentTarget.value) {
                      setState('settings', 'wallpaperType', 'custom');
                    } else {
                      setState('settings', 'wallpaperType', 'stock');
                    }
                    saveState();
                  }}
                />
              </div>

              <div class="setting-row">
                <div>
                  <strong>Background Blur ({state.settings.wallpaperBlur}px)</strong>
                  <p class="setting-desc">Subtle blur for improved text legibility</p>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={state.settings.wallpaperBlur}
                  onInput={e => {
                    setState('settings', 'wallpaperBlur', parseInt(e.currentTarget.value, 10));
                    saveState();
                  }}
                />
              </div>

              <div class="setting-row">
                <div>
                  <strong>Atmosphere Dim ({state.settings.wallpaperDim}%)</strong>
                  <p class="setting-desc">Darkness overlay opacity for higher contrast</p>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={state.settings.wallpaperDim}
                  onInput={e => {
                    setState('settings', 'wallpaperDim', parseInt(e.currentTarget.value, 10));
                    saveState();
                  }}
                />
              </div>

              <div class="setting-row">
                <div>
                  <strong>Falling Sakura Blossom Petals</strong>
                  <p class="setting-desc">Ambient cherry blossom canvas animation</p>
                </div>
                <input
                  type="checkbox"
                  checked={state.settings.sakuraParticles}
                  onChange={e => {
                    setState('settings', 'sakuraParticles', e.currentTarget.checked);
                    saveState();
                  }}
                />
              </div>
            </div>
          </div>
        </Show>

        {/* 4. THEMES TAB */}
        <Show when={activeTab() === 'themes'}>
          <div class="settings-section active">
            <div class="section-card">
              <h3 class="section-title">Color Palette & Glassmorphism</h3>
              <p class="section-subtitle">
                Select your favorite aesthetic color palette.
              </p>

              <div class="themes-grid">
                <For
                  each={[
                    { id: 'sakura', name: '🌸 Sakura Blossom', color: '#ff6584' },
                    { id: 'cyberpunk', name: '⚡ Cyberpunk Tokyo', color: '#00f2fe' },
                    { id: 'midnight', name: '🌌 Midnight Lavender', color: '#6c5ce7' },
                    { id: 'matcha', name: '🍵 Matcha Zen', color: '#00b894' },
                    { id: 'sunset', name: '🌇 Sunset Amber', color: '#e17055' },
                    { id: 'amoled', name: '🖤 AMOLED Dark', color: '#ff6584' }
                  ]}
                >
                  {thm => (
                    <div
                      class={`theme-card ${state.settings.theme === thm.id ? 'active' : ''}`}
                      onClick={() => {
                        setState('settings', 'theme', thm.id);
                        document.documentElement.setAttribute('data-theme', thm.id);
                        saveState();
                        showToast(`Theme set to ${thm.name}`);
                      }}
                    >
                      <span class="theme-dot" style={{ background: thm.color }} />
                      <span class="theme-name">{thm.name}</span>
                    </div>
                  )}
                </For>
              </div>

              <div class="setting-row" style={{ 'margin-top': '24px' }}>
                <div>
                  <strong>Custom Primary Accent Color</strong>
                  <p class="setting-desc">Overrides primary button and highlight colors</p>
                </div>
                <input
                  type="color"
                  value={state.settings.customAccent}
                  onInput={e => {
                    setState('settings', 'customAccent', e.currentTarget.value);
                    document.documentElement.style.setProperty('--primary-accent', e.currentTarget.value);
                    saveState();
                  }}
                />
              </div>
            </div>
          </div>
        </Show>

        {/* 5. VOICE & AI TAB */}
        <Show when={activeTab() === 'voice'}>
          <div class="settings-section active">
            <div class="section-card">
              <h3 class="section-title">Voice Synthesis & Optional AI</h3>
              <p class="section-subtitle">
                WaifuSpace features a rich, built-in offline persona dialogue engine. You can also enable Text-to-Speech or connect external AI models.
              </p>

              <div class="setting-row">
                <div>
                  <strong>Enable Text-to-Speech (TTS)</strong>
                  <p class="setting-desc">Waifu speaks her dialogues out loud using Web Speech API</p>
                </div>
                <input
                  type="checkbox"
                  checked={state.settings.ttsEnabled}
                  onChange={e => {
                    setState('settings', 'ttsEnabled', e.currentTarget.checked);
                    saveState();
                  }}
                />
              </div>

              <div class="setting-row">
                <div>
                  <strong>Speech Voice</strong>
                  <p class="setting-desc">Select from your installed system voices</p>
                </div>
                <select
                  class="modal-select"
                  style={{ width: '220px' }}
                  value={state.settings.ttsVoice}
                  onChange={e => {
                    setState('settings', 'ttsVoice', e.currentTarget.value);
                    saveState();
                  }}
                >
                  <option value="">Auto-select pleasant voice</option>
                  <For each={availableVoices()}>
                    {v => <option value={v.name}>{v.name} ({v.lang})</option>}
                  </For>
                </select>
              </div>

              <div class="setting-row">
                <div>
                  <strong>Voice Pitch ({state.settings.ttsPitch})</strong>
                  <p class="setting-desc">Higher pitch gives an anime/cute tonality</p>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={state.settings.ttsPitch}
                  onInput={e => {
                    setState('settings', 'ttsPitch', parseFloat(e.currentTarget.value));
                    saveState();
                  }}
                />
              </div>

              <div class="setting-row">
                <div>
                  <strong>Voice Speed ({state.settings.ttsRate}x)</strong>
                  <p class="setting-desc">Adjust speech pacing</p>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={state.settings.ttsRate}
                  onInput={e => {
                    setState('settings', 'ttsRate', parseFloat(e.currentTarget.value));
                    saveState();
                  }}
                />
              </div>

              <button
                type="button"
                class="gcal-btn gcal-btn-outline"
                style={{ 'margin-top': '10px' }}
                onClick={testVoice}
              >
                🔊 Test Voice
              </button>

              <hr style={{ margin: '24px 0', opacity: 0.15 }} />

              <h4 class="sidebar-heading">Optional AI LLM Provider</h4>
              <p class="section-subtitle">
                Connect your own API key for limitless natural responses. (Leave as None for the zero-config offline engine).
              </p>

              <div class="setting-row">
                <div>
                  <strong>AI Provider</strong>
                  <p class="setting-desc">Google Gemini, OpenAI, or OpenRouter</p>
                </div>
                <select
                  class="modal-select"
                  style={{ width: '180px' }}
                  value={state.settings.llmProvider}
                  onChange={e => {
                    setState('settings', 'llmProvider', e.currentTarget.value);
                    saveState();
                  }}
                >
                  <option value="none">Built-in Offline Engine</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (GPT-4o mini)</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>

              {state.settings.llmProvider !== 'none' && (
                <>
                  <div class="setting-row">
                    <div>
                      <strong>API Key</strong>
                      <p class="setting-desc">Stored strictly locally in your browser's LocalStorage</p>
                    </div>
                    <input
                      type="password"
                      class="modal-input"
                      style={{ 'max-width': '340px' }}
                      placeholder="sk-..."
                      value={state.settings.llmApiKey}
                      onInput={e => {
                        setState('settings', 'llmApiKey', e.currentTarget.value);
                        saveState();
                      }}
                    />
                  </div>

                  <div class="setting-row">
                    <div>
                      <strong>Model Name</strong>
                      <p class="setting-desc">e.g. gemini-1.5-flash, gpt-4o-mini</p>
                    </div>
                    <input
                      type="text"
                      class="modal-input"
                      style={{ 'max-width': '340px' }}
                      value={state.settings.llmModel}
                      onInput={e => {
                        setState('settings', 'llmModel', e.currentTarget.value);
                        saveState();
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </Show>

        {/* 6. DATA TAB */}
        <Show when={activeTab() === 'data'}>
          <div class="settings-section active">
            <div class="section-card">
              <h3 class="section-title">Data Backup, Export & Factory Reset</h3>
              <p class="section-subtitle">
                All your calendar schedules, customization settings, and companion affection progression are preserved in your browser.
              </p>

              <div class="setting-row">
                <div>
                  <strong>Export Full JSON Backup</strong>
                  <p class="setting-desc">Download a backup file of your events, settings, and progress</p>
                </div>
                <button
                  type="button"
                  class="gcal-btn gcal-btn-outline"
                  onClick={handleExportData}
                >
                  💾 Export Backup (.json)
                </button>
              </div>

              <div class="setting-row">
                <div>
                  <strong>Restore Backup</strong>
                  <p class="setting-desc">Import a previously exported JSON backup</p>
                </div>
                <label class="gcal-btn gcal-btn-outline" style={{ cursor: 'pointer' }}>
                  📂 Import Backup (.json)
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleImportData}
                  />
                </label>
              </div>

              <div class="setting-row" style={{ 'margin-top': '24px' }}>
                <div>
                  <strong style={{ color: '#ff4757' }}>Factory Reset</strong>
                  <p class="setting-desc">Erase all calendar events and reset companion to initial state</p>
                </div>
                <button
                  type="button"
                  class="gcal-btn gcal-btn-danger"
                  onClick={handleResetConfirm}
                >
                  ⚠️ Reset Everything
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
