import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data', 'archive');

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const id = String(req.query.id||'').replace(/[^a-z0-9-_]/ig, '');
    if (!id) return res.status(400).json({ error: 'missing id' });
    const file = path.join(DIR, `${id}.json`);
    const txt = await fs.readFile(file, 'utf8');
    const j = JSON.parse(txt);
    return res.status(200).json(j);
  }catch{
    return res.status(404).json({ error: 'not found' });
  }
}
