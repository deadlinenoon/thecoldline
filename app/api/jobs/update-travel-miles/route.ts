import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getSeasonSchedule } from "../../../../libs/nfl/schedule";
import { buildTravelTable } from "../../../../libs/nfl/buildTravelTable";

function env(k: string) { return process.env[k]; }

async function writeUpstashJSON(key: string, json: unknown, ttlSec?: number) {
  const url = env('UPSTASH_REDIS_REST_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return false;
  const value = JSON.stringify(json);
  const ttl = typeof ttlSec === 'number' && ttlSec > 0 ? ttlSec : undefined;
  const setUrl = new URL(`${url.replace(/\/$/, '')}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`);
  if (ttl) setUrl.searchParams.set('EX', String(ttl));
  const res = await fetch(setUrl.toString(), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  return res.ok;
}

export async function GET(req: Request) {
  try {
    const nowNY = DateTime.now().setZone('America/New_York');
    const season = nowNY.year;
    const schedule = await getSeasonSchedule(season);
    let comingWeek = 1;
    const upcoming = schedule
      .map(r => ({ week: r.week, t: DateTime.fromISO(r.dateUTC) }))
      .filter(x => x.t >= nowNY.toUTC())
      .sort((a, b) => a.t.toMillis() - b.t.toMillis());
    if (upcoming.length > 0) comingWeek = Math.max(1, Math.min(18, upcoming[0].week || 1));

    const table = await buildTravelTable(season);
    const weekRows = table.filter(r => r.week === comingWeek);

    const payload = { season, week: comingWeek, count: weekRows.length, rows: weekRows };
    const wroteLatest = await writeUpstashJSON('travel:latest', payload);
    const wroteWeek = await writeUpstashJSON(`travel:week:${comingWeek}`, payload, 60 * 60 * 24 * 365);

    return NextResponse.json({ ok: true, week: comingWeek, rows: weekRows.length, wrote: wroteLatest && wroteWeek });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('/api/jobs/update-travel-miles error', e?.message || e);
    return NextResponse.json({ ok: false, error: 'job failed' }, { status: 500 });
  }
}

