import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NullEngine, Scene } from '@babylonjs/core';
import { StrikeP2PManager } from '../../src/lib/strike/strike-p2p';
import { StrikeChatMessage } from '../../src/lib/strike/strike-types';

describe('Strike P2P Chat and Announcements', () => {
  let engine: NullEngine;
  let scene: Scene;
  let mockEngine: any;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    mockEngine = {
      scene,
      isDisposed: false,
      remoteAvatars: new Map(),
      camera: { position: { x: 0, y: 1.62, z: 0 }, rotation: { x: 0, y: 0 } },
      velocity: { length: () => 0 },
      health: 150,
      activeWeaponId: 'rifle',
      applyDamage: vi.fn()
    };
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('receives chat message callback when local player sends chat message', () => {
    const receivedChat: StrikeChatMessage[] = [];
    const p2p = new StrikeP2PManager(mockEngine, {
      onScoreboardUpdate: vi.fn(),
      onKillfeedEntry: vi.fn(),
      onMedalAnnouncement: vi.fn(),
      onConnectionStatus: vi.fn(),
      onChatMessage: (msg) => receivedChat.push(msg)
    });

    p2p.start('TestPlayer');

    // First message should be welcome server message
    expect(receivedChat.length).toBe(1);
    expect(receivedChat[0].isSystem).toBe(true);

    p2p.sendChatMessage('Hello tactical Kyoto!');
    expect(receivedChat.length).toBe(2);
    expect(receivedChat[1].sender).toBe('TestPlayer');
    expect(receivedChat[1].text).toBe('Hello tactical Kyoto!');
    expect(receivedChat[1].isSystem).toBeUndefined();

    p2p.stop();
  });

  it('broadcasts system messages and streak announcements', () => {
    const receivedChat: StrikeChatMessage[] = [];
    const p2p = new StrikeP2PManager(mockEngine, {
      onScoreboardUpdate: vi.fn(),
      onKillfeedEntry: vi.fn(),
      onMedalAnnouncement: vi.fn(),
      onConnectionStatus: vi.fn(),
      onChatMessage: (msg) => receivedChat.push(msg)
    });

    p2p.start('Commander');
    p2p.broadcastSystemMessage('🔥 Commander is on a 5 KILL STREAK!', '#ff7675');

    const last = receivedChat[receivedChat.length - 1];
    expect(last.isSystem).toBe(true);
    expect(last.sender).toBe('Server');
    expect(last.text).toContain('5 KILL STREAK');
    expect(last.color).toBe('#ff7675');

    p2p.stop();
  });
});
