import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { WaifuAvatar } from '../../src/components/WaifuAvatar';
import { state, setState, DEFAULT_STATE } from '../../src/lib/store';

describe('WaifuAvatar Component (WaifuAvatar.tsx)', () => {
  beforeEach(() => {
    cleanup();
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  });

  it('renders SVG avatar container with correct class', () => {
    const { container } = render(() => <WaifuAvatar />);
    const svg = container.querySelector('svg.waifu-avatar-svg');
    expect(svg).toBeInTheDocument();
  });

  it('reacts to changes in mood by rendering appropriate mood layers', () => {
    setState('waifu', 'mood', 'blush');
    const { container } = render(() => <WaifuAvatar />);

    // Blush circles should be present
    const blushCircles = container.querySelectorAll('.blush-glow');
    expect(blushCircles.length).toBeGreaterThan(0);
  });

  it('renders custom outfits like miko or magical girl', () => {
    setState('waifu', 'appearance', 'outfit', 'miko');
    const { container } = render(() => <WaifuAvatar />);

    // Shrine maiden miko outfit elements
    const outfitEl = container.querySelector('.outfit-miko');
    expect(outfitEl).toBeInTheDocument();
  });

  it('renders accessories like halo or bunny ears', () => {
    setState('waifu', 'appearance', 'accessory', 'halo');
    const { container } = render(() => <WaifuAvatar />);

    // Angel halo accessory element
    const haloEl = container.querySelector('.accessory-halo');
    expect(haloEl).toBeInTheDocument();
  });
});
