import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllAccessConfig } from '@/lib/env';
import { getMatchupContext } from '@/lib/providers/balldontlie';
import { balldontlieFetch } from '@/lib/providers/balldontlie/client';
import { TEAM_ID, toAbbr } from '@/lib/nfl-teams';
import { logWarn } from '@/lib/logs';
import type { InjuryItem, InjuryReport, InjuryTeamReport } from '@/lib/injuries/types';

const CACHE = new Map<string, { ts: number; data: InjuryReport }>();
const TTL = 10 * 60 * 1000;
const FALLBACK_SOURCE = 'balldontlie-api';
const ESPN_SOURCE = 'espn-api';

const ESPN_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (compatible; TheColdLine/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  Accept: 'application/json',
};

// Canonical 2–3 letter codes the upstream provider expects.
const TEAM_ALIASES: Record<string, string> = {
  ARI: 'ARI', ARZ: 'ARI', AZ: 'ARI', ARIZONA: 'ARI', CARDINALS: 'ARI',
  ATL: 'ATL', ATLANTA: 'ATL', FALCONS: 'ATL',
  BAL: 'BAL', BALTIMORE: 'BAL', RAVENS: 'BAL',
  BUF: 'BUF', BUFFALO: 'BUF', BILLS: 'BUF',
  CAR: 'CAR', CAROLINA: 'CAR', PANTHERS: 'CAR',
  CHI: 'CHI', CHICAGO: 'CHI', BEARS: 'CHI',
  CIN: 'CIN', CINCINNATI: 'CIN', BENGALS: 'CIN',
  CLE: 'CLE', CLEVELAND: 'CLE', BROWNS: 'CLE',
  DAL: 'DAL', DALLAS: 'DAL', COWBOYS: 'DAL',
  DEN: 'DEN', DENVER: 'DEN', BRONCOS: 'DEN',
  DET: 'DET', DETROIT: 'DET', LIONS: 'DET',
  GB: 'GB', GBP: 'GB', GNB: 'GB', 'GREEN BAY': 'GB', PACKERS: 'GB',
  HOU: 'HOU', HST: 'HOU', HOUSTON: 'HOU', TEXANS: 'HOU',
  IND: 'IND', INDY: 'IND', INDIANAPOLIS: 'IND', COLTS: 'IND',
  JAX: 'JAX', JAC: 'JAX', JACKSONVILLE: 'JAX', JAGS: 'JAX', JAGUARS: 'JAX',
  KC: 'KC', KCC: 'KC', KAN: 'KC', 'KANSAS CITY': 'KC', KCY: 'KC', CHIEFS: 'KC',
  LAC: 'LAC', SD: 'LAC', SDG: 'LAC', 'SAN DIEGO': 'LAC', CHARGERS: 'LAC',
  LAR: 'LAR', STL: 'LAR', 'ST LOUIS': 'LAR', 'ST. LOUIS': 'LAR', RAMS: 'LAR', 'LOS ANGELES RAMS': 'LAR',
  LV: 'LV', LVR: 'LV', OAK: 'LV', OAKLAND: 'LV', RAIDERS: 'LV', 'LAS VEGAS RAIDERS': 'LV',
  MIA: 'MIA', MIAMI: 'MIA', DOLPHINS: 'MIA',
  MIN: 'MIN', MINN: 'MIN', MINNESOTA: 'MIN', VIKINGS: 'MIN',
  NE: 'NE', NEN: 'NE', NWE: 'NE', 'NEW ENGLAND': 'NE', PATRIOTS: 'NE',
  NO: 'NO', NOR: 'NO', 'NEW ORLEANS': 'NO', SAINTS: 'NO',
  NYG: 'NYG', 'NEW YORK GIANTS': 'NYG', GIANTS: 'NYG',
  NYJ: 'NYJ', 'NEW YORK JETS': 'NYJ', JETS: 'NYJ',
  PHI: 'PHI', PHL: 'PHI', PHILA: 'PHI', PHILADELPHIA: 'PHI', EAGLES: 'PHI',
  PIT: 'PIT', PITTSBURGH: 'PIT', STEELERS: 'PIT',
  SEA: 'SEA', SEATTLE: 'SEA', SEAHAWKS: 'SEA',
  SF: 'SF', SFO: 'SF', 'SAN FRANCISCO': 'SF', '49ERS': 'SF', NINERS: 'SF',
  TB: 'TB', TBB: 'TB', TAM: 'TB', 'TAMPA BAY': 'TB', BUCS: 'TB', BUCCANEERS: 'TB',
  TEN: 'TEN', TNS: 'TEN', TENNESSEE: 'TEN', TITANS: 'TEN',
  WAS: 'WAS', WSH: 'WAS', WFT: 'WAS', WASHINGTON: 'WAS', COMMANDERS: 'WAS', REDSKINS: 'WAS', 'FOOTBALL TEAM': 'WAS',
};

