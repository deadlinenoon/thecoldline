'use client';

import { useEffect, useMemo, useState } from 'react';
import TeamTag from '@/components/TeamTag';
import RedZoneBarsForMatchup from '@/components/metrics/RedZoneBarsForMatchup';
import GameMetricsBlock from '@/components/game/GameMetricsBlock';
import { normalizeInjuryReport } from '@/lib/injuries/normalize';
import type { InjuryItem, InjuryReport } from '@/lib/injuries/types';
import type { ExpectedPointsContext } from '@/lib/model/expectation';
import { MAX_VISIBLE_SIM_ROWS } from '@/lib/model/constants';
import simulateMatchupPoisson, { SimulationResult, SimulationOptions } from '@/lib/sim/poissonSim';
import type { TeamPriors } from '@/lib/model/priors';
import { teamAbbr } from '@/lib/abbr';
import { toAbbr } from '@/lib/nfl-teams';
import normalizeTeamName from '@/libs/nfl/teams';
import { NFLGameReport } from '@/components/reports/NFLGameReport';

export type GameCardProps = {
  home: string;
  away: string;
  kickoff?: string | null;
  marketSpread?: number | null;
  marketTotal?: number | null;
  simulationContext?: ExpectedPointsContext;
  defaultIterations?: number;
  className?: string;
  matchup?: RedZoneMatchup;
  teamLogos?: {
    home?: string[];
    away?: string[];
  };
  injuries?: InjuryReport | null;
  injuriesLoading?: boolean;
  injuriesError?: string | null;
  coachingFamiliarity?: CoachingFamiliarityInfo | null;
};

type CoachingFamiliaritySide = {
  points: number;
  reason: string;
};

type CoachingFamiliarityInfo = {
  marginShift: number;
  home?: CoachingFamiliaritySide;
  away?: CoachingFamiliaritySide;
};

type ShareInput = number | string | null | undefined;

const normalizeShare = (value: ShareInput): number | null => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0) return 0;
  if (num > 1) {
    if (num <= 100) return Math.min(1, num / 100);
    return 1;
  }
  return num;
};

const normalizeCountValue = (value: ShareInput): number | null => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0) return 0;
  return Math.round(num);
};
type RedZoneValue = { share: number | null; count: number | null };

const createValue = (): RedZoneValue => ({ share: null, count: null });

export type RedZoneOffenseMetrics = {
  trips: number | null;
  td: RedZoneValue;
  fg: RedZoneValue;
  turnover: RedZoneValue;
  fail: RedZoneValue;
};
export type RedZoneDefenseMetrics = {
  trips: number | null;
  tdAllowed: RedZoneValue;
  fgAllowed: RedZoneValue;
  takeaway: RedZoneValue;
  zero: RedZoneValue;
};
export type RedZoneTeamMetrics = {
  teamId: string;
  displayName?: string | null;
  redZone: {
    offense: RedZoneOffenseMetrics;
    defense: RedZoneDefenseMetrics;
  };
};
export type RedZoneMatchup = {
  teamA: RedZoneTeamMetrics;
  teamB: RedZoneTeamMetrics;
};

const createEmptyRedZone = (): { offense: RedZoneOffenseMetrics; defense: RedZoneDefenseMetrics } => ({
  offense: {
    trips: null,
    td: createValue(),
    fg: createValue(),
    turnover: createValue(),
    fail: createValue(),
  },
  defense: {
    trips: null,
    tdAllowed: createValue(),
    fgAllowed: createValue(),
    takeaway: createValue(),
    zero: createValue(),
  },
});

const ensureValue = (value: RedZoneValue | undefined): RedZoneValue => ({
  share: normalizeShare(value?.share ?? null),
  count: normalizeCountValue(value?.count ?? null),
});

const ensureOffense = (offense: RedZoneOffenseMetrics | undefined): RedZoneOffenseMetrics => ({
  trips: normalizeCountValue(offense?.trips ?? null),
  td: ensureValue(offense?.td),
  fg: ensureValue(offense?.fg),
  turnover: ensureValue(offense?.turnover),
  fail: ensureValue(offense?.fail),
});

