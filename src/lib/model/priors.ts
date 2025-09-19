import { normalizeTeam as normalizeTeamFn } from '../../../libs/nfl/teams';
import hfaByTeam from '../../../lib/hfa';
import { clamp, DEFAULT_PRIOR, LEAGUE_MEANS, PRIOR_LIMITS, PRIOR_WEIGHTS, PriorsSource, SHRINKAGE_K_PLAYS } from './constants';

export type TeamPriors = {
  pace_drives: number;
  epa_per_play_off: number;
  epa_per_play_def: number;
  success_off: number;
  success_def: number;
  redzone_off_td: number;
  redzone_def_td: number;
  st_epa: number;
  turnovers_per_drive_off: number;
  takeaways_per_drive_def: number;
  explosive_rate_off: number;
  explosive_rate_def: number;
  hfa: number;
  meta?: {
    source: PriorsSource;
    samplePlays: number;
  };
};

type NumericMetric = Exclude<keyof TeamPriors, 'meta'>;

export type TeamSampleMetrics = Partial<Record<NumericMetric, number>> & {
  plays?: number;
  drives?: number;
};

export type TeamSampleMap = Record<string, TeamSampleMetrics>;

export type WeatherContext = {
  tempF?: number | null;
  windMph?: number | null;
  precipitation?: 'none' | 'rain' | 'snow' | 'mixed';
  roof?: 'open' | 'closed' | 'retractable' | null;
  surface?: 'turf' | 'grass' | null;
};

export type TravelAdjustments = {
  pace?: number;
  fatigue?: number; // 0..1 penalty applied to success/epa
  restBoost?: number; // positive values bump success
};

export type InjuryAdjustments = {
  offensiveLine?: number; // 0..1 severity
  quarterback?: number; // 0..1 severity
  skill?: number; // WR/TE/RB grouping 0..1 severity
  defenseFront7?: number;
  secondary?: number;
};

export type PriorsLocation = {
  homeTeamId?: string;
  neutralSite?: boolean;
  stadiumCode?: string;
  altitudeFeet?: number | null;
  surface?: 'turf' | 'grass' | null;
  roof?: 'open' | 'closed' | 'retractable' | null;
};

export type PriorsOverrides = Record<string, Partial<TeamPriors>>;

const METRICS: NumericMetric[] = [
  'pace_drives',
  'epa_per_play_off',
  'epa_per_play_def',
  'success_off',
  'success_def',
  'redzone_off_td',
  'redzone_def_td',
  'st_epa',
  'turnovers_per_drive_off',
  'takeaways_per_drive_def',
  'explosive_rate_off',
  'explosive_rate_def',
  'hfa'
];

export type PriorsContext = {
  seasonToDate?: TeamSampleMap;
  lastThree?: TeamSampleMap;
  lastSeason?: TeamSampleMap;
  leagueAverages?: Partial<Record<keyof TeamPriors, number>>;
  weather?: WeatherContext;
  travel?: Record<string, TravelAdjustments>;
  injuries?: Record<string, InjuryAdjustments>;
  location?: PriorsLocation;
  overrides?: PriorsOverrides;
};

const PLAYS_PER_DRIVE_ESTIMATE = 6.1;

const normalizeTeam = (input: string) => normalizeTeamFn(input);

function normalizeKey(input: string): string {
  return normalizeTeam(input ?? '').trim();
}

function lookupSample(map: TeamSampleMap | undefined, team: string): TeamSampleMetrics | undefined {
  if (!map) return undefined;
  const direct = map[team];
  if (direct) return direct;
  const lowered = map[team.toLowerCase()];
  if (lowered) return lowered;
  const upper = map[team.toUpperCase()];
  if (upper) return upper;
  const compact = map[team.replace(/\s+/g, '')];
  if (compact) return compact;
  for (const [key, value] of Object.entries(map)) {
    if (normalizeTeam(key) === team) return value;
  }
  return undefined;
}

