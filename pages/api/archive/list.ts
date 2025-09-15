import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data', 'archive');

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    await fs.mkdir(DIR, { recursive: true });
    const names = await fs.readdir(DIR).catch(()=>[] as string[]);
    const items = await Promise.all(names
      .filter(n=>n.endsWith('.json'))
      .map(async n => {
        try{
          const p = path.join(DIR, n);
          const st = await fs.stat(p);
          const id = n.replace(/\.json$/, '');
          let count = 0; let startedAt: string | null = null;
          try{
            const txt = await fs.readFile(p, 'utf8');
            const j = JSON.parse(txt);
            const events = Array.isArray(j?.events) ? j.events : [];
            count = events.length;
            startedAt = j?.createdAt || null;
          }catch{}
          return { id, file: n, bytes: st.size, mtime: st.mtimeMs, count, createdAt: startedAt };
        }catch{ return null; }
      })
    );
    const out = items.filter(Boolean) as any[];
    out.sort((a,b)=> (b.mtime||0) - (a.mtime||0));
    return res.status(200).json({ ok:true, items: out });
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'archive list error' });
  }
}

