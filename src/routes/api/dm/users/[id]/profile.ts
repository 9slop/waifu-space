import { json } from '@solidjs/router';
import { resolveDmContext, isUuidLike } from '../../../../../lib/server/dm-context';
import type { DmUserProfile } from '../../../../../lib/dm/types';

export async function GET(event: { request: Request; params: Record<string, string> }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const userId = event.params.id;
  if (!isUuidLike(userId)) {
    return json({ success: false, error: 'Invalid user id' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc('get_user_profile_public', {
    p_user_id: userId
  });

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const p = data as any;
  const profile: DmUserProfile = {
    id: p.id,
    username: p.username,
    avatarUrl: p.avatarUrl ?? '',
    bio: p.bio ?? '',
    createdAt: p.createdAt,
    stats: {
      coins: Number(p.stats?.coins ?? 0),
      bondLevel: Number(p.stats?.bondLevel ?? 1),
      defenseHighWave: Number(p.stats?.defenseHighWave ?? 0),
      totalVictories: Number(p.stats?.totalVictories ?? 0),
      goblinsDefeated: Number(p.stats?.goblinsDefeated ?? 0)
    },
    waifu: {
      name: p.waifu?.name ?? 'Akari',
      personality: p.waifu?.personality ?? 'tsundere',
      appearance: {
        outfit: p.waifu?.appearance?.outfit ?? 'seifuku',
        accessory: p.waifu?.appearance?.accessory ?? 'ribbon',
        hairstyle: p.waifu?.appearance?.hairstyle ?? 'twintails',
        avatarFrame: p.waifu?.appearance?.avatarFrame ?? 'none',
        hairColor: p.waifu?.appearance?.hairColor ?? '#ff7597',
        eyeColor: p.waifu?.appearance?.eyeColor ?? '#4f86f7',
        skinTone: p.waifu?.appearance?.skinTone ?? '#fff1eb',
        avatarMode: p.waifu?.appearance?.avatarMode === 'custom' ? 'custom' : 'svg'
      }
    }
  };

  return json({ success: true, profile });
}