function weightedMerge(team: string, ctx: PriorsContext): { metrics: Partial<Record<NumericMetric, number>>; plays: number } | null {
  const sources: Array<{ weight: number; sample?: TeamSampleMetrics } & { key: keyof typeof PRIOR_WEIGHTS }> = [
    { key: 'lastSeason', weight: PRIOR_WEIGHTS.lastSeason, sample: lookupSample(ctx.lastSeason, team) },
    { key: 'seasonToDate', weight: PRIOR_WEIGHTS.seasonToDate, sample: lookupSample(ctx.seasonToDate, team) },
    { key: 'lastThree', weight: PRIOR_WEIGHTS.lastThree, sample: lookupSample(ctx.lastThree, team) },
  ];

  let totalWeight = 0;
  const accum: Partial<Record<NumericMetric, number>> = {};
  let playsAccumulator = 0;

  for (const entry of sources) {
    if (!entry.sample) continue;
    const weight = entry.weight;
    totalWeight += weight;
    const plays = entry.sample.plays ?? (entry.sample.drives ?? 0) * PLAYS_PER_DRIVE_ESTIMATE;
    playsAccumulator += weight * (plays ?? 0);

    for (const metric of METRICS) {
      const value = entry.sample[metric];
      if (value == null || Number.isNaN(value)) continue;
      accum[metric] = (accum[metric] ?? 0) + weight * value;
    }
  }

  if (!totalWeight) return null;
  const metrics: Partial<Record<NumericMetric, number>> = {};
  for (const [key, value] of Object.entries(accum) as Array<[NumericMetric, number]>) {
    metrics[key] = value / totalWeight;
  }
  return { metrics, plays: playsAccumulator / totalWeight };
}

function blendWithLeague(metric: keyof TeamPriors, value: number | undefined, plays: number, ctx: PriorsContext): number {
  const leagueOverride = ctx.leagueAverages?.[metric];
  const leagueMean = leagueOverride ?? (LEAGUE_MEANS as Record<string, number>)[metric] ?? 0;
  if (value == null || Number.isNaN(value)) return leagueMean;
  const weight = plays / (plays + SHRINKAGE_K_PLAYS);
  return weight * value + (1 - weight) * leagueMean;
}

function applyWeatherAdjustments(priors: TeamPriors, weather?: WeatherContext) {
  if (!weather) return;
  const { windMph, tempF, precipitation, roof, surface } = weather;
  if (roof === 'closed') {
    priors.pace_drives *= 1.015;
    priors.redzone_off_td *= 1.01;
  } else if (roof === 'open' && (windMph ?? 0) > 18) {
    const over = (windMph ?? 0) - 18;
    const penalty = clamp(0.004 * over, 0, 0.12);
    priors.pace_drives *= 1 - penalty;
    priors.redzone_off_td *= 1 - penalty * 0.6;
  }

  if (typeof tempF === 'number') {
    if (tempF < 28) {
      const drop = clamp((28 - tempF) * 0.003, 0, 0.09);
      priors.success_off *= 1 - drop;
      priors.explosive_rate_off *= 1 - drop * 0.8;
    } else if (tempF > 85) {
      const drop = clamp((tempF - 85) * 0.002, 0, 0.05);
      priors.pace_drives *= 1 - drop;
    }
  }

  if (precipitation === 'rain') {
    priors.turnovers_per_drive_off *= 1.05;
    priors.success_off *= 0.98;
  }
  if (precipitation === 'snow') {
    priors.turnovers_per_drive_off *= 1.08;
    priors.success_off *= 0.96;
    priors.explosive_rate_off *= 0.94;
  }

  if (surface) {
    if (surface === 'turf') priors.explosive_rate_off *= 1.02;
    if (surface === 'grass') priors.pace_drives *= 0.995;
  }
}

function applyTravelAdjustments(team: string, priors: TeamPriors, travel?: Record<string, TravelAdjustments>) {
  if (!travel) return;
  const adj = travel[team] ?? travel[team.toLowerCase()] ?? travel[team.replace(/\s+/g, '')];
  if (!adj) return;
  if (typeof adj.pace === 'number') priors.pace_drives += adj.pace;
  if (typeof adj.fatigue === 'number') {
    const fatigue = clamp(adj.fatigue, 0, 1);
    priors.success_off *= 1 - fatigue * 0.05;
    priors.epa_per_play_off -= fatigue * 0.025;
  }
  if (typeof adj.restBoost === 'number') {
    const boost = clamp(adj.restBoost, -1, 1);
    priors.success_off *= 1 + boost * 0.03;
    priors.pace_drives += boost * 0.15;
  }
}

