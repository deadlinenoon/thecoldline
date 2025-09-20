import React from "react";

type HFAChipProps = {
  delta: number;
};

export default function HFAChip({ delta }: HFAChipProps) {
  const tone = delta < 0 ? "text-emerald-400" : delta > 0 ? "text-red-400" : "text-slate-300";
  const background = delta < 0 ? "bg-emerald-500/15" : delta > 0 ? "bg-red-500/15" : "bg-slate-500/15";
  return (
    <span className={`ml-2 inline-flex items-center rounded px-2 py-0.5 text-xs ${background} ${tone}`}>
      HFA Δ {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
    </span>
  );
}
