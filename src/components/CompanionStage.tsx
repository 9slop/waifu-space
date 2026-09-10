import { createMemo } from 'solid-js';
import {
  state,
  pokeAvatar,
  avatarBounced,
  speechBubble,
  speechBubbleVisible,
  sendUserMessage,
  triggerWaifuResponse
} from '../lib/store';
import { getPersonality } from '../lib/personality';
import { WaifuAvatar } from './WaifuAvatar';
import { ChatStage } from './ChatStage';
import { t } from '../lib/i18n';

export function CompanionStage() {
  const persona = createMemo(() => getPersonality(state.waifu.personality));

  const bondProgress = createMemo(() => {
    const needed = state.waifu.bondLevel * 50;
    return Math.min(100, Math.round((state.waifu.bondExp / needed) * 100));
  });

  const handleHeadpat = () => {
    const list = persona().poke;
    const pat = list[Math.floor(Math.random() * list.length)];
    triggerWaifuResponse(pat.text, pat.mood);
  };

  return (
    <div class="main-stage-layout">
      {/* LEFT: WAIFU AVATAR STAGE */}
      <div class="waifu-stage-panel">
        <div class="stage-header-card">
          <div class="waifu-identity">
            <h2 class="waifu-display-name">{state.waifu.name}</h2>
            <span class="personality-tag">{persona().name}</span>
          </div>

          {/* AFFECTION / BOND METER */}
          <div
            class="affection-card"
            title={t('companion.affectionTooltip')}
          >
            <div class="affection-top">
              <span class="affection-label">{t('companion.affectionLevel')}</span>
              <span class="affection-level-badge">Lv. {state.waifu.bondLevel}</span>
            </div>
            <div class="affection-progress-bar">
              <div
                class="affection-fill"
                style={{ width: `${bondProgress()}%` }}
              />
            </div>
          </div>
        </div>

        {/* AVATAR INTERACTIVE STAGE */}
        <div
          class="avatar-interactive-stage"
          title={t('companion.avatarClickTooltip', { name: state.waifu.name })}
          onClick={pokeAvatar}
        >
          <div class={`avatar-mount ${avatarBounced() ? 'avatar-bounced' : ''}`}>
            <WaifuAvatar />
          </div>

          {/* SPEECH BUBBLE OVERLAY */}
          <div class={`waifu-live-bubble ${speechBubbleVisible() ? 'visible' : ''}`}>
            <span class="bubble-text">{speechBubble()}</span>
          </div>
        </div>

        {/* STAGE QUICK ACTIONS */}
        <div class="stage-quick-actions">
          <button
            type="button"
            class="stage-action-chip"
            onClick={handleHeadpat}
          >
            🌸 {t('companion.headpat')}
          </button>
          <button
            type="button"
            class="stage-action-chip"
            onClick={pokeAvatar}
          >
            👉 {t('companion.poke')}
          </button>
          <button
            type="button"
            class="stage-action-chip"
            onClick={() => sendUserMessage(t('chat.schedulePrompt'))}
          >
            📅 {t('companion.reviewSchedule')}
          </button>
          <button
            type="button"
            class="stage-action-chip"
            onClick={() => sendUserMessage(t('chat.cutePrompt'))}
          >
            💖 {t('companion.cute')}
          </button>
        </div>
      </div>

      {/* RIGHT: CHAT PANEL */}
      <ChatStage />
    </div>
  );
}
