import type { NextApiRequest, NextApiResponse } from "next";

type Outcome = { name: string; point?: number; price?: number };
type Market  = { key: string; outcomes: Outcome[] };
type Book    = { title: string; markets: Market[] };
export type Event = { id: string; commence_time: string; home_team: string; away_team: string; bookmakers: Book[] };
import { favoriteFromSpread } from "../../lib/odds";

const BASE = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/";
// Pull all US-region books; do not restrict bookmakers so we can show a full board
const QS = (k: string) =>
  `?regions=us&markets=spreads,h2h,totals&dateFormat=iso&oddsFormat=american&apiKey=${encodeURIComponent(k)}`;

async function pull(key?: string, cache: RequestCache = "default"): Promise<Event[]> {
  if (!key) throw { code: 500, msg: "Missing API key" };
  const r = await fetch(BASE + QS(key), { headers: { Accept: "application/json" }, cache });
  const txt = await r.text();
  if (!r.ok) throw { code: r.status, msg: txt || `Upstream ${r.status}` };
  return JSON.parse(txt) as Event[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const k1 = process.env.ODDS_API_KEY;
  const k2 = process.env.ODDS_API_KEY_2; // optional fallback
  const force = req.query.force === "1" || req.query.force === "true";
  try {
    let data: any[] = await pull(k1!, force ? "no-store" : "default").catch(async (e: any) => {
      if (e?.code === 401 || e?.code === 403) return pull(k2!, "no-store");
      throw e;
    });

    data = Array.isArray(data) ? data : [];

    data = data.map((ev: any) => {
      try {
        const pts: number[] = [];
        for (const b of ev.bookmakers || []) {
          const m = (b.markets || []).find((mm: any) => mm.key === "spreads");
          if (!m) continue;
          const h = (m.outcomes || []).find((o: any) => o.name === ev.home_team);
          const a = (m.outcomes || []).find((o: any) => o.name === ev.away_team);
          if (typeof h?.point === "number") {
            pts.push(h.point); // home spread as seen at book
          } else if (typeof a?.point === "number") {
            pts.push(-a.point); // convert away spread to home spread
          }
        }

        let homeSpread = 0;
        if (pts.length) {
          pts.sort((x, y) => x - y);
          const mid = Math.floor(pts.length / 2);
          homeSpread = pts.length % 2 ? pts[mid] : (pts[mid - 1] + pts[mid]) / 2;
        }

        const fav = favoriteFromSpread(homeSpread);
        return {
          ...ev,
          homeSpread: Number(homeSpread.toFixed(2)),
          favorite: fav.favorite,
          isPickEm: fav.isPickEm
        };
      } catch {
        return { ...ev, homeSpread: 0, favorite: null, isPickEm: true };
      }
    });

    res.setHeader("Cache-Control", force ? "no-store" : "s-maxage=60, stale-while-revalidate=30");
    res.status(200).json({ ok: true, events: data });
  } catch (e) {
    res.setHeader("Cache-Control", force ? "no-store" : "s-maxage=60, stale-while-revalidate=30");
    res.status(200).json({ ok: true, events: [], error: "odds_fetch_failed" });
  }
}