function applyInjuryAdjustments(team: string, priors: TeamPriors, injuries?: Record<string, InjuryAdjustments>) {
  if (!injuries) return;
  const adj = injuries[team] ?? injuries[team.toLowerCase()] ?? injuries[team.replace(/\s+/g, '')];
  if (!adj) return;
  if (typeof adj.offensiveLine === 'number') {
    const sev = clamp(adj.offensiveLine, 0, 1);
    priors.epa_per_play_off -= sev * 0.03;
    priors.success_off *= 1 - sev * 0.04;
  }
  if (typeof adj.quarterback === 'number') {
    const sev = clamp(adj.quarterback, 0, 1);
    priors.epa_per_play_off -= sev * 0.06;
    priors.explosive_rate_off *= 1 - sev * 0.08;
  }
  if (typeof adj.skill === 'number') {
    const sev = clamp(adj.skill, 0, 1);
    priors.success_off *= 1 - sev * 0.03;
  }
  if (typeof adj.defenseFront7 === 'number') {
    const sev = clamp(adj.defenseFront7, 0, 1);
    priors.epa_per_play_def += sev * 0.035;
    priors.success_def += sev * 0.03;
    priors.redzone_def_td += sev * 0.02;
  }
  if (typeof adj.secondary === 'number') {
    const sev = clamp(adj.secondary, 0, 1);
    priors.explosive_rate_def += sev * 0.05;
    priors.success_def += sev * 0.025;
  }
}

function applyLocationAdjustments(team: string, opponent: string, priors: TeamPriors, location?: PriorsLocation) {
  if (!location) return;
  const homeTeam = location.homeTeamId ? normalizeTeam(location.homeTeamId) : null;
  const isHome = homeTeam ? normalizeTeam(team) === homeTeam : false;
  const baseHfa = homeTeam ? hfaByTeam(homeTeam, location.neutralSite ?? false) : 0;
  if (homeTeam) {
    priors.hfa = isHome ? baseHfa : -Math.max(1, baseHfa * 0.65);
  }

  const altitude = location.altitudeFeet ?? null;
  if (typeof altitude === 'number') {
    if (altitude > 3500 && !isHome) priors.pace_drives -= 0.2;
    if (altitude > 3500 && isHome) priors.pace_drives += 0.1;
  }

  if (location.surface) {
    if (location.surface === 'turf') priors.success_off *= 1.01;
    if (location.surface === 'grass' && !isHome) priors.explosive_rate_off *= 0.99;
  }
}

function applyOverrides(team: string, priors: TeamPriors, overrides?: PriorsOverrides) {
  if (!overrides) return;
  const o = overrides[team] ?? overrides[team.toLowerCase()] ?? overrides[team.replace(/\s+/g, '')];
  if (!o) return;
  for (const metric of METRICS) {
    const value = o[metric as keyof typeof o];
    if (value == null || Number.isNaN(value as number)) continue;
    priors[metric] = value as number;
  }
  const samplePlays = priors.meta?.samplePlays ?? 0;
  priors.meta = { source: 'override', samplePlays };
}

