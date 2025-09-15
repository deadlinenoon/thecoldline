"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from "recharts";

type YtdRow = {
  team: string;
  ytd_miles: number;
  miles_since_last_home: number;
  last_week_played: number;
};

export default function TravelMilesBarChart() {
  const [data, setData] = useState<YtdRow[]>([]);
  const [limit, setLimit] = useState<number>(32);

  useEffect(() => {
    fetch("/api/travel/data?kind=ytd", { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const shown = data.slice(0, Math.min(limit, data.length));

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Season travel miles leaderboard</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="limit" className="text-sm">Top N</label>
          <input
            id="limit"
            type="number"
            min={5}
            max={32}
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="w-20 rounded border px-2 py-1 text-sm"
          />
        </div>
      </div>
      <div className="h-[540px] w-full">
        <ResponsiveContainer>
          <BarChart data={shown} margin={{ top: 16, right: 16, left: 16, bottom: 32 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="team" angle={-35} textAnchor="end" interval={0} height={60} />
            <YAxis />
            <Tooltip formatter={(v: any, name: any) => name === "ytd_miles" ? [`${v} mi`, "Season miles"] : [`${v} mi`, name]} />
            <Bar dataKey="ytd_miles">
              <LabelList dataKey="ytd_miles" position="top" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-gray-500">Refreshes after the Tuesday 12:01 AM ET job.</p>
    </div>
  );
}

