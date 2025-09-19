import type { NextApiRequest, NextApiResponse } from "next";

import { favoriteFromSpread } from '@/lib/odds';

type Outcome = { name: string; point?: number; price?: number };
type Market = { key: string; outcomes: Outcome[] };
type Book = { title: string; markets: Market[] };
export type Event = { id: string; commence_time: string; home_team: string; away_team: string; bookmakers: Book[] };
type OddsOut = { events: Event[]; error?: string };

const BASE = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/";
const QS = (k: string) =>
  `?regions=us&markets=spreads,h2h,totals&dateFormat=iso&oddsFormat=american&apiKey=${encodeURIComponent(k)}`;

const CACHE = new Map<string, { ts: number; data: OddsOut }>();
const TTL = 60 * 1000;

async function pull(key?: string, cache: RequestCache = "default"): Promise<Event[]> {
  if (!key) throw { code: 500, msg: "Missing API key" };
  const r = await fetch(BASE + QS(key), { headers: { Accept: "application/json" }, cache });
  const txt = await r.text();
  if (!r.ok) throw { code: r.status, msg: txt || `Upstream ${r.status}` };
  return JSON.parse(txt) as Event[];
}

function normalizeEvents(payload: unknown): Event[] {
  if (Array.isArray(payload)) return payload as Event[];
  if (payload && typeof payload === "object" && Array.isArray((payload as any).events)) {
    return (payload as any).events as Event[];
  }
  return [];
}

function augmentEvents(events: Event[]): Event[] {
  return events.map(ev => {
    try {
      const spreads: number[] = [];
      for (const book of ev.bookmakers || []) {
        const market = (book.markets || []).find(m => m.key === "spreads");
        if (!market) continue;
        const home = (market.outcomes || []).find(o => o.name === ev.home_team);
        const away = (market.outcomes || []).find(o => o.name === ev.away_team);
        if (typeof home?.point === "number") {
          spreads.push(home.point);
        } else if (typeof away?.point === "number") {
          spreads.push(-away.point);
        }
      }

      let homeSpread = 0;
      if (spreads.length) {
        spreads.sort((a, b) => a - b);
        const mid = Math.floor(spreads.length / 2);
        homeSpread = spreads.length % 2 ? spreads[mid] : (spreads[mid - 1] + spreads[mid]) / 2;
      }

      const fav = favoriteFromSpread(homeSpread);
      return {
        ...ev,
        homeSpread: Number(homeSpread.toFixed(2)),
        favorite: fav.favorite,
        isPickEm: fav.isPickEm,
      } as Event & { homeSpread: number; favorite: string | null; isPickEm: boolean };
    } catch {
      return { ...ev, homeSpread: 0, favorite: null, isPickEm: true } as Event & {
        homeSpread: number;
        favorite: string | null;
        isPickEm: boolean;
      };
    }
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<OddsOut>) {
  const k1 = process.env.ODDS_API_KEY;
  const k2 = process.env.ODDS_API_KEY_2;
  const force = req.query.force === "1" || req.query.force === "true";
  const cacheKey = "today";
  const now = Date.now();

  const cached = !force ? CACHE.get(cacheKey) : undefined;
  if (cached && now - cached.ts < TTL) {
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json(cached.data);
  }

  if (!k1 && !k2) {
    const data: OddsOut = { events: [], error: "missing ODDS_API_KEY" };
    CACHE.set(cacheKey, { ts: now, data });
    res.setHeader("Cache-Control", force ? "no-store" : "s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json(data);
  }

  try {
    const payload = await pull(k1!, force ? "no-store" : "default").catch(async (err: any) => {
      if ((err?.code === 401 || err?.code === 403) && k2) {
        return pull(k2, "no-store");
      }
      throw err;
    });

    const events = augmentEvents(normalizeEvents(payload));
    const data: OddsOut = { events };
    CACHE.set(cacheKey, { ts: now, data });
    res.setHeader("Cache-Control", force ? "no-store" : "s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json(data);
  } catch (error: any) {
    const message = typeof error?.msg === "string" && error.msg.trim()
      ? error.msg
      : typeof error?.message === "string" && error.message.trim()
      ? error.message
      : "odds fetch failed";
    const data: OddsOut = { events: [], error: message };
    CACHE.set(cacheKey, { ts: now, data });
    res.setHeader("Cache-Control", force ? "no-store" : "s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json(data);
  }
}
