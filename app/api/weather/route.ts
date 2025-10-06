import { NextResponse } from 'next/server';
import STADIUMS from '@/libs/nfl/stadiums';
import { teamAbbr } from '@/lib/abbr';

type RoofType = 'open' | 'closed' | 'retractable';

type TeamMeta = {
  teamName: string;
  stadium: string | null;
  cityQuery: string;
  lat: number;
  lon: number;
  roof: RoofType;
};

const TEAM_LOOKUP: Map<string, TeamMeta> = (() => {
  const map = new Map<string, TeamMeta>();
  for (const [teamName, info] of Object.entries(STADIUMS)) {
    const abbr = teamAbbr(teamName).toUpperCase();
    const meta: TeamMeta = {
      teamName,
      stadium: info.name,
      cityQuery: info.city.replace(/,\s*/g, ',') + ',US',
      lat: info.lat,
      lon: info.lon,
      roof: info.roof === 'dome' ? 'closed' : info.roof,
    };
    map.set(teamName.toUpperCase(), meta);
    map.set(abbr, meta);
    if (abbr === 'WSH') {
      map.set('WAS', meta);
    }
  }
  return map;
})();

function resolveTeamMeta(input: string | null | undefined): TeamMeta | null {
  if (!input) return null;
  const key = input.trim().toUpperCase();
  return TEAM_LOOKUP.get(key) ?? null;
}

function isIndoor(meta: TeamMeta | null, expectedClosed?: boolean | null) {
  if (!meta) return false;
  if (meta.roof === 'closed') return true;
  if (meta.roof === 'retractable' && expectedClosed) return true;
  return false;
}

type WeatherSample = {
  icon: string | null;
  description: string | null;
  temp_f: number | null;
  wind_mph: number | null;
  wind_deg: number | null;
  pop: number | null;
};

const FORECAST_ENDPOINT = process.env.OPENWEATHERMAP_FORECAST_URL || process.env.NEXT_PUBLIC_OPENWEATHERMAP_FORECAST_URL || 'https://api.openweathermap.org/data/2.5/forecast';
const CURRENT_ENDPOINT = process.env.OPENWEATHERMAP_BASE_URL || process.env.NEXT_PUBLIC_OPENWEATHERMAP_BASE_URL || 'https://api.openweathermap.org/data/2.5/weather';

async function fetchForecastWeather(meta: TeamMeta, kickoffMs: number, apiKey: string): Promise<WeatherSample | null> {
  try {
    const url = new URL(FORECAST_ENDPOINT);
    url.searchParams.set('lat', meta.lat.toString());
    url.searchParams.set('lon', meta.lon.toString());
    url.searchParams.set('appid', apiKey);
    url.searchParams.set('units', 'imperial');

    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    const json = await response.json();
    const entries: Array<any> = Array.isArray(json?.list) ? json.list : [];
    if (!entries.length) return null;

    let bestEntry: any = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const entry of entries) {
      const ts = typeof entry?.dt === 'number' ? entry.dt * 1000 : NaN;
      if (!Number.isFinite(ts)) continue;
      const delta = Math.abs(ts - kickoffMs);
      if (delta < bestDelta) {
        bestEntry = entry;
        bestDelta = delta;
      }
    }

    // If kickoff is outside the forecast window (> ~6h difference), return null so we can fall back to current conditions.
    if (!bestEntry || bestDelta > 6 * 60 * 60 * 1000) {
      return null;
    }

    const weatherInfo = Array.isArray(bestEntry.weather) ? bestEntry.weather[0] : null;
    return {
      icon: weatherInfo?.icon ?? null,
      description: weatherInfo?.description ?? null,
      temp_f: typeof bestEntry?.main?.temp === 'number' ? Math.round(bestEntry.main.temp) : null,
      wind_mph: typeof bestEntry?.wind?.speed === 'number' ? Math.round(bestEntry.wind.speed) : null,
      wind_deg: typeof bestEntry?.wind?.deg === 'number' ? bestEntry.wind.deg : null,
      pop: typeof bestEntry?.pop === 'number' ? Math.max(0, Math.min(1, bestEntry.pop)) : null,
    };
  } catch {
    return null;
  }
}

