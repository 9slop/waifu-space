import { createSignal, For, onMount, createEffect } from 'solid-js';
import {
  state,
  sendUserMessage,
  clearChatHistory,
  ChatMessage
} from '../lib/store';
import { t } from '../lib/i18n';
import { PhFlowerLotus, PhUserCircle, PhTrash, PhPaperPlaneRight, GlyphText } from './icons';

export function ChatStage() {
  const [inputText, setInputText] = createSignal('');
  let messagesContainerRef: HTMLDivElement | undefined;

  const scrollToBottom = () => {
    if (messagesContainerRef) {
      messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
    }
  };

  createEffect(() => {
    // Scroll whenever messages or typing changes
    state.chat.messages.length;
    state.chat.isTyping;
    setTimeout(scrollToBottom, 50);
  });

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const text = inputText().trim();
    if (!text) return;
    setInputText('');
    sendUserMessage(text);
  };

  const handleSuggestionClick = (s: string) => {
    sendUserMessage(s);
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div class="chat-panel">
      <div class="chat-header">
        <div class="chat-header-title">
          <span>{t('chat.headerTitle', { name: state.waifu.name })}</span>
          <span class="chat-status-dot online" />
        </div>
        <div class="chat-header-actions">
          <button
            class="chat-icon-btn"
            id="clear-chat-btn"
            title={t('chat.clearTooltip')}
            aria-label={t('chat.clearTooltip')}
            onClick={clearChatHistory}
          >
            <PhTrash />
          </button>
        </div>
      </div>

      {/* MESSAGES SCROLL AREA */}
      <div
        class="chat-messages"
        id="chat-messages"
        ref={messagesContainerRef}
        role="log"
        aria-live="polite"
        aria-label={t('chat.messagesRegion')}
        tabindex="0"
      >
        <For each={state.chat.messages}>
          {(msg: ChatMessage) => (
            <div class={`chat-bubble-row ${msg.sender === 'user' ? 'user-row' : 'waifu-row'}`}>
              <div class="chat-bubble-avatar">
                {msg.sender === 'user' ? <PhUserCircle /> : <PhFlowerLotus />}
              </div>
              <div class="chat-bubble-content">
                <span class="chat-bubble-sender">
                  {msg.sender === 'user' ? t('chat.you') : state.waifu.name}
                </span>
                <div class="chat-bubble-text"><GlyphText text={msg.text} /></div>
                <span class="chat-bubble-time">{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          )}
        </For>

        {/* TYPING INDICATOR */}
        {state.chat.isTyping && (
          <div class="chat-typing-indicator">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {/* DYNAMIC SUGGESTION CHIPS */}
      {state.chat.suggestions.length > 0 && (
        <div class="chat-quick-suggestions">
          <For each={state.chat.suggestions}>
            {(s: string) => (
              <button
                type="button"
                class="suggestion-chip"
                onClick={() => handleSuggestionClick(s)}
              >
                {s}
              </button>
            )}
          </For>
        </div>
      )}

      {/* INPUT FORM */}
      <form class="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          class="chat-input"
          placeholder={t('chat.placeholder', { name: state.waifu.name })}
          aria-label={t('chat.inputLabel', { name: state.waifu.name })}
          value={inputText()}
          onInput={e => setInputText(e.currentTarget.value)}
        />
        <button
          type="submit"
          class="chat-send-btn"
          title={t('chat.sendTooltip')}
          aria-label={t('chat.sendTooltip')}
        >
          <span><PhPaperPlaneRight /></span>
        </button>
      </form>
    </div>
  );
}
