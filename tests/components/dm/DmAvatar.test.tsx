import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { DmAvatar } from '../../../src/components/dm/DmAvatar';
import { resetForDmTests } from '../../dm-helpers';

describe('DmAvatar', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
  });

  it('renders initials when no avatar is provided', () => {
    const { container } = render(() => <DmAvatar name="Alice" />);
    const el = container.querySelector('[data-testid="dm-avatar"]');
    expect(el).toBeInTheDocument();
    expect(el!.querySelector('.dm-avatar-initials')).toHaveTextContent('AL');
  });

  it('renders the image when an avatar url is provided', () => {
    const { container } = render(() => <DmAvatar name="Bob" avatarUrl="https://img/bob.png" />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://img/bob.png');
  });

  it('falls back to initials when the image fails to load', async () => {
    const { container } = render(() => <DmAvatar name="Cara" avatarUrl="https://img/cara.png" />);
    const img = container.querySelector('img')!;
    img.dispatchEvent(new Event('error'));
    expect(img).not.toBeInTheDocument();
    expect(container.querySelector('.dm-avatar-initials')).toHaveTextContent('CA');
  });

  it('renders a presence dot when a status is set', () => {
    const { container } = render(() => <DmAvatar name="Dan" status="online" />);
    const dot = container.querySelector('.dm-presence-dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveStyle({ background: '#23a55a' });
  });

  it('omits the presence dot when there is no status', () => {
    const { container } = render(() => <DmAvatar name="Eve" />);
    expect(container.querySelector('.dm-presence-dot')).not.toBeInTheDocument();
  });
});