// Minimal Vercel KV (Upstash REST) helper with graceful fallback
function kvUrl(){
  return (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ''
  );
}
function kvToken(){
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    ''
  );
}
export function kvAvailable(){
  return !!(kvUrl() && kvToken());
}

async function pipeline(cmds: (string|number)[][]){
  const url = kvUrl();
  const token = kvToken();
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' },
    body: JSON.stringify(cmds),
    // allow serverless keepalive
  } as any);
  const j = await res.json();
  if (!res.ok) throw new Error(`KV ${res.status}: ${JSON.stringify(j)}`);
  return j as any[];
}

export async function kvHGetAll(key: string): Promise<Record<string,string>|null> {
  if (!kvAvailable()) return null;
  const [r] = await pipeline([[ 'HGETALL', key ]]);
  // Upstash returns array of [field,value,...]
  const val = r?.result;
  if (!val) return null;
  if (Array.isArray(val)){
    const out: Record<string,string> = {};
    for (let i=0;i<val.length;i+=2){ out[String(val[i])] = String(val[i+1]); }
    return out;
  }
  if (typeof val === 'object') return val as Record<string,string>;
  return null;
}

export async function kvHSet(key: string, obj: Record<string, string|number>){
  if (!kvAvailable()) return;
  const args: (string|number)[] = [ 'HSET', key ];
  for (const [k,v] of Object.entries(obj)) { args.push(k, String(v)); }
  await pipeline([args]);
}

export async function kvSMembers(key: string): Promise<string[]>{
  if (!kvAvailable()) return [];
  const [r] = await pipeline([[ 'SMEMBERS', key ]]);
  return Array.isArray(r?.result) ? r.result.map((x:any)=> String(x)) : [];
}

export async function kvSAdd(key: string, member: string){ if (!kvAvailable()) return; await pipeline([[ 'SADD', key, member ]]); }
export async function kvSRem(key: string, member: string){ if (!kvAvailable()) return; await pipeline([[ 'SREM', key, member ]]); }

export async function kvLPush(key: string, value: string){ if (!kvAvailable()) return; await pipeline([[ 'LPUSH', key, value ]]); }
export async function kvLRange(key: string, start: number, stop: number): Promise<string[]>{
  if (!kvAvailable()) return [];
  const [r] = await pipeline([[ 'LRANGE', key, start, stop ]]);
  return Array.isArray(r?.result) ? r.result.map((x:any)=> String(x)) : [];
}

export async function kvIncrBy(key: string, n: number){ if (!kvAvailable()) return; await pipeline([[ 'INCRBY', key, n ]]); }
export async function kvIncr(key: string): Promise<number> {
  if (!kvAvailable()) return 0 as any;
  const [r] = await pipeline([[ 'INCR', key ]]);
  return Number(r?.result || 0);
}

export async function kvGet(key: string): Promise<string|null> {
  if (!kvAvailable()) return null;
  const [r] = await pipeline([[ 'GET', key ]]);
  return (r?.result==null) ? null : String(r.result);
}

export async function kvDel(key: string){ if (!kvAvailable()) return; await pipeline([[ 'DEL', key ]]); }

// Minimal get/set client for simple string keys via Upstash REST
// memory fallback (dev only)
const __memCounters = new Map<string, number>();
const __memZ = new Map<string, Map<string, number>>();

export function getKV(){
  return {
    // existing minimal API
    get: async (key: string): Promise<string|null> => {
      if (!kvAvailable()) return (__memCounters.has(key) ? String(__memCounters.get(key)) : null);
      const [r] = await pipeline([[ 'GET', key ]]);
      return (r?.result==null) ? null : String(r.result);
    },
    set: async (key: string, value: string, ttlSec?: number): Promise<void> => {
      if (!kvAvailable()) { __memCounters.set(key, Number(value)||0); return; }
      const args: any[] = ['SET', key, value]; if (typeof ttlSec==='number' && ttlSec>0){ args.push('EX', ttlSec); } await pipeline([args]);
    },
    setnx: async (key: string, value: string, ttlSec?: number): Promise<boolean> => {
      if (!kvAvailable()) { if(!__memCounters.has(key)){ __memCounters.set(key, Number(value)||0); return true as any; } return false as any; }
      const args: any[] = ['SET', key, value, 'NX']; if (typeof ttlSec==='number' && ttlSec>0){ args.push('EX', ttlSec); }
      const [r] = await pipeline([args]);
      return r?.result === 'OK';
    },
    // analytics helpers
    incr: async (key: string, by = 1): Promise<number> => {
      if (!kvAvailable()) { const v = (__memCounters.get(key)||0)+by; __memCounters.set(key, v); return v; }
      const [r] = await pipeline([[ 'INCRBY', key, by ]]);
      return Number(r?.result||0);
    },
    zincr: async (key: string, member: string, by = 1): Promise<number> => {
      if (!kvAvailable()) {
        const m = __memZ.get(key) || new Map<string, number>();
        __memZ.set(key, m);
        const v = (m.get(member)||0)+by; m.set(member, v); return v;
      }
      const [r] = await pipeline([[ 'ZINCRBY', key, by, member ]]);
      return Number(r?.result||0);
    },
    ztop: async (key: string, limit: number): Promise<[string, number][]> => {
      if (!kvAvailable()) {
        const m = __memZ.get(key) || new Map<string, number>();
        return [...m.entries()].sort((a,b)=> b[1]-a[1]).slice(0, limit);
      }
      const [r] = await pipeline([[ 'ZREVRANGE', key, 0, Math.max(0, limit-1), 'WITHSCORES' ]]);
      const arr: [string, number][] = [];
      const res = r?.result || [];
      for (let i=0;i<res.length;i+=2){ arr.push([ String(res[i]), Number(res[i+1]) ]); }
      return arr;
    },
    getNum: async (key: string): Promise<number> => {
      if (!kvAvailable()) return Number(__memCounters.get(key)||0);
      const [r] = await pipeline([[ 'GET', key ]]);
      return Number(r?.result||0);
    },
    mget: async (keys: string[]): Promise<Record<string, number>> => {
      const out: Record<string, number> = {};
      if (!kvAvailable()) {
        for (const k of keys) out[k] = Number(__memCounters.get(k) || 0);
        return out;
      }
      const [r] = await pipeline([[ 'MGET', ...keys ] as any]);
      const vals = Array.isArray(r?.result) ? r.result : [];
      for (let i=0;i<keys.length;i++) out[keys[i]] = Number(vals[i] || 0);
      return out;
    }
  } as any;
}

export async function safeKV(){
  try{ return kvAvailable()? getKV() : null; }catch{ return null; }
}

export async function kvSetNX(key: string, value: string, ttlSec?: number): Promise<boolean> {
  if (!kvAvailable()) return false as any;
  const args: any[] = ['SET', key, value, 'NX']; if (typeof ttlSec==='number' && ttlSec>0){ args.push('EX', ttlSec); }
  const [r] = await pipeline([args]);
  return r?.result === 'OK';
}
