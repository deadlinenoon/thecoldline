export type NormMarket = {
  homeAbbr: string;
  awayAbbr: string;
  homeSpread: number | null; // negative = home favored
  awaySpread: number | null; // positive mirror of homeSpread when present
  pickem: boolean;
  favIsHome: boolean | null; // null when pick’em
};

export function normalizeMarket(active: any, market: any): NormMarket {
  const homeAbbr = String(active?.home_team || active?.home || active?.homeAbbr || '').toUpperCase();
  const awayAbbr = String(active?.away_team || active?.away || active?.awayAbbr || '').toUpperCase();

  // Try to read a canonical home spread; fallbacks cover various shapes you’ve used.
  const hs = market?.homeSpread ?? market?.spread_home ?? market?.home?.spread ?? (typeof market === 'number' ? market : null);
  const as = market?.awaySpread ?? market?.spread_away ?? market?.away?.spread ?? (hs != null ? -hs : null);

  const homeSpread = (typeof hs === 'number') ? hs : null;
  const awaySpread = (typeof as === 'number') ? as : (homeSpread != null ? -homeSpread : null);

  const pickem = homeSpread === 0 || awaySpread === 0 || (homeSpread == null && awaySpread == null);
  const favIsHome = pickem ? null : (typeof homeSpread === 'number' ? homeSpread < 0 : (typeof awaySpread === 'number' ? awaySpread > 0 : null));

  return { homeAbbr, awayAbbr, homeSpread, awaySpread, pickem, favIsHome };
}

