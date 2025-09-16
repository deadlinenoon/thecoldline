/* eslint-disable @typescript-eslint/no-explicit-any */
export type KV = {
  get: (key: string) => Promise<string | number | null>;
  getNum: (key: string) => Promise<number>;
  setNX: (key: string, value: string, ttlSec?: number) => Promise<boolean>;
  del: (key: string) => Promise<number>;
  incr: (key: string, by?: number) => Promise<number>;
  incrBy: (key: string, by: number) => Promise<number>;
  hset: (key: string, obj: Record<string, string | number>) => Promise<number>;
  hgetall: (key: string) => Promise<Record<string, string>>;
  lpush: (key: string, ...values: string[]) => Promise<number>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
  sadd: (key: string, ...members: string[]) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
  srem: (key: string, ...members: string[]) => Promise<number>;
  zincrBy: (key: string, member: string, by?: number) => Promise<number>;
  ztop: (key: string, limit: number) => Promise<[string, number][]>;
};

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

async function real(): Promise<KV> {
  if (!url || !token) throw new Error("Upstash env missing");
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url, token });

  return {
    async get(key) { const v = await redis.get(key); return (v as any) ?? null; },
    async getNum(key) { const v = await redis.get<number>(key); return Number(v ?? 0); },
    async setNX(key, value, ttlSec) {
      const opts: any = ttlSec != null ? { nx: true, ex: ttlSec } : { nx: true };
      const res = await redis.set(key, value, opts); return res === "OK";
    },
    async del(key) { return await redis.del(key); },
    async incr(key, by = 1) { return await redis.incrby(key, by); },
    async incrBy(key, by) { return await redis.incrby(key, by); },

    async hset(key, obj) { return await redis.hset(key, obj as any); },
    async hgetall(key) { return (await redis.hgetall<Record<string, string>>(key)) ?? {}; },

    async lpush(key, ...values) { return await redis.lpush(key, ...values); },
    async lrange(key, start, stop) {
      const out = await (redis as any).lrange(key, start, stop) as string[] | null;
      return out ?? [];
    },

    async sadd(key, ...members) {
      const tuple = members as unknown as [string, ...string[]] | [];
      return tuple.length ? await (redis as any).sadd(key, ...tuple) : 0;
    },
    async smembers(key) {
      const out = await (redis as any).smembers(key) as string[] | null;
      return out ?? [];
    },
    async srem(key, ...members) {
      const tuple = members as unknown as [string, ...string[]] | [];
      return tuple.length ? await (redis as any).srem(key, ...tuple) : 0;
    },

    async zincrBy(key, member, by = 1) {
      const newScore = await (redis as any).zincrby(key, by, member);
      return Number(newScore ?? 0);
    },
    async ztop(key, limit) {
      const arr = await redis.zrange<(string|number)[]>(key, -limit, -1, { rev: true, withScores: true });
      const out: [string, number][] = [];
      for (let i = 0; i < arr.length; i += 2) out.push([String(arr[i]), Number(arr[i+1])]);
      return out;
    },
  };
}

function memory(): KV {
  const scalars = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const lists = new Map<string, string[]>();
  const sets = new Map<string, Set<string>>();
  const zsets = new Map<string, Map<string, number>>();
  const ztopLocal = (k: string, n: number): [string, number][] =>
    [...(zsets.get(k) ?? new Map()).entries()].sort((a,b)=>b[1]-a[1]).slice(0,n) as [string, number][];

  return {
    async get(k){ return scalars.has(k) ? (scalars.get(k) as any) : null; },
    async getNum(k){ return Number(scalars.get(k) ?? 0); },
    async setNX(k,v){ if (scalars.has(k)) return false; scalars.set(k,String(v)); return true; },
    async del(k){ return scalars.delete(k) ? 1 : 0; },
    async incr(k, by=1){ const n=Number(scalars.get(k) ?? 0)+by; scalars.set(k,String(n)); return n; },
    async incrBy(k, by){ const n=Number(scalars.get(k) ?? 0)+by; scalars.set(k,String(n)); return n; },
    async hset(k,o){ const m=hashes.get(k) ?? new Map(); hashes.set(k,m); for (const [f,v] of Object.entries(o)) m.set(f,String(v)); return m.size; },
    async hgetall(k){ const m=hashes.get(k) ?? new Map(); return Object.fromEntries(m.entries()); },

    async lpush(k,...v){ const a=lists.get(k) ?? []; lists.set(k,[...v,...a]); return lists.get(k)!.length; },
    async lrange(k,s,t){ const a=lists.get(k) ?? []; const N=(i:number)=>i<0?a.length+i:i; return a.slice(N(s), t===-1?undefined:N(t)+1); },

    async sadd(k,...m){ const s=sets.get(k) ?? new Set(); sets.set(k,s); let add=0; for (const x of m){ if(!s.has(x)){ s.add(x); add++; }} return add; },
    async smembers(k){ const s=sets.get(k) ?? new Set(); return [...s.values()]; },
    async srem(k,...m){ const s=sets.get(k) ?? new Set(); sets.set(k,s); let rem=0; for (const x of m){ if(s.delete(x)) rem++; } return rem; },

    async zincrBy(k,u,by=1){ const m=zsets.get(k) ?? new Map(); zsets.set(k,m); m.set(u,(m.get(u) ?? 0)+by); return m.get(u)!; },
    async ztop(k,n){ return ztopLocal(k,n); },
  };
}

export async function getKV(): Promise<KV> { try { return await real(); } catch { return memory(); } }
export function kvAvailable(){ return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN); }
export async function kvGet(k:string){ return (await getKV()).get(k); }
export async function kvSetNX(k:string,v:string,t?:number){ return (await getKV()).setNX(k,v,t); }
export async function kvDel(k:string){ return (await getKV()).del(k); }
export async function kvHSet(k:string,o:Record<string,string|number>){ return (await getKV()).hset(k,o); }
export async function kvHGetAll(k:string){ return (await getKV()).hgetall(k); }
export async function kvLPush(k:string,...v:string[]){ return (await getKV()).lpush(k,...v); }
export async function kvLRange(k:string,s:number,t:number){ return (await getKV()).lrange(k,s,t); }
export async function kvSAdd(k:string,...m:string[]){ return (await getKV()).sadd(k,...m); }
export async function kvSMembers(k:string){ return (await getKV()).smembers(k); }
export async function kvSRem(k:string,...m:string[]){ return (await getKV()).srem(k,...m); }
export async function kvIncr(k:string,by=1){ return (await getKV()).incr(k,by); }
export async function kvIncrBy(k:string,by:number){ return (await getKV()).incrBy(k,by); }
export async function kvZIncrBy(k:string,u:string,by=1){ return (await getKV()).zincrBy(k,u,by); }
