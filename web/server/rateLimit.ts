/** In-memory fixed-window limiter. Per serverless instance, as documented in SECURITY.md. */
interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface Limit {
    allowed: boolean;
    retryAfter: number;
}

export function take(key: string, limit: number, now = Date.now(), windowMs = 60_000): Limit {
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfter: 0 };
    }
    if (bucket.count >= limit) {
        return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    bucket.count += 1;
    return { allowed: true, retryAfter: 0 };
}

/** Tests only: drop every window so one file can exercise more than the production limit. */
export function resetRateLimits(): void {
    buckets.clear();
}
