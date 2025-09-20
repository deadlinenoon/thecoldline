import { balldontlieFetch } from '@/lib/providers/balldontlie/client';

type InjuryItem = {
  name: string;
  status: string;
  position: string;
  note: string;
};

type RedZoneOffense = {
  td: number | null;
  fg: number | null;
  turnover: number | null;
};

type RedZoneDefense = {
  tdAllowed: number | null;
  fgAllowed: number | null;
  takeaway: number | null;
};

type PaceProfile = {
  offense: number | null;
  defense: number | null;
};

type TeamContext = {
  id: string;
  name: string;
  alias: string | null;
  displayName: string;
  sport: string;
  league: string | null;
  logos: string[];
  injuries: InjuryItem[];
  redZone: {
    offense: RedZoneOffense;
    defense: RedZoneDefense;
  };
  pace: PaceProfile;
};

export type MatchupBadge = {
  id: string;
  label: string;
  emoji?: string;
  color?: string;
};

export type MatchupContext = {
  home: TeamContext;
  away: TeamContext;
  badges: MatchupBadge[];
  kickoff: string | null;
  sport: string;
};

type RawBadge = {
  id?: string;
  label?: string;
  emoji?: string;
  icon?: string;
  color?: string;
};

type RawInjury = Record<string, unknown>;

type RawRedZone = {
  offense?: Record<string, unknown>;
  defense?: Record<string, unknown>;
};

type RawTeamContext = {
  id?: string;
  team_id?: string;
  name?: string;
  full_name?: string;
  display_name?: string;
  alias?: string;
  logos?: Array<{ url?: string } | string>;
  logo?: string;
  sport?: string;
  league?: string;
  injuries?: RawInjury[];
  metrics?: {
    red_zone?: RawRedZone;
    pace?: Record<string, unknown>;
  };
  red_zone?: RawRedZone;
  pace?: Record<string, unknown>;
};

type RawContext = {
  home?: RawTeamContext;
  away?: RawTeamContext;
  teams?: {
    home?: RawTeamContext;
    away?: RawTeamContext;
  };
  badges?: RawBadge[];
  kickoff?: string;
  sport?: string;
};

const MATCHUP_CACHE = new Map<string, { ts: number; data: MatchupContext }>();
const MATCHUP_TTL_MS = 5 * 60 * 1000;

function normalizeName(input: unknown): string {
  if (typeof input === 'string') return input.trim();
  return '';
}

function joinName(first: unknown, last: unknown): string {
  const firstName = normalizeName(first);
  const lastName = normalizeName(last);
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function normalizeId(team: RawTeamContext | undefined): string {
  const candidates = [team?.id, team?.team_id, team?.alias];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length) return value.trim();
  }
  return normalizeName(team?.name) || normalizeName(team?.full_name) || normalizeName(team?.display_name);
}

function normalizeLogos(team: RawTeamContext | undefined): string[] {
  if (!team) return [];
  if (Array.isArray(team.logos)) {
    const urls: string[] = [];
    for (const entry of team.logos) {
      if (typeof entry === 'string') {
        if (entry.trim()) urls.push(entry.trim());
      } else if (entry && typeof entry === 'object' && typeof (entry as any).url === 'string') {
        const url = (entry as any).url.trim();
        if (url) urls.push(url);
      }
    }
    if (urls.length) return urls;
  }
  if (typeof team.logo === 'string' && team.logo.trim()) return [team.logo.trim()];
  return [];
}

function normalizeInjury(raw: RawInjury): InjuryItem | null {
  const player = (raw?.player ?? null) as Record<string, unknown> | null;
  const nestedName = joinName(player?.first_name, player?.last_name) || joinName(player?.firstName, player?.lastName);
  const name = normalizeName(
    raw?.player_name ||
      raw?.name ||
      raw?.athlete ||
      (player?.full_name as string | undefined) ||
      (player?.fullName as string | undefined) ||
      (player?.display_name as string | undefined) ||
      nestedName
  );
  if (!name) return null;
  const status = normalizeName(raw?.status || raw?.designation || raw?.injury_status || raw?.timeline);
  const position = normalizeName(
    raw?.position ||
      (player?.position as string | undefined) ||
      (player?.primary_position as string | undefined) ||
      (player?.pos as string | undefined) ||
      raw?.role
  );
  const note = normalizeName(
    raw?.note ||
      raw?.details ||
      raw?.comment ||
      raw?.injury ||
      raw?.description ||
      raw?.body ||
      raw?.report
  );
  return {
    name,
    status,
    position,
    note,
  };
}

