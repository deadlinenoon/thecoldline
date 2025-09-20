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
      ) : (
        <span role="img" aria-label="Weather">🌡️</span>
      )}
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
  const [open, setOpen] = useState(false);

  const params = new URLSearchParams({
    home: g.home_team.abbreviation,
    away: g.away_team.abbreviation,
  });
  if (g.season != null) params.set('season', String(g.season));
  if (g.week != null) params.set('week', String(g.week));
  if (g.date) params.set('kickoff', g.date);

  const metricsKey = `/api/metrics?${params.toString()}`;
  const { data: metrics } = useSWR<MetricsPayload>(metricsKey, (url: string) => fetcher<MetricsPayload>(url), {
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

      {open && metrics ? (
        <div className="mt-4 border-t border-slate-700 pt-4 text-sm">
          <MetricsAccordion data={metrics} />
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
