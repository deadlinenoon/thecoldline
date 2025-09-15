import type { NextApiRequest, NextApiResponse } from 'next';
import { TEAM_ID, toAbbr } from '../../lib/nfl-teams';

// Lightweight AI-style fallback: best-effort, deterministic, no external LLM.
// Supports: type=injuries | redzone | consensus

async function fetchInjuries(abbr: string){
  const id = TEAM_ID[abbr]; if (!id) return [] as any[];
  try{
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/injuries`, { headers: { 'User-Agent':'Mozilla/5.0', Accept:'application/json' }, cache:'no-store' });
    const j = await r.json();
    const groups = Array.isArray(j?.injuries)? j.injuries : [];
    const out:any[] = [];
    for(const g of groups){
      const athletes = g?.athletes || g?.injuries || [];
      for(const a of athletes){
        out.push({ name: a?.athlete?.displayName ?? a?.name ?? '', position: a?.athlete?.position?.abbreviation ?? a?.position ?? '', status: a?.status ?? g?.status ?? a?.injuryStatus ?? '', note: a?.details ?? a?.comment ?? '' });
      }
    }
    // de-dupe by name
    const seen = new Set<string>(); const uniq:any[] = [];
    for(const it of out){ const k=(it.name||'').toUpperCase(); if(k && !seen.has(k)){ seen.add(k); uniq.push(it);} }
    return uniq.slice(0, 12);
  }catch{ return []; }
}

function toProb(price:number){ return price>0? 100/(price+100) : (-price)/((-price)+100); }

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const type = String(req.query.type||'').trim().toLowerCase();
    if (!type) return res.status(400).json({ error:'missing type' });

    if (type === 'injuries'){
      const team = toAbbr(String(req.query.home||''));
      if (!TEAM_ID[team]) return res.status(400).json({ error:'unknown team' });
      const list = await fetchInjuries(team);
      return res.status(200).json({ team, injuries: list, count: list.length, source: 'espn-fallback' });
    }

    if (type === 'redzone'){
      // Pull our own redzone route in single-team mode for a stable fallback
      const team = toAbbr(String(req.query.home||''));
      try{
        const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
        const host = req.headers.host; const base = `${proto}://${host}`;
        const r = await fetch(`${base}/api/redzone?team=${encodeURIComponent(team)}`, { cache:'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error||'redzone error');
        return res.status(200).json({ team, offensePct: j?.offensePct ?? null, defensePct: j?.defensePct ?? null, source: 'rz-derived' });
      }catch{
        return res.status(200).json({ team, offensePct: null, defensePct: null, source: 'rz-null' });
      }
    }

    if (type === 'consensus'){
      // Derive public consensus from current odds implied probabilities
      const home = String(req.query.home||'').trim();
      const away = String(req.query.away||'').trim();
      try{
        const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
        const host = req.headers.host; const base = `${proto}://${host}`;
        const ro = await fetch(`${base}/api/odds`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        const raw = await ro.json();
        const odds:any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.events) ? raw.events : []);
        if (Array.isArray(odds)){
          const ev = odds.find((e:any)=> e?.home_team===home && e?.away_team===away);
          if (ev){
            const homeP:number[]=[]; const awayP:number[]=[];
            for(const b of ev.bookmakers||[]){
              const m=(b.markets||[]).find((mm:any)=>mm.key==='h2h');
              const ho=m?.outcomes?.find((o:any)=>o.name===home); const ao=m?.outcomes?.find((o:any)=>o.name===away);
              if (typeof ho?.price==='number') homeP.push(toProb(ho.price));
              if (typeof ao?.price==='number') awayP.push(toProb(ao.price));
            }
            const avg=(arr:number[])=> arr.length? arr.reduce((s,x)=>s+x,0)/arr.length : null;
            const h=avg(homeP), a=avg(awayP);
            if (h!=null && a!=null){ const z=h+a; const hp=Math.round((h/z)*100); const ap=100-hp; return res.status(200).json({ home: hp, away: ap, bets:{ home: hp, away: ap }, handle:{ home: hp, away: ap }, source:'derived-odds-ai' }); }
          }
        }
      }catch{}
      // graceful placeholder if odds not available
      return res.status(200).json({ home: null, away: null, bets:{ home: null, away: null }, handle:{ home: null, away: null }, source:'ai-shim' });
    }

    return res.status(400).json({ error:'unsupported type' });
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'ai-scrape error' });
  }
}
