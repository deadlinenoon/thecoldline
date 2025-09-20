import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get('start') || new Date().toISOString().slice(0, 10);
  const end = url.searchParams.get('end') || start;
  const base = String(process.env.BALLDONTLIE_ALL_ACCESS_BASE_URL || '');
  const key = String(process.env.BALLDONTLIE_API_KEY || '');

  const query = `${base.replace(/\/$/, '')}/nfl/games?start_date=${start}T00:00:00Z&end_date=${end}T23:59:59Z&status=pre`;
  const response = await fetch(query, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
  if (!response.ok) {
    return NextResponse.json({ error: `bld ${response.status}` }, { status: response.status });
  }
  const json = await response.json();
  return NextResponse.json(Array.isArray(json?.data) ? json.data : json);
}
