// In-memory rate limiter — resets on cold start (Vercel serverless).
// This is a best-effort control, not a hard guarantee.

interface BucketEntry {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, BucketEntry>();

/**
 * Returns true if the request should be allowed, false if rate-limited.
 * @param key      Identifier (e.g. IP address)
 * @param maxReqs  Maximum requests allowed per window
 * @param windowMs Window size in milliseconds
 */
export function checkRateLimit(key: string, maxReqs: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= maxReqs) return false;
  entry.count++;
  return true;
}
