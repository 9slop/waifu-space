import { loadEnvFiles } from '../../../lib/server/load-env';

loadEnvFiles();

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '';

  return new Response(
    JSON.stringify({
      supabaseUrl,
      supabaseAnonKey,
      isConfigured: Boolean(supabaseUrl && supabaseAnonKey)
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
}
