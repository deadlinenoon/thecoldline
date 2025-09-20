import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { Event } from '@/lib/oddsTypes';
import { getPrimetimeTag } from '@/lib/nfl/primetime';
import type { PrimetimeTag } from '@/lib/nfl/primetime';
import { getNetworkLogo, getPrimetimeLogoFromTag } from '@/lib/nfl/broadcast';

const DEFAULT_REDIRECT = '/coldline';
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

type WxInfo = {
  icon?: string | null;
  description?: string | null;
  temp_f?: number | null;
  roof?: string | null;
  expectedClosed?: boolean;
  surface?: string | null;
  stadium?: string | null;
};

const DOME_KEYWORDS = [
  'Mercedes-Benz',
  'SoFi',
  'Caesars Superdome',
  'Allegiant',
  'Lucas Oil',
  'Ford Field',
  'State Farm',
  'AT&T Stadium',
  'NRG',
];

const isDomeStadium = (stadiumName = '', surface = ''): boolean => {
  const name = stadiumName.toLowerCase();
  const surf = surface.toLowerCase();
  if (surf === 'dome') return true;
  if (DOME_KEYWORDS.some(keyword => name.includes(keyword.toLowerCase()))) return true;
  return false;
};

const isIndoorEvent = (event: Event, weather?: WxInfo): boolean => {
  const roof = weather?.roof ?? null;
  const expectedClosed = Boolean(weather?.expectedClosed);
  const stadiumName = String((event as any)?.venue || (event as any)?.stadium || weather?.stadium || '');
  const surface = String(weather?.surface || (event as any)?.surface || '');
  return (
    isDomeStadium(stadiumName, surface) ||
    roof === 'closed' ||
    (roof === 'retractable' && expectedClosed) ||
    (event.home_team ? DOME_TEAMS.has(event.home_team) : false)
  );
};

const emojiLabel = (emoji: string, tag: PrimetimeTag | null): string | null => {
  switch (emoji) {
    case '🏟️':
      return 'Indoor game';
    case '🦃':
      return 'Thanksgiving game';
    case '🎄':
      return 'Christmas game';
    case '🛍️':
      return 'Black Friday game';
    case '🧊':
      return 'Freezing conditions';
    case '🏆':
      return 'Playoff game';
    case '📺':
      return tag ? `${tag} primetime` : 'Primetime game';
    case '🪩':
      return 'Saturday night game';
    case '🏈':
      return 'NFL game';
    default:
      return null;
  }
};

type GameEmojiContext = {
  isDome: boolean;
  isThanksgiving: boolean;
  isChristmas: boolean;
  isBlackFriday: boolean;
  isPlayoffs: boolean;
  isSaturdayNight: boolean;
  tempF: number | null;
  network: string;
  weekday: string;
};

const getGameEmoji = (context: GameEmojiContext): string => {
  if (context.isDome) return '🏟️';
  if (context.isThanksgiving) return '🦃';
  if (context.isChristmas) return '🎄';
  if (context.isBlackFriday) return '🛍️';
  if (context.isPlayoffs) return '🏆';
  if (context.tempF !== null && context.tempF <= 32) return '🧊';
  if (
    ['nbc', 'espn', 'prime video', 'prime', 'amazon'].some(net => context.network.includes(net)) &&
    ['sunday', 'monday', 'thursday'].some(day => context.weekday.includes(day))
  ) {
    return '📺';
  }
  if (context.isSaturdayNight) return '🪩';
  return '🏈';
};

