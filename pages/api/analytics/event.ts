import type { NextApiRequest, NextApiResponse } from 'next';
import { kvIncr, kvSetNX } from '../../../lib/kv';

function bucketKey(env: string, d: Date){
  const iso = d.toISOString().replace(/[-:T.Z]/g,'');
  return `ana:${env}:${iso.slice(0,12)}`; // YYYYMMDDHHmm
}

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const env = process.env.VERCEL_ENV === 'production' ? 'prod' : 'prev';
    const now = new Date();
    const key = bucketKey(env, now);
    const cid = String(req.headers['x-client-id'] || req.cookies?.cid || req.headers['x-forwarded-for'] || 'anon');
    const seenKey = `ana:seen:${env}:${key}:${cid}`;
    const seen = await kvSetNX(seenKey, '1', 90);
    if (seen){
      await kvIncr(key);
    }
    return res.status(200).json({ ok:true });
  }catch(e:any){
    return res.status(200).json({ ok:false, error: e?.message || 'analytics error' });
  }
}

