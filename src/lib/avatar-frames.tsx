import type { JSX } from 'solid-js';

/**
 * Avatar frame catalog.
 *
 * Each frame exposes two render pieces:
 *  - `Portrait`: drawn in the WaifuAvatar SVG coordinate space (0 0 400 520)
 *    so the frame wraps the full-height companion portrait.
 *  - `Overlay`: drawn in a square `0 0 200 200` space used to frame round /
 *    square profile avatars (header circle, navbar badge, leaderboard).
 *
 * Gradient ids are prefixed per frame so multiple frames can coexist on one page.
 */

export interface AvatarFrame {
  id: string;
  name: string;
  rarity: 'legendary' | 'mystical';
  description: string;
  icon: string;
  Portrait: () => JSX.Element;
  Overlay: () => JSX.Element;
}

export const DEFAULT_AVATAR_FRAME_ID = 'none';

// ─── Shared ornamental building blocks ───────────────────────────────────────

function Blossom(props: { cx: number; cy: number; r: number; petal: string; gold: string }) {
  const { cx, cy, r, petal, gold } = props;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {[0, 72, 144, 216, 288].map(a => (
        <ellipse
          cx="0"
          cy={-r * 0.82}
          rx={r * 0.4}
          ry={r * 0.76}
          fill={`url(#${petal})`}
          stroke={`url(#${gold})`}
          stroke-width="1.4"
          transform={`rotate(${a})`}
        />
      ))}
      <circle cx="0" cy="0" r={r * 0.3} fill={`url(#${gold})`} stroke="#ffffff" stroke-width="1.1" />
      <circle cx="0" cy="0" r={r * 0.13} fill="#ffffff" />
      {/* hanging stamen dots */}
      {[0, 120, 240].map(a => (
        <circle cx="0" cy={-r * 0.82} r={r * 0.1} fill="#ffffff" opacity="0.85" transform={`rotate(${a + 36})`} />
      ))}
    </g>
  );
}

function Diamond(props: { cx: number; cy: number; size: number; fill: string; stroke: string; opacity?: number | string }) {
  const { cx, cy, size, fill, stroke, opacity = 1 } = props;
  return (
    <polygon
      points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
      fill={fill}
      stroke={stroke}
      stroke-width="1.2"
      opacity={opacity}
    />
  );
}

function Sparkle(props: { cx: number; cy: number; r: number; fill: string; opacity?: number; class?: string }) {
  const { cx, cy, r, fill, opacity = 1, class: cls } = props;
  const d = `M ${cx} ${cy - r * 2} L ${cx + r * 0.45} ${cy - r * 0.45} L ${cx + r * 2} ${cy} L ${cx + r * 0.45} ${cy + r * 0.45} L ${cx} ${cy + r * 2} L ${cx - r * 0.45} ${cy + r * 0.45} L ${cx - r * 2} ${cy} L ${cx - r * 0.45} ${cy - r * 0.45} Z`;
  return <path d={d} fill={fill} opacity={opacity} class={cls} />;
}

function Flame(props: { x: number; top: number; h: number; w: number; fill: string; opacity?: number | string }) {
  const { x, top, h, w, fill, opacity = 1 } = props;
  const y1 = top + h;
  return (
    <path
      d={`M ${x} ${y1} C ${x - w} ${y1 - h * 0.32} ${x - w * 0.55} ${y1 - h * 0.62} ${x} ${top} C ${x + w * 0.55} ${y1 - h * 0.62} ${x + w} ${y1 - h * 0.32} ${x} ${y1} Z`}
      fill={fill}
      opacity={opacity}
    />
  );
}

// ─── 1. Legendary · Sakura Eternal Frame ────────────────────────────────────