async function fetchCurrentWeather(meta: TeamMeta, apiKey: string): Promise<WeatherSample> {
  try {
    const url = new URL(CURRENT_ENDPOINT);
    url.searchParams.set('lat', meta.lat.toString());
    url.searchParams.set('lon', meta.lon.toString());
    url.searchParams.set('appid', apiKey);
    url.searchParams.set('units', 'imperial');

    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('weather fetch failed');
    }
    const json = await response.json();
    const weatherInfo = Array.isArray(json?.weather) ? json.weather[0] : null;
    return {
      icon: weatherInfo?.icon ?? null,
      description: weatherInfo?.description ?? null,
      temp_f: typeof json?.main?.temp === 'number' ? Math.round(json.main.temp) : null,
      wind_mph: typeof json?.wind?.speed === 'number' ? Math.round(json.wind.speed) : null,
      wind_deg: typeof json?.wind?.deg === 'number' ? json.wind.deg : null,
      pop: null,
    };
  } catch {
    return {
      icon: null,
      description: null,
      temp_f: null,
      wind_mph: null,
      wind_deg: null,
      pop: null,
    };
  }
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
  const homeParam = String(url.searchParams.get('home') || '').toUpperCase();
  const kickoff = url.searchParams.get('kickoff') || '';
  const expectedClosed = url.searchParams.get('expectedClosed') === 'true';
  if (!homeParam) {
    return NextResponse.json({ error: 'home missing' }, { status: 400 });
  }

  const meta = resolveTeamMeta(homeParam);

  if (isIndoor(meta, expectedClosed)) {
    return NextResponse.json({
      icon: null,
      description: null,
      temp_f: null,
      wind_mph: null,
      wind_deg: null,
      pop: null,
      roof: meta?.roof ?? 'closed',
      expectedClosed: true,
      stadium: meta?.stadium ?? null,
      team: meta?.teamName ?? null,
    });
  }

  const fallbackMeta: TeamMeta = meta ?? {
    teamName: homeParam,
    stadium: null,
    cityQuery: 'Chicago,US',
    lat: 41.8781,
    lon: -87.6298,
    roof: 'open',
  };

  const now = Date.now();
  const kickoffMs = kickoff ? new Date(kickoff).getTime() : Number.NaN;
  const hasValidKickoff = Number.isFinite(kickoffMs);
  const inGameWindow = hasValidKickoff && Math.abs(kickoffMs - now) <= (GAME_WINDOW_HOURS * 60 + 30) * 60 * 1000;
  const cacheKey = `wx:${fallbackMeta.teamName || homeParam}:${hasValidKickoff ? new Date(kickoffMs).toISOString().slice(0, 13) : 'daily'}`;
  const cacheHit = getCache(cacheKey);
  if (cacheHit) {
    return NextResponse.json(cacheHit);
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY || process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({
      error: 'weather api key missing',
      roof: fallbackMeta.roof,
      expectedClosed,
      stadium: fallbackMeta.stadium ?? null,
      team: fallbackMeta.teamName ?? null,
    }, { status: 503 });
  }

  const forecast = hasValidKickoff
    ? await fetchForecastWeather(fallbackMeta, kickoffMs as number, apiKey)
    : null;

  const weatherPayload = forecast ?? await fetchCurrentWeather(fallbackMeta, apiKey);

  const payload = {
    icon: weatherPayload.icon,
    description: weatherPayload.description,
    temp_f: weatherPayload.temp_f,
    wind_mph: weatherPayload.wind_mph,
    wind_deg: weatherPayload.wind_deg,
    pop: weatherPayload.pop,
    roof: fallbackMeta.roof,
    expectedClosed,
    stadium: fallbackMeta.stadium ?? null,
    team: fallbackMeta.teamName ?? null,
  };

  setCache(cacheKey, payload, inGameWindow ? GAME_TTL : NORMAL_TTL);
  return NextResponse.json(payload);
}
