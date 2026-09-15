import { json } from '@solidjs/router';
import { resolveDmContext, badRequestResponse } from '../../../lib/server/dm-context';
import type { GifFavorite } from '../../../lib/dm/types';

const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 256;

function toFavorite(row: any): GifFavorite {
  return {
    id: row.id,
    gifId: row.gifId ?? row.gif_id,
    url: row.url,
    preview: row.preview ?? '',
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    title: row.title ?? '',
    provider: row.provider ?? 'giphy',
    createdAt: row.createdAt ?? row.created_at
  };
}

export async function GET(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const { data, error } = await ctx.supabase
    .from('gif_favorites')
    .select('*')
    .eq('user_id', ctx.session.userId)
    .order('created_at', { ascending: false });

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  const favorites: GifFavorite[] = (Array.isArray(data) ? data : []).map(toFavorite);
  return json({ success: true, favorites });
}

export async function POST(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const gifId = typeof body?.gifId === 'string' ? body.gifId.trim().slice(0, 512) : '';
  const url = typeof body?.url === 'string' ? body.url.trim().slice(0, MAX_URL_LENGTH) : '';
  if (!gifId || !url) {
    return badRequestResponse('gifId and url are required');
  }
  if (!/^https?:\/\//i.test(url)) {
    return badRequestResponse('url must be an absolute http(s) URL');
  }

  const preview = typeof body?.preview === 'string' ? body.preview.trim().slice(0, MAX_URL_LENGTH) || url : url;
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : '';
  const width = Number.isFinite(Number(body?.width)) ? Math.max(0, Math.floor(Number(body.width))) : 0;
  const height = Number.isFinite(Number(body?.height)) ? Math.max(0, Math.floor(Number(body.height))) : 0;
  const provider = typeof body?.provider === 'string' && body.provider ? body.provider.slice(0, 32) : 'giphy';

  const { data, error } = await ctx.supabase
    .from('gif_favorites')
    .upsert(
      { user_id: ctx.session.userId, gif_id: gifId, url, preview, width, height, title, provider },
      { onConflict: 'user_id,gif_id', ignoreDuplicates: false }
    )
    .select('*')
    .single();

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  return json({ success: true, favorite: toFavorite(data) }, { status: 200 });
}

export async function DELETE(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const gifId = typeof body?.gifId === 'string' ? body.gifId.trim() : '';
  if (!gifId) {
    return badRequestResponse('gifId is required');
  }

  const { error } = await ctx.supabase
    .from('gif_favorites')
    .delete()
    .eq('user_id', ctx.session.userId)
    .eq('gif_id', gifId);

  if (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }

  return json({ success: true });
}