function normalizeTeam(q: string): string {
  const k = (q || '').trim().toUpperCase();
  return TEAM_ALIASES[k] || k;
}

function toCanon(input: string): string {
  const normalized = normalizeTeam(input);
  if (!normalized) return '';
  const abbr = toAbbr(normalized);
  return TEAM_ID[abbr] ? abbr : '';
}

function firstQueryValue(input: string | string[] | undefined): string {
  if (Array.isArray(input)) {
    const [value = ''] = input;
    return typeof value === 'string' ? value : '';
  }
  return typeof input === 'string' ? input : '';
}

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
        onRequest: ({ url, method, searchParams: params }) => {
          console.log('[injuries] balldontlie request', { team: candidate, method, url, searchParams: params });
        },
        onResponse: ({ url, status, method }) => {
          console.log('[injuries] balldontlie response', { team: candidate, method, url, status });
        },
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

async function fetchEspnInjuries(teamAbbr: string): Promise<InjuryItem[]> {
  const key = String(teamAbbr || '').trim().toUpperCase();
  const lookup = TEAM_ID[key];
  if (!lookup) return [];
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${lookup}/injuries`;
    console.log('[injuries] espn request', { url });
    const resp = await fetch(url, { headers: ESPN_HEADERS, cache: 'no-store' });
    console.log('[injuries] espn response', { url, status: resp.status });
    if (!resp.ok) throw new Error(`espn injuries ${resp.status}`);
    const payload = await resp.json().catch(() => ({}));
    const groups = Array.isArray(payload?.injuries) ? payload.injuries : [];
    const collected: InjuryItem[] = [];
    for (const group of groups) {
      const bucket = Array.isArray(group?.injuries)
        ? group.injuries
        : Array.isArray(group?.athletes)
          ? group.athletes
          : [];
      for (const entry of bucket) {
        const athlete = (entry?.athlete ?? {}) as Record<string, unknown>;
        const nameCandidates = [
          pickString(entry?.name),
          pickString(athlete?.displayName),
          pickString(athlete?.fullName),
          pickString(`${athlete?.firstName || ''} ${athlete?.lastName || ''}`),
        ];
        const name = nameCandidates.find(Boolean);
        if (!name) continue;
        const statusCandidates = [
          pickString(entry?.status),
          pickString(entry?.injuryStatus),
          pickString(group?.status),
        ];
        const positionCandidates = [
          pickString(entry?.position),
          pickString((athlete?.position as Record<string, unknown> | undefined)?.abbreviation),
          pickString((athlete?.position as Record<string, unknown> | undefined)?.displayName),
        ];
        const noteCandidates = [
          pickString(entry?.details),
          pickString(entry?.comment),
          pickString(entry?.note),
          pickString(group?.comment),
        ];
        collected.push({
          name,
          status: statusCandidates.find(Boolean) || '—',
          position: positionCandidates.find(Boolean) || '',
          note: noteCandidates.find(Boolean) || '',
        });
      }
    }
    if (!collected.length) return [];
    const seen = new Set<string>();
    const deduped: InjuryItem[] = [];
    for (const item of collected) {
      const key = `${item.name}|${item.status}|${item.position}|${item.note}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= 40) break;
    }
    return deduped;
  } catch (error) {
    logWarn('injuries', error instanceof Error ? `ESPN fallback failed: ${error.message}` : `ESPN fallback failed: ${String(error)}`);
    return [];
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InjuryReport | { error: string }>,
) {
  try {
    const query = req.query as Record<string, string | string[] | undefined>;
    const pick = (...keys: string[]): string => {
      for (const key of keys) {
        const value = firstQueryValue(query[key]);
        if (value) return value;
      }
      return '';
    };
    const teamAInput = pick('teamA', 'home', 'team1');
    const teamBInput = pick('teamB', 'away', 'team2');
    const rawA = teamAInput.trim();
    const rawB = teamBInput.trim();
    console.log('[injuries] raw:', req.query);
    const teamA = toCanon(rawA);
    const teamB = toCanon(rawB);
    const kickoff = typeof req.query.kickoff === 'string' ? req.query.kickoff : null;
    const { baseUrl: injBaseRaw } = getAllAccessConfig();
    const INJ_BASE = injBaseRaw.replace(/\/+$/, '');
    const buildInjuryUrl = (team: string): URL => {
      const url = new URL(`${INJ_BASE}/sports/nfl/injuries`);
      if (team) url.searchParams.set('team', team);
      url.searchParams.set('sport', 'nfl');
      url.searchParams.set('limit', '40');
      if (kickoff) url.searchParams.set('kickoff', kickoff);
      return url;
    };
    const urlA = buildInjuryUrl(teamA);
    const urlB = buildInjuryUrl(teamB);
    console.log('[injuries] normalized:', { teamA, teamB });
    console.log('[injuries] INJ_BASE:', INJ_BASE);
    console.log('[injuries] URL A/B:', urlA.toString(), urlB.toString());
    const homeOriginal = rawA;
    const awayOriginal = rawB;
    const homeRaw = normalizeTeam(homeOriginal);
    const awayRaw = normalizeTeam(awayOriginal);
    const homeCanonical = teamA;
    const awayCanonical = teamB;
    if (!homeCanonical || !awayCanonical) {
      return res.status(400).json({ error: 'teamA and teamB are required' });
    }

    const cacheKey = `${homeCanonical}:${awayCanonical}:${kickoff ?? 'na'}`;
    const now = Date.now();
    const cached = CACHE.get(cacheKey);
    if (cached && now - cached.ts < TTL) {
      return res.status(200).json(cached.data);
    }

    let context;
    try {
      context = await getMatchupContext({ home: homeCanonical, away: awayCanonical, kickoff, sport: 'nfl' });
      if (
        (!Array.isArray(context?.home?.injuries) || context.home.injuries.length === 0) &&
        (!Array.isArray(context?.away?.injuries) || context.away.injuries.length === 0) &&
        (homeOriginal || awayOriginal)
      ) {
        const fallback = await getMatchupContext({
          home: homeOriginal || homeRaw || homeCanonical,
          away: awayOriginal || awayRaw || awayCanonical,
          kickoff,
          sport: 'nfl',
        });
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
        homeOriginal,
        homeRaw,
        homeCanonical,
      );
      const fallback = await fetchDirectInjuries(homeCandidates, kickoff);
      if (fallback.length) {
        home = serialize(fallback, [...home.sources, FALLBACK_SOURCE]);
      } else {
        const espn = await fetchEspnInjuries(homeCanonical);
        if (espn.length) {
          home = serialize(espn, [...home.sources, ESPN_SOURCE]);
        }
      }
    }

    if (away.list.length === 0) {
      const awayCandidates = buildTeamCandidates(
        context?.away?.displayName,
        context?.away?.name,
        context?.away?.alias,
        awayOriginal,
        awayRaw,
        awayCanonical,
      );
      const fallback = await fetchDirectInjuries(awayCandidates, kickoff);
      if (fallback.length) {
        away = serialize(fallback, [...away.sources, FALLBACK_SOURCE]);
      } else {
        const espn = await fetchEspnInjuries(awayCanonical);
        if (espn.length) {
          away = serialize(espn, [...away.sources, ESPN_SOURCE]);
        }
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
