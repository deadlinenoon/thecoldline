import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT } from '@/lib/auth';

function parseCookie(h: string|undefined) {
  const out: Record<string,string> = {};
  if (!h) return out;
  for (const part of h.split(';')){
    const [k,...rest] = part.trim().split('=');
    if (!k) continue; out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try{
    const { secret } = adminEnv();
    const cookies = parseCookie(req.headers.cookie);
    const tok = cookies['tcl_sess'];
    if (!tok) return res.status(401).json({ error: 'unauthorized' });
    const payload = verifyJWT(tok, secret);
    if (!payload) return res.status(401).json({ error: 'unauthorized' });
    return res.status(200).json({ email: payload.sub, role: payload.role });
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'me error' });
  }
}
