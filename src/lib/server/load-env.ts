import { existsSync, readFileSync } from 'node:fs';

const ENV_FILES = ['.env', '.env.local'];

/**
 * Loads `.env` and `.env.local` into process.env for the Node server runtime.
 *
 * Bun automatically loads `.env.local` when running `bun run dev`, but the
 * Vinxi/SolidStart dev server actually executes under Node (Vite's SSR module
 * runner), which does NOT read dotenv files on its own. Without this loader,
 * process.env.SUPABASE_URL etc. are undefined on the server, so the app would
 * silently fall back to the in-memory local auth store and never touch Supabase.
 *
 * Already-set environment variables always win (deployment platforms such as
 * Vercel set real secrets in the environment, which must take precedence).
 */
let loaded = false;

export function parseDotenv(content: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const raw of content.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice('export '.length).trim();
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && value[0] === value[value.length - 1] && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  }
  return entries;
}

export function loadEnvFiles(): void {
  if (loaded) return;
  loaded = true;

  const root = process.cwd();
  for (const file of ENV_FILES) {
    const path = `${root}/${file}`;
    if (!existsSync(path)) continue;
    try {
      const loadEnvFile = (process as { loadEnvFile?: (path: string) => void }).loadEnvFile;
      if (typeof loadEnvFile === 'function') {
        loadEnvFile(path);
      } else {
        for (const [key, value] of parseDotenv(readFileSync(path, 'utf8'))) {
          if (process.env[key] === undefined) process.env[key] = value;
        }
      }
    } catch {
      // Ignore unreadable env files; real variables are already in process.env.
    }
  }
}