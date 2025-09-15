import type { NextApiRequest, NextApiResponse } from "next";

async function j<T=any>(u:string){ const r=await fetch(u,{headers:{Accept:"application/json","User-Agent":"Mozilla/5.0 (compatible; TCL/1.0)"},cache:"no-store"}); if(!r.ok) throw new Error(`${r.status} ${u}`); return r.json() as Promise<T>; }
const norm=(s:string)=> (s||"").toLowerCase();

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  try{
    const team = String(req.query.team||"").trim();
    const kickoffISO = String(req.query.kickoff||"").trim();
    if(!team) return res.status(400).json({error:"Missing team"});

    // find ESPN team id from site API
    const teams = await j<{ sports: any[] }>("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
    const flat = (teams?.sports?.[0]?.leagues?.[0]?.teams||[]).map((t:any)=>t.team);
    const me = flat.find((t:any)=> norm(t.displayName)===norm(team) || norm(t.name)===norm(team) || norm(t.location+" "+t.name)===norm(team));
    if(!me?.id) return res.status(404).json({error:"Team not found", team});

    // season from kickoff or today
    const now = kickoffISO ? new Date(kickoffISO) : new Date();
    const season = now.getUTCFullYear();

    // team schedule
    const sched:any = await j(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${me.id}/schedule?season=${season}`);
    const events:any[] = sched?.events||[];
    let sum = 0; let cnt = 0;
    for(const ev of events){
      const comp = ev?.competitions?.[0];
      const date = new Date(ev?.date||comp?.date||0);
      if (kickoffISO && date.getTime() >= new Date(kickoffISO).getTime()) continue; // only games before kickoff
      const status = comp?.status?.type?.completed || comp?.status?.type?.name === 'STATUS_FINAL';
      if(!status) continue;
      const comps = comp?.competitors||[];
      const mine = comps.find((c:any)=> String(c?.team?.id)===String(me.id));
      const opp  = comps.find((c:any)=> String(c?.team?.id)!==String(me.id));
      const myScore = typeof mine?.score === 'number' ? mine.score : parseFloat(mine?.score||'NaN');
      const opScore = typeof opp?.score === 'number' ? opp.score : parseFloat(opp?.score||'NaN');
      if (Number.isFinite(myScore) && Number.isFinite(opScore)) {
        sum += (myScore - opScore);
        cnt += 1;
      }
    }
    const avg = cnt>0 ? Number((sum/cnt).toFixed(2)) : 0;
    return res.status(200).json({ team, season, games: cnt, avgMOV: avg });
  }catch(e:any){
    return res.status(200).json({ team: String(req.query.team||''), season: new Date().getUTCFullYear(), games: 0, avgMOV: 0, error:e?.message||"mov route error" });
  }
}
