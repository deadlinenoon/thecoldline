import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TeamTag from "@/components/TeamTag";
import GameCard, { type RedZoneMatchup } from "@/components/game/GameCard";
import WindGoalpost, { abbreviateCardinal, describeWindForGoal } from "@/components/weather/WindGoalpost";
import { normalizeInjuryReport } from "@/lib/injuries/normalize";
import type { InjuryItem, InjuryReport } from "@/lib/injuries/types";
import { EXPECTATION_COEFFICIENTS, PRIOR_LIMITS } from "@/lib/model/constants";
import type { ExpectedPointsContext } from "@/lib/model/expectation";
import type { PriorsOverrides, TravelAdjustments, WeatherContext } from "@/lib/model/priors";
import { fetchTravel } from '@/lib/travel/fetch';
import type { TravelRow } from '@/lib/travel/types';
import { STADIUMS } from '@/lib/stadiums';
import { toAbbr } from '@/lib/nfl-teams';
import { getPrimetimeTag } from '@/lib/nfl/primetime';
import type { NetworkLogo } from '@/lib/nfl/broadcast';
import { getPrimetimeLogoFromLabel, getPrimetimeLogoFromTag } from '@/lib/nfl/broadcast';
import { normalizeSegments } from '@/lib/metrics/redzone';

type GameLine = {
  id: string;
  home: string;
  away: string;
  commenceTime: string;
  marketSpread: number | null;
  spreadBookCount: number;
  marketTotal: number | null;
  totalBookCount: number;
};

type Wx = {
  city: string;
  tempF: number;
  windMph: number;
  windDeg: number | null;
  humidity: number;
  conditions: string;
  icon: string;
};

type Verdict = "Pass" | "Sprinkle" | "Play" | "Pound" | "Hammer" | "Whale";
const verdictFromGap = (gapAbs: number): Verdict => {
  if (gapAbs >= 10) return "Whale";
  if (gapAbs >= 7) return "Hammer";
  if (gapAbs >= 5) return "Pound";
  if (gapAbs >= 3) return "Play";
  if (gapAbs >= 1.5) return "Sprinkle";
  return "Pass";
};

const ColdBlue = "text-sky-300";
const HotRed = "text-red-400";

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[%,$]/g, '').trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

const getByPath = (source: unknown, path: string): unknown => {
  if (!source || typeof source !== 'object') return undefined;
  const parts = path.split('.');
  let current: any = source;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part as keyof typeof current];
    } else {
      return undefined;
    }
  }
  return current;
};

const normalizePercentShare = (value: unknown): number | null => {
  const num = parseNumber(value);
  if (num === null) return null;
  if (num < 0) return 0;
  if (num > 1) {
    if (num <= 100) return Math.min(1, num / 100);
    return 1;
  }
  return num;
};

const getShareFromValue = (raw: unknown, total?: number | null): number | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const nested = getShareFromValue(obj.pct ?? obj.percentage ?? obj.share ?? obj.rate ?? obj.value, total);
    if (nested !== null) return nested;
  }
  const num = parseNumber(raw);
  if (num === null) return null;
  if (total != null && total > 0) {
    if (num > total && num <= 100) return normalizePercentShare(num);
    if (num <= total && num > 1) return null;
  }
  if (num > 1 && num <= 100 && (total == null || num > total)) return normalizePercentShare(num);
  if (num <= 1) return normalizePercentShare(num);
  return null;
};

const getCountFromValue = (raw: unknown, total?: number | null): number | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const nested = getCountFromValue(obj.count ?? obj.total ?? obj.value ?? obj.made ?? obj.amount, total);
    if (nested !== null) return nested;
  }
  const num = parseNumber(raw);
  if (num === null) return null;
  if (total != null && total > 0 && num > total && num <= 100) return null;
  if (num < 0) return 0;
  if (num <= 1 && total != null && total > 1) return null;
  return Math.round(num);
};

const extractTotal = (source: unknown, keys: string[]): number | null => {
  for (const key of keys) {
    const raw = getByPath(source, key);
    const value = getCountFromValue(raw);
    if (value !== null) return value;
  }
  return null;
};

const resolveMetric = (params: {
  source: unknown;
  total: number | null;
  shareKeys?: string[];
  countKeys?: string[];
  objectKeys?: string[];
}): { share: number | null; count: number | null } => {
  const { source, total, shareKeys = [], countKeys = [], objectKeys = [] } = params;
  let share: number | null = null;
  let count: number | null = null;

  for (const key of shareKeys) {
    if (share !== null) break;
    share = getShareFromValue(getByPath(source, key), total);
  }

  for (const key of countKeys) {
    if (count !== null) break;
    count = getCountFromValue(getByPath(source, key), total);
  }

  for (const key of objectKeys) {
    if (share !== null && count !== null) break;
    const raw = getByPath(source, key);
    if (raw && typeof raw === 'object') {
      if (share === null) share = getShareFromValue(raw, total);
      if (count === null) count = getCountFromValue(raw, total);
    }
  }

  if (share === null && count !== null && total) {
    share = total > 0 ? Math.min(count / total, 1) : null;
  }
  if (count === null && share !== null && total) {
    count = Math.round(share * total);
  }

  return { share, count };
};

const ensureCountsMatchTotal = (
  counts: Record<string, number | null>,
  shares: Record<string, number>,
  total: number | null,
  order: string[]
): Record<string, number | null> => {
  if (!total || total <= 0) return counts;
  const next: Record<string, number | null> = { ...counts };
  let assigned = 0;
  const missing: string[] = [];
  for (const key of order) {
    const value = next[key];
    if (value != null) {
      const sanitized = value < 0 ? 0 : value;
      next[key] = sanitized;
      assigned += sanitized;
    } else {
      missing.push(key);
    }
  }
  if (!missing.length) {
    const diff = total - assigned;
    if (diff !== 0) {
      const adjustKey = order[order.length - 1];
      if (next[adjustKey] != null) {
        next[adjustKey] = Math.max(0, (next[adjustKey] as number) + diff);
      }
    }
    return next;
  }

  for (const key of missing) {
    const estimate = Math.round((shares[key] ?? 0) * total);
    next[key] = estimate;
    assigned += estimate;
  }

  const remaining = total - assigned;
  if (remaining !== 0) {
    const adjustKey = missing.includes('fail') ? 'fail' : missing[missing.length - 1];
    if (adjustKey && next[adjustKey] != null) {
      next[adjustKey] = Math.max(0, (next[adjustKey] as number) + remaining);
    }
  }

  return next;
};

const OFFENSE_TOTAL_KEYS = [
  'trips',
  'attempts',
  'att',
  'total_trips',
  'totalTrips',
  'totals.trips',
  'totals.attempts',
  'opportunities',
  'plays',
];

