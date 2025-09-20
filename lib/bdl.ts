import { getAllAccessConfig } from '@/lib/env';

function resolveAuthHeader(rawKey: string | null): string {
  if (!rawKey) throw new Error('BALLDONTLIE_API_KEY (or ALL_ACCESS key) is missing');
  return rawKey.startsWith('Bearer ') ? rawKey : `Bearer ${rawKey}`;
}

function buildUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/+$|$/, '/');
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${trimmedBase}${normalizedPath}`;
}

export async function bdl<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, apiKey } = getAllAccessConfig();
  const url = buildUrl(baseUrl, path);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', resolveAuthHeader(apiKey));

  const response = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`BDL ${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function bdlBase(): string {
  const { baseUrl } = getAllAccessConfig();
  return baseUrl;
}
