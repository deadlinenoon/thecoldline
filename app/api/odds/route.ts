import { NextResponse } from 'next/server';

const DEFAULT_ODDS_BASE = 'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds';

export async function GET() {
  const key =
    process.env.ODDS_API_KEY ||
    process.env.ODDS_API_KEY_2 ||
    process.env.NEXT_PUBLIC_ODDS_API_KEY ||
    '';
  if (!key) {
    return NextResponse.json({ error: 'odds api key missing' }, { status: 503 });
  }

  const baseCandidate =
    process.env.NEXT_PUBLIC_ODDS_API_BASE_URL ||
    process.env.ODDS_API_BASE_URL ||
    DEFAULT_ODDS_BASE;

  let requestUrl: URL;
  try {
    requestUrl = new URL(baseCandidate);
  } catch {
    requestUrl = new URL(DEFAULT_ODDS_BASE);
  }

  requestUrl.searchParams.set('regions', 'us');
  requestUrl.searchParams.set('markets', 'spreads,totals,h2h');
  requestUrl.searchParams.set('dateFormat', 'iso');
  requestUrl.searchParams.set('oddsFormat', 'american');
  requestUrl.searchParams.set('apiKey', key);

  const response = await fetch(requestUrl.toString(), { cache: 'no-store' });
  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: `odds ${response.status}`, detail: detail.slice(0, 200) },
      { status: response.status }
    );
  }
  const json = await response.json();
  return NextResponse.json(json);
}
