import { env } from 'process';

type OddsOutcome = { name: string; point?: number | null };
type OddsMarket = { key: string; outcomes: OddsOutcome[] };
type OddsBookmaker = { key: string; markets: OddsMarket[] };
type OddsGame = {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
};

export type GameLine = {
  id: string;
  home: string;
  away: string;
  commenceTime: string;
  marketSpread: number | null;
  spreadBookCount: number;
  marketTotal: number | null;
  totalBookCount: number;
};

function averageHomeSpread(game: OddsGame): { spread: number | null; books: number } {
  const values: number[] = [];
  for (const bookmaker of game.bookmakers || []) {
    const market = bookmaker.markets?.find(m => m.key === 'spreads');
    if (!market) continue;
    const home = market.outcomes?.find(outcome => outcome.name === game.home_team && typeof outcome.point === 'number');
    const away = market.outcomes?.find(outcome => outcome.name === game.away_team && typeof outcome.point === 'number');
    if (typeof home?.point === 'number') values.push(home.point);
    else if (!home && typeof away?.point === 'number') values.push(-(away.point as number));
  }

  if (!values.length) return { spread: null, books: 0 };
  const avg = values.reduce((acc, value) => acc + value, 0) / values.length;
  return { spread: Math.round(avg * 100) / 100, books: values.length };
}

function averageTotal(game: OddsGame): { total: number | null; books: number } {
  const values: number[] = [];
  for (const bookmaker of game.bookmakers || []) {
    const market = bookmaker.markets?.find(m => m.key === 'totals');
    if (!market) continue;
    const over = market.outcomes?.find(outcome =>
      typeof outcome.name === 'string' && outcome.name.toLowerCase() === 'over' && typeof outcome.point === 'number'
    );
    if (typeof over?.point === 'number') values.push(over.point);
  }

  if (!values.length) return { total: null, books: 0 };
  const avg = values.reduce((acc, value) => acc + value, 0) / values.length;
  return { total: Math.round(avg * 100) / 100, books: values.length };
}

function filterByDate(games: OddsGame[], dateISO?: string): OddsGame[] {
  if (!dateISO) return games;
  const target = new Date(dateISO);
  if (!Number.isFinite(target.getTime())) return games;
  const key = target.toISOString().slice(0, 10);
  return games.filter(game => (game.commence_time || '').slice(0, 10) === key);
}

export async function getLegacyGames(dateISO?: string): Promise<GameLine[]> {
  const apiKey = env.ODDS_API_KEY;
  if (!apiKey) throw new Error('missing ODDS_API_KEY');

  const url = new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds');
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'spreads,totals');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('dateFormat', 'iso');
  url.searchParams.set('apiKey', apiKey);

  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Odds API error ${response.status}`);
  }
  const payload = (await response.json()) as OddsGame[];
  const filtered = filterByDate(payload, dateISO);

  return filtered.map(game => {
    const { spread, books: spreadBooks } = averageHomeSpread(game);
    const { total, books: totalBooks } = averageTotal(game);
    return {
      id: game.id,
      home: game.home_team,
      away: game.away_team,
      commenceTime: game.commence_time,
      marketSpread: spread,
      spreadBookCount: spreadBooks,
      marketTotal: total,
      totalBookCount: totalBooks,
    };
  });
}

export async function getGames(dateISO?: string): Promise<GameLine[]> {
  return getLegacyGames(dateISO);
}

export default getGames;
