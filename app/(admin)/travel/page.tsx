"use client";
import { useEffect, useMemo, useState } from "react";
import ErrorChip from "../../../ui/ErrorChip";

type TravelRow = {
  team: string;
  week: number;
  opponent: string;
  home_away: "home" | "away" | "bye";
  game_city: string;
  game_lat: number;
  game_lon: number;
  distance_from_prev_location_mi: number;
  miles_since_last_home: number;
  cumulative_miles: number;
  note?: string;
  is_primetime: boolean;
  is_dome: boolean;
};

export default function TravelPage() {
  const [rows, setRows] = useState<TravelRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [team, setTeam] = useState<string>("");
  const [week, setWeek] = useState<number | 0>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/travel-miles?season=2025`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setRows(json.rows || []);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load');
      }
    };
    load();
  }, []);

  const teams = useMemo(() => Array.from(new Set(rows.map(r => r.team))).sort(), [rows]);

  const filtered = rows.filter(r => (team ? r.team === team : true) && (week ? r.week === week : true));

  return (
    <div style={{ padding: '1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Travel Miles — 2025</h1>
      {err && <ErrorChip message={`Travel data error: ${err}`} />}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0 16px' }}>
        <label>
          Team:{' '}
          <select value={team} onChange={e => setTeam(e.target.value)}>
            <option value="">All</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Week:{' '}
          <select value={week} onChange={e => setWeek(Number(e.target.value))}>
            <option value={0}>All</option>
            {Array.from({ length: 18 }, (_, i) => i + 1).map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <a href="/api/travel-miles?season=2025" className="text-blue-600 hover:underline">Download CSV</a>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Team','Week','Opponent','H/A','City','Lat','Lon','From Prev (mi)','Since Home (mi)','Cumulative (mi)','Tags','Note'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={`${r.team}-${r.week}-${idx}`}>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.team}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.week}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.opponent}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.home_away}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.game_city}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.game_lat.toFixed(3)}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.game_lon.toFixed(3)}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.distance_from_prev_location_mi}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.miles_since_last_home}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.cumulative_miles}</td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                  {r.is_primetime && (
                    <span style={{ display:'inline-block', background:'#e0e7ff', color:'#3730a3', border:'1px solid #c7d2fe', borderRadius:6, padding:'2px 6px', fontSize:12, marginRight:6 }}>PRIME</span>
                  )}
                  {r.is_dome && (
                    <span style={{ display:'inline-block', background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a', borderRadius:6, padding:'2px 6px', fontSize:12 }}>DOME</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{r.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ opacity: 0.7, marginTop: 12 }}>Note: A full CSV is exported under /data via the export script.</p>
    </div>
  );
}
