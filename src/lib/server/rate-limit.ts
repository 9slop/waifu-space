// In-memory sliding window rate limiter for server endpoints
interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Checks if a given key (e.g. IP or user ID + action) has exceeded maxRequests in windowMs.
 * Returns { allowed: boolean, remaining: number, resetInMs: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Remove timestamps outside current window
  record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0];
    const resetInMs = Math.max(0, windowMs - (now - oldest));
    return { allowed: false, remaining: 0, resetInMs };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - record.timestamps.length,
    resetInMs: windowMs
  };
}

export function clearRateLimits() {
  rateLimitStore.clear();
}
