import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Event } from '@/lib/oddsTypes';
import { teamLogoUrl } from '@/lib/logos';
import WindGoalpost, { abbreviateCardinal, describeWindForGoal } from '@/components/weather/WindGoalpost';

function kickoffET(iso: string){
  try{ return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)); }catch{return iso;}
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
            const rawWindSpeed = typeof w?.wind_mph === 'number' ? Number(w.wind_mph) : null;
            const windSpeed = rawWindSpeed != null && Number.isFinite(rawWindSpeed) ? rawWindSpeed : null;
            const rawWindDeg = typeof w?.wind_deg === 'number' ? Number(w.wind_deg) : null;
            const windDeg = rawWindDeg != null && Number.isFinite(rawWindDeg) ? rawWindDeg : null;
            const windDescriptor = describeWindForGoal(windDeg);
            const windAbbr = abbreviateCardinal(windDescriptor.cardinal);
            const windLine = windSpeed != null
              ? (() => {
                  const mph = Math.round(windSpeed);
                  const parts: string[] = [`${mph} mph`];
                  if (windAbbr) parts.push(windAbbr);
                  if (windDescriptor.toDegrees != null) parts.push(`${Math.round(windDescriptor.toDegrees)}° to`);
                  if (windDeg != null) parts.push(`from ${Math.round(windDeg)}°`);
                  return parts.join(' • ');
                })()
              : '—';
            const windNarrative = windSpeed != null
              ? (() => {
                  const mph = Math.round(windSpeed);
                  const phraseParts: string[] = [];
                  if (windDescriptor.cardinal) phraseParts.push(windDescriptor.cardinal);
                  if (windDescriptor.target) phraseParts.push(windDescriptor.target);
                  const degreeSuffix = windDescriptor.toDegrees != null ? ` (${Math.round(windDescriptor.toDegrees)}°)` : '';
                  const first = phraseParts.length
                    ? `Wind blowing ${phraseParts.join(' ')} at ${mph} mph${degreeSuffix}.`
                    : `Wind steady at ${mph} mph${degreeSuffix}.`;
                  const second = windDeg != null ? `From ${Math.round(windDeg)}°.` : '';
                  return `${first}${second ? ` ${second}` : ''}`.trim();
                })()
              : null;
            return (
              <div key={ev.id} className="p-3 rounded-lg border border-[#1b2735] bg-[#0f1720]">
                <div className="text-sm font-medium text-gray-100 inline-flex items-center gap-2">
                  <Image
                    src={teamLogoUrl(ev.away_team)}
                    alt=""
                    className="h-4 w-4"
                    width={16}
                    height={16}
                    unoptimized
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                  {ev.away_team}
                  <span className="text-gray-400">@</span>
                  <Image
                    src={teamLogoUrl(ev.home_team)}
                    alt=""
                    className="h-4 w-4"
                    width={16}
                    height={16}
                    unoptimized
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                  {ev.home_team}
                </div>
                <div className="text-xs text-gray-400">Kickoff: {kickoffET(ev.commence_time)}</div>
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-3 items-center">
                  <div className="text-sm text-gray-200">
                    <div><span className="text-gray-400">Temp:</span> {w?.temp_f ?? '—'}°F</div>
                    {!isIndoors && (
                      <>
                        <div><span className="text-gray-400">Wind:</span> {windLine}</div>
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
                    ) : windSpeed != null ? (
                      <div className="text-right">
                        <WindGoalpost
                          speed={windSpeed}
                          directionFrom={windDeg}
                          width={132}
                          height={210}
                          className="ml-auto"
                        />
                        {windNarrative ? (
                          <p className="mt-2 w-[140px] text-right text-[11px] leading-snug text-gray-300 ml-auto">{windNarrative}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">Wind data unavailable</div>
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
