const DEFAULT_ALL_ACCESS_BASE_URL = 'https://all-access.balldontlie.io/v1';
const DEFAULT_PUBLIC_ALL_ACCESS_BASE_URL = 'https://assets.balldontlie.io';

type EnvRequirement = {
  key: string;
  fallbackKeys?: string[];
  optional?: boolean;
  devDefault?: string;
};

type EnvGroupRequirement = {
  keys: string[];
  optional?: boolean;
  label?: string;
};

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

const envRequirements: EnvRequirement[] = [
  { key: 'ODDS_API_KEY', fallbackKeys: ['ODDS_API_KEY_2'] },
  { key: 'OPENWEATHERMAP_API_KEY' },
  { key: 'UPSTASH_REDIS_REST_URL', fallbackKeys: ['KV_REST_API_URL'], optional: true },
  { key: 'UPSTASH_REDIS_REST_TOKEN', fallbackKeys: ['KV_REST_API_TOKEN'], optional: true },
  {
    key: 'SAO_USER_AGENT',
    optional: true,
    devDefault: 'Mozilla/5.0 (compatible; TheColdLine Dev)',
  },
  {
    key: 'SAO_SCRAPE_URL',
    optional: true,
    devDefault: 'https://www.scoresandodds.com/nfl/consensus',
  },
  { key: 'NEXT_PUBLIC_ODDS_API_KEY', fallbackKeys: ['ODDS_API_KEY', 'ODDS_API_KEY_2'], optional: true },
  { key: 'NEXT_PUBLIC_CONVEX_URL', optional: true },
];

const envGroupRequirements: EnvGroupRequirement[] = [
  {
    keys: ['BALLDONTLIE_ALL_ACCESS_KEY', 'BALDONTLIE_ALL_ACCESS_KEY', 'ALLSPORTS_API_KEY'],
    optional: true,
    label: 'BALLDONTLIE_ALL_ACCESS_KEY or BALDONTLIE_ALL_ACCESS_KEY or ALLSPORTS_API_KEY',
  },
  {
    keys: ['BALLDONTLIE_ALL_ACCESS_BASE_URL', 'BALDONTLIE_ALL_ACCESS_BASE_URL', 'ALLSPORTS_API_BASE'],
    optional: true,
    label: 'BALLDONTLIE_ALL_ACCESS_BASE_URL or BALDONTLIE_ALL_ACCESS_BASE_URL or ALLSPORTS_API_BASE',
  },
  {
    keys: ['NEXT_PUBLIC_BALLDONTLIE_BASE_URL', 'NEXT_PUBLIC_BALLEDONTLIE_BASE_URL', 'NEXT_PUBLIC_ALLSPORTS_BASE_URL'],
    optional: true,
    label: 'NEXT_PUBLIC_BALLDONTLIE_BASE_URL or NEXT_PUBLIC_BALLEDONTLIE_BASE_URL or NEXT_PUBLIC_ALLSPORTS_BASE_URL',
  },
  {
    keys: ['NEXT_PUBLIC_BALLEDONTLIE_KEY', 'NEXT_PUBLIC_ALLSPORTS_KEY'],
    optional: true,
    label: 'NEXT_PUBLIC_BALLEDONTLIE_KEY or NEXT_PUBLIC_ALLSPORTS_KEY',
  },
];

const readEnv = (key: string): string | undefined => {
  const raw = process.env[key];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
};

const writeEnv = (key: string, value: string | undefined): void => {
  if (value === undefined) return;
  process.env[key] = value;
};

function hydrateEnvDefaults() {
  const isDev = process.env.NODE_ENV === 'development';
  for (const requirement of envRequirements) {
    if (readEnv(requirement.key)) continue;
    let resolved: string | undefined;
    for (const fallback of requirement.fallbackKeys ?? []) {
      const fallbackValue = readEnv(fallback);
      if (fallbackValue) {
        resolved = fallbackValue;
        break;
      }
    }
    if (!resolved && requirement.devDefault && isDev) {
      resolved = requirement.devDefault;
    }
    if (resolved) {
      writeEnv(requirement.key, resolved);
    }
  }
}

hydrateEnvDefaults();

let envChecked = false;

const envExists = (key: string) => Boolean(readEnv(key));

