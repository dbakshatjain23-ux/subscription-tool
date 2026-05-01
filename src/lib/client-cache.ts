"use client";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

function readStorage<T>(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    memoryCache.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, entry: CacheEntry<T>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Session storage can be unavailable in strict browser modes. Memory cache still works.
  }
}

export function getClientCache<T>(key: string) {
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (cached) {
    if (Date.now() <= cached.expiresAt) {
      return cached.value;
    }
    memoryCache.delete(key);
  }

  return readStorage<T>(key);
}

export function setClientCache<T>(key: string, value: T, ttlMs = 60_000) {
  const entry = {
    value,
    expiresAt: Date.now() + ttlMs,
  };

  memoryCache.set(key, entry);
  writeStorage(key, entry);
}

export async function fetchWithClientCache<T>(key: string, fetcher: () => Promise<T>, ttlMs = 60_000) {
  const cached = getClientCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetcher();
  setClientCache(key, value, ttlMs);
  return value;
}

export function invalidateClientCache(key: string) {
  memoryCache.delete(key);
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}
