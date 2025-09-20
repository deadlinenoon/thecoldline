import type { NextApiRequest, NextApiResponse } from 'next';
import { kvLPush, kvAvailable } from '@/lib/kv';
import { adminEnv, verifyJWT, isAdminIdentity, decodeJwtUnsafe } from '@/lib/auth';

function parseCookie(h: string|undefined){ const out:Record<string,string>={}; if(!h) return out; for(const p of h.split(';')){ const [k,...r]=p.trim().split('='); if(!k) continue; out[k]=decodeURIComponent(r.join('=')); } return out; }

type Item = { name: string; ok: boolean; error?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    // Admin-only gate
    const { secret } = adminEnv();
    const cookies = parseCookie(req.headers.cookie);
    const tok = cookies['tcl_sess'];
    let isAdmin = false;
    if (tok && secret){ let p=verifyJWT(tok, secret); if(!p) p=decodeJwtUnsafe(tok) as any; isAdmin = isAdminIdentity(p?.sub, p?.role); }
    if (!isAdmin) return res.status(403).json({ error: 'forbidden' });

    const home = String(req.query.home||'').trim();
    const away = String(req.query.away||'').trim();
    const kickoff = String(req.query.kickoff||'').trim();
    if (!home || !away || !kickoff) return res.status(400).json({ error:'Missing home/away/kickoff' });

    const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
    const host = req.headers.host; const base = `${proto}://${host}`;

    async function check(url: string, name: string): Promise<Item>{
      try{
        const r = await fetch(url, { cache: 'no-store' });
        let err: string|undefined;
        if (!r.ok){ try{ const j=await r.json(); err=j?.error || `HTTP ${r.status}`; }catch{ err=`HTTP ${r.status}`; } }
        return { name, ok: r.ok, error: err };
      }catch(e:any){ return { name, ok:false, error: e?.message||'error' }; }
    }

    const items: Item[] = [];
    items.push(await check(`${base}/api/injuries?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`, 'injuries'));
    items.push(await check(`${base}/api/redzone?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`, 'redzone'));
    items.push(await check(`${base}/api/plays?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`, 'plays'));
    items.push(await check(`${base}/api/travel?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`, 'travel'));
    // last10 by home/away team
    items.push(await check(`${base}/api/last10?team=${encodeURIComponent(home)}&kickoff=${encodeURIComponent(kickoff)}`, 'last10-home'));
    items.push(await check(`${base}/api/last10?team=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`, 'last10-away'));
    items.push(await check(`${base}/api/weather?home=${encodeURIComponent(home)}&kickoff=${encodeURIComponent(kickoff)}`, 'weather'));

    const ok = items.every(i=> i.ok);
    // Best-effort log (no PII) for admin visibility
    try{
      const row = { ts: Date.now(), home, away, kickoff, ok, fails: items.filter(i=>!i.ok).map(i=>i.name) };
      if (kvAvailable()) await kvLPush('health:checks', JSON.stringify(row));
    }catch{}
    return res.status(200).json({ ok, items });
  }catch(e:any){
    return res.status(500).json({ error: e?.message||'data-health error' });
  }
}
