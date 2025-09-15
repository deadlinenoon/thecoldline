import React from 'react';

type Variant = 'success' | 'warn' | 'error' | 'info';

export function Chip({ variant = 'info', children }: { variant?: Variant; children: React.ReactNode }) {
  const color = variant === 'success'
    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
    : variant === 'warn'
    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
    : variant === 'error'
    ? 'bg-rose-600/30 text-rose-300 border border-rose-500/50'
    : 'bg-[#1a2330] text-gray-300 border border-[#233041]';
  return <span className={`px-2 py-0.5 rounded text-[11px] ${color}`}>{children}</span>;
}

export default Chip;

