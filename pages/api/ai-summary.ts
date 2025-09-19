import type { NextApiRequest, NextApiResponse } from "next";

type CacheEntry = { ts: number; data: any };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const home = String(req.query.home || "").trim();
    const away = String(req.query.away || "").trim();
    const kickoff = String(req.query.kickoff || "").trim();
    if (!home || !away || !kickoff) return res.status(400).json({ error: "Missing home/away/kickoff" });

    const key = `${home}|${away}|${kickoff}`;
    const now = Date.now();
    const cached = CACHE.get(key);
    if (cached && now - cached.ts < TTL_MS) {
      return res.status(200).json(cached.data);
    }

    const proto = (req.headers["x-forwarded-proto"] as string) || "http";
    const host = req.headers.host;
    const base = `${proto}://${host}`;

    // Always fetch agent bundle
    const ares = await fetch(`${base}/api/agent?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&kickoff=${encodeURIComponent(kickoff)}`);
    const agent = await ares.json();

    const bullets: string[] = [];

    // Balldontlie matchup context: badges & pace
    try {
      const badges = Array.isArray(agent?.matchup?.badges) ? agent.matchup.badges : [];
      const badgeSnippets = badges.slice(0, 3)
        .map((badge: any) => [badge?.emoji, badge?.label].filter(Boolean).join(' ').trim())
        .filter(Boolean);
      if (badgeSnippets.length) bullets.push(`Context: ${badgeSnippets.join(' / ')}`);
      const paceHome = agent?.matchup?.home?.pace;
      const paceAway = agent?.matchup?.away?.pace;
      if ((paceHome?.offense ?? paceHome?.defense ?? paceAway?.offense ?? paceAway?.defense) != null) {
        const fmt = (value: any) => (value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toFixed(1));
        bullets.push(
          `Pace (drives/g) — Home O ${fmt(paceHome?.offense)} / D ${fmt(paceHome?.defense)}; Away O ${fmt(paceAway?.offense)} / D ${fmt(paceAway?.defense)}`
        );
      }
    } catch {}

    // Market median and average
    try {
      const ev = agent?.odds;
      if (ev && Array.isArray(ev?.bookmakers)){
        const pts:number[]=[];
        for(const b of ev.bookmakers){ const m=b.markets?.find((mm:any)=>mm.key==='spreads'); if(!m) continue; const h=m.outcomes?.find((o:any)=>o.name===ev.home_team); const a=m.outcomes?.find((o:any)=>o.name===ev.away_team); if(typeof h?.point==='number') pts.push(h.point); else if(typeof a?.point==='number') pts.push(-(a.point)); }
        if(pts.length){ const s=pts.slice().sort((x:number,y:number)=>x-y); const mid=Math.floor(s.length/2); const med = s.length%2? s[mid] : (s[mid-1]+s[mid])/2; const avg = pts.reduce((p:number,x:number)=>p+x,0)/pts.length; const favHome = med<0; const favTeam = favHome? home : away; bullets.push(`Market: ${favTeam} -${Math.abs(med).toFixed(1)} (median); avg ${Math.abs(avg).toFixed(1)}`); }
      }
    } catch {}

    // Top injuries per side (names if available, else counts)
    const ihList: any[] = Array.isArray(agent?.injuries?.home?.list) ? agent.injuries.home.list : [];
    const iaList: any[] = Array.isArray(agent?.injuries?.away?.list) ? agent.injuries.away.list : [];
    const ih = ihList.slice(0,6).map((p:any)=>p?.name).filter(Boolean);
    const ia = iaList.slice(0,6).map((p:any)=>p?.name).filter(Boolean);
    if (ih.length) bullets.push(`Home injuries: ${ih.join(', ')}`);
    else if (Number.isFinite(agent?.injuries?.home?.count)) bullets.push(`Home injuries: ${agent.injuries.home.count}`);
    if (ia.length) bullets.push(`Away injuries: ${ia.join(', ')}`);
    else if (Number.isFinite(agent?.injuries?.away?.count)) bullets.push(`Away injuries: ${agent.injuries.away.count}`);

    // Fatigue from plays
    const ph = agent?.plays?.home; const pa = agent?.plays?.away;
    if (ph || pa) {
      bullets.push(`Plays last game — Home O ${ph?.offense ?? '—'} / D ${ph?.defense ?? '—'}; Away O ${pa?.offense ?? '—'} / D ${pa?.defense ?? '—'}`);
    }

    // Travel
    const th = agent?.travel?.home; const ta = agent?.travel?.away;
    if (th || ta) bullets.push(`Travel: Home ${th?.milesSinceLastHome ?? '—'} mi since home (YTD ${th?.milesSeasonToDate ?? '—'}), Away ${ta?.milesSinceLastHome ?? '—'} (YTD ${ta?.milesSeasonToDate ?? '—'})`);

    // Red zone
    const rzh = agent?.redzone?.home; const rza = agent?.redzone?.away;
    if (rzh || rza) bullets.push(`RZ TD% — Home O ${rzh?.offensePct ?? '—'} / D ${rzh?.defensePct ?? '—'}; Away O ${rza?.offensePct ?? '—'} / D ${rza?.defensePct ?? '—'}`);

    // Public consensus (bets + handle when available)
    const cons = agent?.consensus;
    const betsHome = cons?.bets?.home ?? cons?.home; const betsAway = cons?.bets?.away ?? cons?.away;
    if (betsHome!=null || betsAway!=null) bullets.push(`Consensus (bets): Away ${betsAway ?? '—'}% / Home ${betsHome ?? '—'}%`);
    const handleHome = cons?.handle?.home; const handleAway = cons?.handle?.away;
    if (handleHome!=null || handleAway!=null) bullets.push(`Consensus (handle): Away ${handleAway ?? '—'}% / Home ${handleHome ?? '—'}%`);

    // Weather
    const wx = agent?.weather; if (wx?.temp_f!=null || wx?.wind_mph!=null || wx?.pop!=null) bullets.push(`Weather: ${wx?.temp_f ?? '—'}°F, wind ${wx?.wind_mph ?? '—'} mph, precip ${wx?.pop!=null? Math.round(wx.pop*100)+'%' : '—'}`);

    // H2H
    const h2h = agent?.h2h; if (h2h?.record) bullets.push(`H2H last 10: ${home} ${h2h.record} ${away}${h2h?.streakTeam? ' • streak ' + h2h.streakTeam + ' W' + h2h.streakCount : ''}${h2h?.revenge? ' • revenge ' + h2h.revenge.team : ''}`);

    const angleParts: string[] = [];
    if (ph?.defense!=null && ph.defense > 70) angleParts.push('home D high snaps');
    if (pa?.defense!=null && pa.defense > 70) angleParts.push('away D high snaps');
    if (th?.milesSinceLastHome!=null && th.milesSinceLastHome > 1500) angleParts.push('home travel wear');
    if (wx?.wind_mph!=null && wx.wind_mph >= 15) angleParts.push('wind impact');
    if (h2h?.revenge?.team) angleParts.push('revenge factor');
    const angle = angleParts.length ? `Angle: ${angleParts.slice(0,3).join(' • ')}` : 'Angle: blend market + context adjustments';

    const out = { bullets, angle };
    CACHE.set(key, { ts: now, data: out });
    return res.status(200).json(out);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'ai-summary error' });
  }
}
