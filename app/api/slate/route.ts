import { NextResponse } from 'next/server';
import { getAllAccessConfig } from '@/lib/env';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get('start') || new Date().toISOString().slice(0, 10);
  const end = url.searchParams.get('end') || start;
  const { baseUrl, apiKey } = getAllAccessConfig();
  if (!apiKey) {
    return NextResponse.json({ error: 'All-Access API key missing' }, { status: 500 });
  }

  const normalizedBase = baseUrl.replace(/\/$/, '');
  const isSportsScoped = normalizedBase.includes('/sports/');
  const endpoint = isSportsScoped
    ? `${normalizedBase}/games`
    : `${normalizedBase}/sports/nfl/games`;
  const query = `${endpoint}?start_date=${start}T00:00:00Z&end_date=${end}T23:59:59Z&status=pre`;
  const authHeader = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;

  const response = await fetch(query, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    return NextResponse.json({ error: `all-access ${response.status}` }, { status: response.status });
  }
  const json = await response.json();
  const data = Array.isArray(json?.data) ? json.data : json;
  return NextResponse.json(data);
}
