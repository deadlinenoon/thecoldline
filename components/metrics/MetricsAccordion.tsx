'use client';

import React, { useState } from "react";

export type MetricItem = { key: string; label: string; value: number; weight?: number; isHfa?: boolean };
export type MetricCategory = { key: string; label: string; items: MetricItem[]; subtotal: number };
export type MetricsPayload = {
  categories: MetricCategory[];
  total: number;
  count: number;
  hfa: { base: number; delta: number };
};

const EXPECTED_COUNT = 74;

function valClass(v: number) {
  if (v > 0.05) return "text-emerald-400";
  if (v < -0.05) return "text-red-400";
  return "text-slate-300";
}

export default function MetricsAccordion({ data }: { data: MetricsPayload }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const hasExpectedCount = data.count === EXPECTED_COUNT;

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

  return (
    <div className="rounded-lg bg-slate-800 ring-1 ring-slate-700">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
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
            <span className={`font-semibold ${valClass(data.total)}`}>
              {data.total >= 0 ? "+" : ""}
              {data.total.toFixed(2)}
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
      <div className="divide-y divide-slate-700">
        {data.categories.map(category => {
          const isOpen = open[category.key] ?? false;
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
                  <ul className="space-y-1">
                    {category.items.map(item => (
                      <li key={item.key} className="flex items-baseline justify-between">
                        <span className={`text-sm ${item.isHfa ? "text-sky-300" : "text-slate-300"}`}>
                          {item.label}
                          {item.isHfa ? " *" : ""}
                          {typeof item.weight === "number" && (
                            <span className="ml-2 text-xs text-slate-500">w {item.weight.toFixed(2)}</span>
                          )}
                        </span>
                        <span className={`text-sm font-semibold ${valClass(item.value)}`}>
                          {item.value >= 0 ? "+" : ""}
                          {item.value.toFixed(2)}
                        </span>
                      </li>
                    ))}
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
