import type { NextApiRequest, NextApiResponse } from 'next';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '../../../lib/auth';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

const CANDIDATES = [
  'KV_REST_API_URL','KV_REST_API_TOKEN',
  'UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN',
  // common mis-keys
  'UPSTASH_REDIS_URL','UPSTASH_REDIS_TOKEN','REDIS_URL','REDIS_TOKEN'
];

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const { secret } = adminEnv();
  const cookies = parseCookie(req.headers.cookie);
  const tok = cookies['tcl_sess'];
  let ok=false; if (tok && secret){ let p=verifyJWT(tok, secret); if(!p) p=decodeJwtUnsafe(tok) as any; ok = isAdminIdentity(p?.sub, p?.role); }
  if (!ok) return res.status(403).json({ error:'forbidden' });
  const report: Record<string, any> = {};
  for (const k of CANDIDATES){
    const v = process.env[k];
    report[k] = v ? { present: true, length: String(v).length } : { present: false };
  }
  // derived values our code uses
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  return res.status(200).json({ ok:true, urlPresent: !!url, tokenPresent: !!token, env: report });
}

