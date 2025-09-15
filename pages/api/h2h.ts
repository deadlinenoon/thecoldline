import type { NextApiRequest, NextApiResponse } from "next";

async function j<T=any>(u:string){ const r=await fetch(u,{headers:{Accept:"application/json","User-Agent":"Mozilla/5.0 (compatible; TCL/1.0)"},cache:"no-store"}); if(!r.ok) throw new Error(`${r.status} ${u}`); return r.json() as Promise<T>; }
const norm=(s:string)=> (s||"").toLowerCase();

type Meet = { date: string; season: number; home: string; away: string; homeScore: number; awayScore: number; winner: string };

type CacheEntry = { ts: number; data: any };
const CACHE = new Map<string, CacheEntry>();
const TTL = 15 * 60 * 1000;

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  try{
    const home = String(req.query.home||"").trim();
    const away = String(req.query.away||"").trim();
    const kickoffISO = String(req.query.kickoff||"").trim();
    if(!home || !away) return res.status(400).json({error:"Missing home/away"});

    const key = `h2h:${home}|${away}`;
    const nowTs = Date.now();
    const hit = CACHE.get(key);
    if (hit && nowTs - hit.ts < TTL) {
      return res.status(200).json({ ...hit.data, rateProtected: true });
    }

    // map names to ESPN team IDs
    const teams = await j<{ sports: any[] }>("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
    const flat = (teams?.sports?.[0]?.leagues?.[0]?.teams||[]).map((t:any)=>t.team);
    const mapByName = (name:string)=> flat.find((t:any)=> norm(t.displayName)===norm(name) || norm(t.name)===norm(name) || norm(t.location+" "+t.name)===norm(name));
    const th = mapByName(home); const ta = mapByName(away);
    if(!th?.id || !ta?.id) return res.status(404).json({error:"Team not found", home, away});

    const now = kickoffISO ? new Date(kickoffISO) : new Date();
    const startSeason = now.getUTCFullYear();

    const meets: Meet[] = [];
    const seen = new Set<string>();
    // only last 5 seasons, collect up to 10 most recent meetings
    for(let yr=startSeason; yr>=startSeason-4 && meets.length<10; yr--){
      const [schHome, schAway] = await Promise.all([
        j<any>(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${th.id}/schedule?season=${yr}`),
        j<any>(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${ta.id}/schedule?season=${yr}`)
      ]);
      const addFrom = (events:any[])=>{
        for(const ev of events||[]){
          const comp = ev?.competitions?.[0];
          const comps = comp?.competitors||[];
          const ids = comps.map((c:any)=> String(c?.team?.id));
          if(ids.includes(String(th.id)) && ids.includes(String(ta.id))){
            const id = String(ev?.id || comp?.id || ""); if(!id || seen.has(id)) continue; seen.add(id);
            const date = ev?.date || comp?.date || null; const dt = date? new Date(date): null;
            const homeSide = comps.find((c:any)=> c?.homeAway==='home');
            const awaySide = comps.find((c:any)=> c?.homeAway==='away');
            const homeName = homeSide?.team?.displayName || ""; const awayName = awaySide?.team?.displayName || "";
            const hs = parseFloat(String(homeSide?.score??NaN)); const as = parseFloat(String(awaySide?.score??NaN));
            const winner = Number.isFinite(hs) && Number.isFinite(as) ? (hs>as? homeName : (as>hs? awayName : "")) : "";
            meets.push({
              date: dt? dt.toISOString(): (date||""),
              season: yr,
              home: homeName,
              away: awayName,
              homeScore: Number.isFinite(hs)?hs:0,
              awayScore: Number.isFinite(as)?as:0,
              winner
            });
          }
        }
      };
      addFrom(schHome?.events||[]);
      addFrom(schAway?.events||[]);
    }
    // sort most recent first and de-dup limited already; slice 10
    meets.sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime());
    const list = meets.slice(0,10);
    // record for CURRENT matchup axis (wins for `home` vs `away`)
    let homeWins=0, awayWins=0;
    for(const m of list){ if(m.winner===home) homeWins++; else if(m.winner===away) awayWins++; }

    // compute current streak from most recent meeting (who won last, count consecutive wins)
    let streakTeam = ""; let streak = 0;
    for(const m of list){
      const w = m.winner; if(!w) break;
      if(streak===0){ streakTeam = w; streak=1; }
      else if(w===streakTeam){ streak++; }
      else break;
    }
    // revenge: +0.5 for the team that lost the last meeting, signed on home axis
    let revenge: { team: string; delta: number } | null = null;
    const last = list[0];
    if (last && last.winner) {
      const lastLoser = last.winner === last.home ? last.away : last.home;
      if (lastLoser === home) revenge = { team: home, delta: +0.5 };
      else if (lastLoser === away) revenge = { team: away, delta: -0.5 };
    }

    // rivalry trend (last 5 seasons, typically divisional 2x/yr):
    // award +0.5 per win above 2 across the sample. Signed on the home axis.
    const sampleSize = list.length;
    const above2Home = Math.max(0, homeWins - 2);
    const above2Away = Math.max(0, awayWins - 2);
    // Only apply trend when there is a reasonably sized sample (>= 6 typical for divisional)
    const rivalryEligible = sampleSize >= 6;
    const rivalryDelta = rivalryEligible ? 0.5 * (above2Home - above2Away) : 0;
    const rivalryTrend = { sampleSize, homeWins, awayWins, delta: Number(rivalryDelta.toFixed(2)), eligible: rivalryEligible };

    const payload = {
      home,
      away,
      record: `${homeWins}-${awayWins}`,
      meetings: list,
      streakTeam,
      streakCount: streak,
      sampleSize: list.length,
      revenge,
      trend: rivalryTrend
    };
    CACHE.set(key, { ts: nowTs, data: payload });
    return res.status(200).json({ ...payload, rateProtected: false });
  }catch(e:any){
    return res.status(500).json({error:e?.message||"h2h route error"});
  }
}
