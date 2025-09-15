export const TEAM_ID: Record<string, number> = {
  ARI: 22, ATL: 1, BAL: 33, BUF: 2, CAR: 29, CHI: 3, CIN: 4, CLE: 5, DAL: 6,
  DEN: 7, DET: 8, GB: 9, HOU: 34, IND: 11, JAX: 30, KC: 12, LAC: 24,
  LAR: 14, LV: 13, MIA: 15, MIN: 16, NE: 17, NO: 18, NYG: 19, NYJ: 20,
  PHI: 21, PIT: 23, SEA: 26, SF: 25, TB: 27, TEN: 10,
  WAS: 28, // canonical
  WSH: 28  // accept alternate abbr used elsewhere
};

import { teamAbbr as fullToAbbr } from './abbr';

export function toAbbr(input: string): string {
  const raw = String(input || '').trim();
  const s = raw.toUpperCase();

  // 1) Already an abbr?
  if (TEAM_ID[s]) return s;

  // 2) Full name mapping (e.g., "New York Jets" → "NYJ").
  let ab = fullToAbbr(raw).toUpperCase();
  if (ab === 'WSH') ab = 'WAS';
  if (TEAM_ID[ab]) return ab;

  // 3) Last word fallback (e.g., "New York Jets" → "JETS").
  const last = s.split(/\s+/).pop() || s;
  const wordMap: Record<string,string> = {
    'ARIZONA': 'ARI','CARDINALS': 'ARI',
    'FALCONS': 'ATL','BALTIMORE': 'BAL','RAVENS': 'BAL',
    'BILLS': 'BUF','PANTHERS': 'CAR','BEARS': 'CHI',
    'BENGALS': 'CIN','BROWNS': 'CLE','COWBOYS': 'DAL',
    'BRONCOS': 'DEN','LIONS': 'DET','PACKERS': 'GB',
    'TEXANS': 'HOU','COLTS': 'IND','JAGUARS': 'JAX',
    'CHARGERS': 'LAC','RAMS': 'LAR','RAIDERS': 'LV',
    'DOLPHINS': 'MIA','VIKINGS': 'MIN','PATRIOTS': 'NE',
    'SAINTS': 'NO','GIANTS': 'NYG','JETS': 'NYJ',
    'EAGLES': 'PHI','STEELERS': 'PIT','SEAHAWKS': 'SEA',
    '49ERS': 'SF','NINERS': 'SF','BUCCANEERS': 'TB','BUCS':'TB',
    'TITANS': 'TEN','COMMANDERS': 'WAS','REDSKINS':'WAS','FOOTBALL':'WAS'
  };
  const alt = wordMap[last] || wordMap[s] || s;
  if (alt === 'WSH') return 'WAS';
  return TEAM_ID[alt] ? alt : s;
}
