import React, { useEffect, useMemo, useState } from 'react';
import type { Event } from '../lib/oddsTypes';
import { teamLogoUrl } from '../lib/logos';

function fmtOdds(n?: number|null){ if (typeof n!=='number'||!Number.isFinite(n)) return '—'; return n>0? `+${n}`: `${n}`; }
function fmtPt(n?: number|null){ if (typeof n!=='number'||!Number.isFinite(n)) return '—'; return n>0? `+${n.toFixed(1)}`: n.toFixed(1); }
function kickoffET(iso:string){ try{ return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(new Date(iso)); }catch{return iso;} }

export default function OddsBoard(){
  const [events,setEvents]=useState<Event[]>([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState<string|null>(null);
  const [showML,setShowML]=useState(false);

  useEffect(()=>{(async()=>{ try{ setLoading(true); const r=await fetch('/api/odds'); const j=await r.json().catch(()=>({})); const arr:Event[]=Array.isArray(j)? j: (Array.isArray(j?.events)? j.events: []); setEvents(arr);}catch(e:any){ setErr(e?.message||'odds error'); } finally{ setLoading(false); } })();},[]);

  const list = useMemo(()=> (events||[]).slice().sort((a,b)=> new Date(a.commence_time).getTime()-new Date(b.commence_time).getTime()),[events]);

  const cols = [ 'betmgm','fanduel','caesars','bet365','draftkings','fanatics' ];
  const colLabel:Record<string,string>={ betmgm:'BetMGM', fanduel:'FanDuel', caesars:'Caesars', bet365:'bet365', draftkings:'DraftKings', fanatics:'Fanatics' };
  const findBook=(ev:Event,key:string)=> (ev.bookmakers||[]).find(b=> String(b.title||'').toLowerCase().includes(key));
  const getSpreads=(ev:Event,key:string)=>{ const b=findBook(ev,key); const m=b?.markets?.find(mm=>mm.key==='spreads'); const a=m?.outcomes?.find(o=>o.name===ev.away_team) as any; const h=m?.outcomes?.find(o=>o.name===ev.home_team) as any; return { a, h }; };
  const getML=(ev:Event,key:string)=>{ const b=findBook(ev,key); const m=b?.markets?.find(mm=>mm.key==='h2h'); const a=m?.outcomes?.find(o=>o.name===ev.away_team) as any; const h=m?.outcomes?.find(o=>o.name===ev.home_team) as any; return { a, h }; };

  return (
    <div className="min-h-screen bg-[#070c11] text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">Odds</div>
            <div className="text-xs text-gray-400">Spreads and totals by book</div>
          </div>
          <button onClick={()=>setShowML(v=>!v)} className="px-2 py-1 rounded bg-[#1a2330] hover:bg-[#202c3b] text-xs">{showML? 'Hide moneylines' : 'Show moneylines'}</button>
        </div>
        {loading && <div className="text-sm text-gray-400">Loading…</div>}
        {err && <div className="text-sm text-rose-400">{err}</div>}
        <div className="rounded-lg border border-[#1b2735] bg-[#0f1720] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left w-[100px]">Time</th>
                <th className="px-3 py-2 text-left w-[240px]">Teams</th>
                <th className="px-3 py-2 text-left w-[80px]">Opener</th>
                {cols.map(c=> (<th key={c} className="px-3 py-2 text-left whitespace-nowrap">{colLabel[c]}</th>))}
              </tr>
            </thead>
            <tbody className="text-gray-200">
              {list.map(ev=>{
                // Opening medians (home-axis) and total
                const medSpread=(()=>{ const pts:number[]=[]; for(const b of ev.bookmakers||[]){ const m=b.markets?.find(mm=>mm.key==='spreads'); if(!m) continue; const h=m.outcomes?.find(o=>o.name===ev.home_team) as any; const a=m.outcomes?.find(o=>o.name===ev.away_team) as any; if(typeof h?.point==='number') pts.push(h.point); else if(typeof a?.point==='number') pts.push(-a.point); } if(!pts.length) return null; pts.sort((x,y)=>x-y); const mid=Math.floor(pts.length/2); const med= pts.length%2? pts[mid] : (pts[mid-1]+pts[mid])/2; return Number(med.toFixed(1)); })();
                const medTotal=(()=>{ const pts:number[]=[]; for(const b of ev.bookmakers||[]){ const m=b.markets?.find(mm=>mm.key==='totals'); if(!m) continue; for(const o of m.outcomes||[]){ const v=(o as any).point; if(typeof v==='number') pts.push(v); } } if(!pts.length) return null; pts.sort((a,b)=>a-b); const mid=Math.floor(pts.length/2); const med= pts.length%2? pts[mid] : (pts[mid-1]+pts[mid])/2; return Number(med.toFixed(1)); })();
                return (
                  <tr key={ev.id} className="border-t border-[#1b2735] align-top">
                    <td className="px-3 py-2 text-xs text-gray-300">{kickoffET(ev.commence_time)} ET</td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-2"><img src={teamLogoUrl(ev.away_team)} alt="" className="h-4 w-4" onError={(e)=>{ (e.target as HTMLImageElement).style.display='none'; }} /> {ev.away_team}</div>
                      <div className="inline-flex items-center gap-2 mt-0.5"><img src={teamLogoUrl(ev.home_team)} alt="" className="h-4 w-4" onError={(e)=>{ (e.target as HTMLImageElement).style.display='none'; }} /> {ev.home_team}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-300">
                      <div>{medSpread==null? '—' : fmtPt(medSpread)}</div>
                      <div>{medTotal==null? '—' : medTotal}</div>
                    </td>
                    {cols.map(c=>{
                      const sp = getSpreads(ev,c);
                      const ml = getML(ev,c);
                      return (
                        <td key={c} className="px-3 py-2">
                          {!showML ? (
                            <div>
                              <div>{sp.a? `${fmtPt(sp.a.point)} ${fmtOdds(sp.a.price)}` : '—'}</div>
                              <div>{sp.h? `${fmtPt(sp.h.point)} ${fmtOdds(sp.h.price)}` : '—'}</div>
                            </div>
                          ) : (
                            <div>
                              <div>{ml.a? fmtOdds(ml.a.price) : '—'}</div>
                              <div>{ml.h? fmtOdds(ml.h.price) : '—'}</div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
