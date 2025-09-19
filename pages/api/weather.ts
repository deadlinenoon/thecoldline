import type { NextApiRequest, NextApiResponse } from "next";
import { toAbbr } from "../../lib/nfl-teams";
import { STADIUMS } from "../../lib/stadiums";

type WxOut = { temp_f: number; wind_mph: number; wind_deg: number | null; error?: string };

const CACHE = new Map<string, { ts: number; data: WxOut }>();
const TTL = 10 * 60 * 1000;

const DEFAULT_WX: WxOut = { temp_f: 0, wind_mph: 0, wind_deg: null };

function normalizeQueryParam(param: string | string[] | undefined): string {
  if (!param) return "";
  return (Array.isArray(param) ? param[0] : param) ?? "";
}

async function fetchWeather(lat: number, lon: number, kickoffIso: string): Promise<WxOut> {
  const kickoffDate = new Date(kickoffIso);
  if (!Number.isFinite(kickoffDate.getTime())) throw new Error("invalid kickoff");

  const base = new URL("https://api.open-meteo.com/v1/forecast");
  base.searchParams.set("latitude", String(lat));
  base.searchParams.set("longitude", String(lon));
  base.searchParams.set("hourly", "temperature_2m,wind_speed_10m,wind_direction_10m");
  base.searchParams.set("temperature_unit", "fahrenheit");
  base.searchParams.set("windspeed_unit", "mph");
  base.searchParams.set("timezone", "UTC");

  const response = await fetch(base.toString(), { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`wx HTTP ${response.status}`);

  const payload: any = await response.json();
  const times: string[] = payload?.hourly?.time || [];
  const temps: number[] = payload?.hourly?.temperature_2m || [];
  const winds: number[] = payload?.hourly?.wind_speed_10m || [];
  const dirs: number[] = payload?.hourly?.wind_direction_10m || [];
  if (!Array.isArray(times) || !times.length) throw new Error("wx missing hourly");

  const targetHour = kickoffDate.toISOString().slice(0, 13);
  const idx = times.findIndex((t: string) => typeof t === "string" && t.startsWith(targetHour));

  const pick = (arr: number[], fallbackIndex = 0): number | null => {
    const raw = idx >= 0 ? arr[idx] : arr[fallbackIndex] ?? null;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    return raw;
  };

  const temp = pick(temps) ?? 0;
  const wind = pick(winds) ?? 0;
  const deg = pick(dirs);

  return {
    temp_f: temp,
    wind_mph: wind,
    wind_deg: typeof deg === "number" ? deg : null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<WxOut>) {
  const homeRaw = normalizeQueryParam(req.query.home).trim();
  const awayRaw = normalizeQueryParam(req.query.away).trim();
  const kickoffRaw = normalizeQueryParam(req.query.kickoff).trim();

  if (!homeRaw || !awayRaw || !kickoffRaw) {
    return res
      .status(400)
      .json({ ...DEFAULT_WX, error: "missing/invalid params" });
  }

  const homeAbbr = toAbbr(homeRaw);
  const awayAbbr = toAbbr(awayRaw);
  const kickoffDate = new Date(kickoffRaw);
  const stadium = STADIUMS[homeAbbr];

  if (!stadium || !homeAbbr || !awayAbbr || !Number.isFinite(kickoffDate.getTime())) {
    return res
      .status(400)
      .json({ ...DEFAULT_WX, error: "missing/invalid params" });
  }

  const cacheKey = `${homeAbbr}|${awayAbbr}|${kickoffDate.toISOString()}`;
  const now = Date.now();
  const cached = CACHE.get(cacheKey);
  if (cached && now - cached.ts < TTL) {
    return res.status(200).json(cached.data);
  }

  if (!process.env.OPENWEATHERMAP_API_KEY) {
    const data: WxOut = { ...DEFAULT_WX, error: "OPENWEATHERMAP_API_KEY missing" };
    CACHE.set(cacheKey, { ts: now, data });
    return res.status(200).json(data);
  }

  try {
    const data = await fetchWeather(stadium.lat, stadium.lon, kickoffDate.toISOString());
    CACHE.set(cacheKey, { ts: now, data });
    return res.status(200).json(data);
  } catch (error: any) {
    const message = typeof error?.message === "string" && error.message.trim() ? error.message : "weather fetch failed";
    const data: WxOut = { ...DEFAULT_WX, error: message };
    CACHE.set(cacheKey, { ts: now, data });
    return res.status(200).json(data);
  }
}
