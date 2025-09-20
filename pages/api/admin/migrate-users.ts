import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '@/lib/auth';
import { kvAvailable, kvHSet, kvSAdd } from '@/lib/kv';
import { readUsers } from '@/lib/userstore';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    if (req.method !== 'POST') return res.status(405).json({ error:'method not allowed' });
    const { secret } = adminEnv();
    const cookies = parseCookie(req.headers.cookie);
    const tok = cookies['tcl_sess'];
    let ok=false; if (tok && secret){ let p=verifyJWT(tok, secret); if(!p) p=decodeJwtUnsafe(tok) as any; ok = isAdminIdentity(p?.sub, p?.role); }
    if (!ok) return res.status(403).json({ error:'forbidden' });
    if (!kvAvailable()) return res.status(400).json({ error:'kv not connected' });
    const local = readUsers();
    let migrated = 0;
    for (const u of local){
      try{
        await kvHSet(`user:${u.email.toLowerCase()}`, { email:u.email, salt:u.salt, hash:u.hash, role:u.role, createdAt:u.createdAt });
        await kvSAdd('users:index', u.email.toLowerCase());
        migrated++;
      }catch{}
    }
    return res.status(200).json({ ok:true, migrated, sourceCount: local.length });
  }catch(e:any){ return res.status(500).json({ error: e?.message||'migrate error' }); }
}
