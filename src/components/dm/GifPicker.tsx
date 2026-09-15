import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { dmState, gifLoadFavorites, gifSearch, gifToggleFavorite, isGifFavorited, sendGif, setGifOpen, setGifTab } from '../../lib/dm/store';
import { gifKeyOfUrl } from '../../lib/dm/api';
import { t } from '../../lib/i18n';
import { PhHeart, PhHeartFill } from '../icons';

/**
 * Popover GIF picker: searches the configured GIF provider (debounced),
 * shows a favorites tab with heart toggles, and lets the user send a
 * GIF inline.
 */
export function GifPicker() {
  const [query, setQuery] = createSignal('');
  let debounce: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    void gifLoadFavorites();
    document.addEventListener('pointerdown', closeOnClickAway);
  });

  onCleanup(() => document.removeEventListener('pointerdown', closeOnClickAway));

  const closeOnClickAway = (e: PointerEvent) => {
    const el = e.target as HTMLElement | null;
    if (!el || !el.closest('.dm-gif-picker') && !el.closest('.dm-gif-btn')) setGifOpen(false);
  };

  const runSearch = (value: string) => {
    setGifTab('search');
    clearTimeout(debounce);
    debounce = setTimeout(() => void gifSearch(value), 400);
  };

  const choose = (url: string) => {
    void sendGif(url);
    setGifOpen(false);
  };

  return (
    <div class="dm-gif-picker" data-testid="dm-gif-picker">
      <div class="dm-gif-tabs">
        <button
          class={`dm-gif-tab${dmState.gifTab === 'search' ? ' active' : ''}`}
          data-testid="dm-gif-tab-search"
          onClick={() => setGifTab('search')}
        >
          {t('dm.gifTabSearch')}
        </button>
        <button
          class={`dm-gif-tab${dmState.gifTab === 'favorites' ? ' active' : ''}`}
          data-testid="dm-gif-tab-favorites"
          onClick={() => {
            setGifTab('favorites');
            void gifLoadFavorites();
          }}
        >
          {t('dm.gifTabFavorites')}
        </button>
      </div>

      <Show when={dmState.gifTab === 'search'}>
        <div class="dm-gif-search-row">
          <input
            class="dm-gif-search-input"
            data-testid="dm-gif-search-input"
            value={query()}
            placeholder={t('dm.gifSearchPlaceholder')}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              runSearch(e.currentTarget.value);
            }}
          />
        </div>
        <div class="dm-gif-grid" data-testid="dm-gif-grid">
          <For each={dmState.gifResults}>
            {(item) => {
              const favKey = () => gifKeyOfUrl(item.url);
              return (
                <div class="dm-gif-item" data-testid={`dm-gif-item-${item.id}`}>
                  <button class="dm-gif-send" onClick={() => choose(item.url)} title={item.title || item.url}>
                    <img src={item.preview || item.url} alt="" loading="lazy" />
                  </button>
                  <button
                    class={`dm-gif-heart${isGifFavorited(favKey()) ? ' favorited' : ''}`}
                    data-testid={`dm-gif-fav-${item.id}`}
                    aria-label={isGifFavorited(favKey()) ? 'Unfavorite' : 'Favorite'}
                    onClick={() => void gifToggleFavorite({ id: favKey(), url: item.url, preview: item.preview || item.url, width: item.width, height: item.height, title: item.title })}
                  >
                    {isGifFavorited(favKey()) ? <PhHeartFill /> : <PhHeart />}
                  </button>
                </div>
              );
            }}
          </For>
        </div>
        <Show when={dmState.gifResults.length === 0}>
          <Show when={dmState.gifUnavailable} fallback={<div class="dm-gif-empty">{t('dm.gifSearchEmpty')}</div>}>
            <div class="dm-gif-empty" data-testid="dm-gif-unavailable">{t('dm.gifUnavailable')}</div>
          </Show>
        </Show>
      </Show>

      <Show when={dmState.gifTab === 'favorites'}>
        <div class="dm-gif-grid" data-testid="dm-favorites-grid">
          <For each={dmState.gifFavorites}>
            {(item) => (
              <div class="dm-gif-item" data-testid={`dm-gif-fav-item-${item.id}`}>
                <button class="dm-gif-send" onClick={() => choose(item.url)} title={item.title || item.url}>
                  <img src={item.preview || item.url} alt="" loading="lazy" />
                </button>
                <button
                  class="dm-gif-heart favorited"
                  data-testid={`dm-gif-unfav-${item.id}`}
                  aria-label="Unfavorite"
                  onClick={() => void gifToggleFavorite(item)}
                >
                  <PhHeartFill />
                </button>
              </div>
            )}
          </For>
        </div>
        <Show when={dmState.gifFavorites.length === 0}>
          <div class="dm-gif-empty">{t('dm.gifEmptyFavorites')}</div>
        </Show>
      </Show>
    </div>
  );
}