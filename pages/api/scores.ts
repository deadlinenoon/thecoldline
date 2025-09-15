import type { NextApiRequest, NextApiResponse } from "next";

async function j<T=any>(u:string){ const r=await fetch(u,{headers:{Accept:"application/json","User-Agent":"Mozilla/5.0 (compatible; TCL/1.0)"}, cache:"no-store"}); if(!r.ok) throw new Error(`${r.status} ${u}`); return r.json() as Promise<T>; }

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    // ESPN NFL scoreboard (today and in-progress)
    const data:any = await j("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
    const events:any[] = Array.isArray(data?.events)? data.events : [];
    const out = events.map((ev:any)=>{
      const comp = ev?.competitions?.[0];
      const cs = comp?.competitors || [];
      const home = cs.find((c:any)=> c?.homeAway==='home');
      const away = cs.find((c:any)=> c?.homeAway==='away');
      const status = comp?.status?.type?.name || ev?.status?.type?.name || '';
      const qtr = comp?.status?.period ?? null;
      const clk = comp?.status?.displayClock ?? '';
      const start = ev?.date || comp?.date || null;
      return {
        id: String(ev?.id || comp?.id || ''),
        away: away?.team?.displayName || away?.team?.name || '',
        home: home?.team?.displayName || home?.team?.name || '',
        awayScore: typeof away?.score==='number'? away.score : parseFloat(String(away?.score||'0'))||0,
        homeScore: typeof home?.score==='number'? home.score : parseFloat(String(home?.score||'0'))||0,
        status,
        period: qtr,
        clock: clk,
        start,
      };
    });
    return res.status(200).json(out);
  }catch(e:any){
    return res.status(500).json({ error: e?.message || 'scores error' });
  }
}

