import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { SettingsStudio } from '../../src/components/SettingsStudio';
import { state } from '../../src/lib/store';
import { setLanguage } from '../../src/lib/i18n';

describe('Language Settings Integration (Issue #13)', () => {
  beforeEach(() => {
    localStorage.clear();
    setLanguage('en');
  });

  it('renders Language tab in Settings navigation', () => {
    render(() => <SettingsStudio />);
    const langTab = screen.getByRole('button', { name: /Language/i });
    expect(langTab).toBeInTheDocument();
  });

  it('navigates to Language settings and displays language options', () => {
    render(() => <SettingsStudio />);
    const langTab = screen.getByRole('button', { name: /Language/i });
    fireEvent.click(langTab);

    expect(screen.getByRole('heading', { name: /Language Settings/i })).toBeInTheDocument();
    expect(screen.getByTestId('language-card-en')).toBeInTheDocument();
    expect(screen.getByTestId('language-card-ja')).toBeInTheDocument();
  });

  it('switches application language to Japanese when Japanese card is clicked', () => {
    render(() => <SettingsStudio />);
    const langTab = screen.getByRole('button', { name: /Language/i });
    fireEvent.click(langTab);

    // Click Japanese card
    const jaCard = screen.getByTestId('language-card-ja');
    fireEvent.click(jaCard);

    // State updated
    expect(state.settings.language).toBe('ja');

    // UI re-renders with Japanese translations
    expect(screen.getByRole('heading', { name: /言語設定/i })).toBeInTheDocument();
    expect(screen.getByText('現在の言語')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /言語/i })).toBeInTheDocument();
  });

  it('persists language selection in store / localStorage', () => {
    render(() => <SettingsStudio />);
    const langTab = screen.getByRole('button', { name: /Language/i });
    fireEvent.click(langTab);

    const jaCard = screen.getByTestId('language-card-ja');
    fireEvent.click(jaCard);

    const stored = JSON.parse(localStorage.getItem('waifu_space_data_v1') || '{}');
    expect(stored.settings?.language).toBe('ja');
  });
});
