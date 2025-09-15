import type { NextApiRequest, NextApiResponse } from "next";

type Outcome = { name: string; point?: number | null };
type Market = { key: string; outcomes: Outcome[] };
type Bookmaker = { key: string; markets: Market[] };
type Game = {
  id: string; sport_key: string; commence_time: string;
  home_team: string; away_team: string; bookmakers: Bookmaker[];
};

export type GameLine = {
  id: string; home: string; away: string; commenceTime: string;
  marketSpread: number | null; bookCount: number;
};

function avgHomeSpread(g: Game): { spread: number | null; books: number } {
  const vals: number[] = [];
  for (const b of g.bookmakers || []) {
    const s = b.markets.find(m => m.key === "spreads");
    if (!s) continue;
    const h = s.outcomes.find(o => o.name === g.home_team && typeof o.point === "number");
    const a = s.outcomes.find(o => o.name === g.away_team && typeof o.point === "number");
    if (h && typeof h.point === "number") vals.push(h.point);
    else if (!h && a && typeof a.point === "number") vals.push(-(a.point as number));
  }
  if (!vals.length) return { spread: null, books: 0 };
  const avg = vals.reduce((x, y) => x + y, 0) / vals.length;
  return { spread: Math.round(avg * 100) / 100, books: vals.length };
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<GameLine[] | { error: string }>
) {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) return res.status(200).json({ error: "missing ODDS_API_KEY" });

    const url = new URL("https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds");
    url.searchParams.set("regions", "us");
    url.searchParams.set("markets", "spreads");
    url.searchParams.set("oddsFormat", "american");
    url.searchParams.set("dateFormat", "iso");
    url.searchParams.set("apiKey", apiKey);

    const r = await fetch(url.toString(), { cache: "no-store" });
    if (!r.ok) return res.status(r.status).json({ error: `Odds API error ${r.status}` });
    const data = (await r.json()) as Game[];

    const out = data.map(g => {
      const { spread, books } = avgHomeSpread(g);
      return {
        id: g.id,
        home: g.home_team,
        away: g.away_team,
        commenceTime: g.commence_time,
        marketSpread: spread,
        bookCount: books
      };
    });
    res.status(200).json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
}
