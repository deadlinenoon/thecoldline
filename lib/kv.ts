// lib/kv.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export type KV = {
  // scalars
  get: (key: string) => Promise<string | number | null>;
  getNum: (key: string) => Promise<number>;
  setNX: (key: string, value: string, ttlSec?: number) => Promise<boolean>;
  del: (key: string) => Promise<number>;
  incr: (key: string, by?: number) => Promise<number>;
  incrBy: (key: string, by: number) => Promise<number>;
  // hashes
  hset: (key: string, obj: Record<string, string | number>) => Promise<number>;
  hgetall: (key: string) => Promise<Record<string, string>>;
  // lists
  lpush: (key: string, ...values: string[]) => Promise<number>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
  // sets
  sadd: (key: string, ...members: string[]) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
  srem: (key: string, ...members: string[]) => Promise<number>;
  // sorted sets
  zincrBy: (key: string, member: string, by?: number) => Promise<number>;
  ztop: (key: string, limit: number) => Promise<[string, number][]>;
};

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// Lazy real client (prevents build-time env warnings)
async function real(): Promise<KV> {
  if (!url || !token) throw new Error("Upstash env missing");
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url, token });

  return {
    async get(key) {
      const v = await redis.get(key);
      return (v as any) ?? null;
    },
    async getNum(key) {
      const v = await redis.get<number>(key);
      return Number(v ?? 0);
    },
    async setNX(key, value, ttlSec) {
      if (ttlSec != null) {
        const res = await redis.set(key, value, { nx: true, ex: ttlSec as number } as any);
        return res === "OK";
      } else {
        const res = await redis.set(key, value, { nx: true } as any);
        return res === "OK";
      }
    },
    async del(key) {
      return await redis.del(key);
    },
    async incr(key, by = 1) {
      return await redis.incrby(key, by);
    },
    async incrBy(key, by) {
      return await redis.incrby(key, by);
    },
    async hset(key, obj) {
      return await redis.hset(key, obj as any);
    },
    async hgetall(key) {
      const o = await redis.hgetall<Record<string, string>>(key);
      return o ?? {};
    },
    async lpush(key: string, ...values: string[]) {
      return await (redis as any).lpush(key, ...values);
    },
    async lrange(key: string, start: number, stop: number) {
      const out = (await redis.lrange(key, start, stop)) as string[] | null;
      return out ?? [];
    },
    async sadd(key: string, ...members: string[]) {
      return await (redis as any).sadd(key, ...members);
    },
    async smembers(key: string) {
      const res = (await redis.smembers(key)) as string[] | null;
      return res ?? [];
    },
    async srem(key: string, ...members: string[]) {
      return await (redis as any).srem(key, ...members);
    },
    async zincrBy(key: string, member: string, by = 1) {
      const score = await redis.zincrby(key, by, member);
      return Number(score ?? 0);
    },
    async ztop(key: string, limit: number) {
      const arr = (await redis.zrange(key, -limit, -1, {
        rev: true,
        withScores: true,
      })) as (string | number)[];
      const out: [string, number][] = [];
      for (let i = 0; i < arr.length; i += 2) out.push([String(arr[i]), Number(arr[i + 1])]);
      return out;
    },
  };
}

// In-memory fallback
function memory(): KV {
  const scalars = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const lists = new Map<string, string[]>();
  const sets = new Map<string, Set<string>>();
  const zsets = new Map<string, Map<string, number>>();

  function ztopLocal(key: string, limit: number): [string, number][] {
    const m = zsets.get(key) ?? new Map();
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  }

  return {
    async get(k) { return scalars.has(k) ? (scalars.get(k) as any) : null; },
    async getNum(k) { return Number(scalars.get(k) ?? 0); },
    async setNX(k, v) { if (scalars.has(k)) return false; scalars.set(k, String(v)); return true; },
    async del(k) { return scalars.delete(k) ? 1 : 0; },
    async incr(k, by = 1) { const n = Number(scalars.get(k) ?? 0) + by; scalars.set(k, String(n)); return n; },
    async incrBy(k, by) { const n = Number(scalars.get(k) ?? 0) + by; scalars.set(k, String(n)); return n; },

    async hset(k, obj) {
      const m = hashes.get(k) ?? new Map<string, string>(); hashes.set(k, m);
      Object.entries(obj).forEach(([f,v]) => m.set(f, String(v)));
      return m.size;
    },
    async hgetall(k) {
      const m = hashes.get(k) ?? new Map<string, string>();
      return Object.fromEntries(m.entries());
    },

    async lpush(k, ...values) {
      const arr = lists.get(k) ?? []; lists.set(k, arr);
      lists.set(k, [...values, ...arr]); return lists.get(k)!.length;
    },
    async lrange(k, start, stop) {
      const arr = lists.get(k) ?? [];
      const norm = (i: number) => (i < 0 ? arr.length + i : i);
      return arr.slice(norm(start), stop === -1 ? undefined : norm(stop) + 1);
    },

    async sadd(k, ...members) {
      const s = sets.get(k) ?? new Set<string>(); sets.set(k, s);
      let added = 0; for (const m of members) { if (!s.has(m)) { s.add(m); added++; } }
      return added;
    },
    async smembers(k) {
      const s = sets.get(k) ?? new Set<string>(); return [...s.values()];
    },
    async srem(k, ...members) {
      const s = sets.get(k) ?? new Set<string>(); sets.set(k, s);
      let removed = 0; for (const m of members) { if (s.delete(m)) removed++; }
      return removed;
    },

    async zincrBy(k, member, by = 1) {
      const m = zsets.get(k) ?? new Map<string, number>(); zsets.set(k, m);
      m.set(member, (m.get(member) ?? 0) + by);
      return m.get(member)!;
    },
    async ztop(k, limit) { return ztopLocal(k, limit); },
  };
}

// Entry point
export async function getKV(): Promise<KV> {
  try { return await real(); } catch { return memory(); }
}

// --- Back-compat helpers: keep old imports compiling, all delegate to KV ---
export function kvAvailable(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
export async function kvGet(key: string) { return (await getKV()).get(key); }
export async function kvSetNX(key: string, value: string, ttlSec?: number) { return (await getKV()).setNX(key, value, ttlSec); }
export async function kvDel(key: string) { return (await getKV()).del(key); }
export async function kvHSet(key: string, obj: Record<string, string | number>) { return (await getKV()).hset(key, obj); }
export async function kvHGetAll(key: string) { return (await getKV()).hgetall(key); }
export async function kvLPush(key: string, ...values: string[]) { return (await getKV()).lpush(key, ...values); }
export async function kvLRange(key: string, start: number, stop: number) { return (await getKV()).lrange(key, start, stop); }
export async function kvSAdd(key: string, ...members: string[]) { return (await getKV()).sadd(key, ...members); }
export async function kvSMembers(key: string) { return (await getKV()).smembers(key); }
export async function kvSRem(key: string, ...members: string[]) { return (await getKV()).srem(key, ...members); }
export async function kvIncr(key: string, by = 1) { return (await getKV()).incr(key, by); }
export async function kvIncrBy(key: string, by: number) { return (await getKV()).incrBy(key, by); }
export async function kvZIncrBy(key: string, member: string, by = 1) { return (await getKV()).zincrBy(key, member, by); }