const mapRedZoneOffense = (input: any): RedZoneMatchup['teamA']['redZone']['offense'] => {
  const source = input ?? {};
  const trips = extractTotal(source, OFFENSE_TOTAL_KEYS);

  const tdMetric = resolveMetric({
    source,
    total: trips,
    shareKeys: ['tdPct', 'td_pct', 'touchdown_pct', 'touchdownRate', 'tdRate', 'offense.tdPct'],
    countKeys: ['tdCount', 'td_count', 'touchdowns', 'totals.td', 'td.total'],
    objectKeys: ['touchdown', 'td'],
  });

  const fgMetric = resolveMetric({
    source,
    total: trips,
    shareKeys: ['fgPct', 'fg_pct', 'field_goal_pct', 'fieldGoalRate', 'offense.fgPct'],
    countKeys: ['fgCount', 'fg_count', 'field_goals', 'totals.fg', 'fg.total'],
    objectKeys: ['field_goal', 'fieldGoal', 'fg'],
  });

  const turnoverMetric = resolveMetric({
    source,
    total: trips,
    shareKeys: ['turnoverPct', 'turnover_pct', 'giveaway_pct', 'turnovers_pct', 'offense.turnoverPct'],
    countKeys: ['turnoverCount', 'turnovers', 'giveaways', 'totals.turnover', 'turnover.total'],
    objectKeys: ['turnover', 'giveaway'],
  });

  const failMetric = resolveMetric({
    source,
    total: trips,
    shareKeys: ['stopPct', 'stop_pct', 'failPct', 'fail_pct', 'scoreless_pct', 'offense.stopPct'],
    countKeys: ['stopCount', 'stop_count', 'stops', 'failCount', 'fail_count', 'totals.stop'],
    objectKeys: ['stop', 'fail', 'scoreless', 'no_points'],
  });

  const shareRecord = {
    td: tdMetric.share ?? 0,
    fg: fgMetric.share ?? 0,
    turnover: turnoverMetric.share ?? 0,
    fail: failMetric.share ?? 0,
  };

  const normalizedShares = normalizeSegments(shareRecord, ['td', 'fg', 'turnover', 'fail']);

  const counts = ensureCountsMatchTotal(
    {
      td: tdMetric.count,
      fg: fgMetric.count,
      turnover: turnoverMetric.count,
      fail: failMetric.count,
    },
    normalizedShares,
    trips,
    ['td', 'fg', 'turnover', 'fail']
  );

  if (trips != null) {
    const others = (counts.td ?? 0) + (counts.fg ?? 0) + (counts.turnover ?? 0);
    const residual = Math.max(trips - others, 0);
    if (counts.fail == null) counts.fail = residual;
    else if ((counts.fail ?? 0) !== residual) counts.fail = Math.max(residual, 0);
  }

  return {
    trips,
    td: { share: normalizedShares.td ?? 0, count: counts.td ?? (trips != null ? Math.round((normalizedShares.td ?? 0) * trips) : null) },
    fg: { share: normalizedShares.fg ?? 0, count: counts.fg ?? (trips != null ? Math.round((normalizedShares.fg ?? 0) * trips) : null) },
    turnover: {
      share: normalizedShares.turnover ?? 0,
      count: counts.turnover ?? (trips != null ? Math.round((normalizedShares.turnover ?? 0) * trips) : null),
    },
    fail: {
      share: normalizedShares.fail ?? 0,
      count: counts.fail ?? (trips != null ? Math.max(trips - ((counts.td ?? 0) + (counts.fg ?? 0) + (counts.turnover ?? 0)), 0) : null),
    },
  };
};

const DEFENSE_TOTAL_KEYS = [
  'trips',
  'attempts',
  'att',
  'total_trips',
  'totalTrips',
  'totals.trips',
  'totals.attempts',
  'opportunities',
  'plays',
];

const mapRedZoneDefense = (input: any): RedZoneMatchup['teamA']['redZone']['defense'] => {
  const source = input ?? {};
  const trips = extractTotal(source, DEFENSE_TOTAL_KEYS);

  const tdMetric = resolveMetric({
    source,
    total: trips,
    shareKeys: ['tdAllowedPct', 'td_allowed_pct', 'touchdown_allowed_pct', 'tdAllowed', 'td_allowed', 'defense.tdAllowedPct'],
    countKeys: ['tdAllowedCount', 'td_allowed_count', 'touchdowns_allowed', 'totals.td_allowed', 'td_allowed'],
    objectKeys: ['touchdown_allowed', 'td_allowed', 'touchdown'],
  });

  const fgMetric = resolveMetric({
    source,
    total: trips,
    shareKeys: ['fgAllowedPct', 'fg_allowed_pct', 'field_goal_allowed_pct', 'defense.fgAllowedPct', 'fgAllowed'],
    countKeys: ['fgAllowedCount', 'fg_allowed_count', 'field_goals_allowed', 'totals.fg_allowed', 'fg_allowed'],
    objectKeys: ['field_goal_allowed', 'fg_allowed', 'field_goal'],
  });

  const takeawayMetric = resolveMetric({
    source,
    total: trips,
    shareKeys: ['takeawayPct', 'takeaways_in_rz_pct', 'turnover_forced_pct', 'defense.takeawayPct'],
    countKeys: ['takeawayCount', 'takeaways', 'turnovers_forced', 'totals.takeaway', 'takeaway'],
    objectKeys: ['takeaway', 'turnover_forced'],
  });

  const zeroMetric = resolveMetric({
    source,
    total: trips,
    shareKeys: ['stopPct', 'stop_pct', 'scoreless_pct', 'zeroPct', 'zero_pct', 'defense.stopPct'],
    countKeys: ['stopCount', 'stop_count', 'scoreless', 'zeroCount', 'zero_count', 'totals.stop'],
    objectKeys: ['zero', 'stop', 'scoreless'],
  });

  const shareRecord = {
    zero: zeroMetric.share ?? 0,
    takeaway: takeawayMetric.share ?? 0,
    fg_allowed: fgMetric.share ?? 0,
    td_allowed: tdMetric.share ?? 0,
  };

  const normalizedShares = normalizeSegments(shareRecord, ['zero', 'takeaway', 'fg_allowed', 'td_allowed']);

  const counts = ensureCountsMatchTotal(
    {
      zero: zeroMetric.count,
      takeaway: takeawayMetric.count,
      fg_allowed: fgMetric.count,
      td_allowed: tdMetric.count,
    },
    normalizedShares,
    trips,
    ['zero', 'takeaway', 'fg_allowed', 'td_allowed']
  );

  if (trips != null) {
    const others = (counts.takeaway ?? 0) + (counts.fg_allowed ?? 0) + (counts.td_allowed ?? 0);
    const residual = Math.max(trips - others, 0);
    if (counts.zero == null) counts.zero = residual;
    else if ((counts.zero ?? 0) !== residual) counts.zero = Math.max(residual, 0);
  }

  return {
    trips,
    tdAllowed: {
      share: normalizedShares.td_allowed ?? 0,
      count: counts.td_allowed ?? (trips != null ? Math.round((normalizedShares.td_allowed ?? 0) * trips) : null),
    },
    fgAllowed: {
      share: normalizedShares.fg_allowed ?? 0,
      count: counts.fg_allowed ?? (trips != null ? Math.round((normalizedShares.fg_allowed ?? 0) * trips) : null),
    },
    takeaway: {
      share: normalizedShares.takeaway ?? 0,
      count: counts.takeaway ?? (trips != null ? Math.round((normalizedShares.takeaway ?? 0) * trips) : null),
    },
    zero: {
      share: normalizedShares.zero ?? 0,
      count: counts.zero ?? (trips != null ? Math.max(trips - ((counts.takeaway ?? 0) + (counts.fg_allowed ?? 0) + (counts.td_allowed ?? 0)), 0) : null),
    },
  };
};

