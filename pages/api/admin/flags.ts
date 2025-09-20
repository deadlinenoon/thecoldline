import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '@/lib/auth';
import { getFlag, setFlag } from '@/lib/flags';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const { secret } = adminEnv();
  const cookies = parseCookie(req.headers.cookie);
  const tok = cookies['tcl_sess'];
  let ok=false; if (tok && secret){ let p=verifyJWT(tok, secret); if(!p) p=decodeJwtUnsafe(tok) as any; ok = isAdminIdentity(p?.sub, p?.role); }
  if (!ok) return res.status(403).json({ error:'forbidden' });
  if (req.method==='GET'){
    const aiFallback = await getFlag('aiFallback', true);
    const consensusDerivedOnly = await getFlag('consensusDerivedOnly', false);
    return res.status(200).json({ aiFallback, consensusDerivedOnly });
  } else if (req.method==='POST'){
    const body = (req.body as any) || {};
    if (body.aiFallback!=null){ await setFlag('aiFallback', !!body.aiFallback); }
    if (body.consensusDerivedOnly!=null){ await setFlag('consensusDerivedOnly', !!body.consensusDerivedOnly); }
    return res.status(200).json({ ok:true });
  }
  return res.status(405).json({ error:'method not allowed' });
}
