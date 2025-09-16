import { NextResponse } from "next/server";
import { buildTravelTable } from "../../../libs/nfl/buildTravelTable";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const season = Number(searchParams.get("season") || "2025");
    const rows = await buildTravelTable(season);
    return NextResponse.json({ season, count: rows.length, rows });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("/api/travel-miles error", e?.message || e);
    return NextResponse.json({ error: "failed to build travel miles" }, { status: 500 });
  }
}