const ensureDefense = (defense: RedZoneDefenseMetrics | undefined): RedZoneDefenseMetrics => ({
  trips: normalizeCountValue(defense?.trips ?? null),
  tdAllowed: ensureValue(defense?.tdAllowed),
  fgAllowed: ensureValue(defense?.fgAllowed),
  takeaway: ensureValue(defense?.takeaway),
  zero: ensureValue(defense?.zero),
});

const normalizeTeamEntry = (team: RedZoneTeamMetrics | undefined, fallbackId: string): RedZoneTeamMetrics => {
  const base = team ?? { teamId: fallbackId, redZone: createEmptyRedZone() };
  const rawId = (base.teamId || fallbackId || '').trim();
  const rawDisplay = (base.displayName || rawId || fallbackId || '').trim();
  const canonicalName = normalizeTeamName(rawDisplay);
  const inferredAbbr = toAbbr(canonicalName);
  const teamId = (inferredAbbr || toAbbr(rawId) || rawId || fallbackId).trim();
  const displayName = canonicalName || rawDisplay || fallbackId;
  return {
    teamId,
    displayName,
    redZone: {
      offense: ensureOffense(base.redZone?.offense),
      defense: ensureDefense(base.redZone?.defense),
    },
  };
};

const ITERATION_PRESETS = [500, 1000, 5000] as const;
const SCORE_LIMIT_OPTIONS = [100, 250, 1000] as const;
const DEFAULT_ITERATIONS = 1000;

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toFixed(1);
}

function formatSpreadValue(value: number): string {
  return Math.abs(value).toFixed(2).replace(/\.0+$/, '').replace(/\.([1-9])0$/, '.$1');
}

function formatTotalValue(value: number): string {
  return value.toFixed(2).replace(/\.0+$/, '').replace(/\.([1-9])0$/, '.$1');
}

const STATUS_PRIORITY = ['out', 'doubtful', 'questionable', 'suspended', 'inactive', 'ir', 'pup', 'probable', 'active'];

const getStatusKey = (status: string | null | undefined): string => {
  if (!status) return 'unknown';
  return status.toLowerCase().trim();
};

