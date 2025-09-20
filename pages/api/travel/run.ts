import type { NextApiRequest, NextApiResponse } from "next";
import { rget, rsetex } from "@/lib/redis";
import { buildTravelMetrics, travelCacheKey, travelTableKey, TRAVEL_TTL_SECONDS, determineTargetWeek } from "@/lib/travel/metrics";

function isVercelCron(req: NextApiRequest) {
  const headers = req.headers ?? {};
  const ua = String(headers["user-agent"] ?? "");
  return Boolean(headers["x-vercel-cron"] || headers["x-vercel-id"] || ua.includes("Vercel-Cron"));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const envSecret = String(process.env.TRAVEL_CRON_SECRET ?? "");
  const querySecret = String(req.query.secret ?? "").trim();
  const authorized = (envSecret && querySecret && querySecret === envSecret) || isVercelCron(req);
  if (!authorized) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const season = Number(req.query.season ?? new Date().getFullYear());
  const requestedWeek = req.query.week ? Number(req.query.week) : null;
  const force = String(req.query.force ?? "0") === "1";

  try {
    const targetWeek = requestedWeek && requestedWeek > 0
      ? requestedWeek
      : await determineTargetWeek(season);
    const cacheCheckKey = travelCacheKey(season, targetWeek);
    if (!force) {
      const existing = await rget(cacheCheckKey);
      if (existing) {
        return res.status(200).json({ ok: true, season, week: targetWeek, note: "already populated" });
      }
    }

    const { metrics, table, week } = await buildTravelMetrics(season, targetWeek);
    const cacheKey = travelCacheKey(season, week);

    await Promise.all([
      rsetex(cacheKey, TRAVEL_TTL_SECONDS, metrics),
      rsetex(travelTableKey(season), TRAVEL_TTL_SECONDS, table),
    ]);

     
    console.log("[travel:run] ok", new Date().toISOString());
     
    console.log("[travel/run] refreshed", { season, week, teams: Object.keys(metrics).length });

    return res.status(200).json({ ok: true, season, week, teams: Object.keys(metrics).length });
  } catch (error: any) {
     
    console.error("[travel/run] failure", error?.message || error);
    return res.status(500).json({ ok: false, error: error?.message || "travel run failure" });
  }
}
