import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '../../../lib/auth';
import { recentWarns } from '../../../lib/logs';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const { secret } = adminEnv();
    const cookies = parseCookie(req.headers.cookie);
    const tok = cookies['tcl_sess'];
    let isAdmin = false;
    if (tok && secret){ let p=verifyJWT(tok, secret); if(!p) p=decodeJwtUnsafe(tok) as any; isAdmin = isAdminIdentity(p?.sub, p?.role); }
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
    const items = recentWarns(20);
    return res.status(200).json({ ok:true, items });
  }catch(e:any){ return res.status(200).json({ ok:false, items:[], error: e?.message||'logs error' }); }
}