const summariseStatuses = (list: InjuryItem[]): string | null => {
  if (!list.length) return null;
  const counts = new Map<string, number>();
  for (const entry of list) {
    const key = getStatusKey(entry.status);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => {
    const [statusA] = a;
    const [statusB] = b;
    const idxA = STATUS_PRIORITY.indexOf(statusA);
    const idxB = STATUS_PRIORITY.indexOf(statusB);
    if (idxA === -1 && idxB === -1) return statusA.localeCompare(statusB);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
  return ordered
    .slice(0, 3)
    .map(([status, count]) => {
      const label = status === 'unknown' ? 'Other' : status.replace(/^\w/, (c) => c.toUpperCase());
      return `${label} (${count})`;
    })
    .join(', ');
};

const statusTheme = (status: string | null | undefined): string => {
  const key = getStatusKey(status);
  if (key === 'out' || key === 'ir' || key === 'inactive') return 'bg-rose-500/10 text-rose-200 border border-rose-400/40';
  if (key === 'doubtful' || key === 'suspended') return 'bg-orange-500/10 text-orange-200 border border-orange-400/40';
  if (key === 'questionable' || key === 'pup') return 'bg-amber-500/10 text-amber-200 border border-amber-400/40';
  if (key === 'probable' || key === 'active') return 'bg-emerald-500/10 text-emerald-200 border border-emerald-400/40';
  return 'bg-slate-500/10 text-slate-300 border border-slate-500/30';
};

function useSimulation(
  engine: 'team' | 'classic',
  opts: { home: string; away: string; iterations: number; spread: number | null | undefined; total: number | null | undefined; context?: ExpectedPointsContext }
): SimulationResult {
  const { home, away, iterations, spread, total, context } = opts;
  const priorsCache = useMemo(() => new Map<string, TeamPriors>(), []);
  const simContext = useMemo<ExpectedPointsContext>(() => ({
    ...(context ?? {}),
    priorsCache,
    location: {
      ...(context?.location ?? {}),
      homeTeamId: context?.location?.homeTeamId ?? home,
    },
  }), [context, home, priorsCache]);

  return useMemo(() => {
    const baseOptions: SimulationOptions = {
      teamA: { id: away, label: away },
      teamB: { id: home, label: home, isHome: true },
      n: iterations,
      roundToFootballGrid: true,
      context: simContext,
      classicFallback: {
        spread: spread ?? 0,
        total: total ?? 43.5,
      },
      engine,
    };
    return simulateMatchupPoisson(baseOptions);
  }, [away, home, iterations, simContext, spread, total, engine]);
}

function buildScoreFrequency(draws: SimulationResult['draws']) {
  const map = new Map<string, { a: number; b: number; count: number }>();
  for (const draw of draws) {
    const key = `${draw.a}-${draw.b}`;
    const entry = map.get(key);
    if (entry) entry.count += 1;
    else map.set(key, { a: draw.a, b: draw.b, count: 1 });
  }
  return [...map.values()].sort((x, y) => y.count - x.count);
}

function exportCsv(draws: SimulationResult['draws'], teamA: string, teamB: string) {
  if (typeof window === 'undefined') return;
  const header = `index,${teamA},${teamB}`;
  const rows = draws.map((d: SimulationResult['draws'][number], idx: number) => `${idx + 1},${d.a},${d.b}`);
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${teamA.replace(/\s+/g, '-')}_vs_${teamB.replace(/\s+/g, '-')}_sim.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function GameCard({
  home,
  away,
  kickoff,
  marketSpread,
  marketTotal,
  simulationContext,
  defaultIterations = DEFAULT_ITERATIONS,
  className,
  matchup,
  teamLogos,
  injuries,
  injuriesLoading = false,
  injuriesError,
  coachingFamiliarity = null,
}: GameCardProps) {
  const [engine, setEngine] = useState<'team' | 'classic'>('team');
  const [iterations, setIterations] = useState<number>(defaultIterations);
  const [showScores, setShowScores] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [scoreLimit, setScoreLimit] = useState<number>(SCORE_LIMIT_OPTIONS[0]);
  const [showInjuries, setShowInjuries] = useState(false);
  const shouldSelfFetchInjuries = typeof injuries === 'undefined';
  const [selfInjuries, setSelfInjuries] = useState<InjuryReport | null>(null);
  const [selfInjuriesLoading, setSelfInjuriesLoading] = useState(false);
  const [selfInjuriesError, setSelfInjuriesError] = useState<string | null>(null);
  useEffect(() => {
    if (!showScores) setScoreLimit(SCORE_LIMIT_OPTIONS[0]);
  }, [showScores]);

  useEffect(() => {
    setShowInjuries(false);
  }, [home, away]);

  useEffect(() => {
    setShowMetrics(false);
  }, [home, away]);

  useEffect(() => {
    if (!shouldSelfFetchInjuries) {
      setSelfInjuries(null);
      setSelfInjuriesError(null);
      setSelfInjuriesLoading(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        setSelfInjuriesLoading(true);
        setSelfInjuriesError(null);
        const params = new URLSearchParams({ home, away });
        if (kickoff) params.set('kickoff', kickoff);
        const resp = await fetch(`/api/injuries?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const raw = await resp.json().catch(() => ({}));
        if (cancelled || controller.signal.aborted) return;
        if (!resp.ok) {
          setSelfInjuries(normalizeInjuryReport(raw));
          setSelfInjuriesError(`Injuries request failed (HTTP ${resp.status})`);
          return;
        }
        const normalized = normalizeInjuryReport(raw);
        if (normalized.error) setSelfInjuriesError(normalized.error);
        setSelfInjuries(normalized);
      } catch (e: any) {
        if (cancelled || controller.signal.aborted) return;
        setSelfInjuries(normalizeInjuryReport({}));
        setSelfInjuriesError(e?.message || 'Unable to load injuries');
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setSelfInjuriesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [away, home, kickoff, shouldSelfFetchInjuries]);

  const result = useSimulation(engine, {
    home,
    away,
    iterations,
    spread: marketSpread,
    total: marketTotal,
    context: simulationContext,
  });

  const redZoneMatchup = useMemo<RedZoneMatchup>(() => {
    const base: RedZoneMatchup = matchup ?? {
      teamA: { teamId: away, displayName: away, redZone: createEmptyRedZone() },
      teamB: { teamId: home, displayName: home, redZone: createEmptyRedZone() },
    };
    return {
      teamA: normalizeTeamEntry(base.teamA, away),
      teamB: normalizeTeamEntry(base.teamB, home),
    };
  }, [matchup, away, home]);

  const frequency = useMemo(() => buildScoreFrequency(result.draws), [result.draws]);
  const visibleRows = useMemo(
    () => frequency.slice(0, Math.min(frequency.length, scoreLimit, MAX_VISIBLE_SIM_ROWS)),
    [frequency, scoreLimit]
  );

  const kickoffLabel = kickoff ? new Date(kickoff).toLocaleString() : 'TBD';

  const fallbackHomeCanonical = normalizeTeamName(home);
  const fallbackAwayCanonical = normalizeTeamName(away);
  const canonicalHome = normalizeTeamName(
    redZoneMatchup.teamB.displayName ?? redZoneMatchup.teamB.teamId ?? fallbackHomeCanonical,
  );
  const canonicalAway = normalizeTeamName(
    redZoneMatchup.teamA.displayName ?? redZoneMatchup.teamA.teamId ?? fallbackAwayCanonical,
  );
  const displayHome = canonicalHome || redZoneMatchup.teamB.displayName || fallbackHomeCanonical || home;
  const displayAway = canonicalAway || redZoneMatchup.teamA.displayName || fallbackAwayCanonical || away;
  const rawHomeId = redZoneMatchup.teamB.teamId || fallbackHomeCanonical || home;
  const rawAwayId = redZoneMatchup.teamA.teamId || fallbackAwayCanonical || away;
  const toUpper = (value: string | null | undefined): string => (value ? value.toUpperCase() : '');
  const resolvedHomeAbbr = toAbbr(canonicalHome) || toAbbr(rawHomeId) || teamAbbr(fallbackHomeCanonical) || rawHomeId;
  const resolvedAwayAbbr = toAbbr(canonicalAway) || toAbbr(rawAwayId) || teamAbbr(fallbackAwayCanonical) || rawAwayId;
  const homeAbbr = toUpper(resolvedHomeAbbr);
  const awayAbbr = toUpper(resolvedAwayAbbr);
  const spreadValue = typeof marketSpread === 'number' ? marketSpread : null;
  const spreadAbs = spreadValue !== null ? formatSpreadValue(spreadValue) : null;
  const spreadFavorite = spreadValue !== null ? (spreadValue <= 0 ? homeAbbr : awayAbbr) : null;
  const spreadLabel = (() => {
    if (spreadValue === null || spreadAbs === null) return null;
    if (spreadAbs === '0') return 'PK';
    return `${spreadFavorite} ${spreadAbs}`.trim();
  })();
  const totalLabel = typeof marketTotal === 'number' ? formatTotalValue(marketTotal) : null;
  const metricsHome = toUpper(toAbbr(canonicalHome) || toAbbr(rawHomeId) || homeAbbr);
  const metricsAway = toUpper(toAbbr(canonicalAway) || toAbbr(rawAwayId) || awayAbbr);

  const logosHome = teamLogos?.home ?? [];
  const logosAway = teamLogos?.away ?? [];
  const teamTagHome = { teamId: homeAbbr || rawHomeId, displayName: displayHome, logos: logosHome };
  const teamTagAway = { teamId: awayAbbr || rawAwayId, displayName: displayAway, logos: logosAway };
  const effectiveInjuries = shouldSelfFetchInjuries ? selfInjuries : injuries ?? null;
  const effectiveInjuriesLoading = shouldSelfFetchInjuries ? selfInjuriesLoading : injuriesLoading;
  const effectiveInjuriesError = shouldSelfFetchInjuries ? selfInjuriesError : injuriesError;
  const injuriesHomeList = useMemo(() => {
    const list = effectiveInjuries?.home?.list;
    return Array.isArray(list) ? list : [];
  }, [effectiveInjuries?.home?.list]);
  const injuriesAwayList = useMemo(() => {
    const list = effectiveInjuries?.away?.list;
    return Array.isArray(list) ? list : [];
  }, [effectiveInjuries?.away?.list]);
  const injuriesHomeCount = typeof effectiveInjuries?.home?.count === 'number' ? effectiveInjuries.home.count : injuriesHomeList.length;
  const injuriesAwayCount = typeof effectiveInjuries?.away?.count === 'number' ? effectiveInjuries.away.count : injuriesAwayList.length;
  const injuriesSources = useMemo(() => {
    const set = new Set<string>();
    (effectiveInjuries?.home?.sources ?? []).forEach(source => {
      if (source) set.add(String(source));
    });
    (effectiveInjuries?.away?.sources ?? []).forEach(source => {
      if (source) set.add(String(source));
    });
    return [...set];
  }, [effectiveInjuries?.home?.sources, effectiveInjuries?.away?.sources]);
  const awayStatusSummary = useMemo(() => summariseStatuses(injuriesAwayList), [injuriesAwayList]);
  const homeStatusSummary = useMemo(() => summariseStatuses(injuriesHomeList), [injuriesHomeList]);
  const injuryErrorMessage = effectiveInjuriesError
    ? effectiveInjuriesError
    : effectiveInjuries?.error
      ? `Injuries API: ${String(effectiveInjuries.error)}`
      : null;
  const hasInjuryListings = injuriesAwayList.length > 0 || injuriesHomeList.length > 0;

  const countLabel = (count: number) => (count === 0 ? 'No listings' : `${count} listed`);
  const familiarityHomePoints = coachingFamiliarity?.home?.points ?? 0;
  const familiarityAwayPoints = coachingFamiliarity?.away?.points ?? 0;
  const hasFamiliarityAuto = familiarityHomePoints !== 0 || familiarityAwayPoints !== 0;
  const familiarityReason = coachingFamiliarity?.home?.reason ?? coachingFamiliarity?.away?.reason ?? '';
  const formatPoints = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
  const familiarityMarginDelta = familiarityHomePoints - familiarityAwayPoints;
  const familiarityBeneficiary = familiarityMarginDelta > 0 ? home : familiarityMarginDelta < 0 ? away : null;
  const familiarityMarginDisplay = familiarityMarginDelta === 0
    ? '0.00'
    : `+${Math.abs(familiarityMarginDelta).toFixed(2)}`;

  return (
    <div className={`rounded-xl border border-cl-border bg-[#0b121b] p-5 shadow-cl-card ${className ?? ''}`.trim()}>
      <h3 className="sr-only">Simulations</h3>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-base text-slate-100">
            <TeamTag
              {...teamTagAway}
              showCity
              className="text-base text-slate-100"
              logoSize={32}
            />
            <span className="text-sm text-slate-500">@</span>
            <TeamTag
              {...teamTagHome}
              showCity
              className="text-base text-slate-100"
              logoSize={32}
            />
          </div>
          {(spreadLabel || totalLabel) ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              {spreadLabel ? (
                <span className="mr-1">
                  Spread: <span className="font-semibold text-slate-100">{spreadLabel}</span>
                </span>
              ) : null}
              {totalLabel ? (
                <span className="mr-1">
                  O/U: <span className="font-semibold text-slate-100">{totalLabel}</span>
                </span>
              ) : null}
            </div>
          ) : null}
          <div>
            <h3 className="text-xs uppercase tracking-wide text-emerald-300">Simulation Output</h3>
            <p className="mt-1 text-[11px] text-slate-500">Team-based Poisson sampler</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Kickoff</span>
          <span className="rounded bg-black/40 px-2 py-1 text-slate-300">{kickoffLabel}</span>
          <button
            type="button"
            className="rounded border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
            onClick={() => setShowMetrics(prev => !prev)}
          >
            {showMetrics ? 'Hide metrics' : 'Show metrics'}
          </button>
          <button
            type="button"
            className="rounded border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
            onClick={() => setCollapsed(prev => !prev)}
          >
            {collapsed ? 'Expand panel' : 'Collapse panel'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`rounded-md px-3 py-1 text-xs font-semibold ${engine === 'team' ? 'bg-cyan-600 text-white' : 'bg-transparent text-cyan-300 hover:bg-cyan-900/40'}`}
                onClick={() => setEngine('team')}
              >
                Team-based
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1 text-xs font-semibold ${engine === 'classic' ? 'bg-cyan-600 text-white' : 'bg-transparent text-cyan-300 hover:bg-cyan-900/40'}`}
                onClick={() => setEngine('classic')}
              >
                Classic
              </button>
            </div>
          </div>

          {showMetrics ? (
            <GameMetricsBlock
              home={metricsHome}
              away={metricsAway}
              kickoffISO={kickoff ?? undefined}
            />
          ) : null}

          <NFLGameReport
            homeAbbr={homeAbbr}
            awayAbbr={awayAbbr}
            kickoffISO={kickoff ?? ''}
            angle="market-only context • monitor injury/weather updates"
          />

          {hasFamiliarityAuto ? (
            <div className="mt-4 rounded-lg border border-cyan-700/40 bg-cyan-900/10 px-4 py-3 text-xs text-cyan-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold uppercase tracking-wide text-[11px] text-cyan-200">Coaching familiarity auto</span>
                {familiarityBeneficiary ? (
                  <span className="text-cyan-100">
                    Margin shift {familiarityMarginDisplay} toward {familiarityBeneficiary}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                <div className="flex items-center justify-between gap-2">
                  <TeamTag {...teamTagAway} />
                  <span className="font-mono text-cyan-100">{formatPoints(familiarityAwayPoints)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <TeamTag {...teamTagHome} />
                  <span className="font-mono text-cyan-100">{formatPoints(familiarityHomePoints)}</span>
                </div>
              </div>
              {familiarityReason ? (
                <p className="mt-2 text-[11px] text-cyan-200/90">{familiarityReason}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-emerald-300">Simulation Output</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">Win Probabilities</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <TeamTag {...teamTagAway} />
                  <span className="text-cyan-200">{formatPct(result.summary.winPctA)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <TeamTag {...teamTagHome} />
                  <span className="text-cyan-200">{formatPct(result.summary.winPctB)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span>Push</span>
                  <span>{formatPct(result.summary.tiePct)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Mean Output</div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span>{formatNumber(result.summary.meanTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>Margin</span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <TeamTag
                        {...teamTagHome}
                        logoSize={16}
                        className="text-xs text-slate-300"
                      />
                      <span className="text-slate-500">−</span>
                      <TeamTag
                        {...teamTagAway}
                        logoSize={16}
                        className="text-xs text-slate-300"
                      />
                    </span>
                  </span>
                  <span>{formatNumber(result.summary.meanMargin)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Engine</span>
                  <span>{result.meta.engine === 'team' ? 'Team-based' : 'Classic'}</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Simulation Controls</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {ITERATION_PRESETS.map(count => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setIterations(count)}
                    className={`rounded-md px-3 py-1 ${iterations === count ? 'bg-emerald-600 text-white' : 'bg-slate-800/60 hover:bg-slate-700/60'}`}
                  >
                    {count.toLocaleString()} sims
                  </button>
                ))}
                <label className="ml-auto inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showScores}
                    onChange={(e) => setShowScores(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
                  />
                  <span>Show scores</span>
                </label>
                {showScores ? (
                  <div className="w-full pt-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>Rows</span>
                      {SCORE_LIMIT_OPTIONS.map(limit => (
                        <button
                          key={limit}
                          type="button"
                          onClick={() => setScoreLimit(limit)}
                          className={`rounded-md px-3 py-1 ${scoreLimit === limit ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/50' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'}`}
                        >
                          {limit}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>{iterations.toLocaleString()} draws</span>
                <button
                  type="button"
                  className="rounded bg-cyan-700 px-3 py-1 font-semibold text-white hover:bg-cyan-600"
                  onClick={() => exportCsv(result.draws, away, home)}
                >
                  Export CSV
                </button>
              </div>
              {result.usedFallback ? (
                <div className="mt-3 rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Team priors unavailable — classic margin/total fallback in use.
                </div>
              ) : null}
            </div>
          </div>

          <section aria-label="Injuries" className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-slate-200">Injury report</h4>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                {effectiveInjuriesLoading ? <span className="text-slate-500">Loading…</span> : null}
                {!effectiveInjuriesLoading && injuryErrorMessage ? (
                  <span className="text-rose-300">{injuryErrorMessage}</span>
                ) : null}
                {hasInjuryListings ? (
                  <button
                    type="button"
                    onClick={() => setShowInjuries(prev => !prev)}
                    className="rounded bg-slate-800/60 px-2 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-slate-700/60"
                  >
                    {showInjuries ? '− Details' : '+ Details'}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <TeamTag {...teamTagAway} />
                  <span className="text-xs text-slate-400">{countLabel(injuriesAwayCount)}</span>
                </div>
                <div className="mt-2 text-xs text-slate-300">
                  {awayStatusSummary ? awayStatusSummary : 'Monitoring daily participation.'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <TeamTag {...teamTagHome} />
                  <span className="text-xs text-slate-400">{countLabel(injuriesHomeCount)}</span>
                </div>
                <div className="mt-2 text-xs text-slate-300">
                  {homeStatusSummary ? homeStatusSummary : 'Monitoring daily participation.'}
                </div>
              </div>
            </div>
            {showInjuries ? (
              effectiveInjuries?.error ? (
                <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                  Injuries API: {String(effectiveInjuries.error)}
                </div>
              ) : hasInjuryListings ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                  <h5 className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                    <TeamTag
                      {...teamTagAway}
                      logoSize={18}
                      className="text-xs text-slate-200"
                    />
                    <span>Availability</span>
                  </h5>
                  <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {injuriesAwayList.map((entry, idx) => (
                      <li key={`${entry.name}-${entry.status}-${idx}`} className="rounded border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-medium">
                            {entry.name}
                            {entry.position ? <span className="text-slate-400"> {`(${entry.position})`}</span> : null}
                          </div>
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${statusTheme(entry.status)}`}>
                            {entry.status || '—'}
                          </span>
                        </div>
                        {entry.note ? <p className="mt-2 text-[11px] text-slate-400">{entry.note}</p> : null}
                      </li>
                    ))}
                    {!injuriesAwayList.length ? (
                      <li className="rounded border border-slate-800/70 bg-slate-900/50 p-3 text-xs text-slate-400">No reported injuries.</li>
                    ) : null}
                  </ul>
                </div>
                <div>
                  <h5 className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                    <TeamTag
                      {...teamTagHome}
                      logoSize={18}
                      className="text-xs text-slate-200"
                    />
                    <span>Availability</span>
                  </h5>
                  <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {injuriesHomeList.map((entry, idx) => (
                      <li key={`${entry.name}-${entry.status}-${idx}`} className="rounded border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-medium">
                            {entry.name}
                            {entry.position ? <span className="text-slate-400"> {`(${entry.position})`}</span> : null}
                          </div>
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold ${statusTheme(entry.status)}`}>
                            {entry.status || '—'}
                          </span>
                        </div>
                        {entry.note ? <p className="mt-2 text-[11px] text-slate-400">{entry.note}</p> : null}
                      </li>
                    ))}
                    {!injuriesHomeList.length ? (
                      <li className="rounded border border-slate-800/70 bg-slate-900/50 p-3 text-xs text-slate-400">No reported injuries.</li>
                    ) : null}
                  </ul>
                </div>
                </div>
              ) : null
            ) : null}
            {injuriesSources.length ? (
              <p className="mt-3 text-[11px] text-slate-500">Sources: {injuriesSources.join(', ')}</p>
            ) : null}
          </section>

          <section aria-label="Red Zone" className="mt-5">
            <h4 className="mb-2 text-sm font-medium text-slate-200">Red Zone</h4>
            <RedZoneBarsForMatchup matchup={redZoneMatchup} />
          </section>

          {showScores ? (
            <div className="mt-5">
              <div className="text-xs uppercase tracking-wide text-slate-400">Score distribution (top {visibleRows.length} of {frequency.length})</div>
              <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-800">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-900/80 text-slate-300">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-semibold">Rank</th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        <span className="inline-flex items-center gap-1">
                      <TeamTag
                            {...teamTagAway}
                            logoSize={16}
                            className="text-xs text-slate-200"
                          />
                        </span>
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        <span className="inline-flex items-center gap-1">
                      <TeamTag
                            {...teamTagHome}
                            logoSize={16}
                            className="text-xs text-slate-200"
                          />
                        </span>
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200">
                    {visibleRows.map((row, idx) => (
                      <tr key={`${row.a}-${row.b}-${idx}`}>
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono">{row.a}</td>
                        <td className="px-3 py-2 font-mono">{row.b}</td>
                        <td className="px-3 py-2 text-right">{formatPct(row.count / result.draws.length)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default GameCard;
