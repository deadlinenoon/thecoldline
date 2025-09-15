"use client";
import React, { useEffect, useMemo, useState } from 'react';

type NextRow = {
  team: string;
  opponent: string;
  week: number;
  game_date_local: string;
  site_type: 'home'|'away'|'international';
  stadium_name: string;
  stadium_city: string;
  stadium_country: string;
  leg_miles: number;
  notes?: string;
};

export default function AdminTravelPage(){
  const [rows,setRows] = useState<NextRow[]>([]);
  const [team,setTeam] = useState('');
  const [err,setErr] = useState<string|null>(null);
  useEffect(()=>{(async()=>{ try{ const r=await fetch('/api/travel/data?kind=next_week',{cache:'no-store'}); const j=await r.json(); if(!r.ok) throw new Error(j?.error||'error'); setRows(Array.isArray(j)? j: []);}catch(e:any){ setErr(e?.message||'error'); } })();},[]);
  const view = useMemo(()=> rows.filter(r => (!team || r.team.toLowerCase().includes(team.toLowerCase()))),[rows,team]);
  const wk = view[0]?.week;
  return (
    <div className="min-h-screen bg-cl-bg text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-semibold">Next Week Travel Legs {wk? `(Week ${wk})`: ''}</div>
          <div className="flex items-center gap-2 text-sm">
            <input value={team} onChange={e=>setTeam(e.target.value)} placeholder="Filter by team" className="bg-[#0e1520] border border-[#233041] rounded px-2 py-1" />
          </div>
        </div>
        {err && <div className="text-rose-400 mb-2">{err}</div>}
        <div className="overflow-auto border border-[#1b2735] rounded">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-400 bg-[#0f1720]">
              <tr>
                <th className="px-2 py-1 text-left">Team</th>
                <th className="px-2 py-1 text-left">Opponent</th>
                <th className="px-2 py-1 text-left">Site</th>
                <th className="px-2 py-1 text-left">Stadium</th>
                <th className="px-2 py-1 text-left">City</th>
                <th className="px-2 py-1 text-right">Miles</th>
                <th className="px-2 py-1 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {view.map((r,i)=> (
                <tr key={r.team+':'+r.week+':'+i} className="border-t border-[#1b2735]">
                  <td className="px-2 py-1">{r.team}</td>
                  <td className="px-2 py-1">{r.opponent}</td>
                  <td className="px-2 py-1 capitalize">{r.site_type}</td>
                  <td className="px-2 py-1">{r.stadium_name}</td>
                  <td className="px-2 py-1">{r.stadium_city}, {r.stadium_country}</td>
                  <td className="px-2 py-1 text-right">{r.leg_miles}</td>
                  <td className="px-2 py-1">{r.notes||''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
