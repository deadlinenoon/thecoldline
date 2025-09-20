import { NextResponse } from 'next/server';

type TeamMeta = {
  city: string;
  stadium: string;
  roof: 'open' | 'closed' | 'retractable' | 'fixed' | 'outdoor';
  surface?: string | null;
  domeTeam?: boolean;
};

const TEAMS: Record<string, TeamMeta> = {
  BUF: { city: 'Orchard Park,US', stadium: 'Highmark Stadium', roof: 'outdoor', surface: 'A-Turf Titan' },
  MIA: { city: 'Miami Gardens,US', stadium: 'Hard Rock Stadium', roof: 'outdoor', surface: 'Tifway 419 Bermuda' },
  DAL: { city: 'Arlington,US', stadium: 'AT&T Stadium', roof: 'retractable', surface: 'Hellas Matrix', domeTeam: true },
  DET: { city: 'Detroit,US', stadium: 'Ford Field', roof: 'closed', surface: 'FieldTurf', domeTeam: true },
  HOU: { city: 'Houston,US', stadium: 'NRG Stadium', roof: 'retractable', surface: 'FieldTurf', domeTeam: true },
  IND: { city: 'Indianapolis,US', stadium: 'Lucas Oil Stadium', roof: 'retractable', surface: 'FieldTurf', domeTeam: true },
  MIN: { city: 'Minneapolis,US', stadium: 'U.S. Bank Stadium', roof: 'closed', surface: 'U-Speed', domeTeam: true },
  NO: { city: 'New Orleans,US', stadium: 'Caesars Superdome', roof: 'closed', surface: 'FieldTurf', domeTeam: true },
  LAR: { city: 'Inglewood,US', stadium: 'SoFi Stadium', roof: 'fixed', surface: 'Matrix Turf', domeTeam: true },
  LAC: { city: 'Inglewood,US', stadium: 'SoFi Stadium', roof: 'fixed', surface: 'Matrix Turf', domeTeam: true },
  ARI: { city: 'Glendale,US', stadium: 'State Farm Stadium', roof: 'retractable', surface: 'Tifway 419 Bermuda', domeTeam: true }
};

function isIndoor(meta?: TeamMeta, roofOverride?: string | null, expectedClosed?: boolean | null) {
  if (!meta) {
    return false;
  }
  const roof = (roofOverride || meta.roof || '').toLowerCase();
  if (roof === 'closed' || roof === 'fixed') {
    return true;
  }
  if (roof === 'retractable' && expectedClosed) {
    return true;
  }
  if (meta.domeTeam) {
    return true;
  }
  return false;
}

const NORMAL_TTL = 8 * 60 * 60; // 8h
const GAME_TTL = 10 * 60; // 10m
const GAME_WINDOW_HOURS = 8;

const cache = new Map<string, { exp: number; val: unknown }>();

function getCache(key: string) {
  const entry = cache.get(key);
  if (entry && entry.exp > Date.now()) {
    return entry.val;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, value: unknown, ttlSeconds: number) {
  cache.set(key, { exp: Date.now() + ttlSeconds * 1000, val: value });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const home = String(url.searchParams.get('home') || '').toUpperCase();
  const kickoff = url.searchParams.get('kickoff') || '';
  const expectedClosed = url.searchParams.get('expectedClosed') === 'true';
  if (!home) {
    return NextResponse.json({ error: 'home missing' }, { status: 400 });
  }

  const meta = TEAMS[home];
  if (isIndoor(meta, meta?.roof, expectedClosed)) {
    return NextResponse.json({
      icon: null,
      description: null,
      temp_f: null,
      roof: meta?.roof || 'closed',
      expectedClosed: true,
      surface: meta?.surface || null,
      stadium: meta?.stadium || null
    });
  }

  const now = Date.now();
  const kickoffMs = kickoff ? new Date(kickoff).getTime() : 0;
  const inGameWindow = kickoffMs > 0 && Math.abs(kickoffMs - now) <= (GAME_WINDOW_HOURS * 60 + 30) * 60 * 1000;
  const cacheKey = `wx:${home}:${kickoff ? new Date(kickoff).toISOString().slice(0, 13) : 'daily'}`;
  const cacheHit = getCache(cacheKey);
  if (cacheHit) {
    return NextResponse.json(cacheHit);
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY || '';
  const city = meta?.city || 'Chicago,US';
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=imperial`,
    { cache: 'no-store' }
  );
  if (!response.ok) {
    const fallback = {
      icon: null,
      description: null,
      temp_f: null,
      roof: meta?.roof || null,
      expectedClosed,
      surface: meta?.surface || null,
      stadium: meta?.stadium || null
    };
    setCache(cacheKey, fallback, inGameWindow ? GAME_TTL : NORMAL_TTL);
    return NextResponse.json(fallback);
  }
  const weather = await response.json();
  const payload = {
    icon: weather?.weather?.[0]?.icon ?? null,
    description: weather?.weather?.[0]?.description ?? null,
    temp_f: typeof weather?.main?.temp === 'number' ? Math.round(weather.main.temp) : null,
    wind_mph: typeof weather?.wind?.speed === 'number' ? Math.round(weather.wind.speed) : null,
    wind_deg: typeof weather?.wind?.deg === 'number' ? weather.wind.deg : null,
    roof: meta?.roof || null,
    expectedClosed,
    surface: meta?.surface || null,
    stadium: meta?.stadium || null
  };
  setCache(cacheKey, payload, inGameWindow ? GAME_TTL : NORMAL_TTL);
  return NextResponse.json(payload);
}
