import { json } from '@solidjs/router';
import { resolveDmContext, badRequestResponse, sanitizeSearchQuery } from '../../../lib/server/dm-context';
import { loadEnvFiles } from '../../../lib/server/load-env';

loadEnvFiles();

interface GifItem {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
  title?: string;
}

export async function GET(event: { request: Request }) {
  const ctx = resolveDmContext(event.request);
  if (ctx instanceof Response) return ctx;

  const url = new URL(event.request.url);
  const query = sanitizeSearchQuery(url.searchParams.get('q'));
  const limit = Math.min(24, Math.max(1, Number(url.searchParams.get('limit') || 12)));

  if (query.length < 1) {
    return badRequestResponse('Search query is required');
  }

  const giphyKey = process.env.GIPHY_API_KEY;
  const tenorKey = process.env.TENOR_API_KEY;

  // GIPHY is preferred (it is the default provider for this UI).
  if (giphyKey) {
    const giphyUrl = new URL('https://api.giphy.com/v1/gifs/search');
    giphyUrl.searchParams.set('q', query);
    giphyUrl.searchParams.set('api_key', giphyKey);
    giphyUrl.searchParams.set('limit', String(limit));
    giphyUrl.searchParams.set('rating', 'pg-13');

    try {
      const res = await fetch(giphyUrl.toString());
      if (!res.ok) {
        return json({ success: false, error: 'GIF search failed' }, { status: 502 });
      }
      const body = await res.json();
      const items: GifItem[] = (Array.isArray(body?.data) ? body.data : [])
        .map((g: any) => {
          const url = g?.images?.original?.url as string | undefined;
          const preview = (g?.images?.fixed_width?.url as string | undefined) || url;
          if (!url) return null;
          return {
            id: String(g?.id ?? Math.random()),
            url,
            preview,
            width: Number(g?.images?.original?.width ?? 200),
            height: Number(g?.images?.original?.height ?? 200),
            title: typeof g?.title === 'string' ? g.title.slice(0, 256) : undefined
          };
        })
        .filter((i: GifItem | null): i is GifItem => i !== null);

      return json({ success: true, source: 'giphy', items });
    } catch {
      return json({ success: false, error: 'GIF search failed' }, { status: 502 });
    }
  }

  if (tenorKey) {
    const tenorUrl = new URL('https://tenor.com/v2/search');
    tenorUrl.searchParams.set('q', query);
    tenorUrl.searchParams.set('key', tenorKey);
    tenorUrl.searchParams.set('limit', String(limit));
    tenorUrl.searchParams.set('contentfilter', 'medium');
    tenorUrl.searchParams.set('media_filter', 'minimal');

    try {
      const res = await fetch(tenorUrl.toString());
      if (!res.ok) {
        return json({ success: false, error: 'GIF search failed' }, { status: 502 });
      }
      const body = await res.json();
      const items: GifItem[] = (Array.isArray(body?.results) ? body.results : [])
        .map((r: any) => {
          const formats = r?.media_formats || {};
          const gif = formats?.gif || {};
          const tiny = formats?.tinygif || {};
          const url = (gif?.url as string) || (tiny?.url as string) || '';
          const preview = (tiny?.url as string) || url;
          if (!url) return null;
          return {
            id: String(r?.id ?? Math.random()),
            url,
            preview,
            width: Number(gif?.dims?.[0] ?? tiny?.dims?.[0] ?? 200),
            height: Number(gif?.dims?.[1] ?? tiny?.dims?.[1] ?? 200)
          };
        })
        .filter((i: GifItem | null): i is GifItem => i !== null);

      return json({ success: true, source: 'tenor', items });
    } catch {
      return json({ success: false, error: 'GIF search failed' }, { status: 502 });
    }
  }

  // No provider key configured: return an empty result so the UI can surface
  // the "no results" state instead of silently failing.
  return json({ success: true, source: 'none', items: [], keyConfigured: Boolean(giphyKey || tenorKey) });
}