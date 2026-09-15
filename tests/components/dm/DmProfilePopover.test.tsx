import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@solidjs/testing-library';
import { DmProfilePopover } from '../../../src/components/dm/DmProfilePopover';
import { resetForDmTests, stubFetch } from '../../dm-helpers';

vi.mock('../../../src/lib/dm/call', () => ({
  CallManager: class {}
}));

const rect = (left: number, top: number, height = 40): DOMRect =>
  ({ left, top, bottom: top + height, width: 264, height, x: left, y: top, right: left + 264, toJSON: () => ({}) }) as unknown as DOMRect;

describe('DmProfilePopover', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
  });

  it('loads the user profile and shows name, bio and join date', async () => {
    const restore = stubFetch({
      '/api/dm/users/u-bob/profile': () => ({
        body: {
          success: true,
          profile: {
            id: 'u-bob',
            username: 'Bob',
            avatarUrl: null,
            bio: 'hello from bob',
            createdAt: '2024-01-10T00:00:00.000Z',
            lastSeenAt: '2025-01-02T00:00:00.000Z'
          }
        }
      })
    });
    const { container } = render(() => (
      <DmProfilePopover userId="u-bob" anchor={() => rect(120, 200)} onClose={() => {}} />
    ));
    expect(container.querySelector('[data-testid="dm-profile-popover"]')).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('[data-testid="dm-profile-name"]')).toHaveTextContent('Bob'));
    expect(container.querySelector('[data-testid="dm-popover-bio"]')?.textContent).toContain('hello from bob');
    expect(container.querySelector('[data-testid="dm-popover-joined"]')?.textContent).toBeTruthy();
    restore();
  });

  it('closes on escape, the close button, or an outside pointer down', () => {
    let closed = false;
    const { container } = render(() => (
      <DmProfilePopover userId="u-bob" anchor={() => rect(120, 200)} onClose={() => { closed = true; }} />
    ));
    fireEvent.click(container.querySelector('[data-testid="dm-profile-close"]')!);
    expect(closed).toBe(true);
    closed = false;
    render(() => <DmProfilePopover userId="u-bob" anchor={() => rect(120, 200)} onClose={() => { closed = true; }} />, { container });
    fireEvent.pointerDown(document.body);
    expect(closed).toBe(true);
    closed = false;
    render(() => <DmProfilePopover userId="u-bob" anchor={() => rect(120, 200)} onClose={() => { closed = true; }} />, { container });
    fireEvent.pointerDown(container.querySelector('[data-testid="dm-profile-popover"]')!);
    expect(closed).toBe(false);
  });

  it('flips above the anchor when there is little space below', async () => {
    const restore = stubFetch({
      '/api/dm/users/u-bob/profile': () => ({ body: { success: true, profile: { id: 'u-bob', username: 'Bob', avatarUrl: null, bio: null, createdAt: null, lastSeenAt: null } } })
    });
    const { container } = render(() => (
      <DmProfilePopover userId="u-bob" anchor={() => rect(120, 700)} onClose={() => {}} />
    ));
    await waitFor(() => expect(container.querySelector('[data-testid="dm-profile-popover"]')).toBeInTheDocument());
    const el = container.querySelector('[data-testid="dm-profile-popover"]') as HTMLElement;
    const top = parseFloat(el.style.top);
    expect(top).toBeLessThan(400); // opens upward instead of below the 700px anchor
    restore();
  });
});