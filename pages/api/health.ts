import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try{
    const home = String(req.query.home||"").trim();
    const away = String(req.query.away||"").trim();
    const kickoff = String(req.query.kickoff||"").trim();
    if (!home || !away || !kickoff) return res.status(400).json({ error: "Missing home/away/kickoff" });

    const proto = (req.headers["x-forwarded-proto"] as string) || "http";
    const host = req.headers.host;
    const base = `${proto}://${host}`;

    const checks = {
      weather: fetch(`${base}/api/weather?home=${encodeURIComponent(home)}&kickoff=${encodeURIComponent(kickoff)}`),
      injuries: fetch(`${base}/api/injuries?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`),
      plays: fetch(`${base}/api/plays?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`),
      travel: fetch(`${base}/api/travel?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`),
      redzone: fetch(`${base}/api/redzone?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`),
      h2h: fetch(`${base}/api/h2h?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`),
      odds: fetch(`${base}/api/odds`),
      last10Home: fetch(`${base}/api/last10?team=${encodeURIComponent(home)}&kickoff=${encodeURIComponent(kickoff)}`),
      last10Away: fetch(`${base}/api/last10?team=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`),
    } as const;

    const r = await Promise.allSettled(Object.values(checks));
    function ok(i:number){ const x=r[i]; return x.status==='fulfilled' && x.value.ok; }
    const out = {
      weather: ok(0),
      injuries: ok(1),
      plays: ok(2),
      travel: ok(3),
      redzone: ok(4),
      h2h: ok(5),
      odds: ok(6),
      last10: { home: ok(7), away: ok(8) },
    };
    return res.status(200).json(out);
  }catch(e:any){
    return res.status(500).json({error:e?.message||'health error'});
  }
}
