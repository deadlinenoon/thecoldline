import type { NextApiRequest, NextApiResponse } from 'next';
import { TEAM_ID, toAbbr } from '../../lib/nfl-teams';
import { STADIUMS } from '../../lib/stadiums';
import { milesBetween } from '../../lib/geo';
import { logWarn } from '../../lib/logs';

type TravelOut = { milesSinceLastGame: number; milesSinceLastHome: number; milesSeasonToDate: number };
const CACHE = new Map<string,{ts:number,data:any}>();
const TTL = 15 * 60 * 1000;

async function teamScheduleLocs(abbr: string, cutoffISO: string) {
  const id = TEAM_ID[abbr];
  if (!id) throw new Error(`unknown team ${abbr}`);
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/schedule`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, cache: 'no-store' });
  const j = await r.json();
  const items = Array.isArray(j?.events) ? j.events : [];
  const cutoff = new Date(cutoffISO).getTime();
  const played = items
    .map((e:any)=> {
      const dt = new Date(e?.date || e?.shortDate || e?.competitions?.[0]?.date || '').getTime();
      const comp = e?.competitions?.[0];
      const venue = comp?.venue || e?.venue;
      const mySide = (comp?.competitors||[]).find((c:any)=> c?.homeAway==='home' || c?.homeAway==='away');
      const idStr = String(id);
      const isHome = (comp?.competitors||[]).find((c:any)=> String(c?.team?.id)===idStr)?.homeAway === 'home';
      const lat = Number(venue?.address?.latitude ?? venue?.latitude);
      const lon = Number(venue?.address?.longitude ?? venue?.longitude);
      return { ts: dt || 0, isHome, lat, lon };
    })
    .filter((x:any)=> x.ts > 0 && x.ts < cutoff)
    .sort((a:any,b:any)=> a.ts - b.ts);
  const homeLoc = STADIUMS[abbr];
  const seq = [{ lat: homeLoc.lat, lon: homeLoc.lon, isHome: true, ts: 0 }, ...played.map((p:any)=>({ lat:p.lat, lon:p.lon, isHome:p.isHome, ts:p.ts }))];
  return seq;
}

function tzFromLon(lon:number){ if(!Number.isFinite(lon)) return 0; return Math.round(-lon/15); }

function computeMiles(seq: {lat:number; lon:number; isHome:boolean; ts:number}[], homeAbbr: string): TravelOut & { tzDiff:number } {
  if (seq.length < 2) {
    return { milesSinceLastGame: 0, milesSinceLastHome: 0, milesSeasonToDate: 0, tzDiff: 0 };
  }
  let milesSeasonToDate = 0;
  for (let i = 1; i < seq.length; i++) {
    milesSeasonToDate += milesBetween(seq[i-1], seq[i]);
  }
  const last = seq[seq.length - 1];
  const prev = seq[seq.length - 2];
  const milesSinceLastGame = milesBetween(prev, last);
  const homeLoc = STADIUMS[homeAbbr];
  const milesSinceLastHome = last.isHome ? 0 : milesBetween(last, homeLoc);
  const tzDiff = Math.abs(tzFromLon(last.lon) - tzFromLon(homeLoc.lon));
  return { milesSinceLastGame, milesSinceLastHome, milesSeasonToDate, tzDiff };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try{
    const homeIn = toAbbr(String(req.query.home||''));
    const awayIn = toAbbr(String(req.query.away||''));
    const kickoff = String(req.query.kickoff || '');
    if (!TEAM_ID[homeIn] || !TEAM_ID[awayIn] || !kickoff) {
      return res.status(400).json({ error: 'missing or invalid params', homeIn, awayIn, kickoff });
    }
    const key = `travel:${homeIn}:${awayIn}:${kickoff}`;
    const now = Date.now();
    const hit = CACHE.get(key);
    if (hit && now - hit.ts < TTL) return res.status(200).json(hit.data);

    const [homeSeq, awaySeq] = await Promise.all([
      teamScheduleLocs(homeIn, kickoff),
      teamScheduleLocs(awayIn, kickoff)
    ]);
    const home = computeMiles(homeSeq, homeIn);
    const away = computeMiles(awaySeq, awayIn);

    const data = { home, away };
    CACHE.set(key, { ts: now, data });
    return res.status(200).json(data);
  }catch(e:any){
    logWarn('travel', e?.message || e);
    return res.status(200).json({
      home: { milesSinceLastGame: 0, milesSinceLastHome: 0, milesSeasonToDate: 0 },
      away: { milesSinceLastGame: 0, milesSinceLastHome: 0, milesSeasonToDate: 0 },
      error: e?.message || 'travel error'
    });
  }
}
