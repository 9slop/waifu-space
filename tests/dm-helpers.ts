import { state, setState, DEFAULT_STATE } from '../src/lib/store';
import { configureDmRuntime, resetDmStore, dmState } from '../src/lib/dm/store';

/** Reset dm + main stores back to a pristine logged-in state for each test. */
export function resetForDmTests() {
  resetDmStore();
  setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
  setState('user', { id: 'u-me', username: 'me', token: 'tok-me', avatarUrl: 'https://img/a.png' });
  configureDmRuntime({
    getAuth: () => {
      const u = state.user;
      return u?.token ? { token: u.token, id: u.id, username: u.username, avatarUrl: u.avatarUrl } : null;
    }
  });
}

/**
 * Installs a fetch stub that routes a URL containing each pattern to its
 * handler. Returns the restore function. Handlers may return a plain object
 * (wrapped in a 200 JSON response) or a Response/Tuple { body, status }.
 */
export type FetchHandler = (url: string, init: RequestInit) => unknown;

export function stubFetch(routes: Record<string, FetchHandler>): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        const result = handler(url, init ?? {});
        if (result instanceof Response) return Promise.resolve(result);
        const obj = result as any;
        const status = obj?.status ?? 200;
        const body = obj?.body !== undefined ? obj.body : obj;
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
    }
    return Promise.resolve(
      new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Lets all pending microtasks + timers run (fetch stub -> res.json() -> store). */
export function flush(times = 3): Promise<void> {
  let p: Promise<void> = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => new Promise((r) => setTimeout(r, 0)));
  return p;
}

export function resetState() {
  setState(JSON.parse(JSON.stringify(DEFAULT_STATE)));
}

export { dmState };