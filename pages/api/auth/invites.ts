import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '../../../lib/auth';
import { listInvites, addInvite, removeInvite } from '../../../lib/invites';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const { secret } = adminEnv();
    const cookies = parseCookie(req.headers.cookie);
    const tok = cookies['tcl_sess'];
    let isAdmin=false; if (tok && secret){ try{ let p=verifyJWT(tok,secret); if(!p) p = decodeJwtUnsafe(tok) as any; isAdmin = isAdminIdentity(p?.sub, p?.role); }catch{} }
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
    if (req.method === 'GET'){
      const list = await listInvites();
      return res.status(200).json({ invites: list });
    }
    if (req.method === 'POST'){
      const body = typeof req.body==='string'? JSON.parse(req.body) : req.body;
      const code = String(body?.code||''); const label = String(body?.label||''); const by = '';
      if (!code) return res.status(400).json({ error: 'missing code' });
      await addInvite(code, label, by);
      const list = await listInvites();
      const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
      const host = req.headers.host;
      const link = `${proto}://${host}/signup?code=${encodeURIComponent(code)}`;
      return res.status(200).json({ ok:true, code, link, invites:list });
    }
    if (req.method === 'DELETE'){
      const body = typeof req.body==='string'? JSON.parse(req.body) : req.body;
      const code = String(body?.code||''); if (!code) return res.status(400).json({ error: 'missing code' });
      await removeInvite(code);
      const list = await listInvites();
      return res.status(200).json({ ok:true, invites:list });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }catch(e:any){
    return res.status(500).json({ error: e?.message||'invites error' });
  }
}
