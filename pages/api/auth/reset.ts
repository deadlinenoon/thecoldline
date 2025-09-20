import type { NextApiRequest, NextApiResponse } from 'next';
import { kvAvailable, kvHGetAll, kvDel } from '@/lib/kv';
import { setUserPassword } from '@/lib/userstore';

// Fallback file storage for tokens when KV is not available
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || '/tmp/data';
const RESETS_PATH = path.join(DATA_DIR, 'pwresets.json');

function ensureDir(){ try{ if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true}); }catch{} }
function readResets(): Record<string,{ email:string; exp:number }>{
  try{ if(!fs.existsSync(RESETS_PATH)) return {}; return JSON.parse(fs.readFileSync(RESETS_PATH,'utf8')) || {}; }catch{ return {}; }
}
function writeResets(obj: Record<string,{ email:string; exp:number }>){ try{ ensureDir(); fs.writeFileSync(RESETS_PATH, JSON.stringify(obj)); }catch{} }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token, newPassword } = (typeof req.body==='object' ? req.body : {}) as { token?: string; newPassword?: string };
  if (!token || !newPassword) return res.status(400).json({ error: 'Missing token or password' });

  try{
    let email: string|undefined; let exp = 0;
    if (kvAvailable()){
      try{ const h = await kvHGetAll(`pwreset:${token}`); if (h){ email = String(h.email||''); exp = Number(h.exp||0); } }catch{}
      if (email && exp && Date.now() <= exp){
        await setUserPassword(email, newPassword);
        try{ await kvDel(`pwreset:${token}`); }catch{}
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    // File fallback
    const all = readResets(); const rec = all[token];
    if (rec && rec.email && rec.exp && Date.now() <= rec.exp){
      await setUserPassword(rec.email, newPassword);
      delete all[token]; writeResets(all);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Invalid or expired token' });
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'reset error' });
  }
}
