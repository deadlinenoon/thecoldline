import { NextResponse } from 'next/server';

type UpItem = { key: string; label: string; value: number; weight?: number; isHfa?: boolean };
type UpCat = { key: string; label: string; items: UpItem[]; subtotal?: number };
type UpResp = { gameId?: string; categories: UpCat[]; total?: number; hfa?: { base?: number; delta?: number } };

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

  const base = process.env.ALLSPORTS_API_BASE || '';
  const key = process.env.ALLSPORTS_API_KEY || '';
  const upstream = `${base.replace(/\/$/, '')}/nfl/metrics?home=${home}&away=${away}` +
    (season ? `&season=${encodeURIComponent(season)}` : '') +
    (week ? `&week=${encodeURIComponent(week)}` : '') +
    (kickoff ? `&kickoff=${encodeURIComponent(kickoff)}` : '');

  const response = await fetch(upstream, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store'
  });
  if (!response.ok) {
    const info = await response.text();
    return NextResponse.json(
      { error: `metrics upstream ${response.status}`, info: info.slice(0, 300) },
      { status: response.status }
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
}
