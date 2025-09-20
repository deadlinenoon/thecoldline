import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { kvAvailable, kvHSet } from '@/lib/kv';
import { readUsers, findUserKV } from '@/lib/userstore';
import { sendPasswordResetEmail } from '@/lib/notify';

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
  const { email } = (typeof req.body==='object' ? req.body : {}) as { email?: string };
  if (!email) return res.status(400).json({ error: 'Email required' });

  // Always return 200 for privacy; only attempt to create token if user exists
  try{
    const lower = email.toLowerCase();
    let exists = false;
    // Try KV first to check for user
    const u = await findUserKV(lower);
    if (u) exists = true; else {
      const local = readUsers(); exists = !!local.find(x=> x.email.toLowerCase()===lower);
    }

    if (exists){
      const token = crypto.randomBytes(32).toString('hex');
      const exp = Date.now() + 60*60*1000; // 1 hour
      if (kvAvailable()){
        try{ await kvHSet(`pwreset:${token}`, { email: lower, exp }); }catch{}
      } else {
        const all = readResets(); all[token] = { email: lower, exp }; writeResets(all);
      }
      try{
        const base = process.env.NEXT_PUBLIC_BASE_URL || (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host'] ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}` : `https://${req.headers.host}`);
        const link = `${base}/reset?token=${encodeURIComponent(token)}`;
        await sendPasswordResetEmail(lower, link);
      }catch{}
    }
  }catch{}
  return res.status(200).json({ ok: true });
}
