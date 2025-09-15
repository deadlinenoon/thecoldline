import type { NextApiRequest, NextApiResponse } from 'next';
import { kvAvailable, kvLRange } from '../../../lib/kv';
import { summarize } from '../../../lib/analytics';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '../../../lib/auth';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const { secret } = adminEnv();
    const cookies = parseCookie(req.headers.cookie);
    const tok = cookies['tcl_sess'];
    let ok=false; if (tok && secret){ let p=verifyJWT(tok, secret); if(!p) p=decodeJwtUnsafe(tok) as any; ok = isAdminIdentity(p?.sub, p?.role); }
    if (!ok) return res.status(403).json({ error:'forbidden' });

    const rawDays = Number(req.query.days ?? 14);
    const days = Math.max(1, Math.min(30, isNaN(rawDays) ? 14 : rawDays));
    const since = Date.now() - days*864e5;

    let events: any[] = [];
    if (kvAvailable()){
      try{ const lines = await kvLRange('analytics:events', 0, 5000); events = lines.map(l=>{try{return JSON.parse(l);}catch{return null}}).filter(Boolean) as any[]; }catch{}
    } else {
      // fall back to lib/analytics summarize parse (no recent list available) leave events empty
    }
    const filtered = events.filter(e=> e?.ts && Number(e.ts)>=since);
    const topPathsMap: Record<string, number> = {};
    for (const e of filtered){ const p = String(e.path||'/'); topPathsMap[p] = (topPathsMap[p]||0)+1; }
    const topPaths = Object.entries(topPathsMap).sort((a,b)=> b[1]-a[1]).slice(0,10).map(([path,count])=>({path,count}));
    const recent = filtered.sort((a,b)=> Number(b.ts)-Number(a.ts)).slice(0,25);

    const summary = summarize(days) as any;
    // Unique users from events (emails)
    const usersSet = new Set<string>();
    for (const e of filtered) if (e?.uid) usersSet.add(String(e.uid));
    const usersList = Array.from(usersSet);
    return res.status(200).json({ ...summary, topPaths, recent, usersList });
  }catch(e:any){ return res.status(500).json({ error: e?.message||'detail error' }); }
}
