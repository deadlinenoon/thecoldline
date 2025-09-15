import type { NextApiRequest, NextApiResponse } from "next";

type CacheEntry = { ts: number; data: any };
const CACHE = new Map<string, CacheEntry>();
const TTL = 15 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try{
    const home = String(req.query.home||"").trim();
    const away = String(req.query.away||"").trim();
    const kickoff = String(req.query.kickoff||"").trim();
    if (!home || !away) return res.status(400).json({error:"Missing home/away"});

    const key = `notes:${home}|${away}|${kickoff}`;
    const now = Date.now();
    const hit = CACHE.get(key);
    if (hit && now - hit.ts < TTL) return res.status(200).json({ ...hit.data, rateProtected: true });

    const proto = (req.headers["x-forwarded-proto"] as string) || "http";
    const host = req.headers.host;
    const base = `${proto}://${host}`;

    const [nh, na] = await Promise.allSettled([
      fetch(`${base}/api/team-notes?team=${encodeURIComponent(home)}&opponent=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`),
      fetch(`${base}/api/team-notes?team=${encodeURIComponent(away)}&opponent=${encodeURIComponent(home)}&kickoff=${encodeURIComponent(kickoff)}`)
    ]);
    async function read(x: PromiseSettledResult<Response>){
      if (x.status!=="fulfilled") return [] as any[];
      try{ const j=await x.value.json(); return Array.isArray(j?.notes)? j.notes : []; }catch{ return []; }
    }
    const out = { home: await read(nh), away: await read(na) };
    CACHE.set(key, { ts: now, data: out });
    return res.status(200).json({ ...out, rateProtected: false });
  }catch(e:any){
    return res.status(500).json({error:e?.message||"notes route error"});
  }
}

