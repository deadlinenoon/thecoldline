import React from "react";
import useSWR from "swr";
import MetricsAccordion, { MetricsPayload } from "@/components/metrics/MetricsAccordion";

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`metrics ${r.status}`);
  return r.json();
});

export default function GameMetricsBlock({
  home, away, season, week, kickoffISO
}: { home: string; away: string; season?: string | number; week?: string | number; kickoffISO?: string }) {
  const params = new URLSearchParams({ home, away });
  if (season) params.set("season", String(season));
  if (week) params.set("week", String(week));
  if (kickoffISO) params.set("kickoff", kickoffISO);

  const { data, error, isLoading } = useSWR<MetricsPayload>(`/api/metrics?${params.toString()}`, fetcher, {
    revalidateOnFocus: false, refreshInterval: 0
  });

  if (isLoading) {
    return <div className="mt-3 rounded bg-slate-800 p-3 text-sm text-slate-400">Loading metrics…</div>;
  }
  if (error) {
    return <div className="mt-3 rounded bg-slate-800 p-3 text-sm text-red-400">Metrics error: {String(error.message)}</div>;
  }
  if (!data) return null;

  return (
    <div className="mt-3">
      <MetricsAccordion data={data} />
    </div>
  );
}