const buildRedZoneMatchup = (data: any, away: string, home: string): RedZoneMatchup => {
  const awayData = data?.away ?? {};
  const homeData = data?.home ?? {};
  return {
    teamA: {
      teamId: away,
      displayName: away,
      redZone: {
        offense: mapRedZoneOffense(awayData?.offense ?? {}),
        defense: mapRedZoneDefense(awayData?.defense ?? {}),
      },
    },
    teamB: {
      teamId: home,
      displayName: home,
      redZone: {
        offense: mapRedZoneOffense(homeData?.offense ?? {}),
        defense: mapRedZoneDefense(homeData?.defense ?? {}),
      },
    },
  };
};

type GameBadge = { emoji: string; label: string; color?: string; networkLogo?: NetworkLogo };

function computeGameBadges(kickoffISO: string): GameBadge[] {
  if (!kickoffISO) return [];
  const date = new Date(kickoffISO);
  if (!Number.isFinite(date.getTime())) return [];

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    hour12: false
  }).formatToParts(date);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? NaN);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? NaN);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN);
  const year = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(date));

  const badges: GameBadge[] = [];
  const primetime = getPrimetimeTag(kickoffISO);
  const primetimeLogo = getPrimetimeLogoFromTag(primetime);
  if (primetime) {
    badges.push({
      emoji: '📺',
      label: `${primetime} Primetime`,
      networkLogo: primetimeLogo ?? undefined,
    });
  }

  const isThanksgiving = (() => {
    if (weekday !== 'Thu' || month !== 11) return false;
    const first = new Date(Date.UTC(year, 10, 1));
    const firstThursdayOffset = (4 - first.getUTCDay() + 7) % 7; // Thursday index 4 in UTC week
    const fourthThursday = 1 + firstThursdayOffset + 21;
    return day === fourthThursday;
  })();
  if (isThanksgiving) badges.push({ emoji: '🦃', label: 'Thanksgiving' });

  if (month === 12 && day === 25) badges.push({ emoji: '🎄', label: 'Christmas' });
  if (weekday === 'Fri' && month === 11 && day >= 23 && day <= 29) badges.push({ emoji: '🛍️', label: 'Black Friday' });
  if (weekday === 'Sat' && hour >= 19) badges.push({ emoji: '🪩', label: 'Saturday night' });

  if (!badges.length) badges.push({ emoji: '🏈', label: 'Regular matchup' });
  return badges;
}

function formatKickoff(kickoffISO?: string | null): string {
  if (!kickoffISO) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(kickoffISO));
  } catch {
    return kickoffISO;
  }
}

function isDomedStadium(homeTeamFull: string | undefined): boolean {
  if (!homeTeamFull) return false;
  const abbr = toAbbr(homeTeamFull);
  const stadium = STADIUMS[abbr as keyof typeof STADIUMS];
  if (!stadium) return false;
  const roof = stadium.roof || '';
  return roof === 'closed' || roof === 'retractable';
}

export default function Home() {
  const [games, setGames] = useState<GameLine[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wx, setWx] = useState<Wx | null>(null);
  const [travel, setTravel] = useState<TravelRow[]>([]);
  const [redZone, setRedZone] = useState<RedZoneMatchup | null>(null);

  const [cold, setCold] = useState<number>(-3.5);
  const [hot, setHot] = useState<number | null>(null);
  const [showHot, setShowHot] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [agentData, setAgentData] = useState<any | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [injuryData, setInjuryData] = useState<InjuryReport | null>(null);
  const [injuryLoading, setInjuryLoading] = useState(false);
  const [injuryError, setInjuryError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'dashboard' | 'injuries'>('dashboard');
  const [injuryRefreshKey, setInjuryRefreshKey] = useState(0);
  const [aiReport, setAiReport] = useState<{ bullets?: string[]; angle?: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await fetch("/api/coldline-odds");
        const data = (await r.json()) as GameLine[] | { error: string };
        if (!mounted) return;
        if (Array.isArray(data)) {
          setGames(data);
          if (data.length && !activeId) setActiveId(data[0].id);
        } else if (data.error) {
          setErr(data.error);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Odds fetch error";
        setErr(message);
      }
    };
    load();
    return () => { mounted = false; };
  }, [activeId]);

  // Load upcoming travel rows once
  useEffect(() => {
    let mounted = true;
    fetchTravel().then(rows => { if (mounted) setTravel(rows); }).catch(()=>{ if(mounted) setTravel([]); });
    return () => { mounted = false; };
  }, []);

  const active = useMemo(() => games.find(g => g.id === activeId) || null, [games, activeId]);

  const travelByTeam = useMemo(() => {
    const m = new Map<string, TravelRow>();
    for (const r of travel) m.set(String(r.team).toLowerCase(), r);
    return m;
  }, [travel]);

  const formatTravelMiles = useCallback((value: unknown): string => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    return Math.round(num).toLocaleString();
  }, []);

  const renderTravelChip = useCallback(
    (teamName: string) => {
      const entry = travelByTeam.get(String(teamName || '').toLowerCase());
      if (!entry) return null;
      const miles = formatTravelMiles(entry.distance_from_prev_location_mi);
      const sinceHosting = formatTravelMiles(entry.miles_since_last_home);
      const label = `${teamName} travel: ${miles} mi • Since hosting: ${sinceHosting} mi`;
      return (
        <span
          className="ml-1 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white"
          title={label}
        >
          {label}
        </span>
      );
    },
    [formatTravelMiles, travelByTeam]
  );

  const coachingFamiliarity = agentData?.coachingFamiliarity ?? null;

  const HFA_COEFF = EXPECTATION_COEFFICIENTS.hfa || 0.18;
  const HFA_LIMIT = PRIOR_LIMITS.hfa.max;

  const simulationContext = useMemo<ExpectedPointsContext | undefined>(() => {
    if (!active) return undefined;
    const weather: WeatherContext | undefined = wx ? {
      tempF: wx.tempF,
      windMph: wx.windMph,
      precipitation: (() => {
        const c = (wx.conditions || "").toLowerCase();
        if (/snow|sleet|flurr/.test(c)) return "snow";
        if (/rain|shower|storm/.test(c)) return "rain";
        return "none";
      })(),
    } : undefined;

    const travelAdjustments: Record<string, TravelAdjustments> = {};
    const awayRow = travelByTeam.get(String(active.away).toLowerCase());
    if (awayRow) {
      const fatigue = awayRow.distance_from_prev_location_mi > 1500 ? 0.3 : awayRow.distance_from_prev_location_mi > 800 ? 0.15 : 0;
      if (fatigue > 0) travelAdjustments[active.away] = { pace: -0.2 * fatigue, fatigue };
    }
    const homeRow = travelByTeam.get(String(active.home).toLowerCase());
    if (homeRow) {
      const restBoost = homeRow.home_away === "H" ? 0.1 : 0;
      if (restBoost) travelAdjustments[active.home] = { pace: 0.12, restBoost };
    }

    const overrides: PriorsOverrides = {};
    const applyCoaching = (teamName: string, points: number | undefined) => {
      if (!teamName || points == null || Number.isNaN(points) || points === 0) return;
      const hfaTarget = Math.max(-HFA_LIMIT, Math.min(HFA_LIMIT, points / HFA_COEFF));
      overrides[teamName] = { ...(overrides[teamName] ?? {}), hfa: hfaTarget };
    };

    if (coachingFamiliarity?.home?.points) applyCoaching(active.home, coachingFamiliarity.home.points);
    if (coachingFamiliarity?.away?.points) applyCoaching(active.away, coachingFamiliarity.away.points);

    return {
      weather,
      travel: Object.keys(travelAdjustments).length ? travelAdjustments : undefined,
      location: {
        homeTeamId: active.home,
      },
      overrides: Object.keys(overrides).length ? overrides : undefined,
    };
  }, [active, travelByTeam, wx, coachingFamiliarity?.home?.points, coachingFamiliarity?.away?.points, HFA_COEFF, HFA_LIMIT]);

  useEffect(() => {
    if (!active) {
      setAgentData(null);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      home: active.home,
      away: active.away,
      kickoff: active.commenceTime,
    });
    (async () => {
      try {
        setAgentLoading(true);
        setAgentError(null);
        setAiReport(null);
        setAiError(null);
        setShowWeatherDetails(false);
        const resp = await fetch(`/api/agent?${params.toString()}`, { signal: controller.signal });
        const data = await resp.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (!resp.ok || data?.error) {
          setAgentError(data?.error || `Unable to load game context (HTTP ${resp.status})`);
          setAgentData(null);
        } else {
          setAgentData(data);
        }
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setAgentError(e?.message || 'Unable to load game context');
        setAgentData(null);
      } finally {
        if (!controller.signal.aborted) setAgentLoading(false);
      }
    })();
    return () => controller.abort();
  }, [active?.id, active?.home, active?.away, active?.commenceTime]);

  useEffect(() => {
    if (!active) {
      setInjuryData(null);
      setInjuryError(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        setInjuryLoading(true);
        setInjuryError(null);
        const params = new URLSearchParams({
          home: active.home,
          away: active.away,
        });
        if (active.commenceTime) params.set('kickoff', active.commenceTime);
        if (injuryRefreshKey > 0) params.set('refresh', String(injuryRefreshKey));
        const resp = await fetch(`/api/injuries?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const raw = await resp.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (!resp.ok) {
          setInjuryError(`Injuries request failed (HTTP ${resp.status})`);
          setInjuryData(normalizeInjuryReport(raw));
          return;
        }
        const normalized = normalizeInjuryReport(raw);
        if (normalized.error) setInjuryError(normalized.error);
        setInjuryData(normalized);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setInjuryError(e?.message || 'Unable to load injuries');
        setInjuryData(normalizeInjuryReport({}));
      } finally {
        if (!controller.signal.aborted) setInjuryLoading(false);
      }
    })();
    return () => controller.abort();
  }, [active?.home, active?.away, active?.commenceTime, injuryRefreshKey]);

  useEffect(() => {
    let mounted = true;
    const fetchWx = async () => {
      if (!active) return;
      // Reset weather when switching games so any derived wind exposure visuals
      // do not carry over a previous game's value.
      setWx(null);
      try {
        const r = await fetch(`/api/coldline-weather?team=${encodeURIComponent(active.home)}`);
        const data = (await r.json()) as Wx | { error: string };
        if (!mounted) return;
        if ("city" in data) setWx(data);
      } catch { /* ignore */ }
    };
    fetchWx();
    return () => { mounted = false; };
  }, [active?.home]);

  useEffect(() => {
    let cancelled = false;
    if (!active) {
      setRedZone(null);
      return () => { cancelled = true; };
    }
    setRedZone(null);
    const load = async () => {
      try {
        const params = new URLSearchParams({ home: active.home, away: active.away });
        const res = await fetch(`/api/redzone?${params.toString()}`);
        if (!res.ok) throw new Error('red zone fetch failed');
        const data = await res.json();
        if (!cancelled) setRedZone(buildRedZoneMatchup(data, active.away, active.home));
      } catch {
        if (!cancelled) setRedZone(null);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [active?.home, active?.away]);

  const market = active?.marketSpread ?? null;
  const diff = market === null ? null : Number((cold - market).toFixed(2));
  const signal = diff === null ? "Pass" : verdictFromGap(Math.abs(diff));
  const badges = useMemo(() => {
    const matchupBadges = Array.isArray(agentData?.matchup?.badges) ? agentData.matchup.badges : null;
    const directBadges = Array.isArray(agentData?.badges) ? agentData.badges : null;
    const source = matchupBadges && matchupBadges.length ? matchupBadges : directBadges;
    if (source && source.length) {
      return source
        .map((badge: unknown, index: number): GameBadge | null => {
          const entry = (badge ?? {}) as Record<string, unknown>;
          const labelRaw = typeof entry.label === 'string' ? (entry.label as string).trim() : '';
          const emojiRaw = typeof entry.emoji === 'string' ? (entry.emoji as string).trim() : '';
          if (!labelRaw && !emojiRaw) return null;
          const label = labelRaw || `Badge ${index + 1}`;
          const emoji = emojiRaw || '🏈';
          const colorValue = typeof entry.color === 'string' ? (entry.color as string).trim() : '';
          const networkLogo = emoji === '📺' ? getPrimetimeLogoFromLabel(label) : null;
          return {
            emoji,
            label,
            color: colorValue || undefined,
            networkLogo: networkLogo ?? undefined,
          };
        })
        .filter((badge: GameBadge | null): badge is GameBadge => Boolean(badge));
    }
    return computeGameBadges(active?.commenceTime || "");
  }, [agentData?.matchup?.badges, agentData?.badges, active?.commenceTime]);
  const teamLogos = useMemo(() => {
    const map = new Map<string, string[]>();
    const register = (key: unknown, logos: unknown) => {
      if (typeof key !== 'string' || !key.trim()) return;
      if (!Array.isArray(logos) || !logos.length) return;
      const cleaned = logos
        .map(url => (typeof url === 'string' ? url.trim() : ''))
        .filter(Boolean);
      if (!cleaned.length) return;
      map.set(key.trim().toLowerCase(), cleaned);
    };
    const fromAssets = agentData?.teamAssets || {};
    register(fromAssets.home?.id, fromAssets.home?.logos);
    register(fromAssets.away?.id, fromAssets.away?.logos);
    const matchup = agentData?.matchup;
    if (matchup) {
      register(matchup.home?.id, matchup.home?.logos);
      register(matchup.home?.name, matchup.home?.logos);
      register(matchup.home?.name?.toLowerCase?.(), matchup.home?.logos);
      register(matchup.away?.id, matchup.away?.logos);
      register(matchup.away?.name, matchup.away?.logos);
      register(matchup.away?.name?.toLowerCase?.(), matchup.away?.logos);
    }
    return map;
  }, [agentData?.teamAssets, agentData?.matchup]);
  const getTeamLogos = useCallback(
    (teamName: string) => {
      const key = String(teamName || '').trim().toLowerCase();
      return teamLogos.get(key) ?? [];
    },
    [teamLogos]
  );
  const homeIsDome = useMemo(() => isDomedStadium(active?.home), [active?.home]);
  const agentWeather = agentData?.weather || null;
  const weatherCity = wx?.city || agentWeather?.city || '';
  const weatherTempValue = parseNumber(agentWeather?.temp_f ?? (agentWeather as any)?.tempF ?? wx?.tempF ?? null);
  const weatherWindValue = parseNumber(agentWeather?.wind_mph ?? (agentWeather as any)?.windMph ?? wx?.windMph ?? null);
  const weatherHumidityValue = parseNumber(agentWeather?.humidity ?? wx?.humidity ?? null);
  const weatherConditions = agentWeather?.conditions || agentWeather?.description || wx?.conditions || '';
  const weatherWindDirection = (() => {
    const agentDeg = parseNumber(agentWeather?.wind_deg ?? (agentWeather as any)?.windDeg ?? null);
    if (agentDeg !== null) return agentDeg;
    return parseNumber(wx?.windDeg ?? null);
  })();
  const windGoalDescription = describeWindForGoal(weatherWindDirection);
  const precipitationProbRaw = agentWeather?.pop ?? agentWeather?.precipitation ?? null;
  const precipitationProb = precipitationProbRaw == null ? NaN : Number(precipitationProbRaw);
  const hasPrecipitation = Number.isFinite(precipitationProb);
  const hasWindSpeed = typeof weatherWindValue === 'number' && Number.isFinite(weatherWindValue);
  const roundedWindMph = hasWindSpeed ? Math.round(weatherWindValue as number) : null;
  const windCardinalAbbr = abbreviateCardinal(windGoalDescription.cardinal);
  const windShortLabel = hasWindSpeed
    ? `${roundedWindMph} mph${windCardinalAbbr ? ` • ${windCardinalAbbr}` : ''}${
        windGoalDescription.toDegrees != null ? ` (${Math.round(windGoalDescription.toDegrees)}°)` : ''
      }`
    : '—';
  const windNarrative = hasWindSpeed
    ? (() => {
        const chunks: string[] = [];
        if (windGoalDescription.cardinal) chunks.push(windGoalDescription.cardinal);
        if (windGoalDescription.target) chunks.push(windGoalDescription.target);
        const directionPhrase = chunks.join(' ');
        const degreeSuffix = windGoalDescription.toDegrees != null ? ` (${Math.round(windGoalDescription.toDegrees)}°)` : '';
        if (directionPhrase) return `Wind blowing ${directionPhrase} at ${roundedWindMph} mph${degreeSuffix}`.trim();
        return `Wind steady at ${roundedWindMph} mph${degreeSuffix}`.trim();
      })()
    : null;
  const showWindVisualization = !homeIsDome && hasWindSpeed && windGoalDescription.toDegrees != null;
  const severeWeatherKeywords = ['thunder', 'storm', 'snow', 'rain', 'sleet', 'hail', 'blizzard', 'tornado', 'hurricane', 'freezing', 'ice'];
  const lowerConditions = weatherConditions.toLowerCase();
  const severeConditionMentioned = severeWeatherKeywords.some(keyword => lowerConditions.includes(keyword));
  const heavyWind = !homeIsDome && Number.isFinite(weatherWindValue) && (weatherWindValue as number) >= 18;
  const heavyPrecip = !homeIsDome && Number.isFinite(precipitationProb) && precipitationProb >= 0.5;
  const extremeTemperature = !homeIsDome && Number.isFinite(weatherTempValue) && (Number(weatherTempValue) <= 25 || Number(weatherTempValue) >= 95);
  const hasInclementWeather = !homeIsDome && (heavyWind || heavyPrecip || severeConditionMentioned || extremeTemperature);
  const environmentCardClasses = `${hasInclementWeather ? 'border-rose-500/70 bg-[#2a1114] animate-pulse' : 'border-[#1a2635] bg-[#0b121b]'} rounded-lg p-4 border transition-colors duration-500`;
  const injuriesHome: InjuryItem[] = useMemo(
    () => injuryData?.home?.list ?? [],
    [injuryData?.home?.list]
  );
  const injuriesAway: InjuryItem[] = useMemo(
    () => injuryData?.away?.list ?? [],
    [injuryData?.away?.list]
  );
  const injuryAwayCount = typeof injuryData?.away?.count === 'number' ? injuryData?.away?.count : injuriesAway.length;
  const injuryHomeCount = typeof injuryData?.home?.count === 'number' ? injuryData?.home?.count : injuriesHome.length;
  const injurySources: string[] = useMemo(() => {
    const set = new Set<string>();
    (injuryData?.home?.sources ?? []).forEach(source => {
      if (source) set.add(String(source));
    });
    (injuryData?.away?.sources ?? []).forEach(source => {
      if (source) set.add(String(source));
    });
    return [...set];
  }, [injuryData?.home?.sources, injuryData?.away?.sources]);
  const totalListedInjuries = injuriesHome.length + injuriesAway.length;
  const totalReportedInjuries = injuryHomeCount + injuryAwayCount;
  const injuryBadgeCount = totalListedInjuries || totalReportedInjuries;
  const statusOrder = useMemo(() => [
    'out',
    'doubtful',
    'questionable',
    'probable',
    'game time decision',
    'suspended',
    'injured reserve',
    'pup',
    'active',
  ], []);
  const statusRank = useCallback((status: string) => {
    const lower = status.toLowerCase();
    for (let i = 0; i < statusOrder.length; i += 1) {
      if (lower.includes(statusOrder[i])) return i;
    }
    return statusOrder.length + (lower ? 0 : 1);
  }, [statusOrder]);
  const groupInjuries = useCallback((list: InjuryItem[]) => {
    const map = new Map<string, InjuryItem[]>();
    list.forEach(item => {
      const key = item.status ? item.status.trim() : 'Undesignated';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries())
      .sort((a, b) => {
        const rankDelta = statusRank(a[0]) - statusRank(b[0]);
        if (rankDelta !== 0) return rankDelta;
        return a[0].localeCompare(b[0]);
      })
      .map(([status, items]) => ({
        status,
        items: items.slice().sort((x, y) => x.name.localeCompare(y.name)),
      }));
  }, [statusRank]);
  const mainTabs = useMemo(() => ([
    { id: 'dashboard' as const, label: 'Overview' },
    { id: 'injuries' as const, label: 'Injuries' },
  ]), []);
  const injuriesAwayBuckets = useMemo(() => groupInjuries(injuriesAway), [groupInjuries, injuriesAway]);
  const injuriesHomeBuckets = useMemo(() => groupInjuries(injuriesHome), [groupInjuries, injuriesHome]);
  const handleRefreshInjuries = useCallback(() => {
    setInjuryRefreshKey((prev) => prev + 1);
  }, []);
  const renderTeamPanel = (
    teamId: string,
    buckets: { status: string; items: InjuryItem[] }[],
    listedCount: number,
    reportedCount: number,
    logos: string[],
  ) => {
    const hasListings = listedCount > 0;
    return (
      <div className="rounded-lg border border-[#1a2635] bg-[#0b121b] p-4">
        <div className="flex items-start justify-between gap-2">
          <TeamTag
            teamId={teamId}
            showCity
            logoSize={20}
            className="text-sm text-gray-200"
            logos={logos}
          />
          <div className="text-right">
            <div className="font-mono text-lg text-rose-300">{listedCount}</div>
            {reportedCount > listedCount ? (
              <div className="text-[11px] text-gray-500">{reportedCount} reported</div>
            ) : (
              <div className="text-[11px] text-gray-500">Listed players</div>
            )}
          </div>
        </div>
        {hasListings ? (
          <div className="mt-3 space-y-3">
            {buckets.map((bucket) => (
              <div key={`${teamId}-${bucket.status}`} className="rounded border border-[#1a2635] bg-[#111a26] p-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-gray-400">
                  <span>{bucket.status || 'Undesignated'}</span>
                  <span className="font-mono text-rose-300">{bucket.items.length}</span>
                </div>
                <ul className="mt-2 space-y-2 text-xs text-gray-200">
                  {bucket.items.map((player) => (
                    <li key={`${teamId}-${bucket.status}-${player.name}`} className="rounded bg-[#0b121b] px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-gray-100">{player.name}{player.position ? ` (${player.position})` : ''}</span>
                        {player.status && <span className="text-[11px] text-rose-200">{player.status}</span>}
                      </div>
                      {player.note ? (
                        <div className="mt-1 text-[11px] leading-snug text-gray-400">{player.note}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-400">
            {reportedCount > 0 ? `${reportedCount} injuries reported, awaiting detail.` : 'No injuries reported.'}
          </p>
        )}
      </div>
    );
  };
  const onPropagate = () => {
    if (market === null) return;
    setHot(market);
    setShowHot(true);
  };

  const handleGenerateReport = useCallback(async () => {
    if (!active) return;
    try {
      setAiLoading(true);
      setAiError(null);
      const params = new URLSearchParams({
        home: active.home,
        away: active.away,
        kickoff: active.commenceTime,
      });
      const resp = await fetch(`/api/ai-summary?${params.toString()}`);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) {
        setAiError(data?.error || `Unable to generate report (HTTP ${resp.status})`);
        setAiReport(null);
      } else {
        setAiReport(data);
      }
    } catch (e: any) {
      setAiError(e?.message || 'Unable to generate report');
      setAiReport(null);
    } finally {
      setAiLoading(false);
    }
  }, [active]);

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
      {/* Removed overlay close button (×) to declutter header */}

      <main className="mx-auto max-w-6xl px-5 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-3">
            <img src="/logo-ice-script.svg" alt="The Cold Line" className="h-8 w-auto" />
            <span className="text-sm text-gray-400">Build Cold Line</span>
          </div>
          <Link href="/tutorial" className="text-cyan-300 text-sm underline hover:text-cyan-200">Tutorial</Link>
        </header>

        {err && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <section className="rounded-xl border border-[#14202e] bg-[#0e1520] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1 min-w-0">
              <label className="text-sm text-gray-300">Select game</label>
              <select
                className="mt-1 w-full max-w-xl rounded-lg bg-[#0b121b] border border-[#1a2635] px-3 py-2 outline-none"
                value={activeId ?? ""}
                onChange={(e) => setActiveId(e.target.value)}
              >
                {games.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.away} at {g.home}
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-0 md:ml-auto flex items-center gap-3 text-xs text-gray-400">
              <span>Books</span>
              <span className="rounded bg-[#0b121b] border border-[#1a2635] px-2 py-1">
                {active?.spreadBookCount ?? 0}
              </span>
              <span className="ml-2">Tot</span>
              <span className="rounded bg-[#0b121b] border border-[#1a2635] px-2 py-1">
                {active?.totalBookCount ?? 0}
              </span>
            </div>
          </div>
          {active && (
            <div className="mt-3 rounded-lg border border-[#1a2635] bg-[#0b121b] p-3">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <TeamTag teamId={active.away} showCity logos={getTeamLogos(active.away)} />
                    {renderTravelChip(active.away)}
                    <span className="text-gray-500">@</span>
                    <TeamTag teamId={active.home} showCity logos={getTeamLogos(active.home)} />
                    {renderTravelChip(active.home)}
                  </div>
                  <div className="text-xs text-gray-400">{formatKickoff(active.commenceTime)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-200/90">
                  {badges.map((badge: GameBadge) => (
                    <span
                      key={`${badge.emoji}-${badge.label}`}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1"
                      style={badge.color ? { backgroundColor: badge.color } : { backgroundColor: '#172436' }}
                    >
                      <span role="img" aria-label={badge.label}>{badge.emoji}</span>
                      {badge.networkLogo ? (
                        <img
                          src={badge.networkLogo.src}
                          alt={badge.networkLogo.alt}
                          title={badge.networkLogo.alt}
                          className="h-3 w-auto"
                        />
                      ) : null}
                      <span>{badge.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <nav className="flex flex-wrap items-center gap-2 rounded-xl border border-[#14202e] bg-[#0e1520] px-4 py-3">
          {mainTabs.map((tab) => {
            const isActive = mainTab === tab.id;
            const isInjuriesTab = tab.id === 'injuries';
            const badge = isInjuriesTab ? injuryBadgeCount : null;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMainTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                    : 'border-[#1a2635] bg-[#0b121b] text-cyan-200 hover:border-cyan-500 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {badge ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-white/20 text-white' : 'bg-cyan-900/40 text-cyan-200'}`}>
                    {badge}
                  </span>
                ) : null}
                {isInjuriesTab && injuryLoading ? (
                  <span className="text-[11px] text-cyan-100/80">Loading…</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {mainTab === 'dashboard' ? (
        <section className="rounded-xl border border-[#14202e] bg-[#0e1520] p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-300">Current Game</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-400">Cold Line</span>
                <span className={`text-2xl font-extrabold ${ColdBlue}`}>
                  {Number.isFinite(cold) ? cold.toFixed(2) : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-sky-400">Your model</p>
              <div className="mt-3">
                <input
                  type="number"
                  step="0.5"
                  value={cold}
                  onChange={(e) => setCold(parseFloat(e.target.value))}
                  className="w-32 rounded bg-[#0f1a28] border border-[#213149] px-2 py-1 text-sky-200 outline-none"
                />
              </div>
            </div>

            <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-400">Market Line</span>
                <span className="text-2xl font-extrabold text-gray-200">
                  {market === null ? "—" : market.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">Avg of available books</p>
            </div>

            <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-400">Differential</span>
                <span className="text-2xl font-extrabold text-emerald-300">
                  {diff === null ? "—" : `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}`}
                </span>
              </div>
              <p className="mt-1 text-xs text-emerald-300">{signal}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-[#120f12] p-4 border border-[#351a1a]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-400">Hot Line</span>
                <span className={`text-2xl font-extrabold ${HotRed}`}>
                  {showHot && hot !== null ? hot.toFixed(2) : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-red-300">Shows after Propagate</p>
            </div>

            <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
              <span className="text-sm text-gray-400">Cold vs Hot</span>
              <div className="text-2xl font-extrabold">
                {showHot && hot !== null ? `${(cold - hot >= 0 ? "+" : "")}${(cold - hot).toFixed(2)}` : "—"}
              </div>
              <p className="mt-1 text-xs text-gray-400">Cold minus Hot</p>
            </div>

            <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
              <span className="text-sm text-gray-400">Kickoff</span>
              <div className="text-sm text-gray-300">
                {active ? formatKickoff(active.commenceTime) : "—"}
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {homeIsDome ? 'Indoors (climate controlled)' : weatherCity ? `${weatherCity} outlook preview — see environment card.` : 'Environment card covers weather details.'}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-400">Set your Cold Line, then propagate to compare vs market.</p>
            <button
              onClick={onPropagate}
              disabled={market===null}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${market===null? 'bg-[#1a2635] text-gray-500 cursor-not-allowed' : 'bg-emerald-600/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-600/30'}`}
            >
              <span>Propagate to Hot</span>
            </button>
          </div>
        </section>

        {active ? (
        <section className="rounded-xl border border-[#14202e] bg-[#0e1520] p-4">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-300">Simulations</h2>
            <GameCard
              home={active.home}
              away={active.away}
              kickoff={active.commenceTime}
              marketSpread={active.marketSpread}
              marketTotal={active.marketTotal}
              simulationContext={simulationContext}
              matchup={redZone ?? undefined}
              teamLogos={{ home: getTeamLogos(active.home), away: getTeamLogos(active.away) }}
              injuries={injuryData}
              injuriesLoading={injuryLoading}
              injuriesError={injuryError}
              coachingFamiliarity={coachingFamiliarity}
            />
          </section>
        ) : null}

        {active ? (
          <section className="rounded-xl border border-[#14202e] bg-[#0e1520] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-wide text-gray-300">Game Context</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-200/80">
                {badges.map((badge: GameBadge) => (
                  <span
                    key={`context-${badge.emoji}-${badge.label}`}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1"
                    style={badge.color ? { backgroundColor: badge.color } : { backgroundColor: '#172436' }}
                  >
                    <span role="img" aria-label={badge.label}>{badge.emoji}</span>
                    {badge.networkLogo ? (
                      <img
                        src={badge.networkLogo.src}
                        alt={badge.networkLogo.alt}
                        title={badge.networkLogo.alt}
                        className="h-3 w-auto"
                      />
                    ) : null}
                    <span>{badge.label}</span>
                  </span>
                ))}
              </div>
            </div>
            {agentError ? (
              <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                {agentError}
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className={environmentCardClasses}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${hasInclementWeather ? 'text-rose-200' : 'text-gray-400'}`}>Environment</span>
                  <button
                    type="button"
                    onClick={() => setShowWeatherDetails((prev) => !prev)}
                    className={`rounded px-2 py-1 text-xs font-semibold transition ${hasInclementWeather ? 'bg-rose-700/60 text-rose-100 hover:bg-rose-700/80' : 'bg-[#172436] text-cyan-200 hover:bg-[#1d2f46]'}`}
                  >
                    {showWeatherDetails ? "− Details" : "+ Details"}
                  </button>
                </div>
                <div className="mt-3 space-y-2 text-sm text-gray-200">
                  {homeIsDome ? (
                    <div className="text-emerald-200">Indoor dome — weather neutral</div>
                  ) : (
                    <div className="space-y-1">
                      {hasInclementWeather ? (
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-200">
                          <span>⚠️ Inclement conditions expected</span>
                        </div>
                      ) : null}
                      <div className="inline-flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Temp</span>
                        <span>
                          {Number.isFinite(weatherTempValue) ? `${Math.round(Number(weatherTempValue))}°F` : '—'}
                          {weatherConditions ? ` • ${weatherConditions}` : ''}
                        </span>
                      </div>
                      <div className={`text-xs ${hasInclementWeather ? 'text-rose-200/80' : 'text-gray-400'}`}>
                        {weatherCity ? `Forecast near ${weatherCity}` : 'Forecast courtesy of Open-Meteo'}
                      </div>
                    </div>
                  )}
                </div>
                {showWeatherDetails ? (
                  <div className="mt-3 space-y-3">
                    {showWindVisualization ? (
                      <div className={`rounded-lg border p-3 text-xs ${hasInclementWeather ? 'border-rose-500/60 bg-[#36141a]/80 text-rose-100' : 'border-[#1a2635] bg-[#0b121b]/80 text-gray-300'}`}>
                        <WindGoalpost
                          speed={weatherWindValue as number}
                          directionFrom={weatherWindDirection}
                          width={148}
                          height={200}
                          className="mx-auto block"
                        />
                        {windNarrative ? (
                          <p className={`mt-2 text-[11px] ${hasInclementWeather ? 'text-rose-100' : 'text-slate-200'}`}>{windNarrative}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <dl className={`space-y-1 text-xs ${hasInclementWeather ? 'text-rose-200/80' : 'text-gray-400'}`}>
                      {!homeIsDome && (
                        <>
                          <div className="flex items-center justify-between">
                            <dt>Wind</dt>
                            <dd>{windShortLabel}</dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt>Humidity</dt>
                            <dd>{Number.isFinite(weatherHumidityValue) ? `${Math.round(Number(weatherHumidityValue))}%` : '—'}</dd>
                          </div>
                          {hasPrecipitation ? (
                            <div className="flex items-center justify-between">
                              <dt>Precipitation</dt>
                              <dd>{Math.round(precipitationProb * 100)}%</dd>
                            </div>
                          ) : null}
                          {hasInclementWeather ? (
                            <div className="flex items-center justify-between text-rose-200">
                              <dt>Alert</dt>
                              <dd>Monitor totals & exposure</dd>
                            </div>
                          ) : null}
                        </>
                      )}
                      {homeIsDome ? (
                        <div className="pt-1 text-[11px] text-emerald-200/90">Climate controlled — simulations treat weather as neutral.</div>
                      ) : (
                        <div className={`pt-1 text-[11px] ${hasInclementWeather ? 'text-rose-200/80' : 'text-gray-500'}`}>
                          Weather inputs automatically adjust pace and red-zone efficiency.
                        </div>
                      )}
                    </dl>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Injuries</span>
                  <button
                    type="button"
                    onClick={() => setMainTab('injuries')}
                    className="rounded px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:bg-[#1d2f46]"
                  >
                    Open tab
                  </button>
                </div>
                {injuryLoading ? <p className="mt-2 text-xs text-gray-500">Refreshing injuries…</p> : null}
                {injuryError ? <p className="mt-2 text-xs text-rose-300">{injuryError}</p> : null}
                <div className="mt-3 space-y-3 text-xs text-gray-200">
                  <div className="rounded border border-[#1a2635] bg-[#111a26] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <TeamTag
                        teamId={active.away}
                        showCity
                        className="text-xs text-gray-200"
                        logoSize={16}
                        logos={getTeamLogos(active.away)}
                      />
                      <span className="font-mono text-rose-300">
                        {injuriesAway.length || injuryAwayCount}
                      </span>
                    </div>
                    {injuriesAway.length ? (
                      <ul className="mt-2 space-y-1 text-[11px] text-gray-400">
                        {injuriesAway.slice(0, 2).map((p, idx) => (
                          <li key={`away-highlight-${p.name}-${idx}`} className="flex items-center justify-between gap-2">
                            <span>{p.name}{p.position ? ` (${p.position})` : ''}</span>
                            <span className="text-rose-300">{p.status || '—'}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[11px] text-gray-500">
                        {injuryAwayCount > 0 ? `${injuryAwayCount} reported, awaiting detail` : 'No injuries reported.'}
                      </p>
                    )}
                  </div>
                  <div className="rounded border border-[#1a2635] bg-[#111a26] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <TeamTag
                        teamId={active.home}
                        showCity
                        className="text-xs text-gray-200"
                        logoSize={16}
                        logos={getTeamLogos(active.home)}
                      />
                      <span className="font-mono text-rose-300">
                        {injuriesHome.length || injuryHomeCount}
                      </span>
                    </div>
                    {injuriesHome.length ? (
                      <ul className="mt-2 space-y-1 text-[11px] text-gray-400">
                        {injuriesHome.slice(0, 2).map((p, idx) => (
                          <li key={`home-highlight-${p.name}-${idx}`} className="flex items-center justify-between gap-2">
                            <span>{p.name}{p.position ? ` (${p.position})` : ''}</span>
                            <span className="text-rose-300">{p.status || '—'}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[11px] text-gray-500">
                        {injuryHomeCount > 0 ? `${injuryHomeCount} reported, awaiting detail` : 'No injuries reported.'}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-gray-500">
                  View the Injuries tab for the full Balldontlie report.
                </p>
              </div>

              <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">AI Game Report</span>
                  <button
                    type="button"
                    onClick={handleGenerateReport}
                    disabled={aiLoading || agentLoading}
                    className={`rounded px-3 py-1 text-xs font-semibold transition ${aiLoading || agentLoading ? 'bg-[#1a2635] text-gray-500 cursor-not-allowed' : 'bg-[#172436] text-cyan-200 hover:bg-[#1d2f46]'}`}
                  >
                    {aiLoading ? 'Working…' : '🤖 Generate'}
                  </button>
                </div>
                {aiError ? <p className="mt-3 text-xs text-rose-300">{aiError}</p> : null}
                {aiReport?.bullets && aiReport.bullets.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-gray-200">
                    {aiReport.bullets.map((bullet: string) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : (!aiLoading && !aiError) ? (
                  <p className="mt-3 text-xs text-gray-400">Generate a quick context readout. Report highlights injuries if they are missing above.</p>
                ) : null}
                {aiReport?.angle ? (
                  <p className="mt-3 text-xs text-cyan-300">{aiReport.angle}</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {mainTab === 'injuries' ? (
          <section className="rounded-xl border border-[#14202e] bg-[#0e1520] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-gray-300">Injury Report</h2>
                <p className="text-[11px] text-gray-500">Data sourced from Balldontlie.io</p>
              </div>
              <div className="flex items-center gap-2">
                {injurySources.length ? (
                  <span className="hidden text-[11px] uppercase tracking-wide text-gray-500 sm:inline">
                    Sources: {injurySources.join(', ')}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleRefreshInjuries}
                  disabled={injuryLoading}
                  className={`rounded px-3 py-1 text-xs font-semibold transition ${injuryLoading ? 'bg-[#1a2635] text-gray-500 cursor-not-allowed' : 'bg-[#172436] text-cyan-200 hover:bg-[#1d2f46]'}`}
                >
                  {injuryLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>
            {!active ? (
              <p className="mt-4 text-sm text-gray-400">Select a matchup above to view injury context.</p>
            ) : (
              <>
                {injuryError ? (
                  <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {injuryError}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-300">
                  <span>
                    Listed players: <span className="font-mono text-rose-300">{totalListedInjuries}</span>
                  </span>
                  {totalReportedInjuries > totalListedInjuries ? (
                    <span className="text-[11px] text-gray-500">
                      {totalReportedInjuries} reported across outlets
                    </span>
                  ) : null}
                  {injurySources.length ? (
                    <span className="text-[11px] uppercase tracking-wide text-gray-500 sm:hidden">
                      Sources: {injurySources.join(', ')}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                  {renderTeamPanel(
                    active.away,
                    injuriesAwayBuckets,
                    injuriesAway.length,
                    injuryAwayCount,
                    getTeamLogos(active.away),
                  )}
                  {renderTeamPanel(
                    active.home,
                    injuriesHomeBuckets,
                    injuriesHome.length,
                    injuryHomeCount,
                    getTeamLogos(active.home),
                  )}
                </div>
              </>
            )}
            {injurySources.length ? (
              <p className="mt-4 text-[11px] uppercase tracking-wide text-gray-500">
                Sources: {injurySources.join(', ')}
              </p>
            ) : null}
          </section>
        ) : null}

      </main>
    </div>
  );
}
