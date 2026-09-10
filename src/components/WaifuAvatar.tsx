import { createSignal, onMount, onCleanup, createMemo } from 'solid-js';
import { state, isTalking } from '../lib/store';

function shadeColor(color: string, percent: number): string {
  if (!color || !color.startsWith('#')) return color || '#ff7597';
  let num = parseInt(color.slice(1), 16);
  if (isNaN(num)) return color;
  let amt = Math.round(2.55 * percent);
  let R = (num >> 16) + amt;
  let G = ((num >> 8) & 0x00ff) + amt;
  let B = (num & 0x0000ff) + amt;
  return (
    '#' +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

function getMoodEmoji(mood: string): string {
  switch (mood) {
    case 'happy':
      return '✨';
    case 'blush':
      return '💖';
    case 'pout':
      return '💢';
    case 'yandere':
      return '🔪';
    case 'surprised':
      return '❗';
    default:
      return '🌸';
  }
}

export function WaifuAvatar() {
  const [isBlinking, setIsBlinking] = createSignal(false);
  let blinkTimeout: any = null;

  const scheduleBlink = () => {
    const delay = 2600 + Math.random() * 3200;
    blinkTimeout = setTimeout(() => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        scheduleBlink();
      }, 160);
    }, delay);
  };

  onMount(() => {
    scheduleBlink();
  });

  onCleanup(() => {
    clearTimeout(blinkTimeout);
  });

  const pfx = 'wa_start';

  const hairColor = () => state.waifu.appearance.hairColor || '#ff7597';
  const eyeColor = () => state.waifu.appearance.eyeColor || '#4f86f7';
  const skinTone = () => state.waifu.appearance.skinTone || '#fff0ea';
  const skinShadow = () => shadeColor(skinTone(), -12);
  const blushColor = 'rgba(255, 95, 130, 0.55)';
  const mood = () => state.waifu.mood || 'neutral';
  const hairstyle = () => state.waifu.appearance.hairstyle || 'twintails';
  const outfit = () => state.waifu.appearance.outfit || 'seifuku';
  const accessory = () => state.waifu.appearance.accessory || 'ribbon';

  return (
    <>
      {state.waifu.appearance.avatarMode === 'custom' && state.waifu.appearance.customAvatarUrl ? (
        <div class={`custom-avatar-wrapper mood-${mood()}`}>
          <img
            src={state.waifu.appearance.customAvatarUrl}
            alt="Custom Companion Avatar"
            class="custom-avatar-img animate-breathe"
          />
          <div class="custom-avatar-mood-badge">{getMoodEmoji(mood())}</div>
        </div>
      ) : (
        <div class={`svg-avatar-wrapper animate-breathe mood-${mood()}`}>
          <svg viewBox="0 0 400 520" class="waifu-avatar-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id={`${pfx}_hairGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color={shadeColor(hairColor(), 15)} />
                <stop offset="40%" stop-color={hairColor()} />
                <stop offset="100%" stop-color={shadeColor(hairColor(), -25)} />
              </linearGradient>

              <radialGradient id={`${pfx}_eyeGrad`} cx="50%" cy="38%" r="62%">
                <stop offset="0%" stop-color={shadeColor(eyeColor(), 50)} />
                <stop offset="45%" stop-color={eyeColor()} />
                <stop offset="100%" stop-color={shadeColor(eyeColor(), -45)} />
              </radialGradient>

              <radialGradient id={`${pfx}_yandereGrad`} cx="50%" cy="50%" r="55%">
                <stop offset="0%" stop-color="#ff0055" />
                <stop offset="55%" stop-color="#99002a" />
                <stop offset="100%" stop-color="#2a0008" />
              </radialGradient>

              <linearGradient id={`${pfx}_yandereShadow`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#140008" stop-opacity="0.9" />
                <stop offset="60%" stop-color="#880022" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#ff0044" stop-opacity="0" />
              </linearGradient>
            </defs>

            {/* 1. BACK HAIR LAYER */}
            <g id={`${pfx}_back_hair`}>
              {/* Crown base */}
              <path
                d="M 124,165 C 118,85 282,85 276,165 C 285,210 275,250 265,270 L 135,270 C 125,250 115,210 124,165 Z"
                fill={`url(#${pfx}_hairGrad)`}
              />
              {hairstyle() === 'twintails' && (
                <>
                  <path
                    d="M 130,135 C 75,150 40,240 55,340 C 65,410 90,470 82,510 C 68,460 55,390 62,320 C 70,250 100,170 135,145 Z"
                    fill={`url(#${pfx}_hairGrad)`}
                  />
                  <path
                    d="M 70,330 C 60,400 78,460 76,495 C 64,450 56,380 65,310 Z"
                    fill={shadeColor(hairColor(), -22)}
                  />
                  <path
                    d="M 270,135 C 325,150 360,240 345,340 C 335,410 310,470 318,510 C 332,460 345,390 338,320 C 330,250 300,170 265,145 Z"
                    fill={`url(#${pfx}_hairGrad)`}
                  />
                  <path
                    d="M 330,330 C 340,400 322,460 324,495 C 336,450 344,380 335,310 Z"
                    fill={shadeColor(hairColor(), -22)}
                  />
                  <circle cx="130" cy="138" r="7" fill="#ff4757" />
                  <circle cx="270" cy="138" r="7" fill="#ff4757" />
                </>
              )}
              {hairstyle() === 'long' && (
                <>
                  <path
                    d="M 120,150 C 95,210 90,320 105,460 C 112,500 130,520 200,520 C 270,520 288,500 295,460 C 310,320 305,210 280,150 Z"
                    fill={`url(#${pfx}_hairGrad)`}
                  />
                  <path
                    d="M 105,460 C 135,485 170,490 200,490 C 230,490 265,485 295,460 C 285,420 280,310 290,200 C 270,280 250,420 200,430 C 150,420 130,280 110,200 C 120,310 115,420 105,460 Z"
                    fill={shadeColor(hairColor(), -22)}
                  />
                </>
              )}
              {hairstyle() === 'ponytail' && (
                <>
                  <path
                    d="M 255,115 C 315,100 375,170 365,270 C 355,360 320,440 330,480 C 315,430 325,350 330,280 C 335,210 295,145 260,130 Z"
                    fill={`url(#${pfx}_hairGrad)`}
                  />
                  <circle cx="258" cy="120" r="9" fill="#ff6b81" />
                </>
              )}
              {hairstyle() === 'wavy' && (
                <>
                  <path
                    d="M 125,160 C 85,220 95,310 75,390 C 65,435 95,480 105,510 C 90,460 85,400 100,330 C 115,270 115,200 130,165 Z"
                    fill={`url(#${pfx}_hairGrad)`}
                  />
                  <path
                    d="M 275,160 C 315,220 305,310 325,390 C 335,435 305,480 295,510 C 310,460 315,400 300,330 C 285,270 285,200 270,165 Z"
                    fill={`url(#${pfx}_hairGrad)`}
                  />
                </>
              )}
              {hairstyle() === 'short_bob' && (
                <>
                  <path
                    d="M 125,150 C 110,210 115,280 135,315 C 160,330 240,330 265,315 C 285,280 290,210 275,150 Z"
                    fill={`url(#${pfx}_hairGrad)`}
                  />
                  <path
                    d="M 135,290 C 165,315 235,315 265,290 C 255,270 240,240 200,240 C 160,240 145,270 135,290 Z"
                    fill={shadeColor(hairColor(), -22)}
                  />
                </>
              )}
            </g>

            {/* 2. BODY BASE */}
            <g id={`${pfx}_body_base`}>
              <path
                d="M 125,330 C 135,270 170,258 200,258 C 230,258 265,270 275,330 L 305,520 L 95,520 Z"
                fill={skinTone()}
              />
              <path
                d="M 125,330 C 115,360 105,420 95,520 L 140,520 C 145,430 150,370 155,330 Z"
                fill={skinTone()}
              />
              <path
                d="M 275,330 C 285,360 295,420 305,520 L 260,520 C 255,430 250,370 245,330 Z"
                fill={skinTone()}
              />
              <polygon points="182,230 218,230 224,285 176,285" fill={skinShadow()} />
              <polygon points="185,235 215,235 220,280 180,280" fill={skinTone()} />
              <path
                d="M 170,285 Q 185,292 200,288 Q 215,292 230,285"
                stroke={skinShadow()}
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
              />
            </g>

            {/* 3. CLOTHING */}
            <g id={`${pfx}_outfit`}>
              {outfit() === 'maid' && (
                <>
                  <ellipse cx="115" cy="335" rx="28" ry="24" fill="#1e1e24" />
                  <ellipse cx="285" cy="335" rx="28" ry="24" fill="#1e1e24" />
                  <path d="M 92,345 Q 115,355 138,345" stroke="#ffffff" stroke-width="4" fill="none" />
                  <path d="M 262,345 Q 285,355 308,345" stroke="#ffffff" stroke-width="4" fill="none" />
                  <path d="M 138,300 L 262,300 L 285,520 L 115,520 Z" fill="#1e1e24" />
                  <path d="M 165,300 L 235,300 L 248,520 L 152,520 Z" fill="#ffffff" />
                  <path d="M 152,295 Q 146,340 156,410" stroke="#f1f2f6" stroke-width="8" fill="none" stroke-linecap="round" />
                  <path d="M 248,295 Q 254,340 244,410" stroke="#f1f2f6" stroke-width="8" fill="none" stroke-linecap="round" />
                  <polygon points="182,290 200,310 218,290" fill="#ffffff" />
                  <circle cx="200" cy="310" r="5" fill="#ff4757" />
                  <polygon points="200,310 186,322 195,334 200,318 205,334 214,322" fill="#ff4757" />
                </>
              )}
              {outfit() === 'kimono' && (
                <>
                  <path d="M 125,320 L 70,440 L 125,520 L 145,390 Z" fill="#1e2c3a" />
                  <path d="M 275,320 L 330,440 L 275,520 L 255,390 Z" fill="#1e2c3a" />
                  <path d="M 135,290 L 265,290 L 285,520 L 115,520 Z" fill="#243447" />
                  <polygon points="160,285 200,345 240,285 224,285 200,325 176,285" fill="#f5f6fa" />
                  <polygon points="166,290 200,345 180,345 152,290" fill="#e74c3c" />
                  <rect x="140" y="360" width="120" height="48" rx="4" fill="#f1c40f" />
                  <rect x="140" y="378" width="120" height="12" fill="#e74c3c" />
                  <circle cx="150" cy="440" r="6" fill="#ff7597" opacity="0.8" />
                  <circle cx="250" cy="460" r="7" fill="#ff7597" opacity="0.8" />
                  <circle cx="170" cy="490" r="5" fill="#ff7597" opacity="0.8" />
                </>
              )}
              {outfit() === 'gothic' && (
                <>
                  <ellipse cx="118" cy="335" rx="26" ry="24" fill="#12080e" />
                  <ellipse cx="282" cy="335" rx="26" ry="24" fill="#12080e" />
                  <path d="M 138,295 L 262,295 L 285,520 L 115,520 Z" fill="#12080e" />
                  <path d="M 170,305 L 230,305 L 222,420 L 178,420 Z" fill="#3a0c20" />
                  <line x1="178" y1="325" x2="222" y2="345" stroke="#ff3860" stroke-width="2.5" />
                  <line x1="222" y1="325" x2="178" y2="345" stroke="#ff3860" stroke-width="2.5" />
                  <line x1="178" y1="360" x2="222" y2="380" stroke="#ff3860" stroke-width="2.5" />
                  <line x1="222" y1="360" x2="178" y2="380" stroke="#ff3860" stroke-width="2.5" />
                  <rect x="184" y="254" width="32" height="7" rx="2" fill="#000000" />
                  <polygon points="200,258 204,262 200,266 196,262" fill="#ff0055" />
                </>
              )}
              {outfit() === 'casual' && (
                <>
                  <path d="M 125,310 C 110,350 95,420 85,520 L 138,520 C 142,430 148,360 152,310 Z" fill="#6c5ce7" />
                  <path d="M 275,310 C 290,350 305,420 315,520 L 262,520 C 258,430 252,360 248,310 Z" fill="#6c5ce7" />
                  <path d="M 132,295 C 140,285 260,285 268,295 L 285,520 L 115,520 Z" fill="#6c5ce7" />
                  <ellipse cx="200" cy="295" rx="42" ry="18" fill="#a29bfe" />
                  <ellipse cx="200" cy="293" rx="30" ry="12" fill="#5243b8" />
                  <path d="M 186,305 L 186,365" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" />
                  <path d="M 214,305 L 214,358" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" />
                  <circle cx="186" cy="368" r="3" fill="#ffffff" />
                  <circle cx="214" cy="361" r="3" fill="#ffffff" />
                  <path d="M 160,410 L 240,410 L 235,460 L 165,460 Z" fill="#5243b8" opacity="0.5" />
                </>
              )}
              {outfit() === 'seifuku' && (
                <>
                  <path d="M 125,320 C 115,355 105,410 95,490 L 135,490 C 140,425 145,365 152,320 Z" fill="#ffffff" />
                  <path d="M 95,480 L 135,480 L 135,490 L 95,490 Z" fill="#2d3436" />
                  <path d="M 275,320 C 285,355 295,410 305,490 L 265,490 C 260,425 255,365 248,320 Z" fill="#ffffff" />
                  <path d="M 265,480 L 305,480 L 305,490 L 265,490 Z" fill="#2d3436" />
                  <path d="M 140,295 L 260,295 L 280,520 L 120,520 Z" fill="#ffffff" />
                  <polygon points="172,290 200,335 228,290 262,290 268,348 234,358 200,342 166,358 132,348 138,290" fill="#2d3436" />
                  <path d="M 140,338 L 165,348 L 195,332" stroke="#ffffff" stroke-width="1.8" fill="none" />
                  <path d="M 260,338 L 235,348 L 205,332" stroke="#ffffff" stroke-width="1.8" fill="none" />
                  <polygon points="193,332 207,332 210,375 200,392 190,375" fill="#ff4757" />
                  <circle cx="200" cy="336" r="5" fill="#d63031" />
                </>
              )}
              {outfit() === 'miko' && (
                <>
                  <path d="M 125,320 L 70,440 L 125,520 L 145,390 Z" fill="#ffffff" stroke="#c0392b" stroke-width="1.5" />
                  <path d="M 275,320 L 330,440 L 275,520 L 255,390 Z" fill="#ffffff" stroke="#c0392b" stroke-width="1.5" />
                  <path d="M 135,290 L 265,290 L 285,520 L 115,520 Z" fill="#ffffff" />
                  <polygon points="160,285 200,345 240,285 224,285 200,325 176,285" fill="#e74c3c" />
                  <rect x="135" y="360" width="130" height="52" rx="4" fill="#c0392b" />
                  <rect x="135" y="378" width="130" height="14" fill="#ffffff" />
                  <path d="M 115,410 L 285,410 L 295,520 L 105,520 Z" fill="#e74c3c" />
                </>
              )}
              {outfit() === 'magical' && (
                <>
                  <ellipse cx="116" cy="335" rx="26" ry="22" fill="#fd79a8" />
                  <ellipse cx="284" cy="335" rx="26" ry="22" fill="#fd79a8" />
                  <path d="M 136,295 L 264,295 L 285,520 L 115,520 Z" fill="#fd79a8" />
                  <path d="M 160,295 L 240,295 L 250,520 L 150,520 Z" fill="#ffffff" />
                  <circle cx="200" cy="320" r="12" fill="#f1c40f" />
                  <polygon points="200,312 203,318 210,320 204,324 206,330 200,326 194,330 196,324 190,320 197,318" fill="#ffffff" />
                  <path d="M 140,360 Q 200,380 260,360 Q 200,400 140,360 Z" fill="#e84393" />
                  <circle cx="150" cy="450" r="5" fill="#f1c40f" />
                  <circle cx="250" cy="450" r="5" fill="#f1c40f" />
                  <circle cx="200" cy="480" r="6" fill="#f1c40f" />
                </>
              )}
              {outfit() === 'armor' && (
                <>
                  <path d="M 110,320 L 80,420 L 130,420 L 145,340 Z" fill="#747d8c" />
                  <path d="M 290,320 L 320,420 L 270,420 L 255,340 Z" fill="#747d8c" />
                  <ellipse cx="115" cy="330" rx="30" ry="25" fill="#ced6e0" stroke="#2f3542" stroke-width="2.5" />
                  <ellipse cx="285" cy="330" rx="30" ry="25" fill="#ced6e0" stroke="#2f3542" stroke-width="2.5" />
                  <path d="M 135,295 L 265,295 L 280,520 L 120,520 Z" fill="#2f3542" />
                  <polygon points="160,295 240,295 248,420 200,450 152,420" fill="#dfe4ea" stroke="#747d8c" stroke-width="2" />
                  <polygon points="180,310 220,310 226,380 200,400 174,380" fill="#a4b0be" />
                  <circle cx="200" cy="340" r="8" fill="#f1c40f" stroke="#e67e22" stroke-width="1.5" />
                </>
              )}
            </g>

            {/* 4. HEAD BASE */}
            <g id={`${pfx}_head_base`}>
              <path
                d="M 134,165 C 128,110 160,82 200,82 C 240,82 272,110 266,165 C 262,215 232,258 200,262 C 168,258 138,215 134,165 Z"
                fill={skinTone()}
              />
              <path d="M 172,254 C 188,264 212,264 228,254 C 215,268 185,268 172,254 Z" fill={skinShadow()} />
              <path d="M 135,170 C 124,170 122,192 133,200 C 136,192 136,178 135,170 Z" fill={skinTone()} />
              <path d="M 265,170 C 276,170 278,192 267,200 C 264,192 264,178 265,170 Z" fill={skinTone()} />
              <path d="M 132,176 C 126,178 126,190 132,194" stroke="#ffb8c6" stroke-width="2" fill="none" />
              <path d="M 268,176 C 274,178 274,190 268,194" stroke="#ffb8c6" stroke-width="2" fill="none" />

              {/* Cheeks Blush */}
              {mood() === 'blush' || mood() === 'pout' ? (
                <>
                  <ellipse cx="156" cy="204" rx="16" ry="9" fill={blushColor} />
                  <ellipse cx="244" cy="204" rx="16" ry="9" fill={blushColor} />
                  <line x1="148" y1="205" x2="153" y2="199" stroke="#ff4757" stroke-width="1.6" />
                  <line x1="154" y1="206" x2="159" y2="200" stroke="#ff4757" stroke-width="1.6" />
                  <line x1="160" y1="207" x2="165" y2="201" stroke="#ff4757" stroke-width="1.6" />
                  <line x1="235" y1="205" x2="240" y2="199" stroke="#ff4757" stroke-width="1.6" />
                  <line x1="241" y1="206" x2="246" y2="200" stroke="#ff4757" stroke-width="1.6" />
                  <line x1="247" y1="207" x2="252" y2="201" stroke="#ff4757" stroke-width="1.6" />
                </>
              ) : (
                <>
                  <ellipse cx="158" cy="204" rx="12" ry="6" fill={blushColor} opacity="0.6" />
                  <ellipse cx="242" cy="204" rx="12" ry="6" fill={blushColor} opacity="0.6" />
                </>
              )}
            </g>

            {/* 5. EYES & BROWS */}
            <g id={`${pfx}_eyes`} class={`avatar-eyes-group ${isBlinking() ? 'blinking' : ''}`}>
              {/* Eyebrows */}
              {mood() === 'pout' && (
                <>
                  <path d="M 158,166 Q 174,174 190,170" stroke="#2d3436" stroke-width="3" stroke-linecap="round" fill="none" />
                  <path d="M 242,166 Q 226,174 210,170" stroke="#2d3436" stroke-width="3" stroke-linecap="round" fill="none" />
                </>
              )}
              {mood() === 'blush' && (
                <>
                  <path d="M 158,168 Q 172,162 190,168" stroke="#2d3436" stroke-width="2.6" stroke-linecap="round" fill="none" />
                  <path d="M 242,168 Q 228,162 210,168" stroke="#2d3436" stroke-width="2.6" stroke-linecap="round" fill="none" />
                </>
              )}
              {mood() === 'surprised' && (
                <>
                  <path d="M 158,158 Q 174,150 190,158" stroke="#2d3436" stroke-width="2.6" stroke-linecap="round" fill="none" />
                  <path d="M 242,158 Q 226,150 210,158" stroke="#2d3436" stroke-width="2.6" stroke-linecap="round" fill="none" />
                </>
              )}
              {mood() === 'yandere' && (
                <>
                  <path d="M 158,164 Q 175,160 190,167" stroke="#2d3436" stroke-width="3.2" stroke-linecap="round" fill="none" />
                  <path d="M 242,164 Q 225,160 210,167" stroke="#2d3436" stroke-width="3.2" stroke-linecap="round" fill="none" />
                </>
              )}
              {(mood() === 'happy' || mood() === 'neutral') && (
                <>
                  <path d="M 158,164 Q 174,160 190,164" stroke="#2d3436" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <path d="M 242,164 Q 226,160 210,164" stroke="#2d3436" stroke-width="2.5" stroke-linecap="round" fill="none" />
                </>
              )}

              {/* Eyes */}
              {mood() === 'yandere' ? (
                <>
                  <g id={`${pfx}_eye_l`}>
                    <ellipse cx="174" cy="183" rx="14" ry="13" fill="#ffffff" />
                    <ellipse cx="174" cy="183" rx="11" ry="11" fill={`url(#${pfx}_yandereGrad)`} />
                    <circle cx="174" cy="183" r="5" fill="#ff0055" />
                    <circle cx="174" cy="183" r="2" fill="#ffffff" opacity="0.9" />
                    <path d="M 158,175 C 166,169 184,169 190,175" stroke="#1a1a24" stroke-width="3.5" fill="none" stroke-linecap="round" />
                  </g>
                  <g id={`${pfx}_eye_r`}>
                    <ellipse cx="226" cy="183" rx="14" ry="13" fill="#ffffff" />
                    <ellipse cx="226" cy="183" rx="11" ry="11" fill={`url(#${pfx}_yandereGrad)`} />
                    <circle cx="226" cy="183" r="5" fill="#ff0055" />
                    <circle cx="226" cy="183" r="2" fill="#ffffff" opacity="0.9" />
                    <path d="M 210,175 C 216,169 234,169 242,175" stroke="#1a1a24" stroke-width="3.5" fill="none" stroke-linecap="round" />
                  </g>
                </>
              ) : mood() === 'happy' ? (
                <>
                  <g id={`${pfx}_eye_l`}>
                    <path d="M 160,185 Q 174,172 188,185" stroke="#2d3436" stroke-width="3.8" stroke-linecap="round" fill="none" />
                    <line x1="187" y1="184" x2="192" y2="179" stroke="#2d3436" stroke-width="2.5" stroke-linecap="round" />
                  </g>
                  <g id={`${pfx}_eye_r`}>
                    <path d="M 212,185 Q 226,172 240,185" stroke="#2d3436" stroke-width="3.8" stroke-linecap="round" fill="none" />
                    <line x1="239" y1="184" x2="244" y2="179" stroke="#2d3436" stroke-width="2.5" stroke-linecap="round" />
                  </g>
                </>
              ) : (
                <>
                  <g id={`${pfx}_eye_l`}>
                    <ellipse cx="174" cy="184" rx="14" ry="13" fill="#ffffff" />
                    <ellipse cx="174" cy="184" rx="11" ry="12" fill={`url(#${pfx}_eyeGrad)`} />
                    <ellipse cx="174" cy="184" rx="5" ry="6" fill="#120d36" />
                    <ellipse cx="171" cy="179" rx="4" ry="4" fill="#ffffff" />
                    <ellipse cx="177" cy="189" rx="2" ry="2" fill="#ffffff" opacity="0.85" />
                    <path d="M 158,177 C 165,171 183,171 190,177" stroke="#2d3436" stroke-width="3.5" fill="none" stroke-linecap="round" />
                    <line x1="189" y1="176" x2="194" y2="172" stroke="#2d3436" stroke-width="2.6" stroke-linecap="round" />
                  </g>
                  <g id={`${pfx}_eye_r`}>
                    <ellipse cx="226" cy="184" rx="14" ry="13" fill="#ffffff" />
                    <ellipse cx="226" cy="184" rx="11" ry="12" fill={`url(#${pfx}_eyeGrad)`} />
                    <ellipse cx="226" cy="184" rx="5" ry="6" fill="#120d36" />
                    <ellipse cx="223" cy="179" rx="4" ry="4" fill="#ffffff" />
                    <ellipse cx="229" cy="189" rx="2" ry="2" fill="#ffffff" opacity="0.85" />
                    <path d="M 210,177 C 217,171 235,171 242,177" stroke="#2d3436" stroke-width="3.5" fill="none" stroke-linecap="round" />
                    <line x1="241" y1="176" x2="246" y2="172" stroke="#2d3436" stroke-width="2.6" stroke-linecap="round" />
                  </g>
                </>
              )}
            </g>

            {/* 6. NOSE & MOUTH */}
            <circle cx="200" cy="198" r="1.8" fill="#e29b93" />
            <g id={`${pfx}_mouth`} class={`avatar-mouth ${isTalking() ? 'talking' : ''}`}>
              {mood() === 'pout' && (
                <path d="M 193,222 Q 197,219 200,222 Q 203,225 207,222" stroke="#d63031" stroke-width="2.8" stroke-linecap="round" fill="none" />
              )}
              {mood() === 'blush' && (
                <path d="M 195,221 Q 200,226 205,221 Z" fill="#ff7675" stroke="#d63031" stroke-width="1.2" />
              )}
              {mood() === 'surprised' && (
                <ellipse cx="200" cy="224" rx="4.5" ry="6.5" fill="#ff7675" stroke="#d63031" stroke-width="1.5" />
              )}
              {mood() === 'happy' && (
                <>
                  <path d="M 191,218 Q 200,229 209,218 Z" fill="#e84118" />
                  <path d="M 194,223 Q 200,221 206,223 Q 200,227 194,223 Z" fill="#ff7675" />
                </>
              )}
              {mood() === 'yandere' && (
                <path d="M 189,217 Q 200,228 211,217" stroke="#800020" stroke-width="2.6" stroke-linecap="round" fill="none" />
              )}
              {mood() === 'neutral' && (
                <path d="M 193,220 Q 200,225 207,220" stroke="#d63031" stroke-width="2.2" stroke-linecap="round" fill="none" />
              )}
            </g>

            {/* 7. FRONT HAIR / BANGS */}
            <g id={`${pfx}_front_hair`}>
              <path
                d="M 128,165 C 122,80 278,80 272,165 C 265,140 245,122 200,122 C 155,122 135,140 128,165 Z"
                fill={`url(#${pfx}_hairGrad)`}
              />
              <path
                d="M 130,155 C 138,185 146,205 152,198 C 158,190 162,165 168,155 C 174,188 184,210 192,208 C 200,206 208,182 214,155 C 220,182 230,208 238,202 C 246,196 250,175 260,155 C 270,140 130,140 130,155 Z"
                fill={`url(#${pfx}_hairGrad)`}
              />
              <path
                d="M 130,150 C 120,200 124,250 142,280 C 136,245 132,195 140,155 Z"
                fill={`url(#${pfx}_hairGrad)`}
              />
              <path
                d="M 270,150 C 280,200 276,250 258,280 C 264,245 268,195 260,155 Z"
                fill={`url(#${pfx}_hairGrad)`}
              />
              <ellipse cx="200" cy="122" rx="55" ry="7" fill="#ffffff" opacity="0.45" />
              <path d="M 155,122 Q 200,116 245,122 Q 200,126 155,122 Z" fill="#ffffff" opacity="0.6" />
            </g>

            {/* 8. ACCESSORIES */}
            <g id={`${pfx}_accessory`}>
              {accessory() === 'cat_ears' && (
                <>
                  <path d="M 125,125 L 110,65 L 160,95 Z" fill={`url(#${pfx}_hairGrad)`} />
                  <path d="M 125,115 L 118,75 L 150,98 Z" fill="#ff99bb" />
                  <circle cx="120" cy="118" r="3.5" fill="#f1c40f" />
                  <path d="M 275,125 L 290,65 L 240,95 Z" fill={`url(#${pfx}_hairGrad)`} />
                  <path d="M 275,115 L 282,75 L 250,98 Z" fill="#ff99bb" />
                  <circle cx="280" cy="118" r="3.5" fill="#f1c40f" />
                </>
              )}
              {accessory() === 'glasses' && (
                <>
                  <rect x="154" y="171" width="36" height="24" rx="7" fill="rgba(255,255,255,0.22)" stroke="#ff4757" stroke-width="2.8" />
                  <rect x="210" y="171" width="36" height="24" rx="7" fill="rgba(255,255,255,0.22)" stroke="#ff4757" stroke-width="2.8" />
                  <line x1="190" y1="181" x2="210" y2="181" stroke="#ff4757" stroke-width="2.8" />
                  <line x1="160" y1="176" x2="174" y2="190" stroke="#ffffff" stroke-width="2" opacity="0.85" />
                  <line x1="216" y1="176" x2="230" y2="190" stroke="#ffffff" stroke-width="2" opacity="0.85" />
                </>
              )}
              {accessory() === 'headphones' && (
                <>
                  <path d="M 125,150 C 125,75 275,75 275,150" stroke="#00d2d3" stroke-width="6" fill="none" />
                  <rect x="115" y="165" width="18" height="38" rx="8" fill="#1e272e" stroke="#00d2d3" stroke-width="2.5" />
                  <rect x="267" y="165" width="18" height="38" rx="8" fill="#1e272e" stroke="#00d2d3" stroke-width="2.5" />
                  <circle cx="124" cy="184" r="4" fill="#00d2d3" />
                  <circle cx="276" cy="184" r="4" fill="#00d2d3" />
                </>
              )}
              {accessory() === 'ribbon' && (
                <>
                  <circle cx="150" cy="130" r="5" fill="#ff4757" />
                  <path d="M 150,130 L 132,116 L 136,136 Z" fill="#ff6b81" />
                  <path d="M 150,130 L 168,116 L 164,136 Z" fill="#ff6b81" />
                  <path d="M 150,130 L 138,148 L 148,143 Z" fill="#ff4757" />
                  <path d="M 150,130 L 162,148 L 152,143 Z" fill="#ff4757" />
                </>
              )}
              {accessory() === 'bunny_ears' && (
                <>
                  <path d="M 140,120 C 130,10 160,-20 168,10 C 176,40 165,90 160,110 Z" fill="#ffffff" stroke="#e0e0e0" stroke-width="2" />
                  <path d="M 145,110 C 138,25 158,5 163,22 C 168,45 160,85 156,105 Z" fill="#ff7675" opacity="0.8" />
                  <path d="M 260,120 C 270,10 240,-20 232,10 C 224,40 235,90 240,110 Z" fill="#ffffff" stroke="#e0e0e0" stroke-width="2" />
                  <path d="M 255,110 C 262,25 242,5 237,22 C 232,45 240,85 244,105 Z" fill="#ff7675" opacity="0.8" />
                  <circle cx="150" cy="118" r="6" fill="#fd79a8" />
                  <circle cx="250" cy="118" r="6" fill="#fd79a8" />
                </>
              )}
              {accessory() === 'halo' && (
                <>
                  <ellipse cx="200" cy="65" rx="55" ry="14" fill="none" stroke="#f1c40f" stroke-width="5" />
                  <ellipse cx="200" cy="65" rx="53" ry="12" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.9" />
                </>
              )}
              {accessory() === 'kitsune_mask' && (
                <>
                  <path d="M 250,110 C 285,90 310,130 295,165 C 280,195 240,185 245,150 Z" fill="#ffffff" stroke="#2d3436" stroke-width="2.5" />
                  <polygon points="265,95 285,75 285,105" fill="#ffffff" stroke="#2d3436" stroke-width="2" />
                  <polygon points="270,95 282,82 282,102" fill="#d63031" />
                  <path d="M 265,135 Q 275,128 285,135" stroke="#d63031" stroke-width="3" stroke-linecap="round" fill="none" />
                  <path d="M 260,150 Q 272,146 280,155" stroke="#d63031" stroke-width="2" fill="none" />
                  <circle cx="256" cy="165" r="3.5" fill="#f1c40f" />
                  <line x1="256" y1="168" x2="252" y2="185" stroke="#d63031" stroke-width="2" />
                </>
              )}
              {accessory() === 'flower_pin' && (
                <>
                  <circle cx="145" cy="128" r="5" fill="#f1c40f" />
                  <ellipse cx="145" cy="118" rx="5" ry="7" fill="#ff7597" />
                  <ellipse cx="145" cy="138" rx="5" ry="7" fill="#ff7597" />
                  <ellipse cx="135" cy="128" rx="7" ry="5" fill="#ff7597" />
                  <ellipse cx="155" cy="128" rx="7" ry="5" fill="#ff7597" />
                  <ellipse cx="138" cy="121" rx="5" ry="5" fill="#ff99bb" />
                  <ellipse cx="152" cy="135" rx="5" ry="5" fill="#ff99bb" />
                </>
              )}
            </g>

            {/* 9. YANDERE VIGNETTE SHADOW */}
            {mood() === 'yandere' && (
              <rect x="0" y="0" width="400" height="240" fill={`url(#${pfx}_yandereShadow)`} opacity="0.45" pointer-events="none" />
            )}
          </svg>
        </div>
      )}
    </>
  );
}
