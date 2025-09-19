import type { AllAccessConfig } from '@/lib/env';
import { getAllAccessConfig } from '@/lib/env';

type SearchParams = Record<string, string | number | boolean | null | undefined>;

export type AllAccessFetchOptions = {
  searchParams?: SearchParams;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  cacheTtlMs?: number;
};

type CacheEntry = {
  ts: number;
  data: unknown;
};

const cacheStore = new Map<string, CacheEntry>();

function buildUrl(config: AllAccessConfig, path: string, params?: SearchParams): string {
  const base = config.baseUrl.replace(/\/$/, '');
  const normalized = path.startsWith('http') ? path : `${base}/${path.replace(/^\//, '')}`;
  const url = new URL(normalized);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function cacheKey(url: string, method: string): string {
  return `${method}:${url}`;
}

export async function balldontlieFetch<T = unknown>(path: string, options: AllAccessFetchOptions = {}): Promise<T> {
  const config = getAllAccessConfig();
  const method = options.method ?? 'GET';
  const url = buildUrl(config, path, options.searchParams);
  const key = cacheKey(url, method);

  if (method === 'GET' && options.cacheTtlMs) {
    const cached = cacheStore.get(key);
    if (cached && Date.now() - cached.ts < options.cacheTtlMs) {
      return cached.data as T;
    }
  }

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  const apiKey = config.apiKey;
  if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    cache: 'no-store',
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = typeof (payload as any)?.error === 'string'
      ? (payload as any).error
      : `balldontlie error ${response.status}`;
    throw new Error(message);
  }

  if (method === 'GET' && options.cacheTtlMs) {
    cacheStore.set(key, { ts: Date.now(), data: payload });
  }

  return payload as T;
}

export function clearBalldontlieCache(): void {
  cacheStore.clear();
}

