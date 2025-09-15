import type { NextApiRequest, NextApiResponse } from "next";
import { TEAM_CITY } from "@/lib/nflTeams";

type Wx = { city: string; tempF: number; windMph: number; humidity: number; conditions: string; icon: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Wx | { error: string }>
) {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENWEATHERMAP_API_KEY" });

    const team = (req.query.team as string) || "";
    if (!TEAM_CITY[team]) return res.status(400).json({ error: "team query required. use full team name" });

    const city = TEAM_CITY[team].city;
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("q", city);
    url.searchParams.set("appid", apiKey);
    url.searchParams.set("units", "imperial");

    const r = await fetch(url.toString(), { cache: "no-store" });
    if (!r.ok) return res.status(r.status).json({ error: `OpenWeather error ${r.status}` });
    const j = await r.json();

    res.status(200).json({
      city,
      tempF: j.main?.temp ?? 0,
      windMph: j.wind?.speed ?? 0,
      humidity: j.main?.humidity ?? 0,
      conditions: j.weather?.[0]?.main ?? "N/A",
      icon: j.weather?.[0]?.icon ?? "01d"
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
}

