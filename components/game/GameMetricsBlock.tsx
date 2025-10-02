import React, { useEffect, useMemo } from "react";
import useSWR from "swr";
import MetricsAccordion, { type MetricsPayload, type MetricItem } from "@/components/metrics/MetricsAccordion";
import type { TeamTagProps } from "@/components/TeamTag";
import type { InjuryReport } from "@/lib/injuries/types";
import { buildInjuryAdjustments } from "@/lib/coldline/injuryAdjustments";
import { buildAdjustment } from "@/lib/coldline/adjustments";
import type { ColdLineAdjustmentDetail } from "@/lib/coldline/adjustments";
import type { ColdLineWeight } from "@/lib/coldline/weights";

const jsonFetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  const data = (await response.json()) as T;
  return data;
};

const metricsFetcher = (url: string) => jsonFetcher<MetricsPayload>(url);

type WeightsResponse = { ok: boolean; weights: ColdLineWeight[] };

const weightsFetcher = (url: string) => jsonFetcher<WeightsResponse>(url);

type CoachingFamiliaritySide = {
  points: number;
  reason: string;
};

type CoachingFamiliarityInfo = {
  marginShift: number;
  home?: CoachingFamiliaritySide;
  away?: CoachingFamiliaritySide;
};

export default function GameMetricsBlock({
  home,
  away,
  season,
  week,
  kickoffISO,
  teamTags,
  injuries,
  coachingFamiliarity,
  marketSpread,
}: {
  home: string;
  away: string;
  season?: string | number;
  week?: string | number;
  kickoffISO?: string;
  teamTags?: { home: TeamTagProps; away: TeamTagProps };
  injuries?: InjuryReport | null;
  coachingFamiliarity?: CoachingFamiliarityInfo | null;
  marketSpread?: number | null;
}) {
  const params = new URLSearchParams({ home, away });
  if (season) params.set("season", String(season));
  if (week) params.set("week", String(week));
  if (kickoffISO) params.set("kickoff", kickoffISO);

  const { data, error, isLoading, mutate } = useSWR<MetricsPayload>(`/api/metrics?${params.toString()}`, metricsFetcher, {
    revalidateOnFocus: false, refreshInterval: 0
  });

  const { data: weightsResponse } = useSWR<WeightsResponse>('/api/coldline/weights', weightsFetcher, {
    revalidateOnFocus: false,
    refreshInterval: 0,
  });

  const weightsMap = useMemo(() => {
    const map = new Map<string, ColdLineWeight>();
    if (weightsResponse?.ok) {
      for (const entry of weightsResponse.weights) {
        map.set(entry.metric, entry);
      }
    }
    return map;
  }, [weightsResponse]);

  const injuryAdjustments = useMemo<ColdLineAdjustmentDetail[]>(() => {
    if (!injuries) return [];
    return buildInjuryAdjustments(injuries, weightsMap, marketSpread ?? null);
  }, [injuries, weightsMap, marketSpread]);

  const familiarityAdjustment = useMemo<ColdLineAdjustmentDetail | null>(() => {
    if (!coachingFamiliarity) return null;
    const weight = weightsMap.get('Coaching_Familiarity') ?? weightsMap.get('Coaching_IQ_Edge');
    if (!weight) return null;
    const homePoints = coachingFamiliarity.home?.points ?? 0;
    const awayPoints = coachingFamiliarity.away?.points ?? 0;
    const rawPoints = homePoints - awayPoints;
    if (!rawPoints) return null;
    return buildAdjustment(
      'Coaching_Familiarity',
      'Coaching familiarity auto',
      rawPoints,
      'home',
      weight,
      {
        explanation: coachingFamiliarity.home?.reason ?? coachingFamiliarity.away?.reason,
        source: 'familiarity',
      },
    );
  }, [coachingFamiliarity, weightsMap]);

  const manualMetrics = useMemo<ColdLineAdjustmentDetail[]>(() => {
    const manuals: ColdLineAdjustmentDetail[] = [];
    const mobileWeight = weightsMap.get('Mobile_QB_Status');
    if (mobileWeight) {
      manuals.push(buildAdjustment('Mobile_QB_Status_manual', 'Mobile QB edge (manual)', 0, 'neutral', mobileWeight));
    }
    const coachingWeight = weightsMap.get('Coaching_IQ_Edge');
    if (coachingWeight) {
      manuals.push(buildAdjustment('Coaching_IQ_Edge_manual', 'Coaching IQ edge (manual)', 0, 'neutral', coachingWeight));
    }
    const qbDropWeight = weightsMap.get('QB_Tier_Drop');
    if (qbDropWeight) {
      manuals.push(buildAdjustment('QB_Tier_Drop_manual', 'QB tier drop adjustment', 0, 'neutral', qbDropWeight, {
        explanation: 'Set the underlying starter → backup downgrade. Cap is ±12 raw points, slider clips at ±3.',
      }));
    }
    return manuals;
  }, [weightsMap]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      const detailHome = typeof detail.home === "string" ? detail.home.toUpperCase() : null;
      const detailAway = typeof detail.away === "string" ? detail.away.toUpperCase() : null;
      const matchesHome = !detailHome || detailHome === home.toUpperCase();
      const matchesAway = !detailAway || detailAway === away.toUpperCase();
      if (matchesHome && matchesAway) void mutate();
    };
    window.addEventListener('coldline:metrics-refresh', handler as EventListener);
    return () => window.removeEventListener('coldline:metrics-refresh', handler as EventListener);
  }, [away, home, mutate]);

  if (isLoading) {
    return <div className="mt-3 rounded bg-slate-800 p-3 text-sm text-slate-400">Loading metrics…</div>;
  }
  if (error) {
    return <div className="mt-3 rounded bg-slate-800 p-3 text-sm text-red-400">Metrics error: {String(error.message)}</div>;
  }
  if (!data) return null;

  const transformed = useMemo<MetricsPayload>(() => {
    const baseCategories = data.categories.map(category => {
      const items: MetricItem[] = category.items.map(item => {
        const weight = weightsMap.get(item.key) ?? weightsMap.get(item.key.replace(/__.*$/, ''));
        const rawPoints = item.value;
        const detail = buildAdjustment(item.key, item.label, rawPoints, 'home', weight);
        return {
          ...item,
          value: detail.coldLine,
          rawValue: rawPoints,
          rawCap: item.key === 'QB_Tier_Drop' ? 12 : undefined,
          epaPerPlayDelta: detail.epaPerPlayDelta,
          winProbabilityDelta: detail.winProbabilityDelta,
          atsCoverDelta: detail.atsCoverDelta,
          significance: detail.significance,
          source: undefined,
          explanation: undefined,
          orientation: detail.orientation,
        };
      });
      const subtotal = Number(items.reduce((sum, item) => sum + item.value, 0).toFixed(2));
      return { key: category.key, label: category.label, items, subtotal };
    });

    const autoAdjustments: ColdLineAdjustmentDetail[] = [
      ...injuryAdjustments,
      ...(familiarityAdjustment ? [familiarityAdjustment] : []),
    ];

    if (autoAdjustments.length) {
      const autoItems: MetricItem[] = autoAdjustments.map(adj => ({
        key: adj.key,
        label: adj.label,
        value: adj.coldLine,
        rawValue: adj.rawPoints,
        epaPerPlayDelta: adj.epaPerPlayDelta,
        winProbabilityDelta: adj.winProbabilityDelta,
        atsCoverDelta: adj.atsCoverDelta,
        significance: adj.significance,
        source: adj.source,
        explanation: adj.explanation,
        orientation: adj.orientation,
      }));
      const subtotal = Number(autoItems.reduce((sum, item) => sum + item.value, 0).toFixed(2));
      baseCategories.unshift({
        key: 'automatic_adjustments',
        label: 'Local Auto Adjustments',
        items: autoItems,
        subtotal,
      });
    }

    if (manualMetrics.length) {
      const manualItems: MetricItem[] = manualMetrics.map(adj => ({
        key: adj.key,
        label: adj.label,
        value: adj.coldLine,
        rawValue: adj.rawPoints,
        rawCap: adj.key.startsWith('QB_Tier_Drop') ? 12 : undefined,
        epaPerPlayDelta: adj.epaPerPlayDelta,
        winProbabilityDelta: adj.winProbabilityDelta,
        atsCoverDelta: adj.atsCoverDelta,
        significance: adj.significance,
        source: 'manual',
        explanation: adj.explanation,
        orientation: 'neutral',
      }));
      baseCategories.push({
        key: 'manual_overrides',
        label: 'Manual Overrides',
        items: manualItems,
        subtotal: 0,
      });
    }

    const activeCount = baseCategories.reduce((acc, category) => acc + category.items.length, 0);
    const hfa = data.hfa;
    const total = baseCategories.reduce((sum, category) => sum + category.subtotal, 0);
    return {
      ...data,
      categories: baseCategories,
      count: activeCount,
      total,
      hfa,
    };
  }, [data, weightsMap, injuryAdjustments, familiarityAdjustment, manualMetrics]);

  return (
    <div className="mt-3">
      <MetricsAccordion
        data={transformed}
        teamTags={teamTags}
      />
    </div>
  );
}
