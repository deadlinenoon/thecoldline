import type { NextApiRequest, NextApiResponse } from 'next';
import { getKV, kvAvailable } from '../../../lib/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const auth = typeof process.env.AUTH_SECRET === 'string' && !!process.env.AUTH_SECRET.trim();
    let kv = false; let envs: string[] = [];
    try{
      const has = kvAvailable();
      if (has){
        const kvClient = await getKV();
        await (kvClient as any).set('tcl:ping', String(Date.now()), 60);
        const v = await kvClient.get('tcl:ping');
        kv = typeof v === 'string';
      }
    }catch{ kv=false; }
    envs = ['AUTH_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'].filter(k=> !!process.env[k]);
    return res.status(200).json({ ok:true, kv, auth, envs });
  }catch(e:any){ return res.status(200).json({ ok:false, kv:false, auth:false, envs:[], error:e?.message||'status error' }); }
}
