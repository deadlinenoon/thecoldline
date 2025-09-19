const DEFAULT_ALL_ACCESS_BASE_URL = 'https://all-access.balldontlie.io/v1';
const DEFAULT_PUBLIC_ALL_ACCESS_BASE_URL = 'https://assets.balldontlie.io';

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
  BALLDONTLIE: Boolean(process.env.BALLDONTLIE_ALL_ACCESS_KEY || process.env.ALLSPORTS_API_KEY),
};

export type AllAccessConfig = {
  baseUrl: string;
  apiKey: string | null;
  publicBaseUrl: string;
  publicKey: string | null;
};

export function getAllAccessConfig(): AllAccessConfig {
  const baseUrl =
    (process.env.BALLDONTLIE_ALL_ACCESS_BASE_URL || '').trim() ||
    (process.env.ALLSPORTS_API_BASE || '').trim() ||
    DEFAULT_ALL_ACCESS_BASE_URL;
  const publicBaseUrl =
    (process.env.NEXT_PUBLIC_BALLEDONTLIE_BASE_URL || '').trim() ||
    (process.env.NEXT_PUBLIC_ALLSPORTS_BASE_URL || '').trim() ||
    DEFAULT_PUBLIC_ALL_ACCESS_BASE_URL;
  const apiKey =
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
    // eslint-disable-next-line no-console
    console.warn(`[env] ${message}`);
    return;
  }
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
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
