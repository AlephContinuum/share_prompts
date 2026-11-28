/**
 * Very small per-user rate limiter (sliding window, in memory).
 * Protects the AI bill from someone hammering the Run button.
 * Note: memory is per server instance, so on serverless hosting this is a soft limit.
 * A shared store (e.g. DynamoDB or Redis) would make it exact.
 */
const hits = new Map();

export const rateLimit = (key, { limit = 20, windowMs = 10 * 60 * 1000 } = {}) => {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
};
