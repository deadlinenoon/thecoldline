import type { NextApiRequest, NextApiResponse } from "next";
import { favoriteFromSpread } from "../../lib/odds";
import { logWarn } from "../../lib/logs";

type Settle<T> = Promise<{
  ok: boolean;
  value?: T;
  error?: string;
  rateProtected?: boolean;
}>;

const CACHE = new Map<string, { ts: number; data: any }>();
const INFLIGHT = new Map<string, { ts: number; p: Promise<any> }>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const COALESCE_MS = 2000; // 2 seconds

async function settle<T>(p: Promise<Response>): Settle<T> {
  try {
    const r = await p;
    const j = await r.json();
    if (!r.ok) return { ok: false, error: j?.error || `HTTP ${r.status}` };
    return { ok: true, value: j, rateProtected: !!j?.rateProtected };
  } catch (e: any) {
    return { ok: false, error: e?.message || "fetch error" };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const home = String(req.query.home || "").trim();
    const away = String(req.query.away || "").trim();
    const kickoff = String(req.query.kickoff || "").trim();
    const force = String(req.query.force || "") === '1';
    if (!home || !away || !kickoff) return res.status(400).json({ error: "Missing home/away/kickoff" });

    const key = `agent:${home}|${away}|${kickoff}`;
    const now = Date.now();

    // Optional cache-bust operation
    if (req.method === 'POST' && (String(req.query.bust||'').trim()==='1' || String((req.body as any)?.bust||'').trim()==='1')){
      CACHE.delete(key);
      INFLIGHT.delete(key);
      return res.status(200).json({ ok:true, busted:true });
    }
    const cached = CACHE.get(key);
    if (!force) {
      if (cached && now - cached.ts < TTL_MS) {
        return res.status(200).json({ ok: true, rateProtected: true, ...cached.data });
      }
      const inflight = INFLIGHT.get(key);
      if (inflight && now - inflight.ts < COALESCE_MS) {
        const data = await inflight.p;
        return res.status(200).json({ ok: true, rateProtected: true, ...data });
      }
    }

    const proto = (req.headers["x-forwarded-proto"] as string) || "http";
    const host = req.headers.host;
  const base = `${proto}://${host}`;

    // Helper to safely fetch JSON with slice-specific error
    async function safeJson(path: string, slice: string): Promise<{ data: any; rateProtected?: boolean }> {
      try {
        const r = await fetch(path);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return { data: j, rateProtected: !!j?.rateProtected };
      } catch (e: any) {
        return { data: { error: `${slice} fetch failed` } } as any;
      }
    }

    const promise = (async () => {
      let rateProtected = false;
      const data: any = {};

      // Fire requests in parallel
      const [oddsResp, weatherResp, injuriesResp, playsResp, travelResp, redzoneResp, h2hResp, notesResp, consensusResp, movHResp, movAResp] = await Promise.all([
        safeJson(`${base}/api/odds`, 'odds'),
        safeJson(`${base}/api/weather?home=${encodeURIComponent(home)}&kickoff=${encodeURIComponent(kickoff)}`, 'weather'),
        safeJson(`${base}/api/injuries?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`, 'injuries'),
        safeJson(`${base}/api/plays?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`, 'plays'),
        safeJson(`${base}/api/travel?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`, 'travel'),
        safeJson(`${base}/api/redzone?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`, 'redzone'),
        safeJson(`${base}/api/h2h?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`, 'h2h'),
        safeJson(`${base}/api/notes?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`, 'notes'),
        safeJson(`${base}/api/consensus?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`, 'consensus'),
        safeJson(`${base}/api/mov?team=${encodeURIComponent(home)}&kickoff=${encodeURIComponent(kickoff)}`, 'movHome'),
        safeJson(`${base}/api/mov?team=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`, 'movAway'),
      ]);

      // rate-limit aggregation flag
      rateProtected = !!(
        oddsResp.rateProtected || weatherResp.rateProtected || injuriesResp.rateProtected || playsResp.rateProtected ||
        travelResp.rateProtected || redzoneResp.rateProtected || h2hResp.rateProtected || notesResp.rateProtected ||
        consensusResp.rateProtected || movHResp.rateProtected || movAResp.rateProtected
      );

      // Odds: pick the matching game, compute favorite from homeSpread sign
      const evts = Array.isArray(oddsResp.data) ? oddsResp.data : (Array.isArray(oddsResp.data?.events) ? oddsResp.data.events : []);
      const match = evts.find((ev: any) => ev?.home_team === home && ev?.away_team === away) || null;
      if (match) {
        const hs = Number(match?.homeSpread ?? 0);
        const fav = favoriteFromSpread(Number.isFinite(hs) ? hs : 0);
        data.odds = { ...match, homeSpread: Number.isFinite(hs) ? hs : 0, favorite: fav.favorite, isPickEm: fav.isPickEm };
      } else {
        data.odds = { homeSpread: 0, favorite: null, isPickEm: true, error: 'odds fetch failed' };
      }

      // Direct slices (ensure object, never null/undefined) and numeric defaults
      data.weather   = (weatherResp.data && typeof weatherResp.data === 'object') ? weatherResp.data : { error: 'weather fetch failed' };
      const inj = (injuriesResp.data && typeof injuriesResp.data === 'object') ? injuriesResp.data : { error: 'injuries fetch failed' };
      data.injuries  = {
        home: inj?.home && typeof inj.home === 'object' ? { list: inj.home.list || [], count: Number(inj.home.count||0) } : { list: [], count: 0 },
        away: inj?.away && typeof inj.away === 'object' ? { list: inj.away.list || [], count: Number(inj.away.count||0) } : { list: [], count: 0 },
        ...(inj?.error ? { error: inj.error } : {})
      };
      const pl = (playsResp.data && typeof playsResp.data === 'object') ? playsResp.data : {};
      // Preserve nulls when unknown to avoid misleading autos in UI (0 implies extreme fatigue)
      const nz = (v:any)=> (v==null || Number.isNaN(Number(v))) ? null : Number(v);
      data.plays     = {
        home: { offense: nz(pl?.home?.offense), defense: nz(pl?.home?.defense) },
        away: { offense: nz(pl?.away?.offense), defense: nz(pl?.away?.defense) },
        ...(pl?.error ? { error: pl.error } : {})
      };
      const tr = (travelResp.data && typeof travelResp.data === 'object') ? travelResp.data : {};
      data.travel    = {
        home: { milesSinceLastGame: Number(tr?.home?.milesSinceLastGame||0), milesSinceLastHome: Number(tr?.home?.milesSinceLastHome||0), milesSeasonToDate: Number(tr?.home?.milesSeasonToDate||0) },
        away: { milesSinceLastGame: Number(tr?.away?.milesSinceLastGame||0), milesSinceLastHome: Number(tr?.away?.milesSinceLastHome||0), milesSeasonToDate: Number(tr?.away?.milesSeasonToDate||0) },
        ...(tr?.error ? { error: tr.error } : {})
      };
      const rz = (redzoneResp.data && typeof redzoneResp.data === 'object') ? redzoneResp.data : {};
      data.redzone   = {
        home: { offensePct: Number(rz?.home?.offensePct||0), defensePct: Number(rz?.home?.defensePct||0) },
        away: { offensePct: Number(rz?.away?.offensePct||0), defensePct: Number(rz?.away?.defensePct||0) },
        ...(rz?.error ? { error: rz.error } : {})
      };
      data.h2h       = (h2hResp.data && typeof h2hResp.data === 'object') ? h2hResp.data : { error: 'h2h fetch failed' };
      data.notes     = (notesResp.data && typeof notesResp.data === 'object') ? notesResp.data : { error: 'notes fetch failed' };
      data.consensus = (consensusResp.data && typeof consensusResp.data === 'object') ? consensusResp.data : { error: 'consensus fetch failed' };

      // MOV combined
      const mov: any = {};
      if (movHResp.data && typeof movHResp.data === 'object' && !movHResp.data.error) mov.home = movHResp.data;
      if (movAResp.data && typeof movAResp.data === 'object' && !movAResp.data.error) mov.away = movAResp.data;
      if (!mov.home && !mov.away) mov.error = 'mov fetch failed';
      data.mov = mov;

      // Market-driven favorite (from odds.homeSpread if present)
      try{
        const hs = Number((data.odds && (data.odds as any).homeSpread) ?? NaN);
        const { favorite, isPickEm } = (await import('../../lib/odds')).favoriteFromSpread(Number.isFinite(hs)? hs : 0);
        (data.odds as any).favorite = favorite;
        (data.odds as any).isPickEm = isPickEm;
      }catch{}

      // Compute fatigue autos and travel dock using plays + travel
      try{
        const { computeFatigueAutos } = await import('../../lib/fatigue');
        const fH = computeFatigueAutos(Number(data?.plays?.home?.offense||0), Number(data?.plays?.home?.defense||0));
        const fA = computeFatigueAutos(Number(data?.plays?.away?.offense||0), Number(data?.plays?.away?.defense||0));
        (data as any).fatigueAutos = { home: fH, away: fA };
      }catch{ (data as any).fatigueAutos = { home:0, away:0 }; }
      try{
        const { computeTravelDock } = await import('../../lib/travelDock');
        const th = data?.travel?.home||{}; const ta = data?.travel?.away||{};
        const dH = computeTravelDock(Number(th.milesSinceLastGame||0), Number(th.milesSinceLastHome||0), Number(th.milesSeasonToDate||0), Number(th.tzDiff||0));
        const dA = computeTravelDock(Number(ta.milesSinceLastGame||0), Number(ta.milesSinceLastHome||0), Number(ta.milesSeasonToDate||0), Number(ta.tzDiff||0));
        (data as any).travelDock = { home: dH, away: dA };
      }catch{ (data as any).travelDock = { home:0, away:0 }; }

      CACHE.set(key, { ts: Date.now(), data });
      return { ok: true, rateProtected, ...data };
    })();

    INFLIGHT.set(key, { ts: now, p: promise });
    const out = await promise;
    return res.status(200).json(out);
  } catch (e: any) {
    logWarn('agent', e?.message || e);
    return res.status(500).json({ error: e?.message || "agent error" });
  }
}
