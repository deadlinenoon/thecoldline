import type { NextApiRequest, NextApiResponse } from "next";
import { TEAM_ID, toAbbr } from "../../lib/nfl-teams";
import { logWarn } from "../../lib/logs";

const CACHE = new Map<string, { ts: number; data: any }>();
const TTL = 15 * 60 * 1000;

async function getJson<T = any>(url: string) {
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

function parsePlaysFromStatObjects(stats: any[]): number | null {
  if (!Array.isArray(stats)) return null;
  const getName = (s: any) => (s?.name || s?.displayName || '').toString();
  const getVal = (s: any) => (typeof s?.value === 'number' ? s.value : (typeof s?.displayValue === 'string' ? parseFloat(String(s.displayValue)) : null));
  const plays = stats.find((s: any) => /total\s*plays|offensive\s*plays|\bplays\b/i.test(getName(s)));
  if (plays) {
    const v = getVal(plays);
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  const passAtt = getVal(stats.find((s: any) => /(pass(ing)?\s*att(empts)?|pass.*attempts)/i.test(getName(s))));
  const rushAtt = getVal(stats.find((s: any) => /(rush(ing)?\s*att(empts)?|rush.*attempts)/i.test(getName(s))));
  const sacks = getVal(stats.find((s: any) => /(sacks(\s*allowed)?)/i.test(getName(s))));
  const pens = getVal(stats.find((s: any) => /(accepted\s*penalties|penalties\s*accepted|penalties\b)/i.test(getName(s))));
  if (typeof passAtt === 'number' && typeof rushAtt === 'number') {
    if (typeof sacks === 'number' && typeof pens === 'number') return passAtt + rushAtt + sacks + pens;
    return passAtt + rushAtt;
  }
  return null;
}

function extractTeamPlaysFromBox(box: any, teamId: string): number | null {
  // Try boxscore.teams[].statistics[].stats
  const teamsA = box?.boxscore?.teams;
  if (Array.isArray(teamsA)) {
    const t = teamsA.find((x: any) => String(x?.team?.id) === String(teamId));
    const stats = (t?.statistics || []).flatMap((cat: any) => Array.isArray(cat?.stats) ? cat.stats : []);
    const v = parsePlaysFromStatObjects(stats);
    if (v != null) return v;
  }
  // Try top-level teams[].statistics
  const teamsB = box?.teams;
  if (Array.isArray(teamsB)) {
    const t = teamsB.find((x: any) => String(x?.team?.id) === String(teamId));
    const stats = (t?.statistics || []).flatMap((cat: any) => Array.isArray(cat?.stats) ? cat.stats : (Array.isArray(cat?.statistics) ? cat.statistics : []));
    const v = parsePlaysFromStatObjects(stats);
    if (v != null) return v;
  }
  // Try statistics.splits.categories
  const cats = box?.statistics?.splits?.categories;
  if (Array.isArray(cats)) {
    const stats = cats.flatMap((c: any) => Array.isArray(c?.stats) ? c.stats : (Array.isArray(c?.statistics) ? c.statistics : []));
    const v = parsePlaysFromStatObjects(stats);
    if (v != null) return v;
  }
  return null;
}

async function prevGamePlaysForTeam(abbr: string, kickoffISO: string) {
  const id = TEAM_ID[abbr];
  if (!id) throw new Error(`unknown team ${abbr}`);
  const scheduleUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/schedule`;
  const sched: any = await getJson(scheduleUrl);
  const events = Array.isArray(sched?.events) ? sched.events : [];
  const cutoff = new Date(kickoffISO).getTime();
  const prev = events
    .map((e: any) => ({ id: e?.id || e?.uid?.split('~').pop(), date: new Date(e?.date || e?.competitions?.[0]?.date || 0).getTime(), competitions: e?.competitions }))
    .filter((e: any) => e.date && e.date < cutoff)
    .sort((a: any, b: any) => b.date - a.date)[0];
  if (!prev?.id) throw new Error('no previous event');

  const eventId = String(prev.id);

  // Try summary first
  let myPlays: number | null = null;
  let oppPlays: number | null = null;
  try {
    const sum = await getJson<any>(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`);
    const comp = sum?.boxscore?.teams || sum?.teams || [];
    if (Array.isArray(comp) && comp.length >= 2) {
      const ids = comp.map((t: any) => String(t?.team?.id));
      const meIdx = ids.indexOf(String(id));
      const opIdx = meIdx === 0 ? 1 : (meIdx === 1 ? 0 : -1);
      if (meIdx >= 0 && opIdx >= 0) {
        myPlays = extractTeamPlaysFromBox(sum, String(id));
        const oppId = comp[opIdx]?.team?.id ? String(comp[opIdx].team.id) : null;
        if (oppId) oppPlays = extractTeamPlaysFromBox(sum, oppId);
      }
    }
  } catch {}

  // Fallback: v2 competitions boxscore
  if (myPlays == null || oppPlays == null) {
    try {
      const bs = await getJson<any>(`https://site.api.espn.com/apis/v2/sports/football/nfl/competitions/${eventId}/boxscore`);
      const teams = bs?.teams || [];
      const ids = teams.map((t: any) => String(t?.team?.id));
      const meIdx = ids.indexOf(String(id));
      const opIdx = meIdx === 0 ? 1 : (meIdx === 1 ? 0 : -1);
      if (meIdx >= 0 && opIdx >= 0) {
        myPlays = myPlays ?? extractTeamPlaysFromBox(bs, String(id));
        const oppId = teams[opIdx]?.team?.id ? String(teams[opIdx].team.id) : null;
        if (oppId) oppPlays = oppPlays ?? extractTeamPlaysFromBox(bs, oppId);
      }
    } catch {}
  }

  return { offense: typeof myPlays === 'number' && Number.isFinite(myPlays) ? myPlays : 0, defense: typeof oppPlays === 'number' && Number.isFinite(oppPlays) ? oppPlays : 0 };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const homeIn = toAbbr(String(req.query.home || ''));
    const awayIn = toAbbr(String(req.query.away || ''));
    const kickoffISO = String(req.query.kickoff || '').trim();
    if (!TEAM_ID[homeIn] || !TEAM_ID[awayIn] || !kickoffISO) {
      return res.status(200).json({ home: { offense: 0, defense: 0 }, away: { offense: 0, defense: 0 }, error: 'missing/invalid params' });
    }

    const key = `plays:${homeIn}:${awayIn}:${kickoffISO}`;
    const now = Date.now();
    const hit = CACHE.get(key);
    if (hit && now - hit.ts < TTL) return res.status(200).json(hit.data);

    const [hS, aS] = await Promise.allSettled([prevGamePlaysForTeam(homeIn, kickoffISO), prevGamePlaysForTeam(awayIn, kickoffISO)]);
    const home = hS.status === 'fulfilled' ? hS.value : { offense: 0, defense: 0 };
    const away = aS.status === 'fulfilled' ? aS.value : { offense: 0, defense: 0 };
    const data = { home, away };
    CACHE.set(key, { ts: now, data });
    return res.status(200).json(data);
  } catch (e: any) {
    logWarn('plays', e?.message || e);
    return res.status(200).json({ home: { offense: 0, defense: 0 }, away: { offense: 0, defense: 0 }, error: e?.message || 'plays error' });
  }
}
