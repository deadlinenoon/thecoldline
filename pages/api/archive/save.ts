import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'data', 'archive');

function isoWeek(d: Date){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const now = new Date();
    const { year, week } = isoWeek(now);
    const label = String(req.query.label || req.body?.label || '').trim();
    const id = `${year}-W${String(week).padStart(2,'0')}${label? '-' + label.replace(/[^a-z0-9-_]/ig,'_'):''}`;
    const filePath = path.join(DIR, `${id}.json`);

    const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
    const host = req.headers.host; const base = `${proto}://${host}`;

    // Pull the current odds slate (21-day window handled client-side, but we archive full feed)
    const r = await fetch(`${base}/api/odds?force=1`, { cache: 'no-store' });
    const odds = await r.json().catch(()=>({}));
    const events = Array.isArray(odds?.events) ? odds.events : (Array.isArray(odds) ? odds : []);

    const snapshot = {
      id,
      createdAt: now.toISOString(),
      events,
      meta: { count: events.length }
    };

    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
    return res.status(200).json({ ok:true, id, count: events.length });
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'archive save error' });
  }
}

