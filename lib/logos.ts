import { getAllAccessConfig } from './env';

const TEAM_SLUG: Record<string, string> = {
  'Arizona Cardinals': 'ari',
  'Atlanta Falcons': 'atl',
  'Baltimore Ravens': 'bal',
  'Buffalo Bills': 'buf',
  'Carolina Panthers': 'car',
  'Chicago Bears': 'chi',
  'Cincinnati Bengals': 'cin',
  'Cleveland Browns': 'cle',
  'Dallas Cowboys': 'dal',
  'Denver Broncos': 'den',
  'Detroit Lions': 'det',
  'Green Bay Packers': 'gb',
  'Houston Texans': 'hou',
  'Indianapolis Colts': 'ind',
  'Jacksonville Jaguars': 'jax',
  'Kansas City Chiefs': 'kc',
  'Las Vegas Raiders': 'lv',
  'Los Angeles Chargers': 'lac',
  'Los Angeles Rams': 'lar',
  'Miami Dolphins': 'mia',
  'Minnesota Vikings': 'min',
  'New England Patriots': 'ne',
  'New Orleans Saints': 'no',
  'New York Giants': 'nyg',
  'New York Jets': 'nyj',
  'Philadelphia Eagles': 'phi',
  'Pittsburgh Steelers': 'pit',
  'San Francisco 49ers': 'sf',
  'Seattle Seahawks': 'sea',
  'Tampa Bay Buccaneers': 'tb',
  'Tennessee Titans': 'ten',
  'Washington Commanders': 'wsh',
};

const TEAM_ABBR: Record<string, string> = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS',
};

const ABBR_TO_SLUG: Record<string, string> = {
  ARI: 'ari',
  ATL: 'atl',
  BAL: 'bal',
  BUF: 'buf',
  CAR: 'car',
  CHI: 'chi',
  CIN: 'cin',
  CLE: 'cle',
  DAL: 'dal',
  DEN: 'den',
  DET: 'det',
  GB: 'gb',
  GNB: 'gb',
  HOU: 'hou',
  IND: 'ind',
  JAX: 'jax',
  JAC: 'jax',
  KC: 'kc',
  KAN: 'kc',
  LAR: 'lar',
  LAC: 'lac',
  LV: 'lv',
  LVR: 'lv',
  MIA: 'mia',
  MIN: 'min',
  NE: 'ne',
  NWE: 'ne',
  NO: 'no',
  NOR: 'no',
  NYG: 'nyg',
  NYJ: 'nyj',
  PHI: 'phi',
  PIT: 'pit',
  SF: 'sf',
  SFO: 'sf',
  SEA: 'sea',
  TB: 'tb',
  TAM: 'tb',
  TEN: 'ten',
  WAS: 'wsh',
  WSH: 'wsh',
  WFT: 'wsh',
};

const LOGO_CDN_BASE = (process.env.NEXT_PUBLIC_LOGO_CDN || '').trim();
const NFL_STATIC_LOGO_BASE = 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos';

function stripTrailingSlash(value: string): string {
  return value.replace(/[\/]+$/, '');
}

function buildAllAccessLogoUrl(slug: string): string {
  const { publicBaseUrl } = getAllAccessConfig();
  const base = stripTrailingSlash(publicBaseUrl);
  return `${base}/logos/nfl/${slug}.svg`;
}

function buildNflStaticLogo(abbr: string): string {
  return `${NFL_STATIC_LOGO_BASE}/${abbr}`;
}

export function teamLogo(abbreviation: string): string {
  const trimmed = (abbreviation || '').trim().toUpperCase();
  if (!trimmed) return '';
  if (LOGO_CDN_BASE) {
    const base = stripTrailingSlash(LOGO_CDN_BASE);
    return `${base}/${trimmed}.svg`;
  }
  return buildNflStaticLogo(trimmed);
}

export function teamLogoUrl(team: string): string {
  const normalized = (team || '').trim();
  const slug = TEAM_SLUG[normalized];
  const abbr = TEAM_ABBR[normalized];
  if (LOGO_CDN_BASE && abbr) {
    return teamLogo(abbr);
  }
  if (abbr) {
    return buildNflStaticLogo(abbr);
  }
  if (slug) {
    return buildAllAccessLogoUrl(slug);
  }
  return '';
}

export function teamSlugFromAbbr(abbreviation: string): string | undefined {
  return ABBR_TO_SLUG[(abbreviation || '').trim().toUpperCase()];
}

export default teamLogoUrl;
