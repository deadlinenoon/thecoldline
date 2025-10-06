import type { NextApiRequest, NextApiResponse } from "next";
import { getFlag } from "@/lib/flags";

const TEAM_NAMES_BY_ABBR: Record<string, string> = {
  ARI: 'Arizona Cardinals',
  ATL: 'Atlanta Falcons',
  BAL: 'Baltimore Ravens',
  BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers',
  CHI: 'Chicago Bears',
  CIN: 'Cincinnati Bengals',
  CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys',
  DEN: 'Denver Broncos',
  DET: 'Detroit Lions',
  GB: 'Green Bay Packers',
  HOU: 'Houston Texans',
  IND: 'Indianapolis Colts',
  JAX: 'Jacksonville Jaguars',
  KC: 'Kansas City Chiefs',
  LV: 'Las Vegas Raiders',
  LAC: 'Los Angeles Chargers',
  LAR: 'Los Angeles Rams',
  MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings',
  NE: 'New England Patriots',
  NO: 'New Orleans Saints',
  NYG: 'New York Giants',
  NYJ: 'New York Jets',
  PHI: 'Philadelphia Eagles',
  PIT: 'Pittsburgh Steelers',
  SF: 'San Francisco 49ers',
  SEA: 'Seattle Seahawks',
  TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans',
  WAS: 'Washington Commanders',
  WSH: 'Washington Commanders',
};

const TEAM_ALIASES: Record<string, string[]> = {
  LV: ['Las Vegas Raiders', 'Oakland Raiders'],
  LAC: ['Los Angeles Chargers', 'LA Chargers', 'San Diego Chargers'],
  LAR: ['Los Angeles Rams', 'LA Rams', 'St. Louis Rams'],
  NYG: ['New York Giants', 'NY Giants', 'Giants'],
  NYJ: ['New York Jets', 'NY Jets', 'Jets'],
  PHI: ['Philadelphia Eagles', 'Philly Eagles'],
  TB: ['Tampa Bay Buccaneers', 'Tampa Bay Bucs', 'Tampa Bay'],
  WAS: ['Washington Commanders', 'Washington Football Team', 'Washington Redskins'],
  WSH: ['Washington Commanders', 'Washington Football Team', 'Washington Redskins'],
};

const norm = (s:string)=> (s||"").toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();

const NAME_TO_ABBR: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [abbr, name] of Object.entries(TEAM_NAMES_BY_ABBR)) {
    const canonical = norm(name);
    if (canonical) map[canonical] = abbr;
    for (const alias of TEAM_ALIASES[abbr] ?? []) {
      const aliasNorm = norm(alias);
      if (aliasNorm) map[aliasNorm] = abbr;
    }
  }
  return map;
})();

function buildCandidates(primary: string, abbrParam?: string | null): string[] {
  const set = new Set<string>();
  if (primary) set.add(primary);
  const abbr = (abbrParam || '').trim().toUpperCase();
  if (abbr) {
    set.add(abbr);
    const canonical = TEAM_NAMES_BY_ABBR[abbr];
    if (canonical) set.add(canonical);
    for (const alias of TEAM_ALIASES[abbr] ?? []) {
      set.add(alias);
    }
  }
  return Array.from(set).filter(Boolean);
}

function buildNormalizedSet(values: string[]): Set<string> {
  const out = new Set<string>();
  for (const value of values) {
    const normalized = norm(value);
    if (normalized) out.add(normalized);
  }
  return out;
}

function findFirstIndex(text: string, targets: Set<string>): number {
  let best = -1;
  for (const target of targets) {
    const idx = text.indexOf(target);
    if (idx >= 0 && (best === -1 || idx < best)) {
      best = idx;
    }
  }
  return best;
}

function findPercentAfter(text: string, from: number): number | null {
  if (from < 0) return null;
  const slice = text.slice(from);
  const match = slice.match(/(\d{1,3})%/);
  return match ? Number(match[1]) : null;
}

function getClosestPercent(text: string, targets: Set<string>): number | null {
  if (!targets.size) return null;
  let best: number | null = null;
  let bestIdx = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const idx = text.indexOf(target);
    if (idx >= 0 && idx < bestIdx) {
      bestIdx = idx;
      best = findPercentAfter(text, idx + target.length);
    }
  }
  return best;
}

function pickNear(ctx: string, awayTargets: Set<string>, homeTargets: Set<string>) {
  let away = getClosestPercent(ctx, awayTargets);
  let home = getClosestPercent(ctx, homeTargets);
  if (away == null || home == null) {
    const matches = ctx.match(/(\d{1,3})%/g) || [];
    if (matches.length >= 2) {
      const nums = matches.slice(0, 2).map((value) => Number(value.replace('%', '')));
      if (away == null) away = nums[0] ?? null;
      if (home == null) home = nums[1] ?? null;
    }
  }
  return { away: away ?? null, home: home ?? null };
}

function matchesTeam(value: string, targets: Set<string>): boolean {
  const normalized = norm(value);
  if (targets.has(normalized)) return true;
  const abbr = NAME_TO_ABBR[normalized];
  if (abbr && targets.has(norm(abbr))) return true;
  return false;
}

