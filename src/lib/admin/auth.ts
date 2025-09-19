import type { NextApiRequest } from 'next';
import { adminEnv, decodeJwtUnsafe, isAdminIdentity, verifyJWT } from '@/lib/auth';

export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    out[key] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export function isAdminRequest(req: NextApiRequest): boolean {
  const { secret } = adminEnv();
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies['tcl_sess'];
  if (!token || !secret) return false;
  const payload = verifyJWT(token, secret) ?? decodeJwtUnsafe(token);
  if (!payload) return false;
  return isAdminIdentity((payload as any)?.sub, (payload as any)?.role);
}