export const HAVE = {
  ODDS: envExists('ODDS_API_KEY') || envExists('ODDS_API_KEY_2'),
  UPSTASH: envExists('UPSTASH_REDIS_REST_URL') && envExists('UPSTASH_REDIS_REST_TOKEN'),
  BALLDONTLIE: envExists('BALLDONTLIE_API_KEY')
    || envExists('BALLDONTLIE_ALL_ACCESS_KEY')
    || envExists('BALDONTLIE_ALL_ACCESS_KEY')
    || envExists('ALLSPORTS_API_KEY'),
};

export type AllAccessConfig = {
  baseUrl: string;
  apiKey: string | null;
  publicBaseUrl: string;
  publicKey: string | null;
};

export function getAllAccessConfig(): AllAccessConfig {
  const rawBaseUrl =
    readEnv('BALLDONTLIE_ALL_ACCESS_BASE_URL') ??
    readEnv('BALDONTLIE_ALL_ACCESS_BASE_URL') ??
    readEnv('ALLSPORTS_API_BASE') ??
    DEFAULT_ALL_ACCESS_BASE_URL;
  const rawPublicBaseUrl =
    readEnv('NEXT_PUBLIC_BALLDONTLIE_BASE_URL') ??
    readEnv('NEXT_PUBLIC_BALLEDONTLIE_BASE_URL') ??
    readEnv('NEXT_PUBLIC_ALLSPORTS_BASE_URL') ??
    DEFAULT_PUBLIC_ALL_ACCESS_BASE_URL;
  const baseUrl = normalizeAllAccessBaseUrl(rawBaseUrl, DEFAULT_ALL_ACCESS_BASE_URL);
  const publicBaseUrl = normalizeAllAccessBaseUrl(rawPublicBaseUrl, DEFAULT_PUBLIC_ALL_ACCESS_BASE_URL);
  const apiKey =
    readEnv('BALLDONTLIE_API_KEY') ??
    readEnv('BALLDONTLIE_ALL_ACCESS_KEY') ??
    readEnv('BALDONTLIE_ALL_ACCESS_KEY') ??
    readEnv('ALLSPORTS_API_KEY') ??
    null;
  const publicKey =
    readEnv('NEXT_PUBLIC_BALLEDONTLIE_KEY') ??
    readEnv('NEXT_PUBLIC_ALLSPORTS_KEY') ??
    null;
  return { baseUrl, apiKey, publicBaseUrl, publicKey };
}

export function assertRequiredEnv(): void {
  if (typeof window !== 'undefined') {
    // Client-side bundles don't have access to server-only env vars; assume server validated them.
    if (process.env.NODE_ENV === 'production') {
      console.warn('assertRequiredEnv skipped on client bundle');
    }
    return;
  }

  if (envChecked) return;
  envChecked = true;

  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const requirement of envRequirements) {
    if (readEnv(requirement.key)) continue;
    (requirement.optional ? missingOptional : missingRequired).push(requirement.key);
  }

  const missingGroupRequired: string[] = [];
  const missingGroupOptional: string[] = [];
  for (const group of envGroupRequirements) {
    const hasValue = group.keys.some((key) => !!readEnv(key));
    if (hasValue) continue;
    const label = group.label ?? group.keys.join(' or ');
    (group.optional ? missingGroupOptional : missingGroupRequired).push(label);
  }

  const essential = [...missingRequired, ...missingGroupRequired];
  const optional = [...missingOptional, ...missingGroupOptional];

  if (!essential.length && !optional.length) return;

  const essentialMessage = essential.length
    ? `Missing required environment variables: ${essential.join(', ')}`
    : '';
  const optionalMessage = optional.length
    ? `Missing optional environment variables (features may be limited): ${optional.join(', ')}`
    : '';
  const message = [essentialMessage, optionalMessage].filter(Boolean).join('. ');

  const env = process.env.NODE_ENV;
  if (essential.length || optional.length) {
    if (env !== 'test') {
      console.warn(`[env] ${message}`);
    }
  }
}

export function getRequiredEnv(key: string): string {
  const value = readEnv(key);
  if (!value) {
    throw new Error(`Missing environment variable ${key}`);
  }
  return value;
}