function findMatchingOddsGame(games: any[], homeTargets: Set<string>, awayTargets: Set<string>) {
  return games.find((game) =>
    matchesTeam(game.home_team, homeTargets) && matchesTeam(game.away_team, awayTargets)
  );
}
const SAO_URL = process.env.SAO_SCRAPE_URL || "https://www.scoresandodds.com/nfl/consensus";
const SAO_UA = process.env.SAO_USER_AGENT || "Mozilla/5.0";

// naive scraper for VegasInsider consensus page; best-effort heuristic
export default async function handler(req:NextApiRequest,res:NextApiResponse){
  try{
    const home = String(req.query.home||"").trim();
    const away = String(req.query.away||"").trim();
    const homeAbbr = String(req.query.homeAbbr ?? '').trim().toUpperCase() || null;
    const awayAbbr = String(req.query.awayAbbr ?? '').trim().toUpperCase() || null;
    if(!home || !away) return res.status(400).json({error:"Missing home/away"});
    const homeCandidates = buildCandidates(home, homeAbbr);
    const awayCandidates = buildCandidates(away, awayAbbr);
    const homeNorms = buildNormalizedSet(homeCandidates);
    const awayNorms = buildNormalizedSet(awayCandidates);
    function shape(out: { bets?:{home:number|null,away:number|null}|null; handle?:{home:number|null,away:number|null}|null; source:string }){
      // Always return a stable shape (bets + handle), even when null
      const bets = out.bets ?? { home: null, away: null };
      const handle = out.handle ?? { home: null, away: null };
      return { bets, handle, source: out.source, home: bets.home, away: bets.away };
    }
    let saoHandle: { home:number|null, away:number|null } | null = null;
    let saoBets: { home:number|null, away:number|null } | null = null;

    // ScoresAndOdds primary attempt (HANDLE only; do not return yet)
    try{
      const urlSAO = SAO_URL;
      const rSAO = await fetch(urlSAO, { headers: { "User-Agent": SAO_UA, Accept: "text/html" }, cache:"no-store" });
      const htmlSAO = await rSAO.text(); if(!rSAO.ok) throw new Error(`SAO ${rSAO.status}`);
      const ns = norm(htmlSAO);
      const homeIndex = findFirstIndex(ns, homeNorms);
      const awayIndex = findFirstIndex(ns, awayNorms);
      if (homeIndex>=0 && awayIndex>=0 && Math.abs(homeIndex - awayIndex) < 4000){
        const start = Math.max(0, Math.min(homeIndex, awayIndex) - 800);
        const block = ns.slice(start, start + 4000);
        const betsIdx = block.indexOf('bets');
        const betsCtx = betsIdx>=0 ? block.slice(betsIdx, betsIdx+1600) : block;
        const betsPick = pickNear(betsCtx, awayNorms, homeNorms);
        saoBets = { home: betsPick.home ?? null, away: betsPick.away ?? null };

        const handleIdx = block.indexOf('handle');
        if (handleIdx >= 0){
          const tail = block.slice(handleIdx, handleIdx + 1600);
          const handlePick = pickNear(tail, awayNorms, homeNorms);
          const handleAway = handlePick.away;
          const handleHome = handlePick.home;
          if (handleAway!=null || handleHome!=null){
            saoHandle = { home: handleHome ?? null, away: handleAway ?? null };
          }
        }
      }
    }catch{}
    // Optional flag to force derived-only consensus (stability during spikes)
    let forceDerived = false;
    try {
      forceDerived = await getFlag('consensusDerivedOnly', false);
    } catch (flagError) {
      console.warn('[consensus] flag lookup failed', flagError);
    }
    if (forceDerived){
      try{
        const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
        const host = req.headers.host; const base = `${proto}://${host}`;
        const ro = await fetch(`${base}/api/odds`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        const raw = await ro.json();
        const odds:any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.events) ? raw.events : []);
        if (Array.isArray(odds)){
          const ev = findMatchingOddsGame(odds, homeNorms, awayNorms);
          if (ev){
            const homeP: number[] = [];
            const awayP: number[] = [];
            for(const b of ev.bookmakers||[]){
              const m = (b.markets||[]).find((mm:any)=>mm.key==='h2h');
              const ho = m?.outcomes?.find((o:any)=> matchesTeam(o.name, homeNorms));
              const ao = m?.outcomes?.find((o:any)=> matchesTeam(o.name, awayNorms));
              const toProb = (price:number)=> price>0? 100/(price+100) : (-price)/((-price)+100);
              if (typeof ho?.price==='number') homeP.push(toProb(ho.price));
              if (typeof ao?.price==='number') awayP.push(toProb(ao.price));
            }
            const avg = (arr:number[])=> arr.length? arr.reduce((s,x)=>s+x,0)/arr.length : null;
            const h = avg(homeP), a = avg(awayP);
            if (h!=null && a!=null){ const z=h+a; const hp=Math.round((h/z)*100); const ap=100-hp; return res.status(200).json(shape({ source:'derived-odds-forced', bets:{home:hp,away:ap}, handle:{home:hp,away:ap} })); }
          }
        }
      }catch{}
      return res.status(200).json(shape({ source:'derived-odds-fallback', bets:{home:null,away:null}, handle:{home:null,away:null} }));
    }

    // Try VegasInsider first
    try{
      const url = "https://www.vegasinsider.com/nfl/consensus/";
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, cache:"no-store" });
      const html = await r.text(); if(!r.ok) throw new Error(`VI ${r.status}`);
      const nhtml = norm(html);
      const hi = findFirstIndex(nhtml, homeNorms);
      const ai = findFirstIndex(nhtml, awayNorms);
      let block = "";
      if (hi>=0 && ai>=0 && Math.abs(hi-ai) < 2000) {
        const start = Math.max(0, Math.min(hi,ai)-400);
        block = nhtml.slice(start, start+2000);
      }
      const near = pickNear(block, awayNorms, homeNorms);
      const awayPct = near.away;
      const homePct = near.home;
      if (homePct!=null || awayPct!=null) {
        const merged = { bets: { home: homePct ?? null, away: awayPct ?? null }, handle: saoHandle ?? undefined, source: `vegasinsider${saoHandle? '+sao':''}` } as any;
        return res.status(200).json(shape(merged));
      }
      // fallthrough to derived odds
    }catch{}

    // Second source: Pregame (best-effort)
    try{
      const url2 = 'https://pregame.com/consensus/picks/nfl';
      const r2 = await fetch(url2, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, cache:"no-store" });
      const html2 = await r2.text(); if(!r2.ok) throw new Error(`pregame ${r2.status}`);
      const n = norm(html2);
      // find local block around both names
      const hi = findFirstIndex(n, homeNorms), ai = findFirstIndex(n, awayNorms);
      if (hi>=0 && ai>=0 && Math.abs(hi-ai)<3000){
        const start = Math.max(0, Math.min(hi,ai)-600);
        const block = n.slice(start, start+3000);
        const pick = pickNear(block, awayNorms, homeNorms);
        if (pick.away != null || pick.home != null) {
          return res.status(200).json({
            home: pick.home,
            away: pick.away,
            source: 'pregame',
            bets: { home: pick.home ?? null, away: pick.away ?? null },
          });
        }
      }
    }catch{}

    // Fallback: derive consensus from available bookmakers' moneyline implied probabilities
    try{
      const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
      const host = req.headers.host;
      const base = `${proto}://${host}`;
      const ro = await fetch(`${base}/api/odds`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const raw = await ro.json();
      const odds:any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.events) ? raw.events : []);
      if (Array.isArray(odds)){
        const ev = findMatchingOddsGame(odds, homeNorms, awayNorms);
        if (ev){
          const homeP: number[] = [];
          const awayP: number[] = [];
          for(const b of ev.bookmakers||[]){
            const m = (b.markets||[]).find((mm:any)=>mm.key==='h2h');
            const ho = m?.outcomes?.find((o:any)=> matchesTeam(o.name, homeNorms));
            const ao = m?.outcomes?.find((o:any)=> matchesTeam(o.name, awayNorms));
            const toProb = (price:number)=> price>0? 100/(price+100) : (-price)/((-price)+100);
            if (typeof ho?.price==='number') homeP.push(toProb(ho.price));
            if (typeof ao?.price==='number') awayP.push(toProb(ao.price));
          }
          const avg = (arr:number[])=> arr.length? arr.reduce((s,x)=>s+x,0)/arr.length : null;
          const h = avg(homeP), a = avg(awayP);
          if (h!=null && a!=null){
            const z = h + a; const hp = Math.round((h/z)*100); const ap = 100 - hp;
            // Provide both bets and handle with the same proxy so UI shows both bars
            return res.status(200).json(shape({ source: 'derived-odds', bets: { home: hp, away: ap }, handle: { home: hp, away: ap } }));
          }
        }
      }
    }catch{}
    // AI fallback
    try{
      const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
      const host = req.headers.host; const base = `${proto}://${host}`;
      const r3 = await fetch(`${base}/api/ai-scrape?type=consensus&home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`, { cache:'no-store' });
      const j3 = await r3.json(); if (r3.ok) return res.status(200).json(shape({ source: String(j3?.source||'ai'), bets: j3?.bets||{home:j3?.home??null, away:j3?.away??null}, handle: j3?.handle||{home:null,away:null} }));
    }catch{}
    const finalBets = saoBets ?? { home: null, away: null };
    const finalHandle = saoHandle ?? { home: null, away: null };
    return res.status(200).json(shape({ source: 'unavailable', bets: finalBets, handle: finalHandle }));
  }catch(e:any){
    console.error('[consensus] failed', e);
    return res.status(200).json({
      bets: { home: null, away: null },
      handle: { home: null, away: null },
      source: 'error',
      error: e instanceof Error ? e.message : 'consensus scrape error',
      home: null,
      away: null,
    });
  }
}
