import { describe, it, expect, beforeEach } from 'vitest';
import {
  AVATAR_FRAME_CATALOG,
  getAvatarFrame,
  DEFAULT_AVATAR_FRAME_ID
} from '../../src/lib/avatar-frames';
import {
  state,
  setState,
  unlockCosmetic,
  isCosmeticUnlocked,
  getUnlockedCosmeticsCount,
  claimAffectionReward,
  COSMETIC_CATALOG,
  AFFECTION_MILESTONES,
  DEFAULT_RPG,
  DEFAULT_STATE
} from '../../src/lib/store';
import { sanitizeRawState } from '../../src/lib/validate';

describe('Avatar Frames (avatar-frames.ts)', () => {
  beforeEach(() => {
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  });

  it('catalog exposes exactly the 4 designed frames with rarities and icons', () => {
    const ids = AVATAR_FRAME_CATALOG.map(f => f.id);
    expect(ids).toEqual(['frame_sakura', 'frame_royal', 'frame_demon', 'frame_galaxy']);

    const byId = new Map(AVATAR_FRAME_CATALOG.map(f => [f.id, f]));
    expect(byId.get('frame_sakura')?.rarity).toBe('legendary');
    expect(byId.get('frame_royal')?.rarity).toBe('legendary');
    expect(byId.get('frame_demon')?.rarity).toBe('legendary');
    expect(byId.get('frame_galaxy')?.rarity).toBe('mystical');

    for (const frame of AVATAR_FRAME_CATALOG) {
      expect(frame.icon).toBeTruthy();
      expect(typeof frame.Portrait).toBe('function');
      expect(typeof frame.Overlay).toBe('function');
    }
  });

  it('getAvatarFrame resolves valid ids and returns null for none/unknown', () => {
    expect(getAvatarFrame('frame_sakura')?.id).toBe('frame_sakura');
    expect(getAvatarFrame('frame_galaxy')?.id).toBe('frame_galaxy');
    expect(getAvatarFrame(DEFAULT_AVATAR_FRAME_ID)).toBeNull();
    expect(getAvatarFrame('frame_bogus')).toBeNull();
    expect(getAvatarFrame()).toBeNull();
  });
});

describe('Avatar Frames in the RPG store (store.ts)', () => {
  beforeEach(() => {
    setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  });

  it('registers every frame in COSMETIC_CATALOG under the avatar_frame category', () => {
    const frames = COSMETIC_CATALOG.filter(c => c.category === 'avatar_frame');
    expect(frames).toHaveLength(AVATAR_FRAME_CATALOG.length);
    for (const f of AVATAR_FRAME_CATALOG) {
      const entry = COSMETIC_CATALOG.find(c => c.id === f.id);
      expect(entry?.category).toBe('avatar_frame');
      expect(entry?.rarity).toBe(f.rarity);
    }
  });

  it('defaults to no unlocked frames and no equipped frame', () => {
    expect(DEFAULT_RPG.unlockedAvatarFrames).toEqual([]);
    expect(DEFAULT_STATE.waifu.appearance.avatarFrame).toBe('none');
    expect(state.waifu.appearance.avatarFrame).toBe('none');
    expect(state.rpg.unlockedAvatarFrames).toEqual([]);
  });

  it('unlocks, counts and equips avatar frames via unlockCosmetic/isCosmeticUnlocked', () => {
    const countBefore = getUnlockedCosmeticsCount();
    unlockCosmetic('avatar_frames', 'frame_sakura');
    expect(state.rpg.unlockedAvatarFrames).toContain('frame_sakura');
    expect(isCosmeticUnlocked('avatar_frame', 'frame_sakura')).toBe(true);
    expect(isCosmeticUnlocked('avatar_frames', 'frame_sakura')).toBe(true);
    expect(isCosmeticUnlocked('avatar_frame', 'frame_demon')).toBe(false);
    expect(getUnlockedCosmeticsCount()).toBe(countBefore + 1);
  });

  it('grants frame rewards at milestones 18, 25 and 30', () => {
    expect(AFFECTION_MILESTONES.find(m => m.level === 18)?.rewardValue).toBe('frame_royal');
    expect(AFFECTION_MILESTONES.find(m => m.level === 25)?.rewardValue).toBe('frame_demon');
    expect(AFFECTION_MILESTONES.find(m => m.level === 30)?.rewardValue).toBe('frame_galaxy');
  });

  it('claims the Level 18 milestone and unlocks the royal frame', () => {
    setState('waifu', 'bondLevel', 18);
    const claimed = claimAffectionReward(18);
    expect(claimed).toBe(true);
    expect(state.rpg.unlockedAvatarFrames).toContain('frame_royal');
    expect(isCosmeticUnlocked('avatar_frame', 'frame_royal')).toBe(true);
  });

  it('refuses milestone claim when bond level is below the frame milestone', () => {
    setState('waifu', 'bondLevel', 17);
    const claimed = claimAffectionReward(18);
    expect(claimed).toBe(false);
    expect(state.rpg.unlockedAvatarFrames).not.toContain('frame_royal');
  });
});

describe('Avatar Frames validation (validate.ts)', () => {
  it('dedupes unlockedAvatarFrames and preserves the equipped avatarFrame string', () => {
    const out = sanitizeRawState({
      rpg: { unlockedAvatarFrames: ['frame_sakura', 'frame_sakura', 'frame_bogus'] },
      waifu: { appearance: { avatarFrame: 'frame_royal' } }
    }).data;
    expect(new Set(out.rpg?.unlockedAvatarFrames)).toEqual(new Set(['frame_sakura', 'frame_bogus']));
    expect(out.waifu?.appearance?.avatarFrame).toBe('frame_royal');
  });

  it('defaults missing avatarFrame to none', () => {
    const out = sanitizeRawState({
      waifu: { appearance: {} }
    }).data;
    expect(out.waifu?.appearance?.avatarFrame).toBe('none');
  });
});