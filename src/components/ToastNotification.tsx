import { toastMessage, toastVisible } from '../lib/store';

export function ToastNotification() {
  return (
    <div class={`app-toast ${toastVisible() ? 'visible' : ''}`} id="app-toast">
      {toastMessage()}
    </div>
  );
}