function finalizeBounds(priors: TeamPriors) {
  priors.pace_drives = clamp(priors.pace_drives, PRIOR_LIMITS.pace_drives.min, PRIOR_LIMITS.pace_drives.max);
  priors.epa_per_play_off = clamp(priors.epa_per_play_off, PRIOR_LIMITS.epa.min, PRIOR_LIMITS.epa.max);
  priors.epa_per_play_def = clamp(priors.epa_per_play_def, PRIOR_LIMITS.epa.min, PRIOR_LIMITS.epa.max);
  priors.success_off = clamp(priors.success_off, PRIOR_LIMITS.success.min, PRIOR_LIMITS.success.max);
  priors.success_def = clamp(priors.success_def, PRIOR_LIMITS.success.min, PRIOR_LIMITS.success.max);
  priors.redzone_off_td = clamp(priors.redzone_off_td, PRIOR_LIMITS.redzone.min, PRIOR_LIMITS.redzone.max);
  priors.redzone_def_td = clamp(priors.redzone_def_td, PRIOR_LIMITS.redzone.min, PRIOR_LIMITS.redzone.max);
  priors.turnovers_per_drive_off = clamp(priors.turnovers_per_drive_off, PRIOR_LIMITS.turnovers_per_drive_off.min, PRIOR_LIMITS.turnovers_per_drive_off.max);
  priors.takeaways_per_drive_def = clamp(priors.takeaways_per_drive_def, PRIOR_LIMITS.takeaways_per_drive_def.min, PRIOR_LIMITS.takeaways_per_drive_def.max);
  priors.explosive_rate_off = clamp(priors.explosive_rate_off, PRIOR_LIMITS.explosive_rate.min, PRIOR_LIMITS.explosive_rate.max);
  priors.explosive_rate_def = clamp(priors.explosive_rate_def, PRIOR_LIMITS.explosive_rate.min, PRIOR_LIMITS.explosive_rate.max);
  priors.st_epa = clamp(priors.st_epa, PRIOR_LIMITS.st_epa.min, PRIOR_LIMITS.st_epa.max);
  priors.hfa = clamp(priors.hfa, PRIOR_LIMITS.hfa.min, PRIOR_LIMITS.hfa.max);
}

function canonicalTeamKey(team: string): string {
  return normalizeTeam(team);
}

export function getTeamPriors(teamId: string, opponentId: string, context: PriorsContext = {}): TeamPriors {
  const team = canonicalTeamKey(teamId);
  const opponent = canonicalTeamKey(opponentId);
  const merged = weightedMerge(team, context);
  const samplePlays = merged?.plays ?? 0;

  const priors: TeamPriors = {
    pace_drives: blendWithLeague('pace_drives', merged?.metrics.pace_drives, samplePlays, context),
    epa_per_play_off: blendWithLeague('epa_per_play_off', merged?.metrics.epa_per_play_off, samplePlays, context),
    epa_per_play_def: blendWithLeague('epa_per_play_def', merged?.metrics.epa_per_play_def, samplePlays, context),
    success_off: blendWithLeague('success_off', merged?.metrics.success_off, samplePlays, context),
    success_def: blendWithLeague('success_def', merged?.metrics.success_def, samplePlays, context),
    redzone_off_td: blendWithLeague('redzone_off_td', merged?.metrics.redzone_off_td, samplePlays, context),
    redzone_def_td: blendWithLeague('redzone_def_td', merged?.metrics.redzone_def_td, samplePlays, context),
    st_epa: blendWithLeague('st_epa', merged?.metrics.st_epa, samplePlays, context),
    turnovers_per_drive_off: blendWithLeague('turnovers_per_drive_off', merged?.metrics.turnovers_per_drive_off, samplePlays, context),
    takeaways_per_drive_def: blendWithLeague('takeaways_per_drive_def', merged?.metrics.takeaways_per_drive_def, samplePlays, context),
    explosive_rate_off: blendWithLeague('explosive_rate_off', merged?.metrics.explosive_rate_off, samplePlays, context),
    explosive_rate_def: blendWithLeague('explosive_rate_def', merged?.metrics.explosive_rate_def, samplePlays, context),
    hfa: DEFAULT_PRIOR.hfa,
    meta: {
      source: merged ? 'blended' : 'league',
      samplePlays,
    },
  };

  if (!merged) {
    // League fallback ensures we return sane defaults
    Object.assign(priors, DEFAULT_PRIOR);
    priors.meta = { source: 'league', samplePlays: 0 };
  }

  applyWeatherAdjustments(priors, context.weather);
  applyTravelAdjustments(team, priors, context.travel);
  applyInjuryAdjustments(team, priors, context.injuries);
  applyLocationAdjustments(team, opponent, priors, context.location);
  applyOverrides(team, priors, context.overrides);

  finalizeBounds(priors);
  return priors;
}

export default getTeamPriors;