const SAKURA_PORTRAIT = (
  <g class="avatar-frame sg-frame-sakura" data-frame-id="frame_sakura">
    <defs>
      <linearGradient id="sgf_band" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fff0f6" />
        <stop offset="35%" stop-color="#ff9ecd" />
        <stop offset="70%" stop-color="#f43b7f" />
        <stop offset="100%" stop-color="#7d1a4e" />
      </linearGradient>
      <linearGradient id="sgf_gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fff3b0" />
        <stop offset="50%" stop-color="#ffd700" />
        <stop offset="100%" stop-color="#c98a00" />
      </linearGradient>
      <radialGradient id="sgf_petal" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stop-color="#ffe3ef" />
        <stop offset="100%" stop-color="#ff5f9e" />
      </radialGradient>
    </defs>

    {/* outer band */}
    <rect x="0" y="0" width="400" height="520" rx="24" fill="none" stroke="url(#sgf_band)" stroke-width="30" />
    <rect x="16" y="16" width="368" height="488" rx="16" fill="none" stroke="url(#sgf_gold)" stroke-width="2.6" />
    <rect x="22" y="22" width="356" height="476" rx="13" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.1" />

    {/* gold filigree curls along edges */}
    {[90, 180, 270, 360].map(cy0 => (
      <g>
        <path d={`M 30 ${cy0} Q 40 ${cy0 - 12} 52 ${cy0}`} fill="none" stroke="url(#sgf_gold)" stroke-width="2.4" stroke-linecap="round" />
        <path d={`M 348 ${cy0} Q 360 ${cy0 - 12} 370 ${cy0}`} fill="none" stroke="url(#sgf_gold)" stroke-width="2.4" stroke-linecap="round" />
      </g>
    ))}
    {[100, 200, 300].map(cx0 => (
      <g>
        <path d={`M ${cx0} 30 Q ${cx0 - 12} 40 ${cx0} 52`} fill="none" stroke="url(#sgf_gold)" stroke-width="2.4" stroke-linecap="round" />
        <path d={`M ${cx0} 468 Q ${cx0 - 12} 480 ${cx0} 490`} fill="none" stroke="url(#sgf_gold)" stroke-width="2.4" stroke-linecap="round" />
      </g>
    ))}

    {/* corner blossom medallions */}
    <Blossom cx={34} cy={38} r={30} petal="sgf_petal" gold="sgf_gold" />
    <Blossom cx={366} cy={38} r={30} petal="sgf_petal" gold="sgf_gold" />
    <Blossom cx={34} cy={482} r={30} petal="sgf_petal" gold="sgf_gold" />
    <Blossom cx={366} cy={482} r={30} petal="sgf_petal" gold="sgf_gold" />

    {/* edge blossoms */}
    <Blossom cx={200} cy={24} r={18} petal="sgf_petal" gold="sgf_gold" />
    <Blossom cx={200} cy={496} r={18} petal="sgf_petal" gold="sgf_gold" />
    <Blossom cx={20} cy={260} r={16} petal="sgf_petal" gold="sgf_gold" />
    <Blossom cx={380} cy={260} r={16} petal="sgf_petal" gold="sgf_gold" />

    {/* falling petals around the border */}
    <ellipse cx="58" cy="150" rx="6" ry="3.4" fill="#ff8fbd" opacity="0.9" transform="rotate(24 58 150)" />
    <ellipse cx="342" cy="180" rx="6" ry="3.4" fill="#ff8fbd" opacity="0.9" transform="rotate(-30 342 180)" />
    <ellipse cx="70" cy="360" rx="6" ry="3.4" fill="#ff8fbd" opacity="0.9" transform="rotate(40 70 360)" />
    <ellipse cx="330" cy="400" rx="6" ry="3.4" fill="#ff8fbd" opacity="0.9" transform="rotate(-40 330 400)" />
    <ellipse cx="200" cy="62" rx="5" ry="2.8" fill="#ffc6dd" opacity="0.95" transform="rotate(12 200 62)" />
    <ellipse cx="200" cy="458" rx="5" ry="2.8" fill="#ffc6dd" opacity="0.95" transform="rotate(-12 200 458)" />

    {/* gold glitter */}
    <Sparkle cx={130} cy={40} r={2.6} fill="#fffdf2" />
    <Sparkle cx={270} cy={40} r={2.6} fill="#fffdf2" />
    <Sparkle cx={130} cy={480} r={2.6} fill="#fffdf2" />
    <Sparkle cx={270} cy={480} r={2.6} fill="#fffdf2" />
  </g>
);

