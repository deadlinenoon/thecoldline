import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

export async function putJSON(key: string, value: unknown, ttlSeconds?: number) {
  const str = JSON.stringify(value);
  if (ttlSeconds && Number.isFinite(ttlSeconds)) {
    await redis.set(key, str, { ex: ttlSeconds as number });
  } else {
    await redis.set(key, str);
  }
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const str = await redis.get<string>(key);
  if (!str) return null;
  try { return JSON.parse(str) as T; } catch { return null; }
}

export async function setStamp(key: string) {
  await redis.set(key, JSON.stringify(new Date().toISOString()));
}
