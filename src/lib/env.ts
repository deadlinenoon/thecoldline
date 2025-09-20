const DEFAULT_ALL_ACCESS_BASE_URL = 'https://all-access.balldontlie.io/v1';
const DEFAULT_PUBLIC_ALL_ACCESS_BASE_URL = 'https://assets.balldontlie.io';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeAllAccessBaseUrl(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('all-access.balldontlie.io')) {
      const path = stripTrailingSlash(url.pathname);
      if (!path || path === '') {
        url.pathname = '/v1';
      } else if (!path.startsWith('/v1')) {
        url.pathname = `/v1${path.startsWith('/') ? path : `/${path}`}`;
      }
      return stripTrailingSlash(url.toString());
    }
    return stripTrailingSlash(trimmed);
  } catch {
    return fallback;
  }
}

const requiredKeys = [
  'ODDS_API_KEY',
  'OPENWEATHERMAP_API_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
  'UPSTASH_REDIS_REST_URL',
  'SAO_USER_AGENT',
  'SAO_SCRAPE_URL',
  'NEXT_PUBLIC_ODDS_API_KEY',
  'NEXT_PUBLIC_CONVEX_URL',
];

const eitherKeyGroups: string[][] = [
  ['BALLDONTLIE_ALL_ACCESS_KEY', 'ALLSPORTS_API_KEY'],
  ['BALLDONTLIE_ALL_ACCESS_BASE_URL', 'ALLSPORTS_API_BASE'],
  ['NEXT_PUBLIC_BALLEDONTLIE_KEY', 'NEXT_PUBLIC_ALLSPORTS_KEY'],
  ['NEXT_PUBLIC_BALLEDONTLIE_BASE_URL', 'NEXT_PUBLIC_ALLSPORTS_BASE_URL'],
];

let envChecked = false;

export const HAVE = {
  ODDS: Boolean(process.env.ODDS_API_KEY),
  UPSTASH: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
  BALLDONTLIE: Boolean(
    process.env.BALLDONTLIE_API_KEY ||
    process.env.BALLDONTLIE_ALL_ACCESS_KEY ||
    process.env.ALLSPORTS_API_KEY
  ),
};

export type AllAccessConfig = {
  baseUrl: string;
  apiKey: string | null;
  publicBaseUrl: string;
  publicKey: string | null;
};

export function getAllAccessConfig(): AllAccessConfig {
  const rawBaseUrl =
    (process.env.BALLDONTLIE_ALL_ACCESS_BASE_URL || '').trim() ||
    (process.env.ALLSPORTS_API_BASE || '').trim() ||
    DEFAULT_ALL_ACCESS_BASE_URL;
  const rawPublicBaseUrl =
    (process.env.NEXT_PUBLIC_BALLEDONTLIE_BASE_URL || '').trim() ||
    (process.env.NEXT_PUBLIC_ALLSPORTS_BASE_URL || '').trim() ||
    DEFAULT_PUBLIC_ALL_ACCESS_BASE_URL;
  const baseUrl = normalizeAllAccessBaseUrl(rawBaseUrl, DEFAULT_ALL_ACCESS_BASE_URL);
  const publicBaseUrl = normalizeAllAccessBaseUrl(rawPublicBaseUrl, DEFAULT_PUBLIC_ALL_ACCESS_BASE_URL);
  const apiKey =
    (process.env.BALLDONTLIE_API_KEY || '').trim() ||
    (process.env.BALLDONTLIE_ALL_ACCESS_KEY || '').trim() ||
    (process.env.ALLSPORTS_API_KEY || '').trim() ||
    null;
  const publicKey =
    (process.env.NEXT_PUBLIC_BALLEDONTLIE_KEY || '').trim() ||
    (process.env.NEXT_PUBLIC_ALLSPORTS_KEY || '').trim() ||
    null;
  return { baseUrl, apiKey, publicBaseUrl, publicKey };
}

export function assertRequiredEnv(): void {
  if (envChecked) return;
  envChecked = true;
  const missing = requiredKeys.filter(key => {
    const value = process.env[key];
    return value === undefined || value === '';
  });
  const missingEither = eitherKeyGroups
    .filter(keys => keys.every(key => {
      const value = process.env[key];
      return value === undefined || value === '';
    }))
    .map(keys => keys.join(' or '));
  if (!missing.length && !missingEither.length) return;
  const missingMessages = [];
  if (missing.length) missingMessages.push(...missing);
  if (missingEither.length) missingMessages.push(...missingEither);
  const message = `Missing required environment variables: ${missingMessages.join(', ')}`;
  if (process.env.NODE_ENV === 'development') {
    throw new Error(message);
  }
  if (process.env.NODE_ENV === 'production') {
     
    console.warn(`[env] ${message}`);
    return;
  }
  if (process.env.NODE_ENV !== 'test') {
     
    console.warn(`[env] ${message}`);
  }
}

export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing environment variable ${key}`);
  }
  return value;
}