const SAKURA_OVERLAY = (
  <g class="avatar-frame sg-frame-sakura" data-frame-id="frame_sakura">
    <defs>
      <linearGradient id="sgf_oband" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fff0f6" />
        <stop offset="35%" stop-color="#ff9ecd" />
        <stop offset="70%" stop-color="#f43b7f" />
        <stop offset="100%" stop-color="#7d1a4e" />
      </linearGradient>
      <linearGradient id="sgf_ogold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fff3b0" />
        <stop offset="50%" stop-color="#ffd700" />
        <stop offset="100%" stop-color="#c98a00" />
      </linearGradient>
      <radialGradient id="sgf_opetal" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stop-color="#ffe3ef" />
        <stop offset="100%" stop-color="#ff5f9e" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="200" height="200" rx="22" fill="none" stroke="url(#sgf_oband)" stroke-width="24" />
    <rect x="13" y="13" width="174" height="174" rx="14" fill="none" stroke="url(#sgf_ogold)" stroke-width="2" />
    <rect x="18" y="18" width="164" height="164" rx="11" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="0.9" />
    <Blossom cx={26} cy={26} r={22} petal="sgf_opetal" gold="sgf_ogold" />
    <Blossom cx={174} cy={26} r={22} petal="sgf_opetal" gold="sgf_ogold" />
    <Blossom cx={26} cy={174} r={22} petal="sgf_opetal" gold="sgf_ogold" />
    <Blossom cx={174} cy={174} r={22} petal="sgf_opetal" gold="sgf_ogold" />
    <Blossom cx={100} cy={18} r={12} petal="sgf_opetal" gold="sgf_ogold" />
    <Blossom cx={100} cy={182} r={12} petal="sgf_opetal" gold="sgf_ogold" />
    <Blossom cx={18} cy={100} r={11} petal="sgf_opetal" gold="sgf_ogold" />
    <Blossom cx={182} cy={100} r={11} petal="sgf_opetal" gold="sgf_ogold" />
    <ellipse cx="80" cy="50" rx="4.4" ry="2.5" fill="#ff8fbd" opacity="0.9" transform="rotate(22 80 50)" />
    <ellipse cx="122" cy="152" rx="4.4" ry="2.5" fill="#ff8fbd" opacity="0.9" transform="rotate(-24 122 152)" />
    <Sparkle cx={70} cy={30} r={2} fill="#fffdf2" />
    <Sparkle cx={132} cy={30} r={2} fill="#fffdf2" />
    <Sparkle cx={70} cy={170} r={2} fill="#fffdf2" />
    <Sparkle cx={132} cy={170} r={2} fill="#fffdf2" />
  </g>
);

// ─── 2. Legendary · Royal Azure Frame ───────────────────────────────────────

const ROYAL_PORTRAIT = (
  <g class="avatar-frame rg-frame-royal" data-frame-id="frame_royal">
    <defs>
      <linearGradient id="rgf_band" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1a4fd8" />
        <stop offset="40%" stop-color="#4f9dff" />
        <stop offset="75%" stop-color="#0f2f9e" />
        <stop offset="100%" stop-color="#071a5c" />
      </linearGradient>
      <linearGradient id="rgf_gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fff3b0" />
        <stop offset="50%" stop-color="#ffd700" />
        <stop offset="100%" stop-color="#c98a00" />
      </linearGradient>
      <radialGradient id="rgf_gem" cx="50%" cy="42%" r="58%">
        <stop offset="0%" stop-color="#aef1ff" />
        <stop offset="55%" stop-color="#00a8ff" />
        <stop offset="100%" stop-color="#00366e" />
      </radialGradient>
    </defs>

    <rect x="0" y="0" width="400" height="520" rx="24" fill="none" stroke="url(#rgf_band)" stroke-width="30" />
    <rect x="16" y="16" width="368" height="488" rx="16" fill="none" stroke="url(#rgf_gold)" stroke-width="2.6" />
    <rect x="23" y="23" width="354" height="474" rx="12" fill="none" stroke="rgba(174,241,255,0.5)" stroke-width="1.1" />

    {/* gilded studs along band */}
    {[60, 160, 240, 340, 460].map(cy0 => (
      <g>
        <Diamond cx={13} cy={cy0} size={5} fill="url(#rgf_gold)" stroke="#fff" />
        <Diamond cx={387} cy={cy0} size={5} fill="url(#rgf_gold)" stroke="#fff" />
      </g>
    ))}
    {[70, 150, 230, 300].map(cx0 => (
      <g>
        <Diamond cx={cx0} cy={13} size={5} fill="url(#rgf_gold)" stroke="#fff" />
        <Diamond cx={cx0} cy={507} size={5} fill="url(#rgf_gold)" stroke="#fff" />
      </g>
    ))}

    {/* royal crest corners */}
    {[
      { x: 40, y: 44, s: 1 },
      { x: 360, y: 44, s: -1 },
      { x: 40, y: 476, s: 1 },
      { x: 360, y: 476, s: -1 }
    ].map(c => (
      <g
       
        transform={`translate(${c.x} ${c.y}) scale(${c.s}, -${c.s})`}
      >
        <circle r="20" fill="url(#rgf_band)" stroke="url(#rgf_gold)" stroke-width="2.6" />
        <circle r="15" fill="none" stroke="url(#rgf_gold)" stroke-width="1.2" />
        {/* tri-lobe fleur */}
        <ellipse cx="0" cy="-9" rx="4.4" ry="9" fill="url(#rgf_gold)" />
        <ellipse cx="-7.5" cy="-3" rx="4.4" ry="8" fill="url(#rgf_gold)" transform="rotate(-22 -7.5 -3)" />
        <ellipse cx="7.5" cy="-3" rx="4.4" ry="8" fill="url(#rgf_gold)" transform="rotate(22 7.5 -3)" />
        <path d="M -5 4 L 0 -2 L 5 4 L 0 13 Z" fill="url(#rgf_gem)" stroke="#fff" stroke-width="0.9" />
        <Diamond cx={0} cy={-13} size={2.6} fill="#fff" stroke="url(#rgf_gold)" />
      </g>
    ))}

    {/* gold tassels on top/bottom edges */}
    <path d="M 100 30 L 100 10" stroke="url(#rgf_gold)" stroke-width="2.4" stroke-linecap="round" />
    <path d="M 300 30 L 300 10" stroke="url(#rgf_gold)" stroke-width="2.4" stroke-linecap="round" />
    <path d="M 100 490 L 100 510" stroke="url(#rgf_gold)" stroke-width="2.4" stroke-linecap="round" />
    <path d="M 300 490 L 300 510" stroke="url(#rgf_gold)" stroke-width="2.4" stroke-linecap="round" />

    <Diamond cx={200} cy={18} size={6.5} fill="url(#rgf_gem)" stroke="url(#rgf_gold)" />
    <Diamond cx={200} cy={502} size={6.5} fill="url(#rgf_gem)" stroke="url(#rgf_gold)" />
    <Diamond cx={18} cy={260} size={6} fill="url(#rgf_gem)" stroke="url(#rgf_gold)" />
    <Diamond cx={382} cy={260} size={6} fill="url(#rgf_gem)" stroke="url(#rgf_gold)" />

    <Sparkle cx={200} cy={70} r={2.2} fill="#fffdf2" />
    <Sparkle cx={120} cy={46} r={1.8} fill="#fffdf2" />
    <Sparkle cx={280} cy={46} r={1.8} fill="#fffdf2" />
    <Sparkle cx={120} cy={474} r={1.8} fill="#fffdf2" />
    <Sparkle cx={280} cy={474} r={1.8} fill="#fffdf2" />
  </g>
);

