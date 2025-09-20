import type { NextApiRequest, NextApiResponse } from "next";
import { getFlag } from "@/lib/flags";

const norm = (s:string)=> (s||"").toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
const SAO_URL = process.env.SAO_SCRAPE_URL || "https://www.scoresandodds.com/nfl/consensus";
const SAO_UA = process.env.SAO_USER_AGENT || "Mozilla/5.0";

// naive scraper for VegasInsider consensus page; best-effort heuristic
export default async function handler(req:NextApiRequest,res:NextApiResponse){
  try{
    const home = String(req.query.home||"").trim();
    const away = String(req.query.away||"").trim();
    if(!home || !away) return res.status(400).json({error:"Missing home/away"});
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
      const Hs = norm(home), As = norm(away);
      const ns = norm(htmlSAO);
      const hiS = ns.indexOf(Hs), aiS = ns.indexOf(As);
      if (hiS>=0 && aiS>=0 && Math.abs(hiS-aiS) < 4000){
        const start = Math.max(0, Math.min(hiS, aiS) - 800);
        const block = ns.slice(start, start + 4000);
        // Helper to assign two percentages to away/home using proximity to names
        const pickNear = (ctx:string)=>{
          const out = { away: null as number|null, home: null as number|null };
          const findPctAfter = (from:number)=>{ const tail=ctx.slice(Math.max(0,from), from+600); const m=tail.match(/(\d{1,3})%/); return m? Number(m[1]) : null; };
          const ai = ctx.indexOf(As); const hi = ctx.indexOf(Hs);
          if (ai>=0) out.away = findPctAfter(ai);
          if (hi>=0) out.home = findPctAfter(hi);
          if (out.away==null || out.home==null){
            const m = ctx.match(/(\d{1,3})%/g) || [];
            if (m.length>=2){ const nums=m.slice(0,2).map(x=> Number(x.replace('%',''))); if(out.away==null) out.away=nums[0]; if(out.home==null) out.home=nums[1]; }
          }
          return out;
        };
        // Bets context: prefer region after the keyword 'bets', else the whole block
        const betsIdx = block.indexOf('bets');
        const betsCtx = betsIdx>=0 ? block.slice(betsIdx, betsIdx+1600) : block;
        const betsPick = pickNear(betsCtx);
        saoBets = { home: betsPick.home ?? null, away: betsPick.away ?? null };
        // Handle context: prefer region after keyword 'handle'
        let handleAway: number|null = null, handleHome: number|null = null;
        const handleIdx = block.indexOf('handle');
        if (handleIdx >= 0){
          const tail = block.slice(handleIdx, handleIdx + 1600);
          const hPick = pickNear(tail);
          handleAway = hPick.away; handleHome = hPick.home;
        }
        if (handleAway!=null || handleHome!=null){ saoHandle = { home: handleHome ?? null, away: handleAway ?? null }; }
      }
    }catch{}
    // Optional flag to force derived-only consensus (stability during spikes)
    const forceDerived = await getFlag('consensusDerivedOnly', false);
    if (forceDerived){
      try{
        const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
        const host = req.headers.host; const base = `${proto}://${host}`;
        const ro = await fetch(`${base}/api/odds`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        const raw = await ro.json();
        const odds:any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.events) ? raw.events : []);
        if (Array.isArray(odds)){
          const ev = odds.find((e:any)=> e?.home_team===home && e?.away_team===away);
          if (ev){
            const homeP: number[] = [];
            const awayP: number[] = [];
            for(const b of ev.bookmakers||[]){
              const m = (b.markets||[]).find((mm:any)=>mm.key==='h2h');
              const ho = m?.outcomes?.find((o:any)=>o.name===home); const ao = m?.outcomes?.find((o:any)=>o.name===away);
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
      const H = norm(home), A = norm(away);
      const nhtml = norm(html);
      const hi = nhtml.indexOf(H); const ai = nhtml.indexOf(A);
      let block = "";
      if (hi>=0 && ai>=0 && Math.abs(hi-ai) < 2000) {
        const start = Math.max(0, Math.min(hi,ai)-400);
        block = nhtml.slice(start, start+2000);
      }
      function grab(name:string, ctx:string){
        const i = ctx.indexOf(name); if(i<0) return null;
        const tail = ctx.slice(i, i+200);
        const m = tail.match(/(\d{1,3})%/); return m? Number(m[1]) : null;
      }
      const awayPct = grab(A, block);
      const homePct = grab(H, block);
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
      const H = norm(home), A = norm(away);
      const n = norm(html2);
      // find local block around both names
      const hi = n.indexOf(H), ai = n.indexOf(A);
      if (hi>=0 && ai>=0 && Math.abs(hi-ai)<3000){
        const start = Math.max(0, Math.min(hi,ai)-600);
        const block = n.slice(start, start+3000);
        const m = block.match(/(\d{1,3})%/g) || [];
        // take first two percentages in the block as away/home bets
        if (m.length>=2){
          const nums = m.slice(0,2).map(x=> Number(x.replace('%','')));
          const awayPct = nums[0]; const homePct = nums[1];
          if (Number.isFinite(awayPct) && Number.isFinite(homePct))
            return res.status(200).json({ home: homePct, away: awayPct, source:'pregame', bets: { home: homePct, away: awayPct } });
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
        const ev = odds.find((e:any)=> e?.home_team===home && e?.away_team===away);
        if (ev){
            const homeP: number[] = [];
            const awayP: number[] = [];
          for(const b of ev.bookmakers||[]){
            const m = (b.markets||[]).find((mm:any)=>mm.key==='h2h');
            const ho = m?.outcomes?.find((o:any)=>o.name===home);
            const ao = m?.outcomes?.find((o:any)=>o.name===away);
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
    return res.status(500).json({error:e?.message||"consensus scrape error"});
  }
}
