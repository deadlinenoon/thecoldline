import crypto from 'crypto';

export type JwtPayload = { sub: string; role: string; iat: number; exp: number };

const b64url = (buf: Buffer) => buf.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const b64urlJSON = (obj: any) => b64url(Buffer.from(JSON.stringify(obj)));

export function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function signJWT(payload: Omit<JwtPayload,'iat'|'exp'>, secret: string, ttlSeconds = 60*60*24*7): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now()/1000);
  const body: JwtPayload = { ...payload, iat: now, exp: now + ttlSeconds } as JwtPayload;
  const unsigned = `${b64urlJSON(header)}.${b64urlJSON(body)}`;
  const sig = crypto.createHmac('sha256', secret).update(unsigned).digest();
  return `${unsigned}.${b64url(sig)}`;
}

export function verifyJWT(token: string, secret: string): JwtPayload | null {
  try {
    const [h,p,s] = token.split('.'); if(!h||!p||!s) return null;
    const unsigned = `${h}.${p}`;
    const expSig = b64url(crypto.createHmac('sha256', secret).update(unsigned).digest());
    if (s !== expSig) return null;
    const payload = JSON.parse(Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')) as JwtPayload;
    if (payload.exp && Math.floor(Date.now()/1000) > payload.exp) return null;
    return payload;
  } catch { return null; }
}

/** Decode JWT payload without verifying signature (unsafe fallback for admin gating in dev). */
export function decodeJwtUnsafe(token: string): Partial<JwtPayload> | null {
  try{
    const parts = token.split('.'); if (parts.length < 2) return null;
    const p = parts[1].replace(/-/g,'+').replace(/_/g,'/');
    const buf = Buffer.from(p, 'base64');
    const j = JSON.parse(buf.toString('utf8')) as Partial<JwtPayload>;
    return j;
  }catch{ return null; }
}

export function isSecure(reqHeaders: Record<string, any>): boolean {
  const xfProto = (reqHeaders['x-forwarded-proto'] as string) || '';
  return xfProto.includes('https');
}

export function adminEnv() {
  const email = process.env.ADMIN_EMAIL || '';
  let pwHash = process.env.ADMIN_PWHASH || '';
  const salt = process.env.ADMIN_SALT || '';
  // Fall back to a local default when not configured, so development isn't blocked.
  const secret = process.env.AUTH_SECRET || 'dev-secret';
  // Convenience: allow ADMIN_PASSWORD instead of ADMIN_PWHASH (hash at runtime)
  if (!pwHash && salt && process.env.ADMIN_PASSWORD) {
    pwHash = sha256Hex(`${salt}${process.env.ADMIN_PASSWORD}`);
  }
  return { email, pwHash, salt, secret };
}

export function verifyAdminPassword(plain: string): boolean {
  const { pwHash, salt } = adminEnv();
  if (!pwHash || !salt) return false;
  const h = sha256Hex(`${salt}${plain}`);
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(pwHash));
}

/** Allow multiple admin emails via ADMIN_EMAILS (CSV) in addition to ADMIN_EMAIL. Includes sane defaults. */
export function isAdminIdentity(sub?: string, role?: string): boolean {
  if (role === 'admin') return true;
  const s = (sub || '').trim().toLowerCase();
  if (!s) return false;
  const list: string[] = [];
  const one = (process.env.ADMIN_EMAIL || '').trim().toLowerCase(); if (one) list.push(one);
  const many = (process.env.ADMIN_EMAILS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean); list.push(...many);
  // Safety defaults for your current addresses
  if (!list.includes('betsharp@icloud.com')) list.push('betsharp@icloud.com');
  if (!list.includes('georgesantiago55@me.com')) list.push('georgesantiago55@me.com');
  if (!list.includes('garitar@gmail.com')) list.push('garitar@gmail.com');
  return list.includes(s);
}
