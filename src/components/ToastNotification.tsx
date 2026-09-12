import { toastMessage, toastVisible } from '../lib/store';
import { GlyphText } from './icons';

export function ToastNotification() {
  return (
    <div class={`app-toast ${toastVisible() ? 'visible' : ''}`} id="app-toast">
      <GlyphText text={toastMessage()} />
    </div>
  );
}
