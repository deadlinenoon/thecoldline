"use client";
import { useEffect, useState } from "react";

type Row = {
  team: string;
  opponent: string;
  week: number;
  game_date_local: string;
  site_type: "home" | "away" | "international";
  stadium_name: string;
  stadium_city: string;
  stadium_country: string;
  leg_miles: number;
  notes?: string;
};

export default function NextWeekTravelTable() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    fetch("/api/travel/data?kind=next_week", { cache: "no-store" })
      .then(r => r.json())
      .then(setRows)
      .catch(console.error);
  }, []);
  if (!rows.length) return null;
  const wk = rows[0]?.week;
  return (
    <div className="w-full">
      <h2 className="mb-2 text-xl font-semibold">Next week travel legs {wk ? `(Week ${wk})` : ""}</h2>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-left">Opponent</th>
              <th className="px-3 py-2 text-left">Site</th>
              <th className="px-3 py-2 text-left">Stadium</th>
              <th className="px-3 py-2 text-left">City</th>
              <th className="px-3 py-2 text-right">Miles</th>
              <th className="px-3 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2">{r.team}</td>
                <td className="px-3 py-2">{r.opponent}</td>
                <td className="px-3 py-2 capitalize">{r.site_type}</td>
                <td className="px-3 py-2">{r.stadium_name}</td>
                <td className="px-3 py-2">{r.stadium_city}, {r.stadium_country}</td>
                <td className="px-3 py-2 text-right">{r.leg_miles}</td>
                <td className="px-3 py-2">{r.notes || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

