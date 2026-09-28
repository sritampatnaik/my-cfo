const buckets = new Map<string, number[]>();

// In-memory sliding window, so limits apply per server instance. Swap for a shared store (e.g. Redis)
// before running more than one instance.
export function rateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }) {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return { ok: false as const, retryAfterSeconds: Math.ceil((recent[0] + windowMs - now) / 1000) };
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 10_000) {
    for (const [bucketKey, timestamps] of buckets) {
      if (timestamps.every((timestamp) => now - timestamp >= windowMs)) buckets.delete(bucketKey);
    }
  }
  return { ok: true as const };
}

export function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
