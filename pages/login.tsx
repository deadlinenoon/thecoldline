import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { Event } from '../lib/oddsTypes';
import { getPrimetimeTag } from '../lib/nfl/primetime';

export default function Login() {
  const router = useRouter();
  const next = typeof router.query.next === 'string' ? router.query.next : '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  // Rotating odds widget
  const [events, setEvents] = useState<Event[]>([]);
  const [rot, setRot] = useState(0);
  const [wx, setWx] = useState<Record<string, { icon?: string|null; description?: string|null; temp_f?: number|null }>>({});

  const etFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const etTime = (iso:string)=> etFmt.format(new Date(iso)) + ' ET';
  const dowFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  const isMonET = (iso:string)=> dowFmt.format(new Date(iso)) === 'Mon';

  // helpers to compute market
  function homeSpread(ev: Event): number|null {
    const pts:number[]=[];
    for(const b of ev.bookmakers||[]){
      const m=b.markets?.find((mm:any)=>mm.key==='spreads'); if(!m) continue;
      const h=(m.outcomes||[]).find((o:any)=>o.name===ev.home_team);
      const a=(m.outcomes||[]).find((o:any)=>o.name===ev.away_team);
      if(typeof h?.point==='number') pts.push(h.point); else if(typeof a?.point==='number') pts.push(-(a.point));
    }
    if(!pts.length) return null; pts.sort((x,y)=>x-y); const mid=Math.floor(pts.length/2);
    const med= pts.length%2? pts[mid] : (pts[mid-1]+pts[mid])/2;
    return Number(med.toFixed(1));
  }
  function totalPoints(ev:Event){
    const pts:number[]=[];
    for(const b of ev.bookmakers||[]){ const m=b.markets?.find((mm:any)=>mm.key==='totals'); if(!m) continue; for(const o of (m.outcomes||[])){ if(typeof (o as any).point==='number') pts.push((o as any).point); } }
    if(!pts.length) return null; pts.sort((a,b)=>a-b); const mid=Math.floor(pts.length/2); const med= pts.length%2? pts[mid] : (pts[mid-1]+pts[mid])/2; return Number(med.toFixed(1));
  }
  function moneyline(ev:Event){
    const toProb=(o:number|null)=>{ if(o==null) return null; return o>0? 100/(o+100) : (-o)/((-o)+100) };
    const ml=(side:'home'|'away')=>{
      const prices:number[]=[];
      for(const b of ev.bookmakers||[]){ const m=b.markets?.find((mm:any)=>mm.key==='h2h'); if(!m) continue; const o=(m.outcomes||[]).find((oo:any)=>oo.name===(side==='home'? ev.home_team : ev.away_team)); if(typeof o?.price==='number') prices.push(o.price); }
      if(!prices.length) return null; const avg=prices.reduce((s,x)=>s+x,0)/prices.length; return Math.round(avg);
    };
    return { home: ml('home'), away: ml('away') };
  }
  // Dome stadium detection (fixed/retractable roofs)
  const DOME_TEAMS = new Set<string>([
    'Arizona Cardinals',
    'Atlanta Falcons',
    'New Orleans Saints',
    'Minnesota Vikings',
    'Detroit Lions',
    'Dallas Cowboys',
    'Houston Texans',
    'Indianapolis Colts',
    'Los Angeles Rams',
    'Los Angeles Chargers',
    'Las Vegas Raiders',
  ]);
  const wxEmoji=(icon?:string|null, desc?:string|null, homeTeam?:string, roof?:string|null, expectedClosed?:boolean)=>{
    if ((roof==='closed') || (roof==='retractable' && expectedClosed)) return '🏟️';
    if (homeTeam && DOME_TEAMS.has(homeTeam)) return '🏟️';
    const code=icon||''; const d=(desc||'').toLowerCase();
    if(code.startsWith('01')||/clear/.test(d)) return '☀️';
    if(code.startsWith('02')||/mainly|few/.test(d)) return '🌤️';
    if(code.startsWith('03')||code.startsWith('04')||/cloud/.test(d)) return '☁️';
    if(code.startsWith('09')||code.startsWith('10')||/rain|drizzle/.test(d)) return '🌧️';
    if(code.startsWith('11')||/thunder/.test(d)) return '⛈️';
    if(code.startsWith('13')||/snow/.test(d)) return '❄️';
    if(code.startsWith('50')||/fog|mist|haze/.test(d)) return '🌫️';
    return '🌡️';
  };

  // Primetime/special badges
  function eventBadge(iso:string){
    try{
      const d = new Date(iso);
      const et = new Intl.DateTimeFormat('en-US',{ timeZone:'America/New_York', weekday:'short', hour:'numeric', hour12:false }).formatToParts(d);
      const wk = et.find(p=>p.type==='weekday')?.value || '';
      const hr = Number(et.find(p=>p.type==='hour')?.value || '0');
      const month = new Intl.DateTimeFormat('en-US',{ timeZone:'America/New_York', month:'numeric' }).format(d);
      const day = new Intl.DateTimeFormat('en-US',{ timeZone:'America/New_York', day:'numeric' }).format(d);
      const m = Number(month), dd = Number(day);
      // Thanksgiving (fourth Thu of Nov)
      const isThanksgiving = (() => {
        if (wk !== 'Thu' || m !== 11) return false;
        // Day of week index in ET
        const first = new Date(Date.UTC(d.getUTCFullYear(),10,1));
        const firstThuOffset = (11 - first.getUTCDay()) % 7; // 4-DoW normalized
        const fourthThu = 1 + firstThuOffset + 21; // 4th Thursday date
        return dd >= fourthThu && dd <= fourthThu + 2; // allow Fri/Sat spill handling elsewhere
      })();
      const isChristmas = (m===12 && dd===25);
      const isBlackFriday = (wk==='Fri' && m===11 && dd>=23 && dd<=29); // rough BF window
      const primetime = (hr>=20 && hr<=21);
      if (isChristmas) {
        return (
          <span className="inline-flex items-center align-middle">
            <span role="img" aria-label="Primetime" title="Primetime">📺</span>
            <span className="ml-1" role="img" aria-label="Christmas">🎄</span>
          </span>
        ) as any;
      }
      if (isThanksgiving) {
        return (
          <span className="inline-flex items-center align-middle">
            <span role="img" aria-label="Primetime" title="Primetime">📺</span>
            <span className="ml-1" role="img" aria-label="Thanksgiving">🦃</span>
          </span>
        ) as any;
      }
      if (isBlackFriday) return '🛍️';
      const tag = getPrimetimeTag(iso);
      if (tag){
        return (
          <span className="inline-flex items-center align-middle">
            <span role="img" aria-label="Primetime" title="Primetime">📺</span>
            <span className="ml-1 inline-flex items-center rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white" aria-label={`${tag} badge`}>{tag}</span>
          </span>
        ) as any;
      }
      if (wk==='Sat' && hr>=19) return '⭐'; // Saturday night
      return '';
    }catch{return ''}
  }

  // load odds once and rotate every 3s
  useEffect(()=>{
    (async()=>{
      try{
        const r=await fetch('/api/odds'); const data:Event[]=await r.json();
        const now=new Date();
        // Upcoming sorted
        const upcoming = data.map(ev=>({ev,dt:new Date(ev.commence_time)}))
          .filter(x=> x.dt.getTime() >= now.getTime())
          .sort((a,b)=> a.dt.getTime() - b.dt.getTime());
        // Find this MNF (first Monday among upcoming)
        const firstMon = upcoming.find(x=> isMonET(x.ev.commence_time))?.dt || null;
        let start = now; let end: Date;
        if (firstMon && now.getTime() < firstMon.getTime()) {
          end = firstMon;
        } else if (firstMon) {
          // After MNF: go until next Monday or +8d fallback
          const after = upcoming.filter(x=> x.dt.getTime() > firstMon.getTime());
          const nextMon = after.find(x=> isMonET(x.ev.commence_time))?.dt;
          end = nextMon || new Date(firstMon.getTime() + 8*864e5);
        } else {
          end = new Date(now.getTime() + 8*864e5);
        }
        const windowed = upcoming.filter(x=> x.dt >= start && x.dt <= end).map(x=>x.ev);
        setEvents(windowed);
      }catch{}
    })();
  },[]);
  useEffect(()=>{ const id=setInterval(()=> setRot(r=> (r+1) % Math.max(1, events.length)), 3000); return ()=>clearInterval(id); },[events.length]);
  useEffect(()=>{
    // prefetch weather for current card
    const ev=events[rot]; if(!ev) return; if(wx[ev.id]) return;
    (async()=>{ try{ const r=await fetch(`/api/weather?home=${encodeURIComponent(ev.home_team)}&kickoff=${encodeURIComponent(ev.commence_time)}`); const j=await r.json(); setWx(prev=>({...prev,[ev.id]:{ icon:j?.icon??null, description:j?.description??null, temp_f:j?.temp_f??null, roof: j?.roof ?? null, expectedClosed: !!j?.expectedClosed }})); }catch{} })();
  },[events,rot,wx]);

  useEffect(() => {
    // If already logged in, skip
    (async () => {
      try{ const r = await fetch('/api/auth/me'); if (r.ok) router.replace(next); }catch{}
    })();
  }, [next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setErr(null);
    try{
      const r = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(()=>({}));
      if (r.ok){ router.replace(next || '/'); return; }
      // Do not auto-create/reset here. Invite code is for first-time signup only.
      throw new Error(j?.error || 'Invalid credentials');
    }catch(e:any){ setErr(e?.message||'Login error'); }
    finally{ setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-cl-bg text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        <a href="/" aria-label="Home" className="mb-6 block">
          <img
            src="/logo-ice-script.svg"
            alt="The Cold Line"
            className="h-24 w-auto md:h-32 lg:h-40 drop-shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
          />
        </a>
        <div className="w-full bg-[#0f1720] border border-[#1b2735] rounded-xl p-6 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
          <div className="text-lg font-semibold mb-4">Sign in</div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Password</label>
              <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white" />
            </div>
            {err && <div className="text-sm text-rose-400">{err}</div>}
            <button disabled={loading} className="w-full mt-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 rounded px-3 py-2 font-semibold">{loading? 'Signing in…' : 'Sign in'}</button>
          </form>
          <div className="mt-2 text-center">
            <a href="/reset" className="text-xs text-cyan-300 underline">Forgot your password?</a>
          </div>
          <div className="mt-4">
            <a
              href={`/signup?next=${encodeURIComponent(next)}`}
              className="w-full inline-block text-center bg-emerald-600 hover:bg-emerald-500 rounded px-3 py-2 font-semibold"
            >
              NEW USER: CREATE ACCOUNT
            </a>
          </div>

          {/* Rotating odds widget (inside card, under invite code box) */}
            {events.length>0 && (()=>{ const ev=events[rot]; const sp=homeSpread(ev); const tot=totalPoints(ev); const ml=moneyline(ev); const info=wx[ev.id]||{};
              const favIsHome = (sp!=null && sp<0);
              const spreadTxt = sp==null? '—' : (`-${Math.abs(sp).toFixed(1)}`);
              const topRight = (sp==null || sp===0)
              ? (<span className="text-right text-sm text-gray-300">O/U {tot ?? '—'}</span>)
              : (!favIsHome
                  ? (<span className="text-right text-sm">{spreadTxt} {ml.away!=null? <span className="text-gray-400">({ml.away})</span> : null}</span>)
                  : (<span className="text-right text-sm text-gray-300">O/U {tot ?? '—'}</span>)
                );
              const bottomRight = (sp==null || sp===0)
              ? (<span className="text-right text-sm">{ml.home!=null? <span className="text-gray-400">({ml.home})</span> : ' '}</span>)
              : (favIsHome
                  ? (<span className="text-right text-sm">{spreadTxt} {ml.home!=null? <span className="text-gray-400">({ml.home})</span> : null}</span>)
                  : (<span className="text-right text-sm text-gray-300">O/U {tot ?? '—'}</span>)
                );
            return (
              <div className="mt-5 p-4 rounded-lg border border-[#233041] bg-[#0e1520]">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>{etTime(ev.commence_time)}</span>
                  <span>
                    {eventBadge(ev.commence_time) || ''} {wxEmoji(info.icon, info.description, ev.home_team, (info as any).roof, (info as any).expectedClosed)} {info.temp_f!=null? `${info.temp_f}°F` : '—'}
                  </span>
                </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="col-span-2 text-sm text-gray-200 font-medium truncate">{ev.away_team}</div>
                {topRight}
                <div className="col-span-2 text-sm text-gray-200 font-semibold truncate">{ev.home_team}</div>
                {bottomRight}
              </div>
            </div>
          ); })()}
        </div>
      </div>
    </div>
  );
}
