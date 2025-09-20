import type { NextApiRequest, NextApiResponse } from "next";
import { sameDivision } from "@/lib/divisions";

async function j<T=any>(u:string){ const r=await fetch(u,{headers:{Accept:"application/json","User-Agent":"Mozilla/5.0 (compatible; TCL/1.0)"},cache:"no-store"}); if(!r.ok) throw new Error(`${r.status} ${u}`); return r.json() as Promise<T>; }
const norm=(s:string)=> (s||"").toLowerCase();

type Game = { date:string; opponent:string; homeAway:'home'|'away'; pf:number; pa:number; result:'W'|'L'|'T' };

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  try{
    const team = String(req.query.team||"").trim();
    const kickoffISO = String(req.query.kickoff||"").trim();
    if (!team) return res.status(400).json({ error: 'Missing team' });

    // map team name → ESPN id
    const teams = await j<{ sports: any[] }>("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
    const flat = (teams?.sports?.[0]?.leagues?.[0]?.teams||[]).map((t:any)=>t.team);
    const me = flat.find((t:any)=> norm(t.displayName)===norm(team) || norm(t.name)===norm(team) || norm(`${t.location} ${t.name}`)===norm(team));
    if(!me?.id) return res.status(404).json({ error:'Team not found', team });

    const now = kickoffISO ? new Date(kickoffISO) : new Date();
    const seasons = [now.getUTCFullYear(), now.getUTCFullYear()-1, now.getUTCFullYear()-2];
    const games: Game[] = [];
    for (const season of seasons){
      const sched:any = await j(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${me.id}/schedule?season=${season}`);
      const events:any[] = Array.isArray(sched?.events)? sched.events : [];
      for (const ev of events) {
        const comp = ev?.competitions?.[0];
        const when = new Date(ev?.date || comp?.date || 0);
        if (kickoffISO && when.getTime() >= new Date(kickoffISO).getTime()) continue;
        const completed = comp?.status?.type?.completed || comp?.status?.type?.name==='STATUS_FINAL';
        if (!completed) continue;
        const comps = comp?.competitors||[];
        const mine = comps.find((c:any)=> String(c?.team?.id)===String(me.id));
        const opp  = comps.find((c:any)=> String(c?.team?.id)!==String(me.id));
        const oppName = String(opp?.team?.displayName || opp?.team?.name || '');
        if (!sameDivision(team, oppName)) continue;
        const pf = typeof mine?.score==='number'? mine.score : parseFloat(String(mine?.score||'NaN'));
        const pa = typeof opp?.score==='number'? opp.score : parseFloat(String(opp?.score||'NaN'));
        if (!Number.isFinite(pf) || !Number.isFinite(pa)) continue;
        const homeAway: 'home'|'away' = (mine?.homeAway==='home') ? 'home' : 'away';
        const result: 'W'|'L'|'T' = pf>pa? 'W' : (pa>pf? 'L':'T');
        games.push({ date: when.toISOString(), opponent: oppName, homeAway, pf, pa, result });
      }
      if (games.length>=10) break;
    }
    games.sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime());
    const last10 = games.slice(0,10);
    const w = last10.filter(g=>g.result==='W').length;
    const l = last10.filter(g=>g.result==='L').length;
    const t = last10.filter(g=>g.result==='T').length;
    return res.status(200).json({ team, record:`${w}-${l}${t?('-'+t):''}`, games:last10 });
  }catch(e:any){ return res.status(500).json({ error:e?.message||'last10-division error' }); }
}