const ROYAL_OVERLAY = (
  <g class="avatar-frame rg-frame-royal" data-frame-id="frame_royal">
    <defs>
      <linearGradient id="rgf_oband" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1a4fd8" />
        <stop offset="40%" stop-color="#4f9dff" />
        <stop offset="75%" stop-color="#0f2f9e" />
        <stop offset="100%" stop-color="#071a5c" />
      </linearGradient>
      <linearGradient id="rgf_ogold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fff3b0" />
        <stop offset="50%" stop-color="#ffd700" />
        <stop offset="100%" stop-color="#c98a00" />
      </linearGradient>
      <radialGradient id="rgf_ogem" cx="50%" cy="42%" r="58%">
        <stop offset="0%" stop-color="#aef1ff" />
        <stop offset="55%" stop-color="#00a8ff" />
        <stop offset="100%" stop-color="#00366e" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="200" height="200" rx="22" fill="none" stroke="url(#rgf_oband)" stroke-width="24" />
    <rect x="13" y="13" width="174" height="174" rx="14" fill="none" stroke="url(#rgf_ogold)" stroke-width="2" />
    <rect x="18" y="18" width="164" height="164" rx="11" fill="none" stroke="rgba(174,241,255,0.5)" stroke-width="0.9" />
    <Diamond cx={13} cy={60} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={13} cy={100} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={13} cy={140} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={187} cy={60} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={187} cy={100} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={187} cy={140} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={60} cy={13} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={100} cy={13} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={140} cy={13} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={60} cy={187} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={100} cy={187} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    <Diamond cx={140} cy={187} size={4} fill="url(#rgf_ogold)" stroke="#fff" />
    {[
      { x: 34, y: 34, s: 1 },
      { x: 166, y: 34, s: -1 },
      { x: 34, y: 166, s: 1 },
      { x: 166, y: 166, s: -1 }
    ].map(c => (
      <g transform={`translate(${c.x} ${c.y}) scale(${c.s}, -${c.s})`}>
        <circle r="16" fill="url(#rgf_oband)" stroke="url(#rgf_ogold)" stroke-width="2.2" />
        <circle r="12" fill="none" stroke="url(#rgf_ogold)" stroke-width="1" />
        <ellipse cx="0" cy="-7" rx="3.4" ry="7" fill="url(#rgf_ogold)" />
        <ellipse cx="-5.8" cy="-2.4" rx="3.4" ry="6.2" fill="url(#rgf_ogold)" transform="rotate(-22 -5.8 -2.4)" />
        <ellipse cx="5.8" cy="-2.4" rx="3.4" ry="6.2" fill="url(#rgf_ogold)" transform="rotate(22 5.8 -2.4)" />
        <path d="M -4 3 L 0 -1.6 L 4 3 L 0 10 Z" fill="url(#rgf_ogem)" stroke="#fff" stroke-width="0.7" />
      </g>
    ))}
    <Diamond cx={100} cy={16} size={5} fill="url(#rgf_ogem)" stroke="url(#rgf_ogold)" />
    <Diamond cx={100} cy={184} size={5} fill="url(#rgf_ogem)" stroke="url(#rgf_ogold)" />
    <Diamond cx={16} cy={100} size={4.6} fill="url(#rgf_ogem)" stroke="url(#rgf_ogold)" />
    <Diamond cx={184} cy={100} size={4.6} fill="url(#rgf_ogem)" stroke="url(#rgf_ogold)" />
    <Sparkle cx={96} cy={70} r={1.6} fill="#fffdf2" />
    <Sparkle cx={104} cy={132} r={1.6} fill="#fffdf2" />
  </g>
);

