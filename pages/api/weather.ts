import type { NextApiRequest, NextApiResponse } from "next";
import { toAbbr } from "../../lib/nfl-teams";
import { STADIUMS } from "../../lib/stadiums";

type WxOut = { temp_f: number; wind_mph: number } & { error?: string };

async function forecastAt(lat: number, lon: number, iso: string): Promise<WxOut> {
  try {
    const kick = new Date(iso);
    if (!Number.isFinite(kick.getTime())) throw new Error("invalid kickoff");
    const base = new URL("https://api.open-meteo.com/v1/forecast");
    base.searchParams.set("latitude", String(lat));
    base.searchParams.set("longitude", String(lon));
    base.searchParams.set("hourly", "temperature_2m,wind_speed_10m");
    base.searchParams.set("temperature_unit", "fahrenheit");
    base.searchParams.set("windspeed_unit", "mph");
    base.searchParams.set("timezone", "UTC");
    const r = await fetch(base.toString(), { cache: "no-store", headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`wx HTTP ${r.status}`);
    const j: any = await r.json();
    const times: string[] = j?.hourly?.time || [];
    const temps: number[] = j?.hourly?.temperature_2m || [];
    const winds: number[] = j?.hourly?.wind_speed_10m || [];
    if (!Array.isArray(times) || !times.length) throw new Error("wx missing hourly");
    const targetISO = new Date(iso).toISOString().slice(0, 13) + ":00"; // hour resolution
    const idx = times.findIndex((t: string) => t.startsWith(targetISO.slice(0, 13)));
    const temp = idx >= 0 ? Number(temps[idx]) : Number(temps[0] ?? 0);
    const wind = idx >= 0 ? Number(winds[idx]) : Number(winds[0] ?? 0);
    return { temp_f: Number.isFinite(temp) ? temp : 0, wind_mph: Number.isFinite(wind) ? wind : 0 };
  } catch (e: any) {
    return { temp_f: 0, wind_mph: 0, error: e?.message || "weather error" };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<WxOut>) {
  try {
    const homeIn = toAbbr(String(req.query.home || ""));
    const kickoff = String(req.query.kickoff || "").trim();
    const st = STADIUMS[homeIn];
    if (!st || !kickoff) return res.status(400).json({ temp_f: 0, wind_mph: 0, error: "missing/invalid params" });
    const wx = await forecastAt(st.lat, st.lon, kickoff);
    return res.status(200).json(wx);
  } catch (e: any) {
    return res.status(200).json({ temp_f: 0, wind_mph: 0, error: e?.message || "weather handler error" });
  }
}
