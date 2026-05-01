type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private ttl: number;

  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000;
  }

  set<T>(key: string, value: T, ttlMs = this.ttl): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const cacheTtl = Number(process.env.CACHE_TTL_SECONDS) || 300;
const enableCache = process.env.ENABLE_CACHE !== "false";

export const appCache = enableCache ? new MemoryCache(cacheTtl) : null;

export function getCacheKey(...parts: string[]): string {
  return parts.join(":");
}

export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  if (!appCache) {
    return fetchFn();
  }

  const cached = appCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetchFn();
  appCache.set(key, value, ttlSeconds ? ttlSeconds * 1000 : undefined);
  return value;
}

export function invalidateCache(pattern: string | RegExp): void {
  appCache?.invalidatePattern(pattern);
}
