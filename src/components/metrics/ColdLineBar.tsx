'use client';

import TeamTag, { type TeamTagProps } from '@/components/TeamTag';

export type ColdLineBarSummaryItem = {
  key: string;
  label: string;
  coldLine: number;
  rawPoints: number;
};

type ColdLineBarProps = {
  total: number;
  rawTotal: number;
  epaPerPlay: number;
  winProbability: number;
  atsCover: number;
  homeTag?: TeamTagProps;
  awayTag?: TeamTagProps;
  items: ColdLineBarSummaryItem[];
  onSelectMetric?: (key: string) => void;
};

const clamp = (value: number, limit = 3) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-limit, Math.min(limit, value));
};

export default function ColdLineBar({
  total,
  rawTotal,
  epaPerPlay,
  winProbability,
  atsCover,
  homeTag,
  awayTag,
  items,
  onSelectMetric,
}: ColdLineBarProps) {
  const clampedTotal = clamp(total, 3);
  const percent = ((clampedTotal + 3) / 6) * 100; // map [-3,3] to [0,100]
  const topItems = items
    .filter(item => Math.abs(item.coldLine) >= 0.05)
    .sort((a, b) => Math.abs(b.coldLine) - Math.abs(a.coldLine))
    .slice(0, 6);

  const formatSigned = (value: number, digits = 2) => {
    if (!Number.isFinite(value) || Math.abs(value) < 0.0005) return '0.00';
    return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <TeamTag {...(awayTag ?? { teamId: 'AWAY', displayName: 'Away' })} logoSize={28} className="text-sm" />
          <span className="text-xs text-slate-500">@</span>
          <TeamTag {...(homeTag ?? { teamId: 'HOME', displayName: 'Home' })} logoSize={28} className="text-sm" />
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>Total: <span className="font-semibold text-slate-100">{formatSigned(clampedTotal)}</span></span>
          <span>Raw pts: <span className="font-semibold text-slate-100">{formatSigned(rawTotal)}</span></span>
        </div>
      </div>
      <div className="relative h-6 overflow-hidden rounded-full bg-slate-800">
        <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
        <div
          className="absolute top-0 h-full w-1 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
          style={{ left: `${percent}%`, transform: 'translateX(-50%)' }}
        />
        <div className="absolute inset-y-0 left-1/2 w-1/2 bg-emerald-500/10" />
        <div className="absolute inset-y-0 right-1/2 w-1/2 bg-sky-500/10" />
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-slate-700/70 bg-slate-800/70 p-3 text-xs text-slate-400">
          <dt className="uppercase tracking-wide">EPA/play</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-100">{formatSigned(epaPerPlay, 3)}</dd>
        </div>
        <div className="rounded border border-slate-700/70 bg-slate-800/70 p-3 text-xs text-slate-400">
          <dt className="uppercase tracking-wide">Win %</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-100">{formatSigned(winProbability, 2)}%</dd>
        </div>
        <div className="rounded border border-slate-700/70 bg-slate-800/70 p-3 text-xs text-slate-400">
          <dt className="uppercase tracking-wide">ATS %</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-100">{formatSigned(atsCover, 2)}%</dd>
        </div>
      </dl>
      {topItems.length ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top adjustments</h4>
          <ul className="grid gap-2 sm:grid-cols-2">
            {topItems.map(item => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelectMetric?.(item.key)}
                  className="flex w-full items-center justify-between rounded border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-cyan-400/60 hover:text-slate-100"
                >
                  <span className="truncate pr-3">{item.label}</span>
                  <span className={item.coldLine >= 0 ? 'text-emerald-300 font-semibold' : 'text-sky-300 font-semibold'}>
                    {formatSigned(item.coldLine)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
