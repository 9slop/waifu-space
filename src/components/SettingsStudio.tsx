import { createSignal, onMount, For, Show } from 'solid-js';
import {
  state,
  setState,
  saveState,
  updateSettings,
  showToast,
  resetAllData,
  speakText,
  isCosmeticUnlocked
} from '../lib/store';
import { onActivateKey } from '../lib/accessibility';
import { PERSONALITIES } from '../lib/personality';
import { STOCK_WALLPAPERS } from '../lib/wallpapers';
import { WaifuAvatar } from './WaifuAvatar';
import { t, SUPPORTED_LANGUAGES, setLanguage, SupportedLanguage } from '../lib/i18n';

export function SettingsStudio() {
  const [activeTab, setActiveTab] = createSignal<
    'personality' | 'appearance' | 'wallpapers' | 'themes' | 'voice' | 'data' | 'language'
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
    speakText(t('settings.voice.testVoiceMessage', { name: state.waifu.name }));
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
        showToast(t('settings.appearance.customSpriteUpdated'));
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
    showToast(t('settings.data.exportSuccess'));
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
        showToast(t('settings.data.importSuccess'));
      } catch (err) {
        showToast(t('settings.data.importFailed'));
      }
    };
    reader.readAsText(file);
    input.value = '';
  };

  const handleResetConfirm = () => {
    if (confirm(t('settings.data.resetConfirm'))) {
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
          🌸 {t('settings.tabs.personality')}
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          👗 {t('settings.tabs.appearance')}
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'wallpapers' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallpapers')}
        >
          🗾 {t('settings.tabs.wallpapers')}
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'themes' ? 'active' : ''}`}
          onClick={() => setActiveTab('themes')}
        >
          🎨 {t('settings.tabs.themes')}
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'voice' ? 'active' : ''}`}
          onClick={() => setActiveTab('voice')}
        >
          🎙️ {t('settings.tabs.voice')}
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          💾 {t('settings.tabs.data')}
        </button>
        <button
          type="button"
          class={`settings-tab-btn ${activeTab() === 'language' ? 'active' : ''}`}
          onClick={() => setActiveTab('language')}
        >
          🌐 {t('settings.tabs.language')}
        </button>
      </nav>

      {/* SETTINGS SECTIONS WRAPPER */}
      <div class="settings-content">
        {/* 1. PERSONALITY TAB */}
        <Show when={activeTab() === 'personality'}>
          <div class="settings-section active">
            <div class="section-card">
              <h3 class="section-title">{t('settings.personality.title')}</h3>
              <p class="section-subtitle">
                {t('settings.personality.subtitle')}
              </p>

              <div class="form-group" style={{ 'margin-bottom': '20px' }}>
                <label class="form-label">{t('settings.personality.companionName')}</label>
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
                  {p => {
                    const isActive = () => state.waifu.personality === p.id;
                    const selectPersonality = () => {
                      setState('waifu', 'personality', p.id);
                      setState('waifu', 'mood', p.defaultMood);
                      saveState();
                      showToast(t('settings.personality.switchedToast', { name: p.name }));
                    };
                    return (
                      <div
                        class={`personality-card ${isActive() ? 'active' : ''}`}
                        role="button"
                        tabindex="0"
                        aria-pressed={isActive()}
                        aria-label={t('settings.a11y.personalityOption', { name: p.name })}
                        onClick={selectPersonality}
                        onKeyDown={e => onActivateKey(e, selectPersonality)}
                      >
                        <div class="persona-card-header">
                          <span class="persona-name">{p.name}</span>
                          {isActive() && <span class="persona-check">✔</span>}
                        </div>
                        <p class="persona-tagline">{p.tagline}</p>
                      </div>
                    );
                  }}
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
                <h3 class="section-title">{t('settings.appearance.title')}</h3>
                <p class="section-subtitle">
                  {t('settings.appearance.subtitle')}
                </p>

                {/* Avatar Type */}
                <div class="setting-row">
                  <div>
                    <strong>{t('settings.appearance.avatarType')}</strong>
                    <p class="setting-desc">{t('settings.appearance.avatarTypeDesc')}</p>
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
                    <option value="svg">{t('settings.appearance.layeredSvg')}</option>
                    <option value="custom">{t('settings.appearance.customUpload')}</option>
                  </select>
                </div>

                {state.waifu.appearance.avatarMode === 'custom' ? (
                  <div style={{ 'margin-top': '16px' }}>
                    <div class="setting-row">
                      <div>
                        <strong>{t('settings.appearance.uploadImage')}</strong>
                        <p class="setting-desc">{t('settings.appearance.uploadImageDesc')}</p>
                      </div>
                      <label class="gcal-btn gcal-btn-outline" style={{ cursor: 'pointer' }}>
                        {t('settings.appearance.browseFile')}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleCustomAvatarFile}
                        />
                      </label>
                    </div>
                    <div class="setting-row" style={{ 'margin-top': '10px' }}>
                      <label class="form-label">{t('settings.appearance.imageUrl')}</label>
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
                        <strong>{t('settings.appearance.hairstyle')}</strong>
                        <p class="setting-desc">{t('settings.appearance.hairstyleDesc')}</p>
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
                        <strong>{t('settings.appearance.outfit')}</strong>
                        <p class="setting-desc">{t('settings.appearance.outfitDesc')}</p>
                      </div>
                      <select
                        class="modal-select"
                        style={{ width: '190px' }}
                        value={state.waifu.appearance.outfit}
                        onChange={e => {
                          const val = e.currentTarget.value;
                          if (!isCosmeticUnlocked('outfits', val)) {
                            showToast(t('settings.appearance.lockedOutfitToast'));
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
                        <strong>{t('settings.appearance.accessories')}</strong>
                        <p class="setting-desc">{t('settings.appearance.accessoriesDesc')}</p>
                      </div>
                      <select
                        class="modal-select"
                        style={{ width: '190px' }}
                        value={state.waifu.appearance.accessory}
                        onChange={e => {
                          const val = e.currentTarget.value;
                          if (!isCosmeticUnlocked('accessories', val)) {
                            showToast(t('settings.appearance.lockedAccessoryToast'));
                            e.currentTarget.value = state.waifu.appearance.accessory;
                            return;
                          }
                          setState('waifu', 'appearance', 'accessory', val);
                          saveState();
                        }}
                      >
                        <option value="none">{t('common.none')}</option>
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
                        <strong>{t('settings.appearance.hairColor')}</strong>
                        <p class="setting-desc">{t('settings.appearance.hairColorDesc')}</p>
                      </div>
                      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                        <For each={hairColorPresets}>
                          {c => (
                            <button
                              type="button"
                              class="color-dot"
                              style={{ background: c }}
                              aria-label={t('settings.a11y.hairColorOption', { color: c })}
                              aria-pressed={state.waifu.appearance.hairColor === c}
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
                        <strong>{t('settings.appearance.eyeColor')}</strong>
                        <p class="setting-desc">{t('settings.appearance.eyeColorDesc')}</p>
                      </div>
                      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                        <For each={eyeColorPresets}>
                          {c => (
                            <button
                              type="button"
                              class="color-dot"
                              style={{ background: c }}
                              aria-label={t('settings.a11y.eyeColorOption', { color: c })}
                              aria-pressed={state.waifu.appearance.eyeColor === c}
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
                        <strong>{t('settings.appearance.expressionPreview')}</strong>
                        <p class="setting-desc">{t('settings.appearance.expressionPreviewDesc')}</p>
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
              <h3 class="section-title">{t('settings.wallpapers.title')}</h3>
              <p class="section-subtitle">
                {t('settings.wallpapers.subtitle')}
              </p>

              <div class="wallpaper-grid">
                <For each={STOCK_WALLPAPERS}>
                  {wp => {
                    const isActive = () =>
                      state.settings.wallpaperType === 'stock' && state.settings.wallpaperId === wp.id;
                    const selectWallpaper = () => {
                      updateSettings({ wallpaperType: 'stock' });
                      updateSettings({ wallpaperId: wp.id });
                      saveState();
                      showToast(t('settings.wallpapers.changedToast', { name: wp.name }));
                    };
                    return (
                      <div
                        class={`wallpaper-card ${isActive() ? 'active' : ''}`}
                        role="button"
                        tabindex="0"
                        aria-pressed={isActive()}
                        aria-label={t('settings.a11y.wallpaperOption', { name: wp.name })}
                        onClick={selectWallpaper}
                        onKeyDown={e => onActivateKey(e, selectWallpaper)}
                      >
                        <img src={wp.thumb} alt={wp.name} aria-hidden="true" class="wallpaper-thumb" />
                        <div class="wallpaper-info">
                          <span class="wallpaper-name">{wp.name}</span>
                          <span class="wallpaper-cat">{wp.category}</span>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>

              <div class="setting-row" style={{ 'margin-top': '24px' }}>
                <div>
                  <strong>{t('settings.wallpapers.customUrl')}</strong>
                  <p class="setting-desc">{t('settings.wallpapers.customUrlDesc')}</p>
                </div>
                <input
                  type="url"
                  class="modal-input"
                  style={{ 'max-width': '340px' }}
                  placeholder="https://images.unsplash.com/..."
                  value={state.settings.customWallpaperUrl}
                  onInput={e => {
                    updateSettings({ customWallpaperUrl: e.currentTarget.value });
                    if (e.currentTarget.value) {
                      updateSettings({ wallpaperType: 'custom' });
                    } else {
                      updateSettings({ wallpaperType: 'stock' });
                    }
                    saveState();
                  }}
                />
              </div>

              <div class="setting-row">
                <div>
                  <strong>{t('settings.wallpapers.blur', { blur: state.settings.wallpaperBlur })}</strong>
                  <p class="setting-desc">{t('settings.wallpapers.blurDesc')}</p>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={state.settings.wallpaperBlur}
                  onInput={e => {
                    updateSettings({ wallpaperBlur: parseInt(e.currentTarget.value, 10) });
                    saveState();
                  }}
                />
              </div>

              <div class="setting-row">
                <div>
                  <strong>{t('settings.wallpapers.dim', { dim: state.settings.wallpaperDim })}</strong>
                  <p class="setting-desc">{t('settings.wallpapers.dimDesc')}</p>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={state.settings.wallpaperDim}
                  onInput={e => {
                    updateSettings({ wallpaperDim: parseInt(e.currentTarget.value, 10) });
                    saveState();
                  }}
                />
              </div>

              <div class="setting-row">
                <div>
                  <strong>{t('settings.wallpapers.sakuraParticles')}</strong>
                  <p class="setting-desc">{t('settings.wallpapers.sakuraParticlesDesc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={state.settings.sakuraParticles}
                  onChange={e => {
                    updateSettings({ sakuraParticles: e.currentTarget.checked });
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
              <h3 class="section-title">{t('settings.themes.title')}</h3>
              <p class="section-subtitle">
                {t('settings.themes.subtitle')}
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
                  {thm => {
                    const isActive = () => state.settings.theme === thm.id;
                    const selectTheme = () => {
                      updateSettings({ theme: thm.id });
                      document.documentElement.setAttribute('data-theme', thm.id);
                      saveState();
                      showToast(t('settings.themes.themeSetToast', { name: thm.name }));
                    };
                    return (
                      <div
                        class={`theme-card ${isActive() ? 'active' : ''}`}
                        role="button"
                        tabindex="0"
                        aria-pressed={isActive()}
                        aria-label={t('settings.a11y.themeOption', { name: thm.name })}
                        onClick={selectTheme}
                        onKeyDown={e => onActivateKey(e, selectTheme)}
                      >
                        <span class="theme-dot" style={{ background: thm.color }} />
                        <span class="theme-name">{thm.name}</span>
                      </div>
                    );
                  }}
                </For>
              </div>

              <div class="setting-row" style={{ 'margin-top': '24px' }}>
                <div>
                  <strong>{t('settings.themes.customAccent')}</strong>
                  <p class="setting-desc">{t('settings.themes.customAccentDesc')}</p>
                </div>
                <input
                  type="color"
                  value={state.settings.customAccent}
                  onInput={e => {
                    updateSettings({ customAccent: e.currentTarget.value });
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
              <h3 class="section-title">{t('settings.voice.title')}</h3>
              <p class="section-subtitle">
                {t('settings.voice.subtitle')}
              </p>

              <div class="setting-row">
                <div>
                  <strong>{t('settings.voice.tts')}</strong>
                  <p class="setting-desc">{t('settings.voice.ttsDesc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={state.settings.ttsEnabled}
                  onChange={e => {
                    updateSettings({ ttsEnabled: e.currentTarget.checked });
                    saveState();
                  }}
                />
              </div>

              <div class="setting-row">
                <div>
                  <strong>{t('settings.voice.voice')}</strong>
                  <p class="setting-desc">{t('settings.voice.voiceDesc')}</p>
                </div>
                <select
                  class="modal-select"
                  style={{ width: '220px' }}
                  value={state.settings.ttsVoice}
                  onChange={e => {
                    updateSettings({ ttsVoice: e.currentTarget.value });
                    saveState();
                  }}
                >
                  <option value="">{t('settings.voice.autoVoice')}</option>
                  <For each={availableVoices()}>
                    {v => <option value={v.name}>{v.name} ({v.lang})</option>}
                  </For>
                </select>
              </div>

              <div class="setting-row">
                <div>
                  <strong>{t('settings.voice.pitch', { pitch: state.settings.ttsPitch })}</strong>
                  <p class="setting-desc">{t('settings.voice.pitchDesc')}</p>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={state.settings.ttsPitch}
                  onInput={e => {
                    updateSettings({ ttsPitch: parseFloat(e.currentTarget.value) });
                    saveState();
                  }}
                />
              </div>

              <div class="setting-row">
                <div>
                  <strong>{t('settings.voice.speed', { rate: state.settings.ttsRate })}</strong>
                  <p class="setting-desc">{t('settings.voice.speedDesc')}</p>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={state.settings.ttsRate}
                  onInput={e => {
                    updateSettings({ ttsRate: parseFloat(e.currentTarget.value) });
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
                🔊 {t('settings.voice.testVoice')}
              </button>

              <hr style={{ margin: '24px 0', opacity: 0.15 }} />

              <h4 class="sidebar-heading">{t('settings.voice.aiProvider')}</h4>
              <p class="section-subtitle">
                {t('settings.voice.aiProviderSubtitle')}
              </p>

              <div class="setting-row">
                <div>
                  <strong>{t('settings.voice.providerLabel')}</strong>
                  <p class="setting-desc">{t('settings.voice.providerDesc')}</p>
                </div>
                <select
                  class="modal-select"
                  style={{ width: '180px' }}
                  value={state.settings.llmProvider}
                  onChange={e => {
                    updateSettings({ llmProvider: e.currentTarget.value });
                    saveState();
                  }}
                >
                  <option value="none">{t('settings.voice.offlineEngine')}</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (GPT-4o mini)</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>

              {state.settings.llmProvider !== 'none' && (
                <>
                  <div class="setting-row">
                    <div>
                      <strong>{t('settings.voice.apiKey')}</strong>
                      <p class="setting-desc">{t('settings.voice.apiKeyDesc')}</p>
                    </div>
                    <input
                      type="password"
                      class="modal-input"
                      style={{ 'max-width': '340px' }}
                      placeholder="sk-..."
                      value={state.settings.llmApiKey}
                      onInput={e => {
                        updateSettings({ llmApiKey: e.currentTarget.value });
                        saveState();
                      }}
                    />
                  </div>

                  <div class="setting-row">
                    <div>
                      <strong>{t('settings.voice.modelName')}</strong>
                      <p class="setting-desc">{t('settings.voice.modelNameDesc')}</p>
                    </div>
                    <input
                      type="text"
                      class="modal-input"
                      style={{ 'max-width': '340px' }}
                      value={state.settings.llmModel}
                      onInput={e => {
                        updateSettings({ llmModel: e.currentTarget.value });
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
              <h3 class="section-title">{t('settings.data.title')}</h3>
              <p class="section-subtitle">
                {t('settings.data.subtitle')}
              </p>

              <div class="setting-row">
                <div>
                  <strong>{t('settings.data.exportJson')}</strong>
                  <p class="setting-desc">{t('settings.data.exportJsonDesc')}</p>
                </div>
                <button
                  type="button"
                  class="gcal-btn gcal-btn-outline"
                  onClick={handleExportData}
                >
                  {t('settings.data.exportBtn')}
                </button>
              </div>

              <div class="setting-row">
                <div>
                  <strong>{t('settings.data.restoreBackup')}</strong>
                  <p class="setting-desc">{t('settings.data.restoreBackupDesc')}</p>
                </div>
                <label class="gcal-btn gcal-btn-outline" style={{ cursor: 'pointer' }}>
                  {t('settings.data.importBtn')}
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
                  <strong style={{ color: '#ff4757' }}>{t('settings.data.factoryReset')}</strong>
                  <p class="setting-desc">{t('settings.data.factoryResetDesc')}</p>
                </div>
                <button
                  type="button"
                  class="gcal-btn gcal-btn-danger"
                  onClick={handleResetConfirm}
                >
                  {t('settings.data.resetBtn')}
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* 7. LANGUAGE TAB */}
        <Show when={activeTab() === 'language'}>
          <div class="settings-section active" data-testid="language-settings-section">
            <div class="section-card">
              <h3 class="section-title">🌐 {t('settings.language.title')}</h3>
              <p class="section-subtitle">
                {t('settings.language.subtitle')}
              </p>

              <div
                class="language-selection-grid"
                style={{
                  display: 'grid',
                  'grid-template-columns': 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                  'margin-top': '20px'
                }}
              >
                <For each={SUPPORTED_LANGUAGES}>
                  {lang => {
                    const isSelected = () => (state.settings.language || 'en') === lang.code;
                    const selectLanguage = () => {
                      setLanguage(lang.code);
                      showToast(t('settings.language.switchedToast', { lang: lang.nativeName }));
                    };
                    return (
                      <div
                        class={`personality-card language-card ${isSelected() ? 'active' : ''}`}
                        data-testid={`language-card-${lang.code}`}
                        style={{ cursor: 'pointer', padding: '16px', 'border-radius': '12px' }}
                        role="button"
                        tabindex="0"
                        aria-pressed={isSelected()}
                        onClick={selectLanguage}
                        onKeyDown={e => onActivateKey(e, selectLanguage)}
                      >
                        <div
                          class="persona-card-header"
                          style={{
                            display: 'flex',
                            'align-items': 'center',
                            'justify-content': 'space-between',
                            'margin-bottom': '8px'
                          }}
                        >
                          <span style={{ 'font-size': '1.3rem', display: 'flex', 'align-items': 'center', gap: '8px' }}>
                            <span>{lang.flag}</span>
                            <strong>{lang.nativeName}</strong>
                          </span>
                          {isSelected() && <span class="persona-check">✔</span>}
                        </div>
                        <p class="persona-tagline" style={{ margin: 0, opacity: 0.8 }}>
                          {lang.name} {isSelected() ? `(${t('common.active')})` : ''}
                        </p>
                      </div>
                    );
                  }}
                </For>
              </div>

              <div class="setting-row" style={{ 'margin-top': '24px' }}>
                <div>
                  <strong>{t('settings.language.currentLanguage')}</strong>
                  <p class="setting-desc">{t('settings.language.autoSaved')}</p>
                </div>
                <select
                  class="modal-select"
                  data-testid="language-select"
                  style={{ width: '220px' }}
                  value={state.settings.language || 'en'}
                  onChange={e => {
                    const lang = e.currentTarget.value as SupportedLanguage;
                    setLanguage(lang);
                    const opt = SUPPORTED_LANGUAGES.find(l => l.code === lang);
                    showToast(t('settings.language.switchedToast', { lang: opt ? opt.nativeName : lang }));
                  }}
                >
                  <For each={SUPPORTED_LANGUAGES}>
                    {l => <option value={l.code}>{l.flag} {l.nativeName} ({l.name})</option>}
                  </For>
                </select>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
