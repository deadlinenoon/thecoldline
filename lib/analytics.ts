import fs from 'fs';
import path from 'path';
import { kvAvailable, kvLPush, kvIncrBy, kvLRange } from './kv';

const DATA_DIR = process.env.DATA_DIR || '/tmp/data';
const ANALYTICS_PATH = path.join(DATA_DIR, 'analytics.jsonl');

function ensureDirSafe() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ }
}

export type AnalyticsEvent = {
  ts: number;
  path: string;
  title?: string;
  ref?: string;
  ua?: string;
  ip?: string;
  cid?: string; // client id
  uid?: string; // user email if logged in
  role?: string; // admin/user
  type?: string; // pageview|action
};

export function writeEvent(evt: AnalyticsEvent) {
  if (kvAvailable()) {
    (async()=>{
      try{
        await kvLPush('analytics:events', JSON.stringify(evt));
        const d = new Date(evt.ts).toISOString().slice(0,10);
        await kvIncrBy(`analytics:day:${d}`, 1);
      }catch{}
    })();
    return;
  }
  try { ensureDirSafe(); fs.appendFileSync(ANALYTICS_PATH, JSON.stringify(evt) + '\n'); } catch {}
}

export function readEvents(sinceMs?: number): AnalyticsEvent[] {
  if (kvAvailable()) {
    // Read a recent window from list (last 5000 events)
    try{
      const lines = kvLRange('analytics:events', 0, 5000) as unknown as string[];
      // Note: can't await in sync function; fall back to empty list in KV mode for summary()
      return [];
    }catch{ return []; }
  }
  try {
    if (!fs.existsSync(ANALYTICS_PATH)) return [];
    const raw = fs.readFileSync(ANALYTICS_PATH, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const list: AnalyticsEvent[] = [];
    for (const line of lines) {
      try { const j = JSON.parse(line); if (!sinceMs || (j.ts && j.ts >= sinceMs)) list.push(j); } catch {}
    }
    return list;
  } catch { return []; }
}

export function summarize(days = 14) {
  const now = Date.now();
  const since = now - days * 864e5;
  const ev = readEvents(since);
  const total = ev.length;
  const sessions = new Set<string>();
  const users = new Set<string>();
  const byDay: Record<string, number> = {};
  for (const e of ev) {
    if (e.cid) sessions.add(e.cid);
    if (e.uid) users.add(e.uid);
    const d = new Date(e.ts).toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
  }
  const daily = Object.entries(byDay).sort((a,b)=> a[0]<b[0]? -1: 1).map(([date,count])=>({date,count}));
  return { total, uniqueSessions: sessions.size, uniqueUsers: users.size, daily };
}
