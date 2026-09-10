// Interactive Waifu Chat Interface & Stage Interactions

import { getPersonality } from '../waifu/personality.js';

export class ChatUI {
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
