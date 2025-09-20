import React from 'react';
import type { RedZoneMatchup, RedZoneOffenseMetrics, RedZoneDefenseMetrics } from '@/components/game/GameCard';

type ShareMetric = { share: number | null; count: number | null } | null | undefined;

type MetricRowProps = {
  label: string;
  value: ShareMetric;
  accentClass: string;
};

const clampShare = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const MetricRow: React.FC<MetricRowProps> = ({ label, value, accentClass }) => {
  const share = clampShare(value?.share);
  const countLabel = Number.isFinite(value?.count ?? null) ? `${value?.count}` : '—';
  const pctLabel = share != null ? `${(share * 100).toFixed(1)}%` : '—';
  const barWidth = share != null ? Math.max(0, Math.min(100, share * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-[10px] text-slate-500">{countLabel}</span>
      </div>
      <div className="h-2 rounded bg-slate-800/70">
        {share != null ? (
          <div
            className={`${accentClass} h-full rounded transition-all`}
            style={{ width: `${barWidth}%` }}
          />
        ) : (
          <div className="h-full w-full rounded bg-slate-700/40" />
        )}
      </div>
      <div className="text-[11px] text-slate-400">{pctLabel}</div>
    </div>
  );
};

type PanelProps = {
  heading: string;
  offense: RedZoneOffenseMetrics;
  defense: RedZoneDefenseMetrics;
  accent: string;
};

const TeamPanel: React.FC<PanelProps> = ({ heading, offense, defense, accent }) => {
  const offenseMetrics: Array<{ key: string; label: string; value: ShareMetric }> = [
    { key: 'td', label: 'TD rate', value: offense.td },
    { key: 'fg', label: 'FG rate', value: offense.fg },
    { key: 'turnover', label: 'Turnover rate', value: offense.turnover },
    { key: 'fail', label: 'Empty rate', value: offense.fail },
  ];
  const defenseMetrics: Array<{ key: string; label: string; value: ShareMetric }> = [
    { key: 'tdAllowed', label: 'TD allowed', value: defense.tdAllowed },
    { key: 'fgAllowed', label: 'FG allowed', value: defense.fgAllowed },
    { key: 'takeaway', label: 'Takeaway', value: defense.takeaway },
    { key: 'zero', label: 'Zero points', value: defense.zero },
  ];

  return (
    <div className="rounded-lg border border-[#182639] bg-[#0b141f] p-4" data-testid="red-zone-bar">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-slate-200">{heading}</h5>
        {Number.isFinite(offense.trips ?? null) ? (
          <span className="text-[11px] text-slate-500">{offense.trips} trips</span>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Offense</p>
          <div className="mt-2 space-y-2">
            {offenseMetrics.map((metric) => (
              <MetricRow key={metric.key} label={metric.label} value={metric.value} accentClass={`${accent} bg-opacity-80`} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Defense</p>
          <div className="mt-2 space-y-2">
            {defenseMetrics.map((metric) => (
              <MetricRow key={metric.key} label={metric.label} value={metric.value} accentClass="bg-rose-500/70" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

type RedZoneBarsForMatchupProps = {
  matchup: RedZoneMatchup;
};

const RedZoneBarsForMatchup: React.FC<RedZoneBarsForMatchupProps> = ({ matchup }) => {
  const teamA = matchup.teamA;
  const teamB = matchup.teamB;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <TeamPanel
        heading={teamA.displayName || teamA.teamId}
        offense={teamA.redZone.offense}
        defense={teamA.redZone.defense}
        accent="bg-cyan-500/70"
      />
      <TeamPanel
        heading={teamB.displayName || teamB.teamId}
        offense={teamB.redZone.offense}
        defense={teamB.redZone.defense}
        accent="bg-emerald-500/70"
      />
    </div>
  );
};

export default RedZoneBarsForMatchup;
