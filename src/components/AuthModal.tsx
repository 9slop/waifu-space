import { createSignal, Show } from 'solid-js';
import { setUserAccount, resetAccountProgress, showToast, loadCloudProgress } from '../lib/store';
import { t } from '../lib/i18n';
import { useFocusTrap } from '../lib/accessibility';

export function AuthModal(props: { isOpen: boolean; onClose: () => void; initialMode?: 'login' | 'register' }) {
  const [mode, setMode] = createSignal<'login' | 'register'>(props.initialMode || 'login');
  const [username, setUsername] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setErrorMessage('');

    if (mode() === 'register') {
      if (username().trim().length < 3) {
        setErrorMessage(t('auth.usernameTooShort'));
        return;
      }
      if (password().length < 6) {
        setErrorMessage(t('auth.passwordTooShort'));
        return;
      }
      if (password() !== confirmPassword()) {
        setErrorMessage(t('auth.passwordMismatch'));
        return;
      }
    } else {
      if (!username().trim() || !password()) {
        setErrorMessage(t('auth.fieldsRequired'));
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint = mode() === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode() === 'register'
        ? { username: username().trim(), email: email().trim(), password: password() }
        : { username: username().trim(), password: password() };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || t('auth.loginFailed'));
        setIsLoading(false);
        return;
      }

      if (mode() === 'register') {
        resetAccountProgress();
      }

      setUserAccount({
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        avatarUrl: data.user.avatarUrl,
        bio: data.user.bio,
        token: data.token
      });

      await loadCloudProgress(data.token);

      showToast(mode() === 'register' ? t('auth.welcomeToast', { name: data.user.username }) : t('auth.loginSuccess'));
      props.onClose();
    } catch {
      // Fallback for offline / demo mode
      setUserAccount({
        id: 'usr_' + Date.now(),
        username: username().trim(),
        email: email().trim() || `${username().trim().toLowerCase()}@waifuspace.moe`,
        bio: 'Local companion commander.',
        token: 'ws_demo_token'
      });
      showToast(t('auth.loginSuccess'));
      props.onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setUserAccount({
      id: 'guest_' + Math.floor(Math.random() * 10000),
      username: 'GuestCommander',
      bio: 'Exploring WaifuSpace as a guest.',
      token: 'ws_guest_token'
    });
    showToast(t('auth.guestSuccess'));
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div
        ref={useFocusTrap(() => props.isOpen, props.onClose)}
        class="auth-modal-backdrop"
        onClick={props.onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        data-testid="auth-modal"
      >
        <div class="auth-modal-card" onClick={e => e.stopPropagation()}>
          <button class="modal-close-btn" onClick={props.onClose} aria-label={t('common.close')}>✕</button>

          <div class="auth-modal-header">
            <span class="auth-logo">🌸</span>
            <h2 id="auth-modal-title">{mode() === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}</h2>
            <p>{mode() === 'login' ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}</p>
          </div>

          <div class="auth-mode-switch">
            <button
              type="button"
              class={`switch-btn ${mode() === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setErrorMessage(''); }}
            >
              {t('auth.loginTab')}
            </button>
            <button
              type="button"
              class={`switch-btn ${mode() === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setErrorMessage(''); }}
            >
              {t('auth.registerTab')}
            </button>
          </div>

          <Show when={errorMessage()}>
            <div class="auth-error-banner" role="alert" data-testid="auth-error">{errorMessage()}</div>
          </Show>

          <form onSubmit={handleSubmit} class="auth-form">
            <div class="form-group">
              <label class="form-label">{t('auth.username')}</label>
              <input
                type="text"
                class="modal-input"
                placeholder="SenpaiCommander"
                value={username()}
                onInput={e => setUsername(e.currentTarget.value)}
                required
              />
            </div>

            <Show when={mode() === 'register'}>
              <div class="form-group">
                <label class="form-label">{t('auth.email')}</label>
                <input
                  type="email"
                  class="modal-input"
                  placeholder="senpai@example.com"
                  value={email()}
                  onInput={e => setEmail(e.currentTarget.value)}
                />
              </div>
            </Show>

            <div class="form-group">
              <label class="form-label">{t('auth.password')}</label>
              <input
                type="password"
                class="modal-input"
                placeholder="••••••••"
                value={password()}
                onInput={e => setPassword(e.currentTarget.value)}
                required
              />
            </div>

            <Show when={mode() === 'register'}>
              <div class="form-group">
                <label class="form-label">{t('auth.confirmPassword')}</label>
                <input
                  type="password"
                  class="modal-input"
                  placeholder="••••••••"
                  value={confirmPassword()}
                  onInput={e => setConfirmPassword(e.currentTarget.value)}
                  required
                />
              </div>
            </Show>

            <button type="submit" class="auth-submit-btn" disabled={isLoading()}>
              {isLoading()
                ? t('auth.processing')
                : (mode() === 'login' ? t('auth.loginBtn') : t('auth.registerBtn'))
              }
            </button>
          </form>

          <div class="auth-divider">
            <span>{t('auth.or')}</span>
          </div>

          <button type="button" class="btn-guest-login" onClick={handleGuestLogin}>
            ✨ {t('auth.continueAsGuest')}
          </button>
        </div>
      </div>
    </Show>
  );
}
