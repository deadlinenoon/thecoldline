import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '../../../lib/auth';
function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try{
    const { secret, email: adminEmail } = adminEnv();
    const cookies = parseCookie(req.headers.cookie);
    const tok = cookies['tcl_sess'];
    if (!tok) return res.status(401).json({ error: 'unauthorized' });
    let payload = verifyJWT(tok, secret); if (!payload) payload = decodeJwtUnsafe(tok) as any; if (!payload) return res.status(401).json({ error: 'unauthorized' });
    const allowUsers = process.env.INVITES_ALLOW_USERS === '1' || process.env.INVITES_ALLOW_USERS === 'true';
    const isAdmin = isAdminIdentity(payload.sub, payload.role);
    if (!isAdmin && !allowUsers) return res.status(403).json({ error: 'forbidden' });
    const code = process.env.INVITE_CODE || 'WINTER2025';
    const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
    const host = req.headers.host;
    const link = `${proto}://${host}/signup?code=${encodeURIComponent(code)}`;
    return res.status(200).json({ code, link });
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'invite error' });
  }
}