function eventBadge(event: Event, weather?: WxInfo) {
  const iso = event.commence_time;
  const kickoff = new Date(iso);
  if (!Number.isFinite(kickoff.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(kickoff);
  const weekdayShort = parts.find((p) => p.type === 'weekday')?.value || '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'numeric' }).format(kickoff));
  const dayNum = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', day: 'numeric' }).format(kickoff));
  let weekdayLong = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(kickoff);
  if (weekdayShort === 'Sat' && hour >= 19) {
    weekdayLong = `${weekdayLong} Night`;
  }

  const isThanksgiving = (() => {
    if (month !== 11) return false;
    const first = new Date(Date.UTC(kickoff.getUTCFullYear(), 10, 1));
    const firstThursdayOffset = (11 - first.getUTCDay() + 7) % 7;
    const fourthThursday = 1 + firstThursdayOffset + 21;
    return dayNum >= fourthThursday && dayNum <= fourthThursday + 2;
  })();
  const isChristmas = month === 12 && dayNum === 25;
  const isBlackFriday = weekdayShort === 'Fri' && month === 11 && dayNum >= 23 && dayNum <= 29;
  const tag = getPrimetimeTag(iso);

  const isIndoor = isIndoorEvent(event, weather);

  const tempF = typeof weather?.temp_f === 'number' ? weather.temp_f : null;
  const isSaturdayNight = weekdayShort === 'Sat' && hour >= 19;
  const isPlayoffs = /playoff/i.test(`${(event as any)?.name || ''} ${(event as any)?.short_name || ''} ${(event as any)?.notes || ''}`);

  const network = (() => {
    if (tag === 'SNF') return 'NBC';
    if (tag === 'MNF') return 'ESPN';
    if (tag === 'TNF') return 'Prime Video';
    return String((event as any)?.broadcast || (event as any)?.network || '');
  })();

  const emoji = getGameEmoji({
    isDome: isIndoor,
    isThanksgiving,
    isChristmas,
    isBlackFriday,
    isPlayoffs,
    isSaturdayNight,
    tempF,
    network: network.toLowerCase(),
    weekday: weekdayLong.toLowerCase(),
  });

  const label = emojiLabel(emoji, tag);
  const emojiProps = label
    ? { role: 'img' as const, 'aria-label': label, title: label }
    : { 'aria-hidden': true };

  const networkLogo = emoji === '📺'
    ? getNetworkLogo(network, weekdayLong) ?? getPrimetimeLogoFromTag(tag)
    : null;

  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span {...emojiProps}>{emoji}</span>
      {networkLogo ? (
        <Image
          src={networkLogo.src}
          alt={networkLogo.alt}
          title={networkLogo.alt}
          className="h-3 w-auto"
          width={48}
          height={12}
          unoptimized
        />
      ) : null}
    </span>
  );
}

export default function Login() {
  const router = useRouter();
  const nextParam = typeof router.query.next === 'string' ? router.query.next : '';
  const next = nextParam.startsWith('/') && nextParam !== '/' ? nextParam : DEFAULT_REDIRECT;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string|null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Rotating odds widget
  const [events, setEvents] = useState<Event[]>([]);
  const [rot, setRot] = useState(0);
  const [wx, setWx] = useState<Record<string, WxInfo>>({});

  const etFmt = useMemo(() => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), []);
  const etTime = useCallback((iso:string)=> `${etFmt.format(new Date(iso))} ET`, [etFmt]);
  const weekdayFmt = useMemo(() => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }), []);
  const isMonET = useCallback((iso:string)=> weekdayFmt.format(new Date(iso)) === 'Mon', [weekdayFmt]);

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
    const ml=(side:'home'|'away')=>{
      const prices:number[]=[];
      for(const b of ev.bookmakers||[]){ const m=b.markets?.find((mm:any)=>mm.key==='h2h'); if(!m) continue; const o=(m.outcomes||[]).find((oo:any)=>oo.name===(side==='home'? ev.home_team : ev.away_team)); if(typeof o?.price==='number') prices.push(o.price); }
      if(!prices.length) return null; const avg=prices.reduce((s,x)=>s+x,0)/prices.length; return Math.round(avg);
    };
    return { home: ml('home'), away: ml('away') };
  }
  const wxEmoji = (event: Event, weather?: WxInfo) => {
    if (isIndoorEvent(event, weather)) return '🏟️';
    const code = weather?.icon || '';
    const d = (weather?.description || '').toLowerCase();
    if(code.startsWith('01')||/clear/.test(d)) return '☀️';
    if(code.startsWith('02')||/mainly|few/.test(d)) return '🌤️';
    if(code.startsWith('03')||code.startsWith('04')||/cloud/.test(d)) return '☁️';
    if(code.startsWith('09')||code.startsWith('10')||/rain|drizzle/.test(d)) return '🌧️';
    if(code.startsWith('11')||/thunder/.test(d)) return '⛈️';
    if(code.startsWith('13')||/snow/.test(d)) return '❄️';
    if(code.startsWith('50')||/fog|mist|haze/.test(d)) return '🌫️';
    return '🌡️';
  };

  // load odds once and rotate every 3s
  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch('/api/odds');
        const payload = await r.json().catch(() => ({}));
        const data: Event[] = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as any)?.events)
            ? (payload as any).events
            : [];
        if (!data.length && (payload as any)?.error) {
          console.warn('odds fetch returned error', (payload as any).error);
        }
        const now=new Date();
        // Upcoming sorted
        const upcoming = data.map(ev=>({ev,dt:new Date(ev.commence_time)}))
          .filter(x=> x.dt.getTime() >= now.getTime())
          .sort((a,b)=> a.dt.getTime() - b.dt.getTime());
        // Find this MNF (first Monday among upcoming)
        const firstMon = upcoming.find(x=> isMonET(x.ev.commence_time))?.dt || null;
        const start = now; let end: Date;
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
  },[isMonET]);
  useEffect(()=>{ const id=setInterval(()=> setRot(r=> (r+1) % Math.max(1, events.length)), 3000); return ()=>clearInterval(id); },[events.length]);
  useEffect(()=>{
    // prefetch weather for current card
    const ev=events[rot]; if(!ev) return; if(wx[ev.id]) return;
    (async()=>{
      try{
        const r=await fetch(`/api/weather?home=${encodeURIComponent(ev.home_team)}&kickoff=${encodeURIComponent(ev.commence_time)}`);
        const j=await r.json();
        setWx(prev=>({
          ...prev,
          [ev.id]: {
            icon: j?.icon ?? null,
            description: j?.description ?? null,
            temp_f: j?.temp_f ?? null,
            roof: j?.roof ?? null,
            expectedClosed: !!j?.expectedClosed,
            surface: j?.surface ?? null,
            stadium: j?.stadium ?? null,
          },
        }));
      }catch{}
    })();
  },[events,rot,wx]);

  useEffect(() => {
    // If already logged in, skip
    (async () => {
      try{ const r = await fetch('/api/auth/me'); if (r.ok) router.replace(next); }catch{}
    })();
  }, [next, router]);

  const authenticate = useCallback(async (emailValue: string, passwordValue: string): Promise<boolean> => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: emailValue, password: passwordValue }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return true;
    const payload = data as Record<string, unknown>;
    const message = typeof payload.error === 'string'
      ? String(payload.error)
      : 'Invalid credentials';
    throw new Error(message);
  }, []);

  const handleSubmit = useCallback(async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    if (!email || !password) {
      setErr('Email and password required');
      return;
    }
    setIsSubmitting(true);
    setErr(null);
    try {
      await authenticate(email, password);
      try {
        const changed = await router.push(next);
        if (!changed) {
          window.location.assign(next);
        }
      } catch {
        window.location.assign(next);
      }
    } catch (error: any) {
      setErr(error?.message || 'Login error');
    } finally {
      setIsSubmitting(false);
    }
  }, [authenticate, email, isSubmitting, next, password, router]);

  return (
    <div className="min-h-screen bg-cl-bg text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center" data-layer="auth">
        <a href="/" aria-label="Home" className="mb-6 block">
          <Image
            src="/logo-ice-script.svg"
            alt="The Cold Line"
            className="h-24 w-auto md:h-32 lg:h-40 drop-shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
            width={320}
            height={128}
            priority
          />
        </a>
        <div className="w-full bg-[#0f1720] border border-[#1b2735] rounded-xl p-6 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
          <div className="text-lg font-semibold mb-4">Sign in</div>
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1" htmlFor="login-email">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e=>setEmail(e.target.value)}
                autoFocus
                id="login-email"
                name="email"
                autoComplete="username"
                className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1" htmlFor="login-password">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e=>setPassword(e.target.value)}
                id="login-password"
                name="password"
                autoComplete="current-password"
                className="w-full bg-[#0e1520] border border-[#233041] rounded px-3 py-2 text-white"
              />
            </div>
            {err && <div className="text-sm text-rose-400">{err}</div>}
            <button
              type="submit"
              id="login-submit"
              data-testid="login-submit"
              disabled={isSubmitting || !email || !password}
              className="relative z-20 w-full mt-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 rounded px-3 py-2 font-semibold"
            >
              {isSubmitting ? 'Logging in…' : 'Log in'}
            </button>
          </form>
          <div className="mt-2 text-center">
            <Link href="/reset" className="text-xs text-cyan-300 underline">Forgot your password?</Link>
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
              const badgeNode = eventBadge(ev, info);
              const weatherIcon = wxEmoji(ev, info);
              const tempDisplay = info.temp_f!=null? `${info.temp_f}°F` : '—';
            return (
              <div className="mt-5 p-4 rounded-lg border border-[#233041] bg-[#0e1520]">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>{etTime(ev.commence_time)}</span>
                  <span className="inline-flex items-center gap-1">
                    {badgeNode}
                    {(() => {
                      const weatherLabel = weatherIcon === '🏟️' ? 'Indoor conditions' : null;
                      const weatherProps = weatherLabel
                        ? { role: 'img' as const, 'aria-label': weatherLabel, title: weatherLabel }
                        : { 'aria-hidden': true };
                      return <span {...weatherProps}>{weatherIcon}</span>;
                    })()}
                    <span>{tempDisplay}</span>
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
