import type { NextApiRequest, NextApiResponse } from "next";
import { rget, rsetex } from "@/lib/redis";
import { buildTravelMetrics, travelCacheKey, TRAVEL_TTL_SECONDS } from "@/lib/travel/metrics";
import { toAbbr } from "@/lib/nfl-teams";

const nz = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const season = Number(req.query.season ?? new Date().getFullYear());
  const week = Number(req.query.week ?? req.query.w ?? 1);
  const home = toAbbr(String(req.query.home ?? ""));
  const away = toAbbr(String(req.query.away ?? ""));

  const cacheKey = travelCacheKey(season, week);
  let cache = await rget(cacheKey);

  if (!cache || !cache[home] || !cache[away]) {
    try {
      const { metrics } = await buildTravelMetrics(season, week);
      cache = metrics;
      await rsetex(cacheKey, TRAVEL_TTL_SECONDS, metrics);
    } catch {
      cache = cache ?? {};
    }
  }

  const homePack = cache?.[home] ?? {};
  const awayPack = cache?.[away] ?? {};

  const body = {
    home: {
      milesSinceLastGame: nz(homePack.milesSinceLastGame),
      milesSinceLastHome: nz(homePack.milesSinceLastHome),
      milesSeasonToDate: nz(homePack.milesSeasonToDate),
      tzDiff: nz(homePack.tzDiff),
    },
    away: {
      milesSinceLastGame: nz(awayPack.milesSinceLastGame),
      milesSinceLastHome: nz(awayPack.milesSinceLastHome),
      milesSeasonToDate: nz(awayPack.milesSeasonToDate),
      tzDiff: nz(awayPack.tzDiff),
    },
  };

  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=600, stale-while-revalidate=3600");
  return res.status(200).json(body);
}
