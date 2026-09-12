import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { AvatarFrameOverlay } from '../../src/components/AvatarFrame';
import { WaifuAvatar } from '../../src/components/WaifuAvatar';
import { state, setState, DEFAULT_STATE } from '../../src/lib/store';

describe('AvatarFrameOverlay Component (AvatarFrame.tsx)', () => {
  beforeEach(() => {
    cleanup();
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  });

  it('renders nothing when no frame (or none) is provided', () => {
    const { container } = render(() => <AvatarFrameOverlay />);
    expect(container.querySelector('svg.avatar-frame-overlay')).not.toBeInTheDocument();

    const { container: c2 } = render(() => <AvatarFrameOverlay frameId="none" />);
    expect(c2.querySelector('svg.avatar-frame-overlay')).not.toBeInTheDocument();
  });

  it('renders the frame overlay svg with the correct data-frame-id', () => {
    const { container } = render(() => <AvatarFrameOverlay frameId="frame_royal" class="profile-avatar-frame" />);
    const overlay = container.querySelector('svg.avatar-frame-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('data-frame-id', 'frame_royal');
    expect(overlay).toHaveClass('profile-avatar-frame');
    expect(overlay).toHaveAttribute('viewBox', '0 0 200 200');
  });
});

describe('WaifuAvatar portrait frame rendering (WaifuAvatar.tsx)', () => {
  beforeEach(() => {
    cleanup();
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  });

  it('renders no frame layer when no avatar frame is equipped', () => {
    setState('waifu', 'appearance', 'avatarFrame', 'none');
    const { container } = render(() => <WaifuAvatar />);
    expect(container.querySelector('svg.waifu-avatar-svg .avatar-frame')).not.toBeInTheDocument();
  });

  it('renders the equipped portrait frame inside the avatar svg', () => {
    setState('waifu', 'appearance', 'avatarFrame', 'frame_sakura');
    const { container } = render(() => <WaifuAvatar />);
    const frame = container.querySelector('svg.waifu-avatar-svg .avatar-frame');
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveAttribute('data-frame-id', 'frame_sakura');
  });

  it('renders a custom-avatar frame overlay in custom image mode', () => {
    setState('waifu', 'appearance', 'avatarMode', 'custom');
    setState('waifu', 'appearance', 'customAvatarUrl', 'https://example.com/avatar.png');
    setState('waifu', 'appearance', 'avatarFrame', 'frame_galaxy');
    const { container } = render(() => <WaifuAvatar />);
    const customOverlay = container.querySelector('svg.avatar-frame-overlay.custom-avatar-overlay');
    expect(customOverlay).toBeInTheDocument();
    expect(customOverlay).toHaveAttribute('data-frame-id', 'frame_galaxy');
  });
});