// ─── 3. Legendary · Infernal Flame Frame ────────────────────────────────────

const DEMON_PORTRAIT = (
  <g class="avatar-frame dg-frame-demon" data-frame-id="frame_demon">
    <defs>
      <linearGradient id="dgf_band" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#3a060f" />
        <stop offset="50%" stop-color="#7a1224" />
        <stop offset="100%" stop-color="#12020a" />
      </linearGradient>
      <linearGradient id="dgf_fireA" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#ff2d55" />
        <stop offset="55%" stop-color="#ff6b3d" />
        <stop offset="100%" stop-color="#ffd700" />
      </linearGradient>
      <linearGradient id="dgf_fireB" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#8e1c2f" />
        <stop offset="60%" stop-color="#ff4d4d" />
        <stop offset="100%" stop-color="#ffb347" />
      </linearGradient>
      <radialGradient id="dgf_ember" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffe066" />
        <stop offset="100%" stop-color="#ff4500" />
      </radialGradient>
    </defs>

    <rect x="0" y="0" width="400" height="520" rx="24" fill="none" stroke="url(#dgf_band)" stroke-width="30" />
    <rect x="16" y="16" width="368" height="488" rx="16" fill="none" stroke="url(#dgf_fireA)" stroke-width="2.6" />

    {/* flame tongues along top & bottom */}
    {[50, 100, 150, 200, 250, 300, 350].map(fx => (
      <g>
        <Flame x={fx} top={16} h={16} w={11} fill="url(#dgf_fireB)" opacity="0.9" />
        <Flame x={fx} top={486 + 7} h={16} w={11} fill="url(#dgf_fireB)" opacity="0.9" />
      </g>
    ))}
    {/* tongues on left/right rotated via path coordinates */}
    {[70, 150, 230, 310, 390, 470].map(fy => (
      <g>
        <Flame x={8} top={fy - 22} h={18} w={12} fill="url(#dgf_fireB)" opacity="0.9" />
        <Flame x={368} top={fy - 22} h={18} w={12} fill="url(#dgf_fireB)" opacity="0.9" />
      </g>
    ))}

    {/* horned corner skulls / obsidian claws */}
    {[
      { x: 40, y: 40 },
      { x: 360, y: 40 },
      { x: 40, y: 480 },
      { x: 360, y: 480 }
    ].map(c => (
      <g transform={`translate(${c.x} ${c.y})`}>
        <path d="M 0 -20 C -16 -18 -22 -4 -12 8 C -4 16 0 10 0 2 C 0 10 4 16 12 8 C 22 -4 16 -18 0 -20 Z" fill="#1a050c" stroke="#ff2d55" stroke-width="1.6" />
        <path d="M -8 -12 C -16 -20 -20 -26 -14 -30 C -12 -20 -10 -16 -6 -16 Z" fill="#ff2d55" />
        <path d="M 8 -12 C 16 -20 20 -26 14 -30 C 12 -20 10 -16 6 -16 Z" fill="#ff2d55" />
        <Diamond cx={0} cy={2} size={4} fill="url(#dgf_ember)" stroke="#fff" opacity="0.95" />
      </g>
    ))}

    {/* ember sparks */}
    <circle cx="90" cy="40" r="2.6" fill="url(#dgf_ember)" />
    <circle cx="310" cy="40" r="2.6" fill="url(#dgf_ember)" />
    <circle cx="90" cy="480" r="2.6" fill="url(#dgf_ember)" />
    <circle cx="310" cy="480" r="2.6" fill="url(#dgf_ember)" />
    <circle cx="200" cy="30" r="3" fill="url(#dgf_ember)" />
    <circle cx="200" cy="490" r="3" fill="url(#dgf_ember)" />
    <circle cx="30" cy="260" r="2.6" fill="url(#dgf_ember)" />
    <circle cx="370" cy="260" r="2.6" fill="url(#dgf_ember)" />
    <circle cx="150" cy="56" r="1.8" fill="#ffd700" opacity="0.9" />
    <circle cx="250" cy="56" r="1.8" fill="#ffd700" opacity="0.9" />
    <circle cx="150" cy="464" r="1.8" fill="#ffd700" opacity="0.9" />
    <circle cx="250" cy="464" r="1.8" fill="#ffd700" opacity="0.9" />
  </g>
);

