import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '@/lib/auth';
import { readWhitelistKV, addWhitelistEmailKV, removeWhitelistEmailKV } from '@/lib/whitelist';
import { kvAvailable } from '@/lib/kv';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  if (!kvAvailable()) return res.status(500).json({ error: 'KV not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.' });
  if (req.method==='GET'){
    return res.status(200).json({ list: await readWhitelistKV() });
  } else if (req.method==='POST'){
    const email = String((req.body as any)?.email||'').trim().toLowerCase(); if(!email) return res.status(400).json({ error:'missing email' }); await addWhitelistEmailKV(email); return res.status(200).json({ ok:true });
  } else if (req.method==='DELETE'){
    const email = String((req.body as any)?.email||'').trim().toLowerCase(); if(!email) return res.status(400).json({ error:'missing email' }); await removeWhitelistEmailKV(email); return res.status(200).json({ ok:true });
  }
  return res.status(405).json({ error:'Method not allowed' });
}
