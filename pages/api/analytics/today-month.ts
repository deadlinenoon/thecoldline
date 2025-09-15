import type { NextApiRequest, NextApiResponse } from 'next';
import { kvAvailable, kvGet, kvLRange } from '../../../lib/kv';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '../../../lib/auth';
import { summarize } from '../../../lib/analytics';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

async function countFromKV(): Promise<{ today:number; month:number }>{
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth()+1).padStart(2,'0');
  const dd = String(today.getUTCDate()).padStart(2,'0');
  const todayKey = `${yyyy}-${mm}-${dd}`;
  let todayCount = 0;
  try{ const v = await kvGet(`analytics:day:${todayKey}`); todayCount = v==null? 0 : parseInt(v,10) || 0; }catch{}
  let monthCount = 0;
  try{
    const first = new Date(Date.UTC(yyyy, today.getUTCMonth(), 1));
    for(let d = new Date(first); d.getUTCMonth()===first.getUTCMonth() && d <= today; d = new Date(d.getTime()+864e5)){
      const key = d.toISOString().slice(0,10);
      const v = await kvGet(`analytics:day:${key}`);
      monthCount += v==null? 0 : (parseInt(v,10)||0);
    }
  }catch{}
  return { today: todayCount, month: monthCount };
}

async function countFromFiles(): Promise<{ today:number; month:number }>{
  const t = summarize(60); // 60d window
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth()+1).padStart(2,'0');
  const dd = String(now.getUTCDate()).padStart(2,'0');
  const todayKey = `${yyyy}-${mm}-${dd}`;
  let today=0, month=0;
  for(const d of t.daily){
    if (d.date===todayKey) today += d.count;
    if (d.date.startsWith(`${yyyy}-${mm}-`)) month += d.count;
  }
  return { today, month };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    // admin only
    const { secret } = adminEnv();
    const cookies = parseCookie(req.headers.cookie);
    const tok = cookies['tcl_sess'];
    let ok=false; if (tok && secret){ let p=verifyJWT(tok, secret); if(!p) p=decodeJwtUnsafe(tok) as any; ok = isAdminIdentity(p?.sub, p?.role); }
    if (!ok) return res.status(403).json({ error:'forbidden' });

    const out = kvAvailable() ? await countFromKV() : await countFromFiles();
    return res.status(200).json(out);
  }catch(e:any){ return res.status(500).json({ error:e?.message||'hits error' }); }
}

