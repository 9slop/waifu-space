import { json } from '@solidjs/router';
import { getSessionTokenFromRequest, verifySessionToken } from '../../../lib/server/auth';
import { getSupabaseServerClient, isSupabaseConfigured } from '../../../lib/server/supabase';

export async function POST(event: { request: Request }) {
  const token = getSessionTokenFromRequest(event.request);
  const session = verifySessionToken(token);

  if (!session) {
    return json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = event.request.headers.get('content-type') || '';
    let imageBuffer: Buffer;
    let mimeType = 'image/webp';

    if (contentType.includes('multipart/form-data')) {
      const formData = await event.request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return json({ success: false, error: 'No image file provided' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      mimeType = file.type || 'image/webp';
    } else {
      const body = await event.request.json();
      const dataUrl = body?.dataUrl || body?.image;
      if (!dataUrl || typeof dataUrl !== 'string') {
        return json({ success: false, error: 'Missing image dataUrl' }, { status: 400 });
      }

      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return json({ success: false, error: 'Invalid data URL format' }, { status: 400 });
      }
      mimeType = match[1];
      imageBuffer = Buffer.from(match[2], 'base64');
    }

    // Enforce 2MB size limit on compressed uploads
    if (imageBuffer.length > 2 * 1024 * 1024) {
      return json({ success: false, error: 'Avatar image too large (max 2MB)' }, { status: 400 });
    }

    const fileExt = mimeType.includes('png') ? 'png' : mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'webp';
    const filePath = `${session.userId}/avatar-${Date.now()}.${fileExt}`;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseServerClient()!;
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, imageBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadErr) {
        return json({ success: false, error: uploadErr.message }, { status: 500 });
      }

      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = `${publicData.publicUrl}?t=${Date.now()}`;

      // Automatically update profile row with newly uploaded avatar URL
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', session.userId);

      if (profileErr) {
        console.warn('Failed to update avatar_url in profiles:', profileErr.message);
      }

      return json({ success: true, avatarUrl, filePath });
    }

    // Offline / demo mode fallback: return data URL as valid mock URL
    const base64Fallback = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    return json({ success: true, avatarUrl: base64Fallback });
  } catch (err: any) {
    return json({ success: false, error: err.message || 'Avatar upload failed' }, { status: 500 });
  }
}
