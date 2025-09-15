import type { NextApiRequest, NextApiResponse } from 'next';
import { TEAM_ID, toAbbr } from '../../lib/nfl-teams';
import { logWarn } from '../../lib/logs';

const CACHE = new Map<string, { ts: number; data: any }>();
const TTL = 15 * 60 * 1000;

async function fetchInj(abbr: string) {
  const id = TEAM_ID[abbr];
  if (!id) return { list: [], count: 0 };
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/injuries`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const groups = Array.isArray(j?.injuries) ? j.injuries : [];
    const list: any[] = [];
    for (const g of groups) {
      const athletes = g?.athletes || g?.injuries || [];
      for (const a of athletes) {
        list.push({
          name: a?.athlete?.displayName ?? a?.name ?? '',
          status: a?.status ?? g?.status ?? a?.injuryStatus ?? '',
          position: a?.athlete?.position?.abbreviation ?? a?.position ?? '',
          note: a?.details ?? a?.comment ?? ''
        });
      }
    }
    const seen = new Set<string>();
    const uniq: any[] = [];
    for (const it of list) {
      const key = (it.name || '').toUpperCase();
      if (key && !seen.has(key)) { seen.add(key); uniq.push(it); }
    }
    const sliced = uniq.slice(0, 9);
    return { list: sliced, count: sliced.length };
  } catch (e: any) {
    return { list: [], count: 0, error: e?.message || 'injuries fetch failed' };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const homeIn = toAbbr(String(req.query.home || ''));
    const awayIn = toAbbr(String(req.query.away || ''));
    if (!TEAM_ID[homeIn] || !TEAM_ID[awayIn]) {
      const data = { home: { list: [], count: 0 }, away: { list: [], count: 0 }, error: 'unknown team' };
      return res.status(200).json(data);
    }
    const key = `injuries:${homeIn}:${awayIn}`;
    const now = Date.now();
    const hit = CACHE.get(key);
    if (hit && now - hit.ts < TTL) return res.status(200).json(hit.data);

    const [h, a] = await Promise.all([fetchInj(homeIn), fetchInj(awayIn)]);
    const data = { home: h, away: a };
    CACHE.set(key, { ts: now, data });
    return res.status(200).json(data);
  } catch (e: any) {
    logWarn('injuries', e?.message || e);
    const data = { home: { list: [], count: 0 }, away: { list: [], count: 0 }, error: e?.message || 'injuries error' };
    return res.status(200).json(data);
  }
}
