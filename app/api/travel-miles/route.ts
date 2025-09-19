import { NextResponse } from "next/server";
import { buildTravelMetrics, travelTableKey } from "@/lib/travel/metrics";
import { rget, rsetex } from "@/lib/redis";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = Number(searchParams.get("season") || new Date().getUTCFullYear());

  try {
    const tableKey = travelTableKey(season);
    let rows = await rget(tableKey);

    if (!Array.isArray(rows) || rows.length === 0) {
      const { table } = await buildTravelMetrics(season, null);
      rows = Array.isArray(table) ? table : [];
      if (rows.length) {
        await rsetex(tableKey, 60 * 60 * 24, rows);
      }
    }

    return NextResponse.json({ ok: true, season, count: Array.isArray(rows) ? rows.length : 0, rows: rows ?? [] });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("/api/travel-miles error", e?.message || e);
    return NextResponse.json({ ok: false, error: "travel-metrics-missing", season, rows: [] }, { status: 200 });
  }
}
