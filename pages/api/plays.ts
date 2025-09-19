import type { NextApiRequest, NextApiResponse } from "next";
import { getTeamPace } from '@/lib/providers/balldontlie';
import { toAbbr } from '@/lib/nfl-teams';
import { logWarn } from '@/lib/logs';

const CACHE = new Map<string, { ts: number; data: any }>();
const TTL = 10 * 60 * 1000;

const ZERO_PACE = { offense: 0, defense: 0 };

function normalizePaceValue(value: number | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(2));
  return 0;
}

function toPayload(pace: Awaited<ReturnType<typeof getTeamPace>>) {
  return {
    offense: normalizePaceValue(pace.offense),
    defense: normalizePaceValue(pace.defense),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const homeRaw = String(req.query.home || '').trim();
    const awayRaw = String(req.query.away || '').trim();
    const kickoff = typeof req.query.kickoff === 'string' ? req.query.kickoff : null;
    const homeIn = toAbbr(homeRaw);
    const awayIn = toAbbr(awayRaw);
    if (!homeIn || !awayIn) {
      return res.status(200).json({ home: ZERO_PACE, away: ZERO_PACE, error: 'missing/invalid params' });
    }

    const cacheKey = `${homeIn}:${awayIn}:${kickoff ?? 'na'}`;
    const now = Date.now();
    const cached = CACHE.get(cacheKey);
    if (cached && now - cached.ts < TTL) {
      return res.status(200).json(cached.data);
    }

    const args = { home: homeRaw || homeIn, away: awayRaw || awayIn, kickoff } as const;
    let homePace;
    let awayPace;
    try {
      [homePace, awayPace] = await Promise.all([getTeamPace(args, 'home'), getTeamPace(args, 'away')]);
    } catch (error) {
      logWarn('plays', error instanceof Error ? error.message : String(error));
      const data = { home: ZERO_PACE, away: ZERO_PACE, error: 'balldontlie fetch failed' };
      CACHE.set(cacheKey, { ts: now, data });
      return res.status(200).json(data);
    }

    const payload = {
      home: toPayload(homePace),
      away: toPayload(awayPace),
    };
    CACHE.set(cacheKey, { ts: now, data: payload });
    return res.status(200).json(payload);
  } catch (e: any) {
    logWarn('plays', e?.message || e);
    return res.status(200).json({ home: ZERO_PACE, away: ZERO_PACE, error: e?.message || 'plays error' });
  }
}
