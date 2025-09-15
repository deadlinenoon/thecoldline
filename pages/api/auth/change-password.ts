import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT, isAdminIdentity } from '../../../lib/auth';
import { readUsers, writeUsers, findUser } from '../../../lib/userstore';
import { kvAvailable, kvHGetAll, kvHSet } from '../../../lib/kv';
import crypto from 'crypto';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try{
    const { secret, email: adminEmail } = adminEnv();
    const cookies = parseCookie(req.headers.cookie);
    const tok = cookies['tcl_sess']; if (!tok) return res.status(401).json({ error: 'unauthorized' });
    const payload = verifyJWT(tok, secret); if (!payload) return res.status(401).json({ error: 'unauthorized' });
    const { oldPassword, newPassword } = (typeof req.body==='object'? req.body : {}) as { oldPassword?:string; newPassword?:string };
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Missing old/new password' });
    const email = payload.sub;
    // Try KV first
    let u: any = null; let i = -1; const users = readUsers();
    if (kvAvailable()) {
      try{ const h = await kvHGetAll(`user:${email.toLowerCase()}`); if (h && h.email) u = { email: h.email, salt: h.salt, hash: h.hash, role: (h.role as any)||'user', createdAt: h.createdAt }; }catch{}
    }
    if (!u) { i = users.findIndex(uu => uu.email.toLowerCase() === email.toLowerCase()); u = i>=0? users[i]: undefined; }
    // If admin user not in store yet, allow transition from env-based admin by verifying oldPassword via env
    if (!u && isAdminIdentity(email, 'admin')) {
      // verify against env admin
      const envOk = !!process.env.ADMIN_SALT && !!(process.env.ADMIN_PWHASH || process.env.ADMIN_PASSWORD);
      if (!envOk) return res.status(401).json({ error: 'Admin credentials not configured' });
      // best-effort verify using env path
      const salt = process.env.ADMIN_SALT as string;
      const pwHash = process.env.ADMIN_PWHASH || crypto.createHash('sha256').update(salt + String(process.env.ADMIN_PASSWORD||'')).digest('hex');
      const candidate = crypto.createHash('sha256').update(salt + oldPassword).digest('hex');
      if (pwHash !== candidate) return res.status(401).json({ error: 'Incorrect old password' });
      // create admin user in store (KV preferred)
      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = crypto.createHash('sha256').update(newSalt + newPassword).digest('hex');
      if (kvAvailable()) { try{ await kvHSet(`user:${email.toLowerCase()}`, { email, salt:newSalt, hash:newHash, role:'admin', createdAt: new Date().toISOString() }); return res.status(200).json({ ok:true }); }catch{} }
      const adminUser = { email, salt: newSalt, hash: newHash, role: 'admin' as const, createdAt: new Date().toISOString() };
      users.push(adminUser); writeUsers(users);
      return res.status(200).json({ ok: true });
    }

    if (!u) {
      // Friendly migration: create a durable record for logged-in user with the new password
      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = crypto.createHash('sha256').update(newSalt + newPassword).digest('hex');
      if (kvAvailable()) { try{ await kvHSet(`user:${email.toLowerCase()}`, { email, salt:newSalt, hash:newHash, role:'user', createdAt: new Date().toISOString() }); return res.status(200).json({ ok:true }); }catch{} }
      const created = { email, salt:newSalt, hash:newHash, role: 'user' as const, createdAt: new Date().toISOString() };
      users.push(created); writeUsers(users);
      return res.status(200).json({ ok:true });
    }

    // Verify old password against stored record
    const oldHash = crypto.createHash('sha256').update(u.salt + oldPassword).digest('hex');
    const oldOk = crypto.timingSafeEqual(Buffer.from(oldHash), Buffer.from(u.hash));
    if (!oldOk) return res.status(401).json({ error: 'Incorrect old password' });
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = crypto.createHash('sha256').update(newSalt + newPassword).digest('hex');
    if (kvAvailable()) { try{ await kvHSet(`user:${email.toLowerCase()}`, { salt:newSalt, hash:newHash }); return res.status(200).json({ ok:true }); }catch{} }
    users[i] = { ...u, salt: newSalt, hash: newHash };
    writeUsers(users);
    return res.status(200).json({ ok: true });
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'change password error' });
  }
}
