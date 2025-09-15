import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '../../../lib/auth';
import { deleteUser } from '../../../lib/userstore';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method!=='DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const { secret, email: adminEmail } = adminEnv();
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
  const email = String((req.body as any)?.email||'').trim().toLowerCase();
  if (!email) return res.status(400).json({ error:'missing email' });
  if (adminEmail && email===adminEmail.toLowerCase()) return res.status(400).json({ error:'cannot delete admin email' });
  await deleteUser(email);
  return res.status(200).json({ ok:true });
}
