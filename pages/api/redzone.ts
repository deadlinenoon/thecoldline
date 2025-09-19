import type { NextApiRequest, NextApiResponse } from "next";
import { getTeamRedZone } from '@/lib/providers/balldontlie';
import { getRedZoneMatchupFeed } from '@/lib/providers/redzone';
import { toAbbr } from '@/lib/nfl-teams';
import { logWarn } from '@/lib/logs';

const DEBUG = true;

type RedZoneTeam = {
  offensePct: number;
  defensePct: number;
  offense?: {
    tdPct?: number | null;
    fgPct?: number | null;
    turnoverPct?: number | null;
  };
  defense?: {
    tdPct?: number | null;
    fgPct?: number | null;
    takeawayPct?: number | null;
  };
};

type RedZoneResponse = { home: RedZoneTeam; away: RedZoneTeam; error?: string; debug?: any };

type CacheEntry = { ts: number; data: RedZoneResponse };

const CACHE = new Map<string, CacheEntry>();
const TTL = 10 * 60 * 1000;

const ZERO_TEAM: RedZoneTeam = {
  offensePct: 0,
  defensePct: 0,
  offense: { tdPct: null, fgPct: null, turnoverPct: null },
  defense: { tdPct: null, fgPct: null, takeawayPct: null },
};

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/%/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeShare(raw: unknown): number {
  const val = coerceNumber(raw);
  if (val === null) return 0;
  if (val < 0) return 0;
  if (val <= 1) return val;
  if (val <= 100) return val / 100;
  return 1;
}

function mapLegacyTeam(redZone: Awaited<ReturnType<typeof getTeamRedZone>> | null): RedZoneTeam {
  const offense = redZone?.offense ?? {};
  const defense = redZone?.defense ?? {};
  const td = coerceNumber((offense as any).td);
  const fg = coerceNumber((offense as any).fg);
  const turnover = coerceNumber((offense as any).turnover);
  const tdAllowed = coerceNumber((defense as any).tdAllowed);
  const fgAllowed = coerceNumber((defense as any).fgAllowed);
  const takeaway = coerceNumber((defense as any).takeaway);
  return {
    offensePct: Math.round(normalizeShare(td) * 100),
    defensePct: Math.round(normalizeShare(tdAllowed) * 100),
    offense: { tdPct: td, fgPct: fg, turnoverPct: turnover },
    defense: { tdPct: tdAllowed, fgPct: fgAllowed, takeawayPct: takeaway },
  };
}

