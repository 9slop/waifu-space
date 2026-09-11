import { createMemo } from 'solid-js';
import { state } from '../lib/store';
import { STOCK_WALLPAPERS } from '../lib/wallpapers';

export function WallpaperBackground() {
  const currentWallpaper = createMemo(() => {
    if (state.settings.wallpaperType === 'custom' && state.settings.customWallpaperUrl) {
      return {
        url: state.settings.customWallpaperUrl,
        fallback: 'linear-gradient(135deg, #1f1435 0%, #3e1b4b 50%, #d85c7a 100%)'
      };
    }
    const found = STOCK_WALLPAPERS.find(w => w.id === state.settings.wallpaperId) || STOCK_WALLPAPERS[0];
    return found;
  });

  return (
    <>
      <div
        class="app-wallpaper"
        id="app-wallpaper"
        aria-hidden="true"
        style={{
          background: `url("${currentWallpaper().url}"), ${currentWallpaper().fallback}`,
          'background-size': 'cover',
          'background-position': 'center center',
          'background-repeat': 'no-repeat',
          filter: `blur(${state.settings.wallpaperBlur ?? 2}px)`
        }}
      />
      <div
        class="wallpaper-overlay"
        id="wallpaper-overlay"
        aria-hidden="true"
        style={{
          'background-color': `rgba(10, 10, 15, ${(state.settings.wallpaperDim ?? 45) / 100})`
        }}
      />
    </>
  );
}
