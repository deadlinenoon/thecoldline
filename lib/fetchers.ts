export type BLTeam = { id: number; abbreviation: string; name: string; location: string; full_name: string };
export type BLGame = {
  id: number;
  season: number;
  week: number;
  date: string;
  status: string;
  venue?: string | null;
  home_team: BLTeam;
  away_team: BLTeam;
};

const BLD_BASE =
  process.env.BALLDONTLIE_ALL_ACCESS_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_BALLEDONTLIE_BASE_URL?.trim() ||
  'https://all-access.balldontlie.io/v1';
const ODDS_BASE = process.env.NEXT_PUBLIC_ODDS_API_BASE_URL || "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds";
const ODDS_KEY = process.env.ODDS_API_KEY || process.env.ODDS_API_KEY_2;

export async function fetchSlate(startISO: string, endISO: string) {
  const base = BLD_BASE.replace(/\/+$/, '');
  const authKey = process.env.BALLDONTLIE_API_KEY || process.env.BALLDONTLIE_ALL_ACCESS_KEY || process.env.ALLSPORTS_API_KEY;
  if (!authKey) throw new Error('BALDONTLIE API key missing');
  const url = `${base}/sports/nfl/games?start_date=${encodeURIComponent(startISO)}&end_date=${encodeURIComponent(endISO)}&status=pre`;
  const r = await fetch(url, {
    headers: { Authorization: authKey.startsWith('Bearer ') ? authKey : `Bearer ${authKey}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`balldontlie ${r.status}`);
  const j = await r.json();
  return j.data as BLGame[];
}

export type OddsOutcome = { name: string; point: number; price: number };
export type OddsMarket = { key: "spreads" | "totals"; outcomes: OddsOutcome[] };
export type OddsBook = { key: string; title: string; markets: OddsMarket[] };
export type OddsGame = { home_team: string; away_team: string; commence_time: string; bookmakers: OddsBook[] };

export async function fetchOdds() {
  const url = `${ODDS_BASE}?regions=us&markets=spreads,totals&dateFormat=iso&oddsFormat=american&apiKey=${ODDS_KEY}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`odds ${r.status}`);
  return await r.json() as OddsGame[];
}
