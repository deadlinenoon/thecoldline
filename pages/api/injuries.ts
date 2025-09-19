import type { NextApiRequest, NextApiResponse } from 'next';
import { getMatchupContext } from '@/lib/providers/balldontlie';
import { balldontlieFetch } from '@/lib/providers/balldontlie/client';
import { toAbbr } from '@/lib/nfl-teams';
import { logWarn } from '@/lib/logs';
import type { InjuryItem, InjuryReport, InjuryTeamReport } from '@/lib/injuries/types';

const CACHE = new Map<string, { ts: number; data: InjuryReport }>();
const TTL = 10 * 60 * 1000;
const FALLBACK_SOURCE = 'balldontlie-api';

function serialize(list: InjuryItem[], sources: string[] = ['balldontlie-all-access']): InjuryTeamReport {
  const uniqueSources = Array.from(new Set(sources.filter(Boolean))).map(String);
  return {
    list,
    count: list.length,
    sources: uniqueSources,
  };
}

type RawInjury = Record<string, unknown>;

const pickString = (input: unknown): string | undefined => (typeof input === 'string' && input.trim() ? input.trim() : undefined);

function normalizeFallbackInjury(raw: RawInjury): InjuryItem | null {
  const player = (raw?.player ?? null) as Record<string, unknown> | null;
  const firstName = pickString((player as any)?.first_name) || pickString((player as any)?.firstName) || pickString(raw?.first_name);
  const lastName = pickString((player as any)?.last_name) || pickString((player as any)?.lastName) || pickString(raw?.last_name);
  const composed = [firstName, lastName].filter(Boolean).join(' ').trim();
  const nameCandidates = [
    pickString(raw?.player_name),
    pickString(raw?.name),
    pickString(raw?.athlete),
    pickString(raw?.full_name),
    pickString(raw?.fullName),
    pickString(raw?.display_name),
    pickString(raw?.displayName),
    composed,
  ];
  let name = '';
  for (const candidate of nameCandidates) {
    if (candidate && candidate.trim()) {
      name = candidate.trim();
      break;
    }
  }
  if (!name) return null;

  const statusCandidates = [
    pickString(raw?.status),
    pickString(raw?.designation),
    pickString(raw?.injury_status),
    pickString(raw?.timeline),
    pickString(raw?.availability),
  ];
  let status = '';
  for (const candidate of statusCandidates) {
    if (candidate && candidate.trim()) {
      status = candidate.trim();
      break;
    }
  }

  const positionCandidates = [
    pickString(raw?.position),
    pickString((player as any)?.position),
    pickString((player as any)?.primary_position),
    pickString((player as any)?.pos),
    pickString(raw?.role),
  ];
  let position = '';
  for (const candidate of positionCandidates) {
    if (candidate && candidate.trim()) {
      position = candidate.trim();
      break;
    }
  }

  const noteCandidates = [
    pickString(raw?.note),
    pickString(raw?.details),
    pickString(raw?.comment),
    pickString(raw?.injury),
    pickString(raw?.description),
    pickString(raw?.body),
    pickString(raw?.report),
  ];
  let note = '';
  for (const candidate of noteCandidates) {
    if (candidate && candidate.trim()) {
      note = candidate.trim();
      break;
    }
  }

  return {
    name,
    status: status || '—',
    position,
    note,
  };
}

function extractInjuryList(payload: unknown): RawInjury[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as RawInjury[];
  if (typeof payload !== 'object') return [];
  const container = payload as Record<string, unknown>;
  if (Array.isArray(container.data)) return container.data as RawInjury[];
  if (Array.isArray(container.injuries)) return container.injuries as RawInjury[];
  if (Array.isArray(container.results)) return container.results as RawInjury[];
  for (const value of Object.values(container)) {
    if (Array.isArray(value) && value.every(entry => entry && typeof entry === 'object')) {
      return value as RawInjury[];
    }
  }
  return [];
}

