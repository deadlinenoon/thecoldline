import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '@/lib/auth';
import { readUsersKV } from '@/lib/userstore';
import { kvAvailable, kvLRange } from '@/lib/kv';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try{
    const { secret } = adminEnv();
    const cookies = parseCookie(req.headers.cookie);
    const tok = cookies['tcl_sess'];
    let isAdmin=false;
    if ((tok ? true : false) && (secret ? true : false)){
      try{
        let p = verifyJWT(tok as string, secret as string);
        if (!p) p = decodeJwtUnsafe(tok as string) as any;
        isAdmin = isAdminIdentity(p?.sub, p?.role);
      }catch{}
    }
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    let list = await readUsersKV();
    // Fallback: derive unique emails from analytics events if store appears empty
    if ((!list || list.length===0) && kvAvailable()){
      try{
        const lines = await kvLRange('analytics:events', 0, 5000);
        const seen = new Set<string>();
        const derived: any[] = [];
        for (const line of lines){
          try{ const j = JSON.parse(line as any); const e = String(j?.uid||'').trim().toLowerCase(); if(e && !seen.has(e)){ seen.add(e); derived.push({ email:e, role:'user', createdAt: undefined }); } }catch{}
        }
        if (derived.length) list = derived as any;
      }catch{}
    }
    const users = (list||[]).map((u:any) => ({ email: u.email, role: u.role, createdAt: u.createdAt }));
    return res.status(200).json({ users });
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'users error' });
  }
}
