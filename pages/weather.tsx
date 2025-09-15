import React, { useEffect, useMemo, useState } from 'react';
import type { Event } from '../lib/oddsTypes';
import { teamLogoUrl } from '../lib/logos';

function kickoffET(iso: string){
  try{ return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)); }catch{return iso;}
}

// Tall vertical football field box with uprights at top/bottom and a wind arrow.
function FieldWindVertical({ deg, speed, width=90, height=180, thick=4 }: { deg:number|null|undefined; speed:number|null|undefined; width?:number; height?:number; thick?:number }){
  if (deg==null || speed==null) return null;
  const toDir = (deg + 180) % 360; // convert FROM -> TO
  const s = Math.max(0, Math.min(1, (Number(speed)||0)/30));
  const cX = width/2;
  const cY = height/2;
  const len = Math.max(height*0.28, height*0.28 + s*(height*0.30));
  const tailY = cY + len*0.35;
  const headY = cY - len*0.65;
  // Speed bands → color
  const v = Number(speed)||0;
  const color = (
    v >= 35 ? '#a855f7' :     // extreme (purple)
    v >= 25 ? '#f43f5e' :     // very windy (rose)
    v >= 18 ? '#f59e0b' :     // windy (amber)
    v >= 10 ? '#22d3ee' :     // breezy (cyan)
              '#60a5fa'       // calm (blue)
  );
  const postW = Math.max(3, Math.floor(width*0.12));
  const postH = Math.max(12, Math.floor(height*0.22));
  const gap = Math.max(3, Math.floor(width*0.08));
  const yardLines: number[] = [];
  for (let i=1;i<10;i++){ yardLines.push(Math.round((height*i)/10)); }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label={`Wind ${speed} mph @ ${deg}°`}>
      {/* Field background */}
      <rect x={0.5} y={0.5} width={width-1} height={height-1} rx={8} ry={8} fill="#0d1624" stroke="#1b2735" />
      {/* Yard lines */}
      {yardLines.map((y,i)=> (
        <line key={i} x1={6} y1={y} x2={width-6} y2={y} stroke="#143044" strokeWidth={1} opacity={0.8} />
      ))}
      {/* Uprights top */}
      <g transform={`translate(${cX}, ${Math.max(6,8)})`}>
        <rect x={-postW/2 - postW - gap} y={0} width={postW} height={postH} fill="#fbbf24" />
        <rect x={-postW/2 + gap} y={0} width={postW} height={postH} fill="#fbbf24" />
        <rect x={-postW - gap} y={postH-2} width={2*postW + 2*gap} height={3} fill="#fbbf24" />
      </g>
      {/* Uprights bottom */}
      <g transform={`translate(${cX}, ${height - Math.max(6,8) - postH})`}>
        <rect x={-postW/2 - postW - gap} y={0} width={postW} height={postH} fill="#fbbf24" />
        <rect x={-postW/2 + gap} y={0} width={postW} height={postH} fill="#fbbf24" />
        <rect x={-postW - gap} y={0} width={2*postW + 2*gap} height={3} fill="#fbbf24" />
      </g>
      {/* Wind arrow (rotate around center) */}
      <g style={{ transform: `rotate(${toDir}deg)`, transformOrigin: `${cX}px ${cY}px` }}>
        <line x1={cX} y1={tailY} x2={cX} y2={headY} stroke={color} strokeWidth={thick} strokeLinecap="round" />
        <polygon points={`${cX},${headY} ${cX-7},${headY+14} ${cX+7},${headY+14}`} fill={color} />
      </g>
    </svg>
  );
}

export default function WeatherBoard(){
  const [events, setEvents] = useState<Event[]>([]);
  const [wx, setWx] = useState<Record<string, { temp_f:number|null; wind_mph:number|null; wind_deg:number|null; pop:number|null; description?:string|null }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const r=await fetch('/api/odds'); const j=await r.json().catch(()=>({}));
        const arr:Event[] = Array.isArray(j)? j : (Array.isArray(j?.events)? j.events : []);
        const now=new Date(); const end=new Date(now.getTime()+8*864e5);
        const slate = arr.map(ev=>({ev,dt:new Date(ev.commence_time)})).filter(x=>x.dt>=now && x.dt<=end).sort((a,b)=>a.dt.getTime()-b.dt.getTime()).map(x=>x.ev);
        setEvents(slate);
        for(const ev of slate){
          try{
            const rr=await fetch(`/api/weather?home=${encodeURIComponent(ev.home_team)}&kickoff=${encodeURIComponent(ev.commence_time)}`);
            const w=await rr.json();
            setWx(prev=>({...prev,[ev.id]:{ temp_f:w?.temp_f??null, wind_mph:w?.wind_mph??null, wind_deg:w?.wind_deg??null, pop:w?.pop??null, description:w?.description??null, roof: w?.roof ?? null, expectedClosed: !!w?.expectedClosed }}));
          }catch{}
        }
      }finally{ setLoading(false); }
    })();
  },[]);

  return (
    <div className="min-h-screen bg-[#070c11] text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-3">
          <h1 className="text-xl font-semibold">Weather</h1>
          <div className="text-xs text-gray-400">Kickoff conditions for the upcoming slate</div>
        </div>
        {loading && <div className="text-sm text-gray-400">Loading…</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {events.map(ev=>{
            const w = wx[ev.id] || {} as any;
            const roof = (w as any).roof as string|undefined;
            const expectedClosed = !!(w as any).expectedClosed;
            const isIndoors = roof==='closed' || (roof==='retractable' && expectedClosed);
            return (
              <div key={ev.id} className="p-3 rounded-lg border border-[#1b2735] bg-[#0f1720]">
                <div className="text-sm font-medium text-gray-100 inline-flex items-center gap-2">
                  <img src={teamLogoUrl(ev.away_team)} alt="" className="h-4 w-4" onError={(e)=>{ (e.target as HTMLImageElement).style.display='none'; }} /> {ev.away_team}
                  <span className="text-gray-400">@</span>
                  <img src={teamLogoUrl(ev.home_team)} alt="" className="h-4 w-4" onError={(e)=>{ (e.target as HTMLImageElement).style.display='none'; }} /> {ev.home_team}
                </div>
                <div className="text-xs text-gray-400">Kickoff: {kickoffET(ev.commence_time)}</div>
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-3 items-center">
                  <div className="text-sm text-gray-200">
                    <div><span className="text-gray-400">Temp:</span> {w?.temp_f ?? '—'}°F</div>
                    {!isIndoors && (
                      <>
                        <div><span className="text-gray-400">Wind:</span> {w?.wind_mph ?? '—'} mph @ {w?.wind_deg ?? '—'}°</div>
                        <div><span className="text-gray-400">Precip:</span> {typeof w?.pop==='number'? `${Math.round(w.pop*100)}%`:'—'}</div>
                      </>
                    )}
                    {isIndoors && (
                      <div className="text-xs text-gray-400 mt-1">{roof==='retractable' ? '(Retractable roof — expected closed)' : 'Indoors (climate-controlled)'} </div>
                    )}
                  </div>
                  <div className="justify-self-end">
                    {isIndoors ? (
                      <div className="text-4xl" aria-label="Dome">🏟️</div>
                    ) : (
                      <FieldWindVertical deg={w?.wind_deg} speed={w?.wind_mph} width={90} height={180} />
                    )}
                  </div>
                </div>
                {w?.description && <div className="mt-1 text-xs text-gray-400">{w.description}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
