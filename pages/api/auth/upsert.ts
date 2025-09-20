import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, isSecure, signJWT } from '@/lib/auth';
import { kvAvailable } from '@/lib/kv';
import { createUser, verifyUserPassword, findUser, findUserKV } from '@/lib/userstore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try{
    const { email, password, code } = (typeof req.body==='object'? req.body : {}) as { email?:string; password?:string; code?:string };
    if (!email || !password) return res.status(400).json({ error: 'Missing email/password' });
    const norm = (s:string)=> String(s||'').trim().toLowerCase();
    const em = norm(email);
    // 1) If user exists, login
    let role: 'admin'|'user' = 'user';
    let ok = false;
    let exists = false;
    try{ if (kvAvailable()){ const kv = await findUserKV(em); if (kv){ const crypto=await import('crypto'); const h=crypto.createHash('sha256').update(kv.salt+password).digest('hex'); if(h===kv.hash){ ok=true; role=kv.role; } } } }catch{}
    if (!ok){ const u=verifyUserPassword(em, password); if (u){ ok=true; role=u.role; } }
    // existence check (KV preferred, fall back to file)
    try{ if (kvAvailable()){ const kv = await findUserKV(em); if (kv) exists = true; } }catch{}
    if (!exists){ const f = findUser(em); if (f) { exists = true; role = f.role; } }
    const { secret } = adminEnv();
    if (ok){
      const token = signJWT({ sub: em, role }, secret);
      const maxAge = 60*60*24*7; const expires = new Date(Date.now() + maxAge*1000).toUTCString();
      const cookie = [`tcl_sess=${token}`,'HttpOnly','Path=/','SameSite=Lax',`Max-Age=${maxAge}`,`Expires=${expires}`,(isSecure(req.headers as any)?'Secure':'')].filter(Boolean).join('; ');
      res.setHeader('Set-Cookie', cookie);
      return res.status(200).json({ ok:true, user:{ email: em, role } });
    }
    // 2) Else create if code/whitelist allows
    const configured = process.env.INVITE_CODE || 'WINTER2025';
    const allowOpen = (process.env.INVITES_OPEN === '1') || (process.env.NODE_ENV!=='production');
    const whitelist = (process.env.WHITELIST || '').split(',').map(x=>x.trim().toLowerCase());
    const whitelisted = whitelist.includes(em);
    const valid = whitelisted || (code && norm(code)===norm(configured)) || allowOpen;
    // Do not reset passwords here; invite is for first-time signup only.
    if (!valid) return res.status(401).json({ error:'Invite required' });
    const user = await createUser(em, password, 'user');
    const token = signJWT({ sub: user.email, role: user.role }, secret);
    const maxAge = 60*60*24*7; const expires = new Date(Date.now() + maxAge*1000).toUTCString();
    const cookie = [`tcl_sess=${token}`,'HttpOnly','Path=/','SameSite=Lax',`Max-Age=${maxAge}`,`Expires=${expires}`,(isSecure(req.headers as any)?'Secure':'')].filter(Boolean).join('; ');
    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ ok:true, user:{ email: user.email, role: user.role } });
  }catch(e:any){ return res.status(500).json({ error: e?.message||'upsert error' }); }
}
