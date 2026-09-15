import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { DmPresenceStatusMenu } from '../../../src/components/dm/DmPresenceStatusMenu';
import { dmState, setDmState } from '../../../src/lib/dm/store';
import { resetForDmTests, stubFetch, flush } from '../../dm-helpers';

describe('DmPresenceStatusMenu', () => {
  beforeEach(() => {
    cleanup();
    resetForDmTests();
    setDmState('myPresence', { userId: 'u-me', status: 'online', lastSeenAt: '2025-01-01T00:00:00.000Z' });
  });

  it('renders the current status on the trigger button', () => {
    const { container } = render(() => <DmPresenceStatusMenu />);
    expect(container.querySelector('[data-testid="dm-status-menu-btn"]')).toHaveTextContent('Online');
  });

  it('opens the menu and shows all storable statuses', () => {
    const { container } = render(() => <DmPresenceStatusMenu />);
    fireEvent.click(container.querySelector('[data-testid="dm-status-menu-btn"]')!);
    expect(container.querySelector('[data-testid="dm-status-menu"]')).toBeInTheDocument();
    for (const status of ['online', 'idle', 'dnd', 'invisible']) {
      expect(container.querySelector(`[data-testid="dm-status-${status}"]`)).toBeInTheDocument();
    }
  });

  it('updates presence status over the API when a status is chosen', async () => {
    let posted: any = null;
    let restore = stubFetch({
      '/api/dm/presence': (url, init) => {
        if (init.method === 'POST') {
          posted = JSON.parse(String(init.body));
          return { body: { success: true, presence: { userId: 'u-me', status: posted.status, customStatus: posted.customStatus, lastSeenAt: '2025-01-01T00:00:00.000Z' } } };
        }
        return { body: { success: true, presence: { userId: 'u-me', status: 'online', lastSeenAt: '2025-01-01T00:00:00.000Z' } } };
      }
    });
    const { container } = render(() => <DmPresenceStatusMenu />);
    fireEvent.click(container.querySelector('[data-testid="dm-status-menu-btn"]')!);
    fireEvent.click(container.querySelector('[data-testid="dm-status-dnd"]')!);
    await flush();
    expect(posted).toEqual({ status: 'dnd', customStatus: null });
    expect(dmState.myPresence?.status).toBe('dnd');
    restore();
  });
});