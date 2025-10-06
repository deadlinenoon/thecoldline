'use client';

import React, { useMemo, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import MetricsAccordion, { MetricsPayload } from "@/components/metrics/MetricsAccordion";
import RedZoneBar from "@/components/metrics/RedZoneBar";
import HFAChip from "@/components/game/HFAChip";
import { teamLogo } from "@/lib/logos";

const fetcher = async <T = unknown>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' });
  const raw = await response.text();

  if (!response.ok) {
    const snippet = raw.slice(0, 180);
    throw new Error(`Request failed (${response.status}) ${snippet}`);
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return {} as T;
  }
  if (trimmed.startsWith('<')) {
    throw new Error('Unexpected non-JSON response');
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error('Invalid JSON response');
  }
};

type WeatherPayload = {
  icon: string | null;
  description: string | null;
  temp_f: number | null;
  roof?: string | null;
  expectedClosed?: boolean;
  stadium?: string | null;
};

type ConsensusPayload = {
  bets?: { home: number | null; away: number | null } | null;
  handle?: { home: number | null; away: number | null } | null;
  source?: string | null;
  home?: number | null;
  away?: number | null;
};

type RedZoneBreakdown = {
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

type RedZonePayload = {
  home: RedZoneBreakdown;
  away: RedZoneBreakdown;
};

type RedZoneBarSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type ColdGameCardProps = {
  g: {
    id: number;
    date: string;
    venue?: string | null;
    season?: number;
    week?: number;
    home_team: { abbreviation: string; name: string };
    away_team: { abbreviation: string; name: string };
  };
  spreadLabel: string;
  totalLabel: string;
};

function coercePercent(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  if (value <= 1) return value * 100;
  return Math.min(100, value);
}

function buildOffenseSegments(prefix: string, offense?: RedZoneBreakdown['offense']): RedZoneBarSegment[] {
  const td = coercePercent(offense?.tdPct);
  const fg = coercePercent(offense?.fgPct);
  const turnover = coercePercent(offense?.turnoverPct);
  const remainder = Math.max(0, 100 - (td + fg + turnover));
  return [
    { key: `${prefix}-td`, label: 'Touchdown', value: td, color: '#22c55e' },
    { key: `${prefix}-fg`, label: 'Field Goal', value: fg, color: '#facc15' },
    { key: `${prefix}-no`, label: 'No Points', value: remainder, color: '#fb923c' },
    { key: `${prefix}-to`, label: 'Turnover', value: turnover, color: '#ef4444' },
  ];
}

function buildDefenseSegments(prefix: string, defense?: RedZoneBreakdown['defense']): RedZoneBarSegment[] {
  const tdAllowed = coercePercent(defense?.tdPct);
  const fgAllowed = coercePercent(defense?.fgPct);
  const takeaways = coercePercent(defense?.takeawayPct);
  const zeroAllowed = Math.max(0, 100 - (tdAllowed + fgAllowed + takeaways));
  return [
    { key: `${prefix}-zero`, label: 'Zero Allowed', value: zeroAllowed, color: '#22c55e' },
    { key: `${prefix}-take`, label: 'Turnover', value: takeaways, color: '#60a5fa' },
    { key: `${prefix}-fg`, label: 'FG Allowed', value: fgAllowed, color: '#facc15' },
    { key: `${prefix}-td`, label: 'TD Allowed', value: tdAllowed, color: '#ef4444' },
  ];
}

function parseSpread(label: string): { favorite: string | null; value: string } {
  const clean = label.trim();
  if (!clean || clean === '—') return { favorite: null, value: '—' };
  if (clean.toUpperCase() === 'PK') return { favorite: null, value: 'PK' };
  const parts = clean.split(/\s+/);
  const favorite = parts.shift() ?? null;
  return { favorite, value: parts.join(' ') || '—' };
}

function clampPercent(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return Math.round(value);
}

function derivePair(homeRaw: number | null | undefined, awayRaw: number | null | undefined): { home: number | null; away: number | null } {
  const home = clampPercent(homeRaw);
  const away = clampPercent(awayRaw);
  if (home != null && away != null) {
    const total = home + away;
    if (total === 0) return { home: 0, away: 0 };
    if (total !== 100) {
      const scale = 100 / total;
      const scaledHome = Math.round(home * scale);
      return { home: scaledHome, away: Math.max(0, 100 - scaledHome) };
    }
    return { home, away };
  }
  if (home != null) {
    return { home, away: Math.max(0, 100 - home) };
  }
  if (away != null) {
    return { home: Math.max(0, 100 - away), away };
  }
  return { home: null, away: null };
}

function ConsensusBar({
  label,
  splits,
  source,
}: {
  label: string;
  splits: { home: number | null; away: number | null };
  source?: string | null;
}) {
  const home = splits.home;
  const away = splits.away;
  const hasValues = home != null || away != null;
  const safeHome = home ?? (away != null ? Math.max(0, 100 - away) : null);
  const safeAway = away ?? (home != null ? Math.max(0, 100 - home) : null);
  const awayWidth = Math.max(0, Math.min(100, safeAway ?? 0));
  const homeWidth = Math.max(0, Math.min(100, safeHome ?? 0));

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/60 p-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="uppercase tracking-wide">{label}</span>
        {source ? <span className="truncate text-[11px] text-slate-500">{source}</span> : null}
      </div>
      {hasValues ? (
        <>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded bg-slate-700/70">
            <div className="h-full bg-sky-500/80" style={{ width: `${awayWidth}%` }} />
            <div className="h-full bg-emerald-400/80" style={{ width: `${homeWidth}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
            <span>
              Away <strong className="text-sky-200">{safeAway != null ? `${safeAway}%` : '—'}</strong>
            </span>
            <span>
              Home <strong className="text-emerald-200">{safeHome != null ? `${safeHome}%` : '—'}</strong>
            </span>
          </div>
        </>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">Consensus split unavailable.</p>
      )}
    </div>
  );
}

function TeamBadge({ abbr, name }: { abbr: string; name: string }) {
  const logo = teamLogo(abbr);
  if (!logo) {
    return (
      <span className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-xs font-semibold uppercase text-slate-200 align-middle">
        {abbr}
      </span>
    );
  }
  return (
    <Image
      src={logo}
      alt={name}
      className="mr-1 inline h-6 w-6 align-middle"
      width={24}
      height={24}
      unoptimized
    />
  );
}

function WeatherChip({ weather, venue }: { weather?: WeatherPayload; venue?: string | null }) {
  if (!weather) return null;
  const roof = String(weather.roof || '').toLowerCase();
  const isClosed = roof === 'closed' || roof === 'fixed' || (roof === 'retractable' && weather.expectedClosed);
  const stadiumLabel = weather.stadium || venue || '';
  if (isClosed) {
    return (
      <span className="ml-3 inline-flex items-center gap-1 rounded bg-slate-700/60 px-2 py-0.5 text-xs text-slate-200">
        <span role="img" aria-label="Indoor stadium">🏟️</span>
        <span>{stadiumLabel || 'Indoors'}</span>
      </span>
    );
  }
  const iconUrl = weather.icon ? `https://openweathermap.org/img/wn/${weather.icon}.png` : null;
  return (
    <span className="ml-3 inline-flex items-center gap-1 rounded bg-slate-700/60 px-2 py-0.5 text-xs text-slate-200">
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt={weather.description || 'Weather icon'}
          width={20}
          height={20}
          unoptimized
        />
      ) : null}
      <span>{typeof weather.temp_f === 'number' ? `${weather.temp_f}°F` : '—'}</span>
    </span>
  );
}

function LineRow({ spreadLabel, totalLabel, hfaDelta }: { spreadLabel: string; totalLabel: string; hfaDelta: number }) {
  const { favorite, value } = parseSpread(spreadLabel);
  return (
    <div className="flex flex-col items-end gap-2 text-sm sm:text-base">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded bg-slate-700/80 px-2 py-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">Spread</span>
          {favorite ? <span className="text-xs font-semibold text-emerald-300">★ {favorite}</span> : null}
          <span className="font-semibold text-slate-100">{value}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded bg-slate-700/80 px-2 py-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">Total</span>
          <span className="font-semibold text-slate-100">{totalLabel || '—'}</span>
        </div>
      </div>
      <HFAChip delta={hfaDelta} />
    </div>
  );
}

export default function ColdGameCard({ g, spreadLabel, totalLabel }: ColdGameCardProps) {
  const [open, setOpen] = useState(true);

  const params = new URLSearchParams({
    home: g.home_team.abbreviation,
    away: g.away_team.abbreviation,
  });
  if (g.season != null) params.set('season', String(g.season));
  if (g.week != null) params.set('week', String(g.week));
  if (g.date) params.set('kickoff', g.date);

  const metricsKey = `/api/metrics?${params.toString()}`;
  const {
    data: metrics,
    error: metricsError,
    isLoading: metricsLoading,
  } = useSWR<MetricsPayload>(metricsKey, (url: string) => fetcher<MetricsPayload>(url), {
    revalidateOnFocus: false,
  });

  const weatherKey = g.date
    ? `/api/weather?home=${encodeURIComponent(g.home_team.abbreviation)}&kickoff=${encodeURIComponent(g.date)}`
    : null;
  const { data: weather } = useSWR<WeatherPayload>(
    weatherKey,
    weatherKey ? (url: string) => fetcher<WeatherPayload>(url) : null,
    { revalidateOnFocus: false }
  );

  const redZoneKey = open
    ? `/api/redzone?home=${encodeURIComponent(g.home_team.abbreviation)}&away=${encodeURIComponent(g.away_team.abbreviation)}&kickoff=${encodeURIComponent(g.date)}`
    : null;
  const { data: redZone, error: redZoneError } = useSWR<RedZonePayload>(
    redZoneKey,
    redZoneKey ? (url: string) => fetcher<RedZonePayload>(url) : null,
    { revalidateOnFocus: false }
  );

  const consensusKey = open
    ? `/api/consensus?home=${encodeURIComponent(g.home_team.name)}&away=${encodeURIComponent(g.away_team.name)}&homeAbbr=${encodeURIComponent(g.home_team.abbreviation)}&awayAbbr=${encodeURIComponent(g.away_team.abbreviation)}`
    : null;
  const {
    data: consensus,
    error: consensusError,
    isLoading: consensusLoading,
  } = useSWR<ConsensusPayload>(
    consensusKey,
    consensusKey ? (url: string) => fetcher<ConsensusPayload>(url) : null,
    { revalidateOnFocus: false }
  );

  const homeSegments = useMemo(() => {
    if (!redZone) return { offense: [], defense: [] };
    return {
      offense: buildOffenseSegments(`${g.home_team.abbreviation}-offense`, redZone.home.offense),
      defense: buildDefenseSegments(`${g.home_team.abbreviation}-defense`, redZone.home.defense),
    };
  }, [g.home_team.abbreviation, redZone]);

  const awaySegments = useMemo(() => {
    if (!redZone) return { offense: [], defense: [] };
    return {
      offense: buildOffenseSegments(`${g.away_team.abbreviation}-offense`, redZone.away.offense),
      defense: buildDefenseSegments(`${g.away_team.abbreviation}-defense`, redZone.away.defense),
    };
  }, [g.away_team.abbreviation, redZone]);

  const kickoffDate = new Date(g.date);
  const dateLabel = `${kickoffDate.getMonth() + 1}/${kickoffDate.getDate()}`;
  const hour12 = ((kickoffDate.getHours() + 11) % 12) + 1;
  const minutes = kickoffDate.getMinutes();
  const suffix = kickoffDate.getHours() >= 12 ? 'pm' : 'am';
  const timeLabel = minutes === 0 ? `${hour12}${suffix}` : `${hour12}:${String(minutes).padStart(2, '0')}${suffix}`;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4 shadow-lg shadow-slate-900/30">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            {dateLabel} {timeLabel}
            {g.venue ? ` · ${g.venue}` : ''}
          </span>
          <WeatherChip weather={weather} venue={g.venue} />
        </div>
        <button
          onClick={() => setOpen(value => !value)}
          className="text-slate-400 transition hover:text-slate-200"
          aria-label="Toggle metrics"
          aria-expanded={open}
        >
          <svg
            className={`h-5 w-5 transform transition-transform ${open ? 'rotate-180' : 'rotate-0'}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center text-lg text-slate-100">
          <TeamBadge abbr={g.away_team.abbreviation} name={g.away_team.name} />
          <span className="font-semibold">{g.away_team.abbreviation}</span>
          <span className="mx-2 text-slate-400">@</span>
          <TeamBadge abbr={g.home_team.abbreviation} name={g.home_team.name} />
          <span className="font-semibold">{g.home_team.abbreviation}</span>
        </div>
        <LineRow
          spreadLabel={spreadLabel}
          totalLabel={totalLabel}
          hfaDelta={Number(metrics?.hfa?.delta ?? 0)}
        />
      </div>

      {open ? (
        <div className="mt-4 border-t border-slate-700 pt-4 text-sm">
          {metricsError ? (
            <p className="text-xs text-rose-400">
              Metrics unavailable: {metricsError instanceof Error ? metricsError.message : String(metricsError)}
            </p>
          ) : metrics ? (
            <MetricsAccordion data={metrics} />
          ) : metricsLoading ? (
            <p className="text-xs text-slate-500">Loading metrics…</p>
          ) : null}

          <div className="mt-4 space-y-3">
            {consensusError ? (
              <p className="text-xs text-rose-400">
                Consensus unavailable: {consensusError instanceof Error ? consensusError.message : String(consensusError)}
              </p>
            ) : consensus ? (
              (() => {
                const bets = derivePair(consensus.bets?.home ?? consensus.home, consensus.bets?.away ?? consensus.away);
                const handle = derivePair(consensus.handle?.home, consensus.handle?.away);
                const sourceLabel = consensus.source || undefined;
                return (
                  <div className="grid gap-3 md:grid-cols-2">
                    <ConsensusBar label="Public Bets" splits={bets} source={sourceLabel} />
                    <ConsensusBar label="Handle" splits={handle} />
                  </div>
                );
              })()
            ) : consensusLoading ? (
              <p className="text-xs text-slate-500">Loading consensus…</p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {redZone ? (
              <>
                <RedZoneBar
                  title={`${g.away_team.abbreviation} Offense`}
                  ariaLabel={`${g.away_team.name} red zone offense distribution`}
                  segments={awaySegments.offense}
                />
                <RedZoneBar
                  title={`${g.home_team.abbreviation} Defense`}
                  ariaLabel={`${g.home_team.name} red zone defense distribution`}
                  segments={homeSegments.defense}
                />
                <RedZoneBar
                  title={`${g.home_team.abbreviation} Offense`}
                  ariaLabel={`${g.home_team.name} red zone offense distribution`}
                  segments={homeSegments.offense}
                />
                <RedZoneBar
                  title={`${g.away_team.abbreviation} Defense`}
                  ariaLabel={`${g.away_team.name} red zone defense distribution`}
                  segments={awaySegments.defense}
                />
              </>
            ) : redZoneError ? (
              <p className="col-span-full text-xs text-slate-500">Red Zone data unavailable.</p>
            ) : (
              <p className="col-span-full text-xs text-slate-500">Loading Red Zone data…</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
