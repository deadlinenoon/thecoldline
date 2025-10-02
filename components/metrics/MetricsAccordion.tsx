'use client';

import React, { useMemo, useState } from "react";
import TeamTag, { type TeamTagProps } from "@/components/TeamTag";
import ColdLineBar, { type ColdLineBarSummaryItem } from "@/components/metrics/ColdLineBar";
import { effectiveRange } from "@/lib/metrics";

export type MetricItem = {
  key: string;
  label: string;
  value: number;
  weight?: number;
  isHfa?: boolean;
  rawValue?: number;
  rawCap?: number;
  epaPerPlayDelta?: number;
  winProbabilityDelta?: number;
  atsCoverDelta?: number;
  significance?: string;
  source?: string;
  explanation?: string;
  orientation?: 'home' | 'away' | 'neutral';
};

export type MetricCategory = {
  key: string;
  label: string;
  items: MetricItem[];
  subtotal: number;
};

export type MetricsPayload = {
  categories: MetricCategory[];
  total: number;
  count: number;
  hfa: { base: number; delta: number };
};

const EXPECTED_COUNT = 74;

const FALLBACK_EPA_PER_POINT = 0.0026;
const FALLBACK_WIN_PER_POINT = 0.27;
const FALLBACK_ATS_PER_POINT = 0.30;

function valClass(v: number) {
  if (v > 0.05) return "text-emerald-400";
  if (v < -0.05) return "text-sky-400";
  return "text-slate-300";
}

type MetricsAccordionProps = {
  data: MetricsPayload;
  teamTags?: { home: TeamTagProps; away: TeamTagProps };
};

const buildBar = (value: number) => {
  const RANGE = 3;
  const clamped = Math.max(-RANGE, Math.min(RANGE, value));
  const fraction = Math.abs(clamped) / RANGE;
  const percent = fraction * 50;
  const positive = clamped >= 0;
  const width = `${percent}%`;
  const left = positive ? '50%' : `${50 - percent}%`;
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded bg-slate-800">
      <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
      {percent > 0 ? (
        <div
          className={`absolute top-0 h-full ${positive ? 'bg-emerald-400/80' : 'bg-sky-400/80'}`}
          style={{ left, width }}
        />
      ) : null}
    </div>
  );
};

function friendlyTeamName(tag: TeamTagProps | undefined): string {
  return (tag?.displayName || tag?.teamId || tag?.team || '').trim() || 'Team';
}

function deriveScaledValue(
  baselineRaw: number,
  effectiveRaw: number,
  baselineMetric: number | undefined,
  fallbackPerPoint: number,
) {
  if (!Number.isFinite(effectiveRaw)) return 0;
  if (baselineRaw === 0) {
    return effectiveRaw * fallbackPerPoint;
  }
  const scale = effectiveRaw / baselineRaw;
  return (baselineMetric ?? (baselineRaw * fallbackPerPoint)) * scale;
}

