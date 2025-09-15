import React from "react";
type Props = { leftTeam: string; rightTeam: string; value?: number|null; };
export default function MetricRow({ leftTeam, rightTeam, value }: Props) {
  const num = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  const color = num === 0 ? "text-gray-300" : num > 0 ? "text-green-400" : "text-red-400";
  const favor = num === 0 ? "neutral" : (num > 0 ? rightTeam : leftTeam);
  const pretty = num === 0 ? "0.00" : `${num > 0 ? "+" : ""}${Math.abs(num).toFixed(2)}`;
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-400">{leftTeam}</span>
      <span className={`text-lg font-bold ${color}`}>
        {pretty}
        <span className={`ml-2 text-[11px] ${num===0?"text-gray-400":"text-cyan-300"} font-medium`}>applies to {favor}</span>
      </span>
      <span className="text-xs text-gray-400">{rightTeam}</span>
    </div>
  );
}
