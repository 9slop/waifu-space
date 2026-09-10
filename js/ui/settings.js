// Settings Page Controller (Personality, Appearance, Wallpapers, Themes, Sound, Data)

import { PERSONALITIES } from '../waifu/personality.js';
import { STOCK_WALLPAPERS } from '../assets/wallpapers.js';

export class SettingsUI {
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