export default function MetricsAccordion({ data, teamTags }: MetricsAccordionProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [valueOverrides, setValueOverrides] = useState<Record<string, number>>({});
  const [rawOverrides, setRawOverrides] = useState<Record<string, number>>({});
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const hasExpectedCount = data.count === EXPECTED_COUNT;

  const getCategoryContext = (key: string): string | null => {
    if (!teamTags) return null;
    const homeName = friendlyTeamName(teamTags.home);
    const awayName = friendlyTeamName(teamTags.away);
    const normalized = key.toLowerCase();
    if (normalized.includes('off')) {
      return `${homeName} offense vs ${awayName} defense`;
    }
    if (normalized.includes('def')) {
      return `${homeName} defense vs ${awayName} offense`;
    }
    if (normalized.includes('special')) {
      return `Special teams & situational (net edge)`;
    }
    return null;
  };

  const effectiveCategories = useMemo(() => {
    return data.categories.map(category => {
      const items = category.items.map(item => {
        const effectiveValue = Number.isFinite(valueOverrides[item.key]) ? valueOverrides[item.key] : item.value;
        const baseRaw = item.rawValue ?? item.value ?? 0;
        const effectiveRaw = Number.isFinite(rawOverrides[item.key]) ? rawOverrides[item.key] : (baseRaw || effectiveValue);
        const epa = deriveScaledValue(baseRaw, effectiveRaw, item.epaPerPlayDelta, FALLBACK_EPA_PER_POINT);
        const win = deriveScaledValue(baseRaw, effectiveRaw, item.winProbabilityDelta, FALLBACK_WIN_PER_POINT);
        const ats = deriveScaledValue(baseRaw, effectiveRaw, item.atsCoverDelta, FALLBACK_ATS_PER_POINT);
        return {
          ...item,
          value: effectiveValue,
          rawValue: effectiveRaw,
          epaPerPlayDelta: epa,
          winProbabilityDelta: win,
          atsCoverDelta: ats,
        };
      });
      const subtotal = Number(items.reduce((sum, item) => sum + (item.value ?? 0), 0).toFixed(2));
      return { ...category, items, subtotal };
    });
  }, [data.categories, valueOverrides, rawOverrides]);

  const summaryItems = useMemo<ColdLineBarSummaryItem[]>(() => {
    return effectiveCategories.flatMap(category =>
      category.items.map(item => ({
        key: item.key,
        label: item.label,
        coldLine: item.value ?? 0,
        rawPoints: item.rawValue ?? item.value ?? 0,
      })),
    );
  }, [effectiveCategories]);

  const totals = useMemo(() => {
    const base = { coldLineTotal: 0, rawPointsTotal: 0, epaPerPlayTotal: 0, winProbabilityTotal: 0, atsCoverTotal: 0 };
    for (const category of effectiveCategories) {
      for (const item of category.items) {
        const value = item.value ?? 0;
        const raw = item.rawValue ?? value;
        base.coldLineTotal += value;
        base.rawPointsTotal += raw;
        base.epaPerPlayTotal += item.epaPerPlayDelta ?? deriveScaledValue(raw, raw, undefined, FALLBACK_EPA_PER_POINT);
        base.winProbabilityTotal += item.winProbabilityDelta ?? deriveScaledValue(raw, raw, undefined, FALLBACK_WIN_PER_POINT);
        base.atsCoverTotal += item.atsCoverDelta ?? deriveScaledValue(raw, raw, undefined, FALLBACK_ATS_PER_POINT);
      }
    }
    return base;
  }, [effectiveCategories]);

  const awayLabel = friendlyTeamName(teamTags?.away) || 'Away';
  const homeLabel = friendlyTeamName(teamTags?.home) || 'Home';

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    data.categories.forEach(category => {
      next[category.key] = true;
    });
    setOpen(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    data.categories.forEach(category => {
      next[category.key] = false;
    });
    setOpen(next);
  };

  const handleSelectMetric = (metricKey: string) => {
    setSelectedMetric(metricKey);
    effectiveCategories.forEach(category => {
      if (category.items.some(item => item.key === metricKey)) {
        setOpen(prev => ({ ...prev, [category.key]: true }));
      }
    });
  };

  return (
    <div className="rounded-lg bg-slate-800 ring-1 ring-slate-700">
      <div className="border-b border-slate-700 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`text-2xl font-bold ${hasExpectedCount ? "text-slate-100" : "text-amber-300"}`}>
              {data.count}
            </div>
            <div className="text-sm text-slate-400">active metrics</div>
            {!hasExpectedCount && (
              <span className="ml-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                missing {EXPECTED_COUNT - data.count}
              </span>
            )}
            <div className="text-sm text-slate-400">
              HFA base <span className="font-semibold text-sky-300">{data.hfa.base.toFixed(2)}</span>
            </div>
            <div className="text-sm text-slate-400">
              HFA delta{' '}
              <span className={`font-semibold ${valClass(data.hfa.delta)}`}>
                {data.hfa.delta >= 0 ? "+" : ""}
                {data.hfa.delta.toFixed(2)}
              </span>
            </div>
            <div className="text-sm text-slate-400">
              Total{' '}
              <span className={`font-semibold ${valClass(totals.coldLineTotal)}`}>
                {totals.coldLineTotal >= 0 ? "+" : ""}
                {totals.coldLineTotal.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={expandAll} className="rounded bg-slate-700 px-2 py-1 text-sm hover:bg-slate-600">
              Expand all
            </button>
            <button onClick={collapseAll} className="rounded bg-slate-700 px-2 py-1 text-sm hover:bg-slate-600">
              Collapse all
            </button>
          </div>
        </div>
        {teamTags ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <TeamTag {...teamTags.away} logoSize={18} className="text-xs" />
            <span className="uppercase tracking-wide">@</span>
            <TeamTag {...teamTags.home} logoSize={18} className="text-xs" />
            <span className="rounded border border-slate-600 bg-slate-900/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
              Positive favors {teamTags.home.displayName ?? teamTags.home.teamId ?? 'home'}
            </span>
            <span className="text-[10px] text-slate-500">Negative favors {teamTags.away.displayName ?? teamTags.away.teamId ?? 'away'}</span>
          </div>
        ) : null}
      </div>

      <div className="border-b border-slate-700 bg-slate-900/80 px-4 py-4">
        <ColdLineBar
          total={totals.coldLineTotal}
          rawTotal={totals.rawPointsTotal}
          epaPerPlay={totals.epaPerPlayTotal}
          winProbability={totals.winProbabilityTotal}
          atsCover={totals.atsCoverTotal}
          homeTag={teamTags?.home}
          awayTag={teamTags?.away}
          items={summaryItems}
          onSelectMetric={handleSelectMetric}
        />
      </div>

      <div className="divide-y divide-slate-700">
        {effectiveCategories.map(category => {
          const isOpen = open[category.key] ?? false;
          const contextNote = getCategoryContext(category.key);
          return (
            <div key={category.key}>
              <button
                onClick={() => setOpen(prev => ({ ...prev, [category.key]: !isOpen }))}
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-700"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-200">{category.label}</span>
                  <span className={`text-sm ${valClass(category.subtotal)}`}>
                    {category.subtotal >= 0 ? "+" : ""}
                    {category.subtotal.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400">({category.items.length})</span>
                  {contextNote ? (
                    <span className="text-[11px] text-slate-500">{contextNote}</span>
                  ) : null}
                </div>
                <svg
                  className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
              {isOpen && (
                <div className="px-4 pb-3">
                  <div className="mb-2 grid grid-cols-[minmax(80px,1fr)_minmax(220px,2fr)_minmax(110px,1fr)] items-center text-[10px] uppercase tracking-wide text-slate-500">
                    <span className="text-right">{awayLabel}</span>
                    <span className="text-center">Impact</span>
                    <span className="text-right">{homeLabel}</span>
                  </div>
                  <ul className="space-y-2">
                    {category.items.map(item => {
                      const range = effectiveRange(item.key, [-3, 3]);
                      const homeValue = item.value ?? 0;
                      const awayValue = -(item.value ?? 0);
                      const isSelected = selectedMetric === item.key;
                      return (
                        <li
                          key={item.key}
                          className={`grid grid-cols-[minmax(80px,1fr)_minmax(220px,2fr)_minmax(170px,1fr)] items-center gap-3 rounded-md px-2 py-1 ${isSelected ? 'bg-cyan-500/10 ring-1 ring-cyan-500/40' : ''}`}
                        >
                          <div className="text-right text-xs text-slate-400">
                            {awayValue.toFixed(2)}
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span className={`font-medium ${item.isHfa ? 'text-sky-300' : 'text-slate-200'}`}>
                                {item.label}
                                {item.isHfa ? ' *' : ''}
                              </span>
                              {item.significance ? (
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">{item.significance}</span>
                              ) : null}
                            </div>
                            {item.source || item.explanation ? (
                              <div className="text-[11px] text-slate-500">
                                {item.source ? <span className="uppercase tracking-wide text-slate-400">{item.source}</span> : null}
                                {item.explanation ? (
                                  <span>{item.source ? ' — ' : ''}{item.explanation}</span>
                                ) : null}
                              </div>
                            ) : null}
                            <div className="flex flex-col gap-2">
                              <input
                                type="range"
                                min={range[0]}
                                max={range[1]}
                                step={0.05}
                                value={homeValue}
                                onChange={event => {
                                  const parsed = Number(event.target.value);
                                  setValueOverrides(prev => ({ ...prev, [item.key]: parsed }));
                                }}
                                className="h-1 w-full appearance-none rounded-lg bg-slate-700 accent-cyan-400"
                              />
                              {buildBar(homeValue)}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 text-xs text-slate-400">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${valClass(homeValue)}`}>
                                {homeValue >= 0 ? '+' : ''}
                                {homeValue.toFixed(2)}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
                                value={homeValue.toFixed(2)}
                                onChange={event => {
                                  const parsed = Number(event.target.value);
                                  if (Number.isFinite(parsed)) {
                                    setValueOverrides(prev => ({ ...prev, [item.key]: parsed }));
                                  }
                                }}
                              />
                            </div>
                            {item.rawCap ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">Raw</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min={-item.rawCap}
                                  max={item.rawCap}
                                  className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-200 focus:border-cyan-400 focus:outline-none"
                                  value={(item.rawValue ?? homeValue).toFixed(1)}
                                  onChange={event => {
                                    const parsed = Number(event.target.value);
                                    if (Number.isFinite(parsed)) {
                                      const clamped = Math.max(-item.rawCap!, Math.min(item.rawCap!, parsed));
                                      setRawOverrides(prev => ({ ...prev, [item.key]: clamped }));
                                      const coldClamped = Math.max(range[0], Math.min(range[1], clamped));
                                      setValueOverrides(prev => ({ ...prev, [item.key]: coldClamped }));
                                    }
                                  }}
                                />
                              </div>
                            ) : null}
                            <div className="grid gap-1 text-[10px] text-slate-500">
                              <span>EPA/play {item.epaPerPlayDelta ? item.epaPerPlayDelta.toFixed(3) : '0.000'}</span>
                              <span>Win % {item.winProbabilityDelta ? item.winProbabilityDelta.toFixed(2) : '0.00'}</span>
                              <span>ATS % {item.atsCoverDelta ? item.atsCoverDelta.toFixed(2) : '0.00'}</span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