function normalizeInjuries(list: RawInjury[] | undefined): InjuryItem[] {
  if (!Array.isArray(list)) return [];
  const out: InjuryItem[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const item = normalizeInjury(raw);
    if (!item) continue;
    const key = `${item.name}|${item.status}|${item.position}|${item.note}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 20);
}

function coerceMetric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeRedZone(source: RawRedZone | undefined): { offense: RedZoneOffense; defense: RedZoneDefense } {
  const offense = source?.offense ?? {};
  const defense = source?.defense ?? {};
  return {
    offense: {
      td: coerceMetric((offense as any).td ?? (offense as any).td_pct ?? (offense as any).touchdown_pct),
      fg: coerceMetric((offense as any).fg ?? (offense as any).fg_pct ?? (offense as any).field_goal_pct),
      turnover: coerceMetric((offense as any).turnover ?? (offense as any).turnover_pct ?? (offense as any).giveaway_pct),
    },
    defense: {
      tdAllowed: coerceMetric((defense as any).td_allowed ?? (defense as any).td_allowed_pct ?? (defense as any).touchdown_allowed_pct),
      fgAllowed: coerceMetric((defense as any).fg_allowed ?? (defense as any).fg_allowed_pct ?? (defense as any).field_goal_allowed_pct),
      takeaway: coerceMetric((defense as any).takeaway ?? (defense as any).takeaway_pct ?? (defense as any).takeaways_in_rz_pct),
    },
  };
}

function normalizePace(source: Record<string, unknown> | undefined): PaceProfile {
  if (!source) return { offense: null, defense: null };
  const offense = coerceMetric(source.offense ?? source.offense_drives ?? source.offensive_drives_per_game);
  const defense = coerceMetric(source.defense ?? source.defense_drives ?? source.defensive_drives_per_game);
  return { offense, defense };
}

function normalizeBadge(raw: RawBadge, fallbackIndex: number): MatchupBadge {
  const label = normalizeName(raw?.label || raw?.id) || `Badge ${fallbackIndex + 1}`;
  const emoji = normalizeName(raw?.emoji || raw?.icon);
  const color = normalizeName(raw?.color);
  return {
    id: normalizeName(raw?.id) || label.toLowerCase().replace(/\s+/g, '-'),
    label,
    emoji: emoji || undefined,
    color: color || undefined,
  };
}

function normalizeTeamContext(raw: RawTeamContext | undefined, defaults: { fallbackName: string; sport: string }): TeamContext {
  const id = normalizeId(raw) || defaults.fallbackName;
  const name = normalizeName(raw?.name || raw?.full_name || raw?.display_name) || defaults.fallbackName;
  const alias = normalizeName(raw?.alias);
  const displayName = normalizeName(raw?.display_name || raw?.full_name) || name;
  const sport = normalizeName(raw?.sport) || defaults.sport;
  const league = normalizeName(raw?.league) || null;
  const injuries = normalizeInjuries(raw?.injuries);
  const fromMetrics = raw?.metrics?.red_zone ? normalizeRedZone(raw.metrics.red_zone) : undefined;
  const fallbackRedZone = raw?.red_zone ? normalizeRedZone(raw.red_zone) : undefined;
  const redZone = fromMetrics ?? fallbackRedZone ?? normalizeRedZone(undefined);
  const pace = raw?.metrics?.pace ? normalizePace(raw.metrics.pace) : normalizePace(raw?.pace);
  return {
    id,
    name,
    alias: alias || null,
    displayName,
    sport,
    league,
    logos: normalizeLogos(raw),
    injuries,
    redZone,
    pace,
  };
}

function normalizeContext(raw: RawContext, params: { home: string; away: string; sport: string; kickoff: string | null }): MatchupContext {
  const homeRaw = raw?.home || raw?.teams?.home;
  const awayRaw = raw?.away || raw?.teams?.away;
  const sport = normalizeName(raw?.sport) || params.sport;
  const home = normalizeTeamContext(homeRaw, { fallbackName: params.home, sport });
  const away = normalizeTeamContext(awayRaw, { fallbackName: params.away, sport });

  const badgesInput = Array.isArray(raw?.badges) ? raw.badges : [];
  const badges = badgesInput.map((badge, index) => normalizeBadge(badge, index));

  return {
    home,
    away,
    badges,
    kickoff: raw?.kickoff ?? params.kickoff,
    sport,
  };
}

function cacheKey(home: string, away: string, kickoff: string | null, sport: string): string {
  return `${sport}:${home.toLowerCase()}|${away.toLowerCase()}|${kickoff ?? 'na'}`;
}

export type MatchupContextArgs = {
  home: string;
  away: string;
  kickoff?: string | null;
  sport?: string;
};

export async function getMatchupContext(args: MatchupContextArgs): Promise<MatchupContext> {
  const sport = args.sport ? args.sport.toLowerCase() : 'nfl';
  const kickoff = args.kickoff ?? null;
  const key = cacheKey(args.home, args.away, kickoff, sport);
  const cached = MATCHUP_CACHE.get(key);
  if (cached && Date.now() - cached.ts < MATCHUP_TTL_MS) {
    return cached.data;
  }

  const searchParams = {
    home: args.home,
    away: args.away,
    kickoff: kickoff ?? undefined,
    sport,
  } as Record<string, string | undefined>;

  let raw: RawContext;
  try {
    raw = await balldontlieFetch<RawContext>('sports/nfl/matchups/context', {
      searchParams,
      cacheTtlMs: MATCHUP_TTL_MS,
    });
  } catch {
    raw = {};
  }

  const context = normalizeContext(raw ?? {}, { home: args.home, away: args.away, sport, kickoff });
  MATCHUP_CACHE.set(key, { ts: Date.now(), data: context });
  return context;
}

export async function getTeamInjuries(args: MatchupContextArgs, team: 'home' | 'away'): Promise<InjuryItem[]> {
  const context = await getMatchupContext(args);
  return team === 'home' ? context.home.injuries : context.away.injuries;
}

export async function getTeamRedZone(args: MatchupContextArgs, team: 'home' | 'away') {
  const context = await getMatchupContext(args);
  return team === 'home' ? context.home.redZone : context.away.redZone;
}

export async function getTeamPace(args: MatchupContextArgs, team: 'home' | 'away'): Promise<PaceProfile> {
  const context = await getMatchupContext(args);
  return team === 'home' ? context.home.pace : context.away.pace;
}

export async function getMatchupBadges(args: MatchupContextArgs): Promise<MatchupBadge[]> {
  const context = await getMatchupContext(args);
  return context.badges;
}

export async function getTeamLogos(args: MatchupContextArgs, team: 'home' | 'away'): Promise<string[]> {
  const context = await getMatchupContext(args);
  return team === 'home' ? context.home.logos : context.away.logos;
}
