import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, isSecure, signJWT } from '../../../lib/auth';
import { createUser, findUser } from '../../../lib/userstore';
import { findUserKV } from '../../../lib/userstore';
import { kvAvailable } from '../../../lib/kv';
import { listInvites, markInviteUsed } from '../../../lib/invites';
import { isWhitelisted } from '../../../lib/whitelist';
import { notifyNewUser } from '../../../lib/notify';
import { getKV } from '../../../lib/kv';
import { kSignups } from '../../../lib/analytics/keys';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try{
    const { email, password, code } = (typeof req.body === 'object' ? req.body : {}) as { email?: string; password?: string; code?: string };
    if (!email || !password || !code) return res.status(400).json({ error: 'Missing email, password, or invite code' });
    const em = String(email).trim().toLowerCase();
    const norm = (s:string)=> String(s||'').trim().toLowerCase();
    // Default to WINTER2025 when INVITE_CODE is not set so new deployments aren't blocked
    const configured = process.env.INVITE_CODE || 'WINTER2025';
    const allowDevFallback = (process.env.INVITES_OPEN === '1') || (process.env.NODE_ENV !== 'production');
    let valid = false;
    if (configured) {
      valid = norm(code) === norm(configured);
    } else if (allowDevFallback) {
      // Allow any non-empty code during development or when INVITES_OPEN=1
      valid = String(code||'').trim().length > 0;
    }
    // Check dynamic invite codes from KV
    if (!valid && kvAvailable()){
      try{
        const inv = await listInvites();
        if (inv.find(i=> String(i.code||'').toLowerCase() === norm(code))) valid = true;
      }catch{}
    }
    // Whitelist bypass
    if (!valid && isWhitelisted(em)) valid = true;
    if (!valid) return res.status(401).json({ error: 'Invalid invite code' });
    let exists = false; let role: 'admin'|'user' = 'user';
    let ok = false;
    try{ if (kvAvailable()){ const ex = await findUserKV(em); if (ex) { exists = true; role = ex.role; const crypto = await import('crypto'); const h = crypto.createHash('sha256').update(ex.salt + String(password)).digest('hex'); if (h === ex.hash) ok = true; } } }catch{}
    if (!exists){ const fileEx = findUser(em); if (fileEx) { exists = true; role = fileEx.role; const crypto = await import('crypto'); const h = crypto.createHash('sha256').update(fileEx.salt + String(password)).digest('hex'); if (h === fileEx.hash) ok = true; } }
    // If the user exists and provided the correct password, treat as login
    if (exists && ok){
      const { secret } = adminEnv();
      const token = signJWT({ sub: em, role }, secret);
      const secure = isSecure(req.headers as any);
      const maxAge = 60*60*24*7; const expires = new Date(Date.now() + maxAge*1000).toUTCString();
      const cookie = [`tcl_sess=${token}`,'HttpOnly','Path=/','SameSite=Lax',`Max-Age=${maxAge}`,`Expires=${expires}`, secure ? 'Secure' : ''].filter(Boolean).join('; ');
      res.setHeader('Set-Cookie', cookie);
      return res.status(200).json({ ok: true, user: { email: em, role } });
    }
    // If the user exists but password is wrong, allow password set when invite/whitelist is valid
    if (exists && !ok) {
      if (!valid) return res.status(409).json({ error: 'User already exists. Use password reset.' });
      // With a valid invite code or whitelist, set password and continue
      try{
        const { setUserPassword } = await import('../../../lib/userstore');
        await setUserPassword(em, password);
      }catch{}
      const { secret } = adminEnv();
      const token = signJWT({ sub: em, role: 'user' }, secret);
      const secure = isSecure(req.headers as any);
      const maxAge = 60*60*24*7; const expires = new Date(Date.now() + maxAge*1000).toUTCString();
      const cookie = [`tcl_sess=${token}`,'HttpOnly','Path=/','SameSite=Lax',`Max-Age=${maxAge}`,`Expires=${expires}`, secure ? 'Secure' : ''].filter(Boolean).join('; ');
      res.setHeader('Set-Cookie', cookie);
      try { const kv = await getKV(); await kv.incr(kSignups()); } catch {}
      return res.status(200).json({ ok: true, user: { email: em, role: 'user' } });
    }
    let user;
    try {
      user = await createUser(em, password, 'user');
    } catch (e) {
      // If storage is read-only or KV unavailable, proceed with a session-only user
      user = { email: em, role: 'user' } as any;
    }
    // Mark invite use if applicable
    try{ if (kvAvailable() && code) await markInviteUsed(code); }catch{}
    // Notify admin
    try{ const { email: adminEmail } = adminEnv(); if (adminEmail) await notifyNewUser(adminEmail, email); }catch{}
    const { secret } = adminEnv();
    const token = signJWT({ sub: user.email, role: user.role }, secret);
    const secure = isSecure(req.headers as any);
    const maxAge = 60*60*24*7; // 7 days
    const expires = new Date(Date.now() + maxAge*1000).toUTCString();
    const cookie = [
      `tcl_sess=${token}`,
      'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${maxAge}`, `Expires=${expires}`, secure ? 'Secure' : '',
    ].filter(Boolean).join('; ');
    res.setHeader('Set-Cookie', cookie);
    try { const kv = await getKV(); await kv.incr(kSignups()); } catch {}
    return res.status(200).json({ ok: true, user: { email: user.email, role: user.role } });
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'signup error' });
  }
}
