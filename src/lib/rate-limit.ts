import { ApiError } from '@/lib/api';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function consumeRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): void {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }
  if (current.count >= options.limit) {
    throw new ApiError(429, 'Too many attempts. Try again later.', 'RATE_LIMITED');
  }
  current.count += 1;

  if (buckets.size > 1_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
}
