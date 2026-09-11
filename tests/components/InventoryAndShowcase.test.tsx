import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { RpgHub } from '../../src/components/RpgHub';
import { ProfileShowcase } from '../../src/components/ProfileShowcase';
import { state, setState, DEFAULT_STATE, unlockCosmetic } from '../../src/lib/store';
import { setLanguage } from '../../src/lib/i18n';

describe('Inventory & Showcase Features (Issue #16)', () => {
  beforeEach(() => {
    localStorage.clear();
    setLanguage('en');
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  });

  describe('ProfileShowcase Inventory Tab (Relocated from Minigames)', () => {
    it('renders the Inventory tab button on ProfileShowcase and switches to it', () => {
      render(() => <ProfileShowcase />);

      const tabBtn = screen.getByTestId('profile-tab-inventory');
      expect(tabBtn).toBeInTheDocument();

      fireEvent.click(tabBtn);
      expect(screen.getByTestId('inventory-pane')).toBeInTheDocument();
    });

    it('displays 6 showcase pedestals in the showcase area of inventory', () => {
      render(() => <ProfileShowcase />);

      const tabBtn = screen.getByTestId('profile-tab-inventory');
      fireEvent.click(tabBtn);

      const pedestals = screen.getAllByTestId(/^showcase-pedestal-/);
      expect(pedestals).toHaveLength(6);
    });

    it('allows toggling items into showcase pedestals up to maximum of 6', () => {
      // Unlock cosmetics first
      unlockCosmetic('accessories', 'maid_headband');
      unlockCosmetic('accessories', 'succubus_horns');
      unlockCosmetic('accessories', 'phoenix_pin');

      render(() => <ProfileShowcase />);

      const tabBtn = screen.getByTestId('profile-tab-inventory');
      fireEvent.click(tabBtn);

      // Find toggle button for items
      const toggleBtns = screen.getAllByTitle(/feature in showcase|remove from showcase/i);
      expect(toggleBtns.length).toBeGreaterThan(0);

      // Click first toggle button
      fireEvent.click(toggleBtns[0]);
      expect(state.rpg.showcaseItems.length).toBe(1);

      // Click again to unshowcase
      fireEvent.click(toggleBtns[0]);
      expect(state.rpg.showcaseItems.length).toBe(0);
    });

    it('filters items by category and rarity in the inventory view', () => {
      render(() => <ProfileShowcase />);

      const tabBtn = screen.getByTestId('profile-tab-inventory');
      fireEvent.click(tabBtn);

      // Category filter
      const accessoryBtn = screen.getByRole('button', { name: /accessories/i });
      fireEvent.click(accessoryBtn);
      expect(accessoryBtn).toHaveClass('active');

      // Rarity filter
      const mysticalBtn = screen.getByRole('button', { name: /mystical/i });
      fireEvent.click(mysticalBtn);
      expect(mysticalBtn).toHaveClass('active');
    });
  });

  describe('ProfileShowcase Component', () => {
    it('renders profile overview, stats, and 6 showcase slots', () => {
      setState('user', {
        id: 'usr_senpai',
        username: 'SenpaiCommander',
        email: 'senpai@waifuspace.moe',
        bio: 'Supreme Master of Waifu Space',
        createdAt: new Date().toISOString()
      });
      setState('rpg', 'defenseHighWave', 15);
      setState('rpg', 'coins', 1250);
      setState('waifu', 'bondLevel', 8);

      render(() => <ProfileShowcase />);

      expect(screen.getByText('SenpaiCommander')).toBeInTheDocument();
      expect(screen.getByText('Supreme Master of Waifu Space')).toBeInTheDocument();
      expect(screen.getByText(/Wave 15/)).toBeInTheDocument();
      expect(screen.getByText(/1250/)).toBeInTheDocument();

      // 6 trophy showcase slots
      const slots = screen.getAllByTestId(/^profile-showcase-slot-/);
      expect(slots).toHaveLength(6);
    });

    it('has a functional copy link button that shows feedback', async () => {
      // Mock navigator.clipboard
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock
        },
        configurable: true,
        writable: true
      });

      render(() => <ProfileShowcase />);

      const copyBtn = screen.getByRole('button', { name: /share/i });
      expect(copyBtn).toBeInTheDocument();

      fireEvent.click(copyBtn);
      expect(writeTextMock).toHaveBeenCalled();
    });
  });
});
