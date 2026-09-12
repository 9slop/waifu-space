import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NullEngine, Scene } from '@babylonjs/core';
import { StrikeP2PManager } from '../../src/lib/strike/strike-p2p';
import { StrikeBabylonEngine } from '../../src/lib/strike/strike-babylon-engine';

describe('StrikeP2PManager Remote State Handling', () => {
  let nullEngine: NullEngine;
  let scene: Scene;
  let mockEngine: any;
  let p2p: StrikeP2PManager;

  beforeEach(() => {
    nullEngine = new NullEngine();
    scene = new Scene(nullEngine);
    mockEngine = {
      scene,
      isDisposed: false,
      remoteAvatars: new Map(),
      mapData: null,
      camera: {
        position: { x: 0, y: 1.62, z: 0 },
        rotation: { y: 0 }
      }
    };
    p2p = new StrikeP2PManager(mockEngine as unknown as StrikeBabylonEngine, {
      onScoreboardUpdate: () => {},
      onKillfeedEntry: () => {},
      onMedalAnnouncement: () => {},
      onConnectionStatus: () => {},
      onChatMessage: () => {}
    });
  });

  afterEach(() => {
    p2p.stop();
    scene.dispose();
    nullEngine.dispose();
  });

  it('safely handles remote state without ReferenceError when hp or weaponId are missing or varied', () => {
    const mockWrapper: any = {
      peerId: 'peer_123',
      name: 'Rival',
      state: null,
      lastPacketTime: 0,
      iceCandidatesQueue: []
    };

    // Case 1: missing health and weaponId entirely
    expect(() => {
      (p2p as any).handleRemoteState(mockWrapper, {
        x: 10,
        y: 1.62,
        z: -5,
        seq: 1
      });
    }).not.toThrow();

    expect(mockWrapper.state).toBeDefined();
    expect(mockWrapper.state.health).toBe(150);
    expect(mockWrapper.state.weaponId).toBe('rifle');

    // Case 2: health passed as hp instead of health
    expect(() => {
      (p2p as any).handleRemoteState(mockWrapper, {
        x: 12,
        y: 1.62,
        z: -6,
        seq: 2,
        hp: 75,
        weaponId: 'sniper'
      });
    }).not.toThrow();

    expect(mockWrapper.state.health).toBe(75);
    expect(mockWrapper.state.weaponId).toBe('sniper');

    // Case 3: health clamped properly between 0 and 150
    (p2p as any).handleRemoteState(mockWrapper, {
      x: 12,
      y: 1.62,
      z: -6,
      seq: 3,
      health: 999,
      weaponId: 'invalid_gun'
    });
    expect(mockWrapper.state.health).toBe(150);
    expect(mockWrapper.state.weaponId).toBe('rifle');
  });

  it('deduplicates incoming WebSocket state packets when WebRTC DataChannel is active', () => {
    const peerId = 'peer_p2p_active';
    const wrapper = (p2p as any).getOrCreatePeerWrapper(peerId, 'P2PRival');
    wrapper.dc = { readyState: 'open' };
    wrapper.state = {
      peerId,
      name: 'P2PRival',
      x: 5,
      y: 1.62,
      z: 5,
      yaw: 0,
      pitch: 0,
      animState: 0,
      health: 150,
      weaponId: 'rifle',
      kills: 0,
      deaths: 0,
      headshots: 0,
      streak: 0,
      seq: 10,
      timestamp: Date.now()
    };

    // An incoming slower WebSocket broadcast arrives with stale coordinates
    (p2p as any).handleIncomingPlayerState({
      peerId,
      name: 'P2PRival',
      x: 0,
      y: 1.62,
      z: 0,
      seq: 9
    });

    // Wrapper state should not have been overwritten by stale WebSocket packet
    expect(wrapper.state.x).toBe(5);
    expect(wrapper.state.z).toBe(5);
  });
});