function mapFeedTeam(team: Record<string, unknown> | undefined): RedZoneTeam {
  const offense = (team?.offense ?? {}) as Record<string, unknown>;
  const defense = (team?.defense ?? {}) as Record<string, unknown>;

  const offenseTd = coerceNumber(
    offense.touchdown ?? offense.tdPct ?? offense.td_pct ?? offense.td ?? offense.tdRate ?? offense.touchdown_pct,
  );
  const offenseFg = coerceNumber(
    offense.field_goal ?? offense.fieldGoal ?? offense.fgPct ?? offense.fg_pct ?? offense.fg ?? offense.field_goal_pct,
  );
  const offenseTo = coerceNumber(
    offense.turnover ?? offense.turnoverPct ?? offense.turnover_pct ?? offense.takeaway_pct,
  );

  const defenseTd = coerceNumber(
    defense.touchdown_allowed ?? defense.tdAllowed ?? defense.td_allowed_pct ?? defense.td_allowed ?? defense.touchdown_pct,
  );
  const defenseFg = coerceNumber(
    defense.field_goal_allowed ?? defense.fgAllowed ?? defense.fg_allowed_pct ?? defense.fieldgoal_allowed_pct,
  );
  const defenseTk = coerceNumber(
    defense.takeaway ?? defense.takeawayPct ?? defense.takeaway_pct ?? defense.takeaways,
  );

  return {
    offensePct: Math.round(normalizeShare(offenseTd) * 100),
    defensePct: Math.round(normalizeShare(defenseTd) * 100),
    offense: { tdPct: offenseTd, fgPct: offenseFg, turnoverPct: offenseTo },
    defense: { tdPct: defenseTd, fgPct: defenseFg, takeawayPct: defenseTk },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<RedZoneResponse>) {
  let debugInfoRef: any = null;
  try {
    const homeRaw = String(req.query.home || '').trim();
    const awayRaw = String(req.query.away || '').trim();
    const kickoff = typeof req.query.kickoff === 'string' ? req.query.kickoff : null;
    const homeIn = toAbbr(homeRaw);
    const awayIn = toAbbr(awayRaw);
    const debugInfo: any = { params: { homeRaw, awayRaw, homeIn, awayIn, kickoff } };
    debugInfoRef = debugInfo;

    if (!homeRaw || !awayRaw) {
      const data: RedZoneResponse = { home: ZERO_TEAM, away: ZERO_TEAM, error: 'missing/invalid params' };
      const response = DEBUG && req.query.debug ? { ...data, debug: debugInfo } : data;
      return res.status(400).json(response);
    }

    if (!homeIn || !awayIn) {
      const data: RedZoneResponse = { home: ZERO_TEAM, away: ZERO_TEAM, error: 'unknown team' };
      const response = DEBUG && req.query.debug ? { ...data, debug: debugInfo } : data;
      return res.status(200).json(response);
    }

    const cacheKey = `${homeIn}:${awayIn}:${kickoff ?? 'na'}`;
    const now = Date.now();
    const cached = CACHE.get(cacheKey);
    if (cached && now - cached.ts < TTL) {
      const response = DEBUG && req.query.debug ? { ...cached.data, debug: { ...debugInfo, source: 'cache' } } : cached.data;
      return res.status(200).json(response);
    }

    const args = { home: homeRaw || homeIn, away: awayRaw || awayIn, kickoff } as const;

    const feed = await getRedZoneMatchupFeed(args).catch(error => {
      logWarn('redzone', error instanceof Error ? error.message : String(error));
      if (DEBUG) debugInfo.feedError = error instanceof Error ? error.message : String(error);
      return null;
    });

    if (feed && feed.home && feed.away) {
      const data: RedZoneResponse = {
        home: mapFeedTeam(feed.home as Record<string, unknown>),
        away: mapFeedTeam(feed.away as Record<string, unknown>),
      };
      const response = DEBUG && req.query.debug ? { ...data, debug: { ...debugInfo, source: 'feed' } } : data;
      CACHE.set(cacheKey, { ts: now, data });
      return res.status(200).json(response);
    }

    try {
      const [homeRz, awayRz] = await Promise.all([
        getTeamRedZone(args, 'home'),
        getTeamRedZone(args, 'away'),
      ]);
      if (!homeRz || !awayRz) {
        throw new Error('redzone fetch failed');
      }
      const payloadBase: RedZoneResponse = { home: mapLegacyTeam(homeRz), away: mapLegacyTeam(awayRz) };
      const payload = DEBUG && req.query.debug ? { ...payloadBase, debug: { ...debugInfo, source: 'legacy' } } : payloadBase;
      CACHE.set(cacheKey, { ts: now, data: payloadBase });
      return res.status(200).json(payload);
    } catch (error: any) {
      logWarn('redzone', error?.message || error);
      if (DEBUG) debugInfo.error = error?.message || String(error);
      const data: RedZoneResponse = { home: ZERO_TEAM, away: ZERO_TEAM, error: 'redzone fetch failed' };
      const response = DEBUG && req.query.debug ? { ...data, debug: debugInfo } : data;
      CACHE.set(cacheKey, { ts: now, data });
      return res.status(200).json(response);
    }
  } catch (error: any) {
    logWarn('redzone', error?.message || error);
    const fallback: RedZoneResponse = { home: ZERO_TEAM, away: ZERO_TEAM, error: 'redzone route error' };
    const response = DEBUG && req.query.debug ? { ...fallback, debug: (debugInfoRef ? { ...debugInfoRef, error: error?.message || String(error) } : { error: error?.message || String(error) }) } : fallback;
    return res.status(200).json(response);
  }
}
