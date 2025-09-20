import { NextResponse } from 'next/server';

export async function GET() {
  const base = 'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds';
  const key = process.env.ODDS_API_KEY || '';
  const url = `${base}?regions=us&markets=spreads,totals&dateFormat=iso&oddsFormat=american&apiKey=${key}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    return NextResponse.json({ error: `odds ${response.status}` }, { status: response.status });
  }
  const json = await response.json();
  return NextResponse.json(json);
}
