import type { NextApiRequest, NextApiResponse } from "next";
import { TEAM_ID, toAbbr } from "../../lib/nfl-teams";
import { logWarn } from "../../lib/logs";

async function j<T = any>(u: string) {
  const r = await fetch(u, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json() as Promise<T>;
}

type CacheEntry = { ts: number; data: any };
const CACHE = new Map<string, CacheEntry>();
const TTL = 15 * 60 * 1000;

function pct(n: any) { const v = Number(n); if (!Number.isFinite(v) || v < 0) return 0; if (v > 100) return 100; return Math.round(v); }

async function teamRZByAbbr(abbr: string) {
  const id = TEAM_ID[abbr];
  if (!id) return { offensePct: 0, defensePct: 0, error: 'unknown team' } as any;
  try {
    // Prefer team statistics endpoint linked from team page
    const stats: any = await j(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/statistics`);
    const cats = stats?.team?.statistics?.splits?.categories || [];
    const statsFlat = cats.flatMap((c: any) => (c?.statistics || c?.stats || []));
    function pick(key: string) {
      const f = statsFlat.find((s: any) => new RegExp(key, 'i').test(String(s?.name || s?.displayName || '')));
      const v = typeof f?.value === 'number' ? f.value : (typeof f?.displayValue === 'string' ? parseFloat(String(f.displayValue).replace('%', '')) : null);
      return v;
    }
    const offTdPct = pick('^red.?zone.*touchdown.*pct|offense.*red.?zone.*touchdown');
    const offScorePct = pick('^red.?zone.*scor.*(td|fg).*(pct)|offense.*red.?zone.*scor');
    const offAtt = pick('^red.?zone.*attempts|offense.*red.?zone.*att');
    const offTds = pick('^red.?zone.*touchdowns|offense.*red.?zone.*tds?');
    const defTdPct = pick('^opponent.*red.?zone.*touchdown.*pct|defense.*red.?zone.*touchdown');
    const defScorePct = pick('^opponent.*red.?zone.*scor.*(td|fg).*(pct)|defense.*red.?zone.*scor');
    const defAtt = pick('^opponent.*red.?zone.*attempts|defense.*red.?zone.*att');
    const defTds = pick('^opponent.*red.?zone.*touchdowns|defense.*red.?zone.*tds?');
    const calcPct = (att: any, tds: any, pctIn: any) => {
      if (typeof pctIn === 'number' && Number.isFinite(pctIn)) return pctIn;
      if (typeof att === 'number' && typeof tds === 'number' && att > 0) return (tds / att) * 100;
      return 0;
    };
    const oTd = pct(calcPct(offAtt, offTds, offTdPct));
    const dTd = pct(calcPct(defAtt, defTds, defTdPct));
    const oScore = pct(offScorePct);
    const dScore = pct(defScorePct);
    const clamp0 = (x:number)=> Math.max(0, Math.min(100, Math.round(x)));
    const oFg = clamp0(oScore - oTd);
    const dFg = clamp0(dScore - dTd);
    const oStop = clamp0(100 - oScore);
    const dStop = clamp0(100 - dScore);
    return {
      // legacy
      offensePct: oTd,
      defensePct: dTd,
      // rich breakdown
      offense: { tdPct: oTd, fgPct: oFg, stopPct: oStop, scorePct: oScore },
      defense: { tdPct: dTd, fgPct: dFg, stopPct: dStop, scorePct: dScore }
    } as any;
  } catch (e: any) {
    return { offensePct: 0, defensePct: 0, error: e?.message || 'redzone fetch failed' } as any;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const homeIn = toAbbr(String(req.query.home || ''));
    const awayIn = toAbbr(String(req.query.away || ''));
    const team = String(req.query.team || '').trim();

    if (team && !homeIn && !awayIn) {
      // single-team legacy mode (keep, but normalize if abbr)
      const ab = toAbbr(team);
      const key = `rz:one:${ab}`;
      const now = Date.now();
      const hit = CACHE.get(key);
      if (hit && now - hit.ts < TTL) return res.status(200).json(hit.data);
      const out = await teamRZByAbbr(ab);
      CACHE.set(key, { ts: now, data: out });
      return res.status(200).json(out);
    }

    if (!TEAM_ID[homeIn] || !TEAM_ID[awayIn]) {
      return res.status(200).json({ home: { offensePct: 0, defensePct: 0 }, away: { offensePct: 0, defensePct: 0 }, error: 'unknown team' });
    }

    const key = `rz:${homeIn}:${awayIn}`;
    const now = Date.now();
    const hit = CACHE.get(key);
    if (hit && now - hit.ts < TTL) return res.status(200).json(hit.data);

    const [rh, ra] = await Promise.allSettled([teamRZByAbbr(homeIn), teamRZByAbbr(awayIn)]);
    const out = {
      home: rh.status === 'fulfilled' ? rh.value : { offensePct: 0, defensePct: 0 },
      away: ra.status === 'fulfilled' ? ra.value : { offensePct: 0, defensePct: 0 },
    };
    CACHE.set(key, { ts: now, data: out });
    return res.status(200).json(out);
  } catch (e: any) {
    logWarn('redzone', e?.message || e);
    return res.status(200).json({ home: { offensePct: 0, defensePct: 0 }, away: { offensePct: 0, defensePct: 0 }, error: e?.message || 'redzone route error' });
  }
}
