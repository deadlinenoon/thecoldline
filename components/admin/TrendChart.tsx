'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps as RechartsTooltipProps,
} from 'recharts';

export type TrendRow = { date: string; hits: number; signups: number };
export type TrendChartProps = { rows: TrendRow[] };

export default function TrendChart({ rows }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          stroke="#94a3b8"
          tick={{ fontSize: 11 }}
          minTickGap={16}
        />
        <YAxis stroke="#94a3b8" tickFormatter={formatCount} tick={{ fontSize: 11 }} width={70} />
        <Tooltip<number, string> content={(props) => <ChartTooltip {...props} />} />
        <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="hits" stroke="#38bdf8" strokeWidth={2} dot={false} name="Hits" />
        <Line type="monotone" dataKey="signups" stroke="#34d399" strokeWidth={2} dot={false} name="Signups" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1000) return Number(value).toLocaleString();
  return Number(value).toString();
}

function formatDateTick(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type ChartTooltipProps = RechartsTooltipProps<number, string>;

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const formattedLabel = label ? formatDateTick(String(label)) : null;
  return (
    <div className="rounded border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-lg">
      <div className="font-semibold">{formattedLabel ?? '—'}</div>
      {payload.map((entry, idx) => {
        const color = entry.color ?? '#38bdf8';
        const labelText = entry.name ? String(entry.name) : `Series ${idx + 1}`;
        const rawValue = entry.value;
        const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);
        return (
          <TooltipRow
            key={`${labelText}-${idx}`}
            color={color}
            label={labelText}
            value={Number.isFinite(numericValue) ? numericValue : 0}
          />
        );
      })}
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-slate-300">{label}</span>
      <span className="font-semibold">{formatCount(value)}</span>
    </div>
  );
}
