// Layered Anime Avatar Generator (SVG & Custom Upload Support)

export class WaifuAvatar {
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