const DEMON_OVERLAY = (
  <g class="avatar-frame dg-frame-demon" data-frame-id="frame_demon">
    <defs>
      <linearGradient id="dgf_oband" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#3a060f" />
        <stop offset="50%" stop-color="#7a1224" />
        <stop offset="100%" stop-color="#12020a" />
      </linearGradient>
      <linearGradient id="dgf_ofireA" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#ff2d55" />
        <stop offset="55%" stop-color="#ff6b3d" />
        <stop offset="100%" stop-color="#ffd700" />
      </linearGradient>
      <linearGradient id="dgf_ofireB" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#8e1c2f" />
        <stop offset="60%" stop-color="#ff4d4d" />
        <stop offset="100%" stop-color="#ffb347" />
      </linearGradient>
      <radialGradient id="dgf_oember" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffe066" />
        <stop offset="100%" stop-color="#ff4500" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="200" height="200" rx="22" fill="none" stroke="url(#dgf_oband)" stroke-width="24" />
    <rect x="13" y="13" width="174" height="174" rx="14" fill="none" stroke="url(#dgf_ofireA)" stroke-width="2" />
    {[30, 60, 90, 120, 150, 170].map(fx => (
      <g>
        <Flame x={fx} top={19} h={11} w={7} fill="url(#dgf_ofireB)" opacity="0.9" />
        <Flame x={fx} top={187 - 6} h={11} w={7} fill="url(#dgf_ofireB)" opacity="0.9" />
      </g>
    ))}
    {[
      { x: 32, y: 32 },
      { x: 168, y: 32 },
      { x: 32, y: 168 },
      { x: 168, y: 168 }
    ].map(c => (
      <g transform={`translate(${c.x} ${c.y})`}>
        <path d="M 0 -15 C -12 -13.5 -16.5 -3 -9 6 C -3 12 0 7.5 0 1.5 C 0 7.5 3 12 9 6 C 16.5 -3 12 -13.5 0 -15 Z" fill="#1a050c" stroke="#ff2d55" stroke-width="1.3" />
        <path d="M -6 -9 C -12 -15 -15 -19.5 -10.5 -22.5 C -9 -15 -7.5 -12 -4.5 -12 Z" fill="#ff2d55" />
        <path d="M 6 -9 C 12 -15 15 -19.5 10.5 -22.5 C 9 -15 7.5 -12 4.5 -12 Z" fill="#ff2d55" />
        <Diamond cx={0} cy={1.5} size={3} fill="url(#dgf_oember)" stroke="#fff" opacity="0.95" />
      </g>
    ))}
    <circle cx="100" cy="24" r="2.4" fill="url(#dgf_oember)" />
    <circle cx="100" cy="176" r="2.4" fill="url(#dgf_oember)" />
    <circle cx="24" cy="100" r="2" fill="url(#dgf_oember)" />
    <circle cx="176" cy="100" r="2" fill="url(#dgf_oember)" />
    <circle cx="70" cy="40" r="1.4" fill="#ffd700" opacity="0.9" />
    <circle cx="130" cy="40" r="1.4" fill="#ffd700" opacity="0.9" />
    <circle cx="70" cy="160" r="1.4" fill="#ffd700" opacity="0.9" />
    <circle cx="130" cy="160" r="1.4" fill="#ffd700" opacity="0.9" />
  </g>
);

// ─── 4. Mystical · Nebula Ethereal Frame ────────────────────────────────────