function buildTeamCandidates(...values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

async function fetchDirectInjuries(teamCandidates: string[], kickoff: string | null): Promise<InjuryItem[]> {
  if (!teamCandidates.length) return [];
  const errors: string[] = [];
  for (const candidate of teamCandidates) {
    try {
      const searchParams: Record<string, string> = {
        team: candidate,
        sport: 'nfl',
        limit: '40',
      };
      if (kickoff) searchParams.kickoff = kickoff;
      const payload = await balldontlieFetch<unknown>('sports/nfl/injuries', {
        searchParams,
        cacheTtlMs: TTL,
      });
      const rawList = extractInjuryList(payload);
      const normalized = rawList
        .map(normalizeFallbackInjury)
        .filter((item): item is InjuryItem => Boolean(item));
      if (normalized.length) return normalized.slice(0, 40);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate}: ${message}`);
    }
  }
  if (errors.length) {
    logWarn('injuries', `Fallback balldontlie injuries failed: ${errors.join('; ')}`);
  }
  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<InjuryReport>) {
  try {
    const homeRaw = String(req.query.home || '').trim();
    const awayRaw = String(req.query.away || '').trim();
    const kickoff = typeof req.query.kickoff === 'string' ? req.query.kickoff : null;
    const homeIn = toAbbr(homeRaw);
    const awayIn = toAbbr(awayRaw);
    if (!homeIn || !awayIn) {
      const data: InjuryReport = { home: serialize([]), away: serialize([]), error: 'unknown team' };
      return res.status(200).json(data);
    }

    const cacheKey = `${homeIn}:${awayIn}:${kickoff ?? 'na'}`;
    const now = Date.now();
    const cached = CACHE.get(cacheKey);
    if (cached && now - cached.ts < TTL) {
      return res.status(200).json(cached.data);
    }

    let context;
    try {
      context = await getMatchupContext({ home: homeIn, away: awayIn, kickoff, sport: 'nfl' });
      if (
        (!Array.isArray(context?.home?.injuries) || context.home.injuries.length === 0) &&
        (!Array.isArray(context?.away?.injuries) || context.away.injuries.length === 0) &&
        (homeRaw || awayRaw)
      ) {
        const fallback = await getMatchupContext({ home: homeRaw || homeIn, away: awayRaw || awayIn, kickoff, sport: 'nfl' });
        if (fallback) context = fallback;
      }
    } catch (error) {
      logWarn('injuries', error instanceof Error ? error.message : String(error));
      const data: InjuryReport = { home: serialize([]), away: serialize([]), error: 'balldontlie fetch failed' };
      CACHE.set(cacheKey, { ts: now, data });
      return res.status(200).json(data);
    }

    let home = serialize(Array.isArray(context?.home?.injuries) ? context.home.injuries : []);
    let away = serialize(Array.isArray(context?.away?.injuries) ? context.away.injuries : []);

    if (home.list.length === 0) {
      const homeCandidates = buildTeamCandidates(
        context?.home?.displayName,
        context?.home?.name,
        context?.home?.alias,
        homeRaw,
        homeIn,
      );
      const fallback = await fetchDirectInjuries(homeCandidates, kickoff);
      if (fallback.length) {
        home = serialize(fallback, [...home.sources, FALLBACK_SOURCE]);
      }
    }

    if (away.list.length === 0) {
      const awayCandidates = buildTeamCandidates(
        context?.away?.displayName,
        context?.away?.name,
        context?.away?.alias,
        awayRaw,
        awayIn,
      );
      const fallback = await fetchDirectInjuries(awayCandidates, kickoff);
      if (fallback.length) {
        away = serialize(fallback, [...away.sources, FALLBACK_SOURCE]);
      }
    }
    const data: InjuryReport = { home, away };
    CACHE.set(cacheKey, { ts: now, data });
    return res.status(200).json(data);
  } catch (e: any) {
    logWarn('injuries', e?.message || e);
    const data: InjuryReport = { home: serialize([]), away: serialize([]), error: e?.message || 'injuries error' };
    return res.status(200).json(data);
  }
}
