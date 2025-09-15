type Entry = { ts: number; data: any };
const MAP = new Map<string, Entry>();
const DEFAULT_TTL = 15 * 60 * 1000;

export function getCache<T=any>(key: string, ttlMs: number = DEFAULT_TTL): T | null {
  const e = MAP.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > ttlMs) { MAP.delete(key); return null; }
  return e.data as T;
}

export function setCache(key: string, data: any){
  MAP.set(key, { ts: Date.now(), data });
}

