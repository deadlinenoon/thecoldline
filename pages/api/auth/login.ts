import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, isSecure, signJWT, verifyAdminPassword } from '@/lib/auth';
import { verifyUserPassword, findUserKV } from '@/lib/userstore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try{
    const { email, password } = (typeof req.body === 'object' ? req.body : {}) as { email?: string; password?: string };
    const env = adminEnv();
    // secret always present due to fallback in adminEnv
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    const em = String(email).trim().toLowerCase();
    let role: 'admin'|'user' = 'user';
    let ok = false;
    // 1) Try KV-backed users first (durable in production)
    try{
      const kv = await findUserKV(em);
      if (kv) {
        const crypto = await import('crypto');
        const h = crypto.createHash('sha256').update(kv.salt + String(password)).digest('hex');
        if (h === kv.hash) { ok = true; role = kv.role; }
      }
    }catch{}
    // 2) Fallback to local user store (dev/temp FS)
    if (!ok) {
      const u = verifyUserPassword(em, password);
      if (u) { ok = true; role = u.role; }
    }
    // 3) Env-configured admin fallback
    if (!ok) {
      const adminConfigured = !!(env.email && env.pwHash && env.salt);
      if (adminConfigured && em === env.email.trim().toLowerCase() && verifyAdminPassword(password)) { ok = true; role = 'admin'; }
    }
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signJWT({ sub: em, role }, env.secret);
    const secure = isSecure(req.headers as any);
    const maxAge = 60*60*24*7; // 7 days
    const expires = new Date(Date.now() + maxAge*1000).toUTCString();
    const cookie = [
      `tcl_sess=${token}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      `Max-Age=${maxAge}`,
      `Expires=${expires}`,
      secure ? 'Secure' : '',
    ].filter(Boolean).join('; ');
    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ ok: true, user: { email } });
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'login error' });
  }
}