const GALAXY_PORTRAIT = (
  <g class="avatar-frame gg-frame-galaxy" data-frame-id="frame_galaxy">
    <defs>
      <linearGradient id="ggf_band" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stop-color="#2c1a5e" />
        <stop offset="30%" stop-color="#ff007f" />
        <stop offset="55%" stop-color="#00dfd8" />
        <stop offset="80%" stop-color="#7928ca" />
        <stop offset="100%" stop-color="#1a0b2e" />
      </linearGradient>
      <linearGradient id="ggf_gold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fff3b0" />
        <stop offset="50%" stop-color="#ffd700" />
        <stop offset="100%" stop-color="#c98a00" />
      </linearGradient>
      <radialGradient id="ggf_nebula" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="rgba(255,0,127,0.55)" />
        <stop offset="45%" stop-color="rgba(0,223,216,0.35)" />
        <stop offset="100%" stop-color="rgba(121,40,202,0)" />
      </radialGradient>
    </defs>

    {/* nebula glow under the band */}
    <circle cx="200" cy="260" r="150" fill="url(#ggf_nebula)" opacity="0.5" />

    <rect x="0" y="0" width="400" height="520" rx="24" fill="none" stroke="url(#ggf_band)" stroke-width="34" />
    <rect x="18" y="18" width="364" height="484" rx="16" fill="none" stroke="url(#ggf_gold)" stroke-width="2.2" />
    <rect x="24" y="24" width="352" height="472" rx="12" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1" stroke-dasharray="2 5" />

    {/* spiral galaxies in corners */}
    {[
      { x: 40, y: 44, s: 1 },
      { x: 360, y: 44, s: -1 },
      { x: 40, y: 476, s: 1 },
      { x: 360, y: 476, s: -1 }
    ].map(c => (
      <g transform={`translate(${c.x} ${c.y}) scale(${c.s}, 1) rotate(0)`}>
        <path
          d="M 0 0 C 6 -14 24 -18 26 -4 C 28 8 12 16 2 6 C -4 -1 2 -12 14 -12 C 24 -12 26 -4 22 2"
          fill="none"
          stroke="url(#ggf_gold)"
          stroke-width="2.4"
          stroke-linecap="round"
        />
        <circle cx="0" cy="0" r="7" fill="url(#ggf_band)" stroke="#fff" stroke-width="1" opacity="0.9" />
        <circle cx="-2" cy="-1" r="2" fill="#ffe066" />
        <circle cx="3" cy="-3" r="1.4" fill="#00dfd8" />
        <circle cx="1" cy="3" r="1.2" fill="#ff007f" />
      </g>
    ))}

    {/* orbiting star clusters */}
    {[
      { x: 200, y: 26, r: 3, c: '#fffdf2', cls: 'frame-star' },
      { x: 200, y: 494, r: 3, c: '#fffdf2', cls: 'frame-star' },
      { x: 26, y: 260, r: 2.6, c: '#00ffff', cls: 'frame-star' },
      { x: 374, y: 260, r: 2.6, c: '#ff80ef', cls: 'frame-star' },
      { x: 120, y: 34, r: 2, c: '#ffe066', cls: 'frame-star' },
      { x: 280, y: 34, r: 2, c: '#ffe066', cls: 'frame-star' },
      { x: 120, y: 486, r: 2, c: '#ffe066', cls: 'frame-star' },
      { x: 280, y: 486, r: 2, c: '#ffe066', cls: 'frame-star' }
    ].map((s, i) => (
      <circle cx={s.x} cy={s.y} r={s.r} fill={s.c} class={s.cls} style={{ 'animation-delay': `${(i % 5) * 0.6}s` }} />
    ))}

    {/* glimmer dots across the band */}
    {[
      [60, 80], [120, 60], [230, 70], [320, 90], [350, 150], [55, 190],
      [330, 330], [70, 380], [290, 440], [150, 470], [240, 440], [80, 460]
    ].map((p, i) => (
      <circle cx={p[0]} cy={p[1]} r={i % 3 === 0 ? 1.6 : 1.1} fill={i % 2 === 0 ? '#fff' : '#9ffcff'} opacity={i % 4 === 0 ? 0.95 : 0.6} />
    ))}

    <Sparkle cx={200} cy={90} r={2.4} fill="#fffdf2" class="frame-star" />
    <Sparkle cx={78} cy={140} r={1.8} fill="#9ffcff" class="frame-star" />
    <Sparkle cx={322} cy={420} r={1.9} fill="#ffd7f5" class="frame-star" />
  </g>
);

