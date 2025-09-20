import React from 'react';

type Segment = {
  key: string;
  label: string;
  value: number | null | undefined;
  color?: string;
};

type RedZoneBarProps = {
  title: string;
  ariaLabel?: string;
  segments: Segment[];
};

const clamp = (value: number | null | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return value;
};

const formatPercent = (share: number): string => `${Math.round(share * 100)}%`;

const shouldShowLabel = (share: number): boolean => share >= 0.12;

const RedZoneBar: React.FC<RedZoneBarProps> = ({ title, ariaLabel, segments }) => {
  const sanitized = segments.map((segment) => ({
    ...segment,
    value: clamp(segment.value),
  }));

  const total = sanitized.reduce((acc, segment) => acc + segment.value, 0);
  if (total <= 0) {
    return (
      <figure className="rounded-lg border border-slate-700 bg-slate-900/60 p-4" aria-label={ariaLabel}>
        <figcaption className="text-sm font-semibold text-slate-200">{title}</figcaption>
        <p className="mt-3 text-xs text-slate-400">No Red Zone data</p>
      </figure>
    );
  }

  const normalized = sanitized.map((segment) => ({
    ...segment,
    share: segment.value / total,
  }));

  return (
    <figure className="rounded-lg border border-slate-700 bg-slate-900/60 p-4" aria-label={ariaLabel}>
      <figcaption className="text-sm font-semibold text-slate-200">{title}</figcaption>
      <div className="mt-3 flex h-6 w-full overflow-hidden rounded">
        {normalized.map((segment) => {
          const width = `${Math.max(0, Math.min(100, segment.share * 100)).toFixed(2)}%`;
          return (
            <div
              key={segment.key}
              className="relative flex items-center justify-center text-[10px] font-medium text-slate-900"
              style={{ width, backgroundColor: segment.color || '#1e7e34' }}
              data-testid={`red-zone-segment-${segment.key}`}
              title={`${segment.label}: ${formatPercent(segment.share)}`}
            >
              {shouldShowLabel(segment.share) ? (
                <span className="px-1 text-[10px] text-slate-900 drop-shadow">{formatPercent(segment.share)}</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
        {normalized.map((segment) => (
          <div key={`legend-${segment.key}`} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded"
              style={{ backgroundColor: segment.color || '#1e7e34' }}
              aria-hidden="true"
            />
            <span className="text-slate-400">{segment.label}</span>
            <span className="ml-auto font-mono text-slate-300">{formatPercent(segment.share)}</span>
          </div>
        ))}
      </dl>
    </figure>
  );
};

export default RedZoneBar;
