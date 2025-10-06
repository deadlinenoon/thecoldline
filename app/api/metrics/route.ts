import { NextResponse } from 'next/server';
import { getAllAccessConfig } from '@/lib/env';
import { metricsConfig } from '@/metrics.config';

type UpItem = { key: string; label: string; value: number; weight?: number; isHfa?: boolean };
type UpCat = { key: string; label: string; items: UpItem[]; subtotal?: number };
type UpResp = { gameId?: string; categories: UpCat[]; total?: number; hfa?: { base?: number; delta?: number } };

type FallbackOptions = {
  error?: string;
};

function buildFallbackPayload({ error }: FallbackOptions = {}) {
  const grouped = new Map<string, { key: string; label: string; value: number; weight?: number }[]>();
  for (const metric of metricsConfig) {
    const key = metric.group || 'Misc';
    const list = grouped.get(key) ?? [];
    list.push({
      key: metric.id,
      label: metric.label,
      value: 0,
      weight: metric.weight,
    });
    grouped.set(key, list);
  }

  const categories = Array.from(grouped.entries()).map(([label, items]) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    label,
    items,
    subtotal: 0,
  }));

  return {
    gameId: null,
    categories,
    total: 0,
    hfa: { base: 0, delta: 0 },
    count: metricsConfig.length,
    error,
    source: 'fallback',
  } satisfies Record<string, unknown>;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const home = url.searchParams.get('home')?.toUpperCase() || '';
  const away = url.searchParams.get('away')?.toUpperCase() || '';
  const season = url.searchParams.get('season') || '';
  const week = url.searchParams.get('week') || '';
  const kickoff = url.searchParams.get('kickoff') || '';

  if (!home || !away) {
    return NextResponse.json({ error: 'home and away are required' }, { status: 400 });
  }

  const allAccess = getAllAccessConfig();
  const baseCandidate =
    process.env.ALLSPORTS_API_BASE ||
    process.env.BALLDONTLIE_ALL_ACCESS_BASE_URL ||
    process.env.BALDONTLIE_ALL_ACCESS_BASE_URL ||
    process.env.NEXT_PUBLIC_ALLSPORTS_BASE_URL ||
    process.env.NEXT_PUBLIC_BALLEDONTLIE_BASE_URL ||
    process.env.NEXT_PUBLIC_BALLDONTLIE_BASE_URL ||
    allAccess.baseUrl ||
    allAccess.publicBaseUrl ||
    '';
  const keyCandidate =
    process.env.ALLSPORTS_API_KEY ||
    process.env.BALLDONTLIE_ALL_ACCESS_KEY ||
    process.env.BALDONTLIE_ALL_ACCESS_KEY ||
    process.env.BALLDONTLIE_API_KEY ||
    process.env.NEXT_PUBLIC_ALLSPORTS_KEY ||
    process.env.NEXT_PUBLIC_BALLEDONTLIE_KEY ||
    allAccess.apiKey ||
    allAccess.publicKey ||
    '';

  if (!baseCandidate || !keyCandidate) {
    return NextResponse.json(buildFallbackPayload({ error: 'metrics upstream not configured' }), { status: 200 });
  }

  const normalizedBase = (baseCandidate || 'https://all-access.balldontlie.io/v1').replace(/\/$/, '');
  const metricsPath = normalizedBase.includes('/sports/')
    ? `${normalizedBase}/metrics`
    : `${normalizedBase}/sports/nfl/metrics`;
  const upstream = `${metricsPath}?home=${home}&away=${away}` +
    (season ? `&season=${encodeURIComponent(season)}` : '') +
    (week ? `&week=${encodeURIComponent(week)}` : '') +
    (kickoff ? `&kickoff=${encodeURIComponent(kickoff)}` : '');

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (keyCandidate) {
    headers.Authorization = keyCandidate.startsWith('Bearer ')
      ? keyCandidate
      : `Bearer ${keyCandidate}`;
  }

  try {
    const response = await fetch(upstream, {
      headers,
      cache: 'no-store'
    });
    if (!response.ok) {
      const info = await response.text();
      return NextResponse.json(
        buildFallbackPayload({ error: `metrics upstream ${response.status}: ${info.slice(0, 200)}` }),
        { status: 200 }
      );
    }
    const upstreamJson = (await response.json()) as UpResp;

    const categories = (upstreamJson.categories || []).map(category => ({
      key: category.key,
      label: category.label,
      items: (category.items || []).map(item => ({
        key: item.key,
        label: item.label,
        value: Number(item.value ?? 0),
        weight: item.weight,
        isHfa: Boolean(item.isHfa)
      })),
      subtotal: typeof category.subtotal === 'number'
        ? category.subtotal
        : (category.items || []).reduce((sum, item) => sum + Number(item.value ?? 0), 0)
    }));
    const count = categories.reduce((acc, category) => acc + category.items.length, 0);
    const total = typeof upstreamJson.total === 'number'
      ? upstreamJson.total
      : categories.reduce((sum, category) => sum + category.subtotal, 0);
    const hfa = {
      base: Number(upstreamJson.hfa?.base ?? 0),
      delta: Number(upstreamJson.hfa?.delta ?? 0)
    };

    return NextResponse.json({
      gameId: upstreamJson.gameId ?? null,
      categories,
      total,
      hfa,
      count
    });
  } catch (error: unknown) {
    console.error('[api/metrics] fallback', error);
    return NextResponse.json(buildFallbackPayload({ error: error instanceof Error ? error.message : 'metrics fetch failed' }), { status: 200 });
  }
}