const GALAXY_OVERLAY = (
  <g class="avatar-frame gg-frame-galaxy" data-frame-id="frame_galaxy">
    <defs>
      <linearGradient id="ggf_oband" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stop-color="#2c1a5e" />
        <stop offset="30%" stop-color="#ff007f" />
        <stop offset="55%" stop-color="#00dfd8" />
        <stop offset="80%" stop-color="#7928ca" />
        <stop offset="100%" stop-color="#1a0b2e" />
      </linearGradient>
      <linearGradient id="ggf_ogold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fff3b0" />
        <stop offset="50%" stop-color="#ffd700" />
        <stop offset="100%" stop-color="#c98a00" />
      </linearGradient>
      <radialGradient id="ggf_onebula" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="rgba(255,0,127,0.55)" />
        <stop offset="45%" stop-color="rgba(0,223,216,0.35)" />
        <stop offset="100%" stop-color="rgba(121,40,202,0)" />
      </radialGradient>
    </defs>

    <circle cx="100" cy="100" r="72" fill="url(#ggf_onebula)" opacity="0.5" />

    <rect x="0" y="0" width="200" height="200" rx="22" fill="none" stroke="url(#ggf_oband)" stroke-width="28" />
    <rect x="15" y="15" width="170" height="170" rx="14" fill="none" stroke="url(#ggf_ogold)" stroke-width="1.8" />
    <rect x="20" y="20" width="160" height="160" rx="11" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="0.9" stroke-dasharray="2 5" />

    {[
      { x: 30, y: 30, s: 1 },
      { x: 170, y: 30, s: -1 },
      { x: 30, y: 170, s: 1 },
      { x: 170, y: 170, s: -1 }
    ].map(c => (
      <g transform={`translate(${c.x} ${c.y}) scale(${c.s}, 1)`}>
        <path
          d="M 0 0 C 4.5 -10.5 18 -13.5 19.5 -3 C 21 6 9 12 1.5 4.5 C -3 0 1.5 -8.4 10.5 -8.4 C 18 -8.4 19.5 -3 16.5 1.5"
          fill="none"
          stroke="url(#ggf_ogold)"
          stroke-width="1.9"
          stroke-linecap="round"
        />
        <circle cx="0" cy="0" r="5.2" fill="url(#ggf_oband)" stroke="#fff" stroke-width="0.9" opacity="0.9" />
        <circle cx="-1.5" cy="-0.8" r="1.5" fill="#ffe066" />
        <circle cx="2.2" cy="-2.2" r="1.1" fill="#00dfd8" />
      </g>
    ))}

    {[
      { x: 100, y: 24, r: 2.6, c: '#fffdf2' },
      { x: 100, y: 176, r: 2.6, c: '#fffdf2' },
      { x: 24, y: 100, r: 2.2, c: '#9ffcff' },
      { x: 176, y: 100, r: 2.2, c: '#ff80ef' },
      { x: 58, y: 40, r: 1.7, c: '#ffe066' },
      { x: 142, y: 40, r: 1.7, c: '#ffe066' },
      { x: 58, y: 160, r: 1.7, c: '#ffe066' },
      { x: 142, y: 160, r: 1.7, c: '#ffe066' }
    ].map((s, i) => (
      <circle cx={s.x} cy={s.y} r={s.r} fill={s.c} class="frame-star" style={{ 'animation-delay': `${(i % 5) * 0.8}s` }} />
    ))}

    {[
      [40, 70], [80, 56], [120, 66], [150, 84], [60, 130], [140, 130], [50, 150], [110, 156]
    ].map((p, i) => (
      <circle cx={p[0]} cy={p[1]} r={i % 3 === 0 ? 1.4 : 1} fill={i % 2 === 0 ? '#fff' : '#9ffcff'} opacity={i % 4 === 0 ? 0.95 : 0.55} />
    ))}

    <Sparkle cx={100} cy={56} r={1.9} fill="#fffdf2" class="frame-star" />
  </g>
);

// ─── Catalog ────────────────────────────────────────────────────────────────

export const AVATAR_FRAME_CATALOG: AvatarFrame[] = [
  {
    id: 'frame_sakura',
    name: 'Sakura Eternal Frame',
    rarity: 'legendary',
    description: 'A regal blossom frame woven from living sakura petals and gilded filigree that drifts petals across the border.',
    icon: '🌸',
    Portrait: () => SAKURA_PORTRAIT,
    Overlay: () => SAKURA_OVERLAY
  },
  {
    id: 'frame_royal',
    name: 'Royal Azure Frame',
    rarity: 'legendary',
    description: 'Anointed azure crest of gold studs, sapphires and a tri-lobe royal fleur for commanders of high standing.',
    icon: '👑',
    Portrait: () => ROYAL_PORTRAIT,
    Overlay: () => ROYAL_OVERLAY
  },
  {
    id: 'frame_demon',
    name: 'Infernal Flame Frame',
    rarity: 'legendary',
    description: 'Obsidian rune-work wreathed in crimson flame tongues, crowned with horned shadow and drifting embers.',
    icon: '🔥',
    Portrait: () => DEMON_PORTRAIT,
    Overlay: () => DEMON_OVERLAY
  },
  {
    id: 'frame_galaxy',
    name: 'Nebula Ethereal Frame',
    rarity: 'mystical',
    description: 'A living cosmos: swirling spiral galaxies, twinkling stars and a soft neon nebula halo for those who touch eternity.',
    icon: '🌌',
    Portrait: () => GALAXY_PORTRAIT,
    Overlay: () => GALAXY_OVERLAY
  }
];

export function getAvatarFrame(id?: string | null): AvatarFrame | null {
  if (!id || id === DEFAULT_AVATAR_FRAME_ID) return null;
  return AVATAR_FRAME_CATALOG.find(f => f.id === id) || null;
}