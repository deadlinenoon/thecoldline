import type { KV } from '@/lib/kv';
import { getKV } from '@/lib/kv';
import { dstr, kHits, kSignups, kRef, kPath } from '@/lib/analytics/keys';

const kvPromise = getKV();

type Metric = 'hits' | 'signups';

type MetricDelta = {
  DoD: number | null;
  WoW: number | null;
  MoM: number | null;
  QoQ: number | null;
  YoY: number | null;
};

type MetricOverview = {
  value: number;
  trailing7: number;
  trailing30: number;
  trailing90: number;
  trailing365: number;
  delta: MetricDelta;
};

export type AnalyticsSummary = {
  today: { hits: number; signups: number };
  yesterday: { hits: number; signups: number };
  totals: { hits: MetricOverview; signups: MetricOverview };
  series: { labels: string[]; hits: number[]; signups: number[] };
  topReferrersToday: Array<{ ref: string; hits: number }>;
  topPathsToday: Array<{ path: string; hits: number }>;
};

export type AnalyticsTrends = {
  labels: string[];
  hits: number[];
  signups: number[];
  deltas: {
    WoW: number | null;
    MoM: number | null;
    QoQ: number | null;
    YoY: number | null;
  };
};

export type HitsTodayMonth = {
  hits: { today: number; month: number };
  signups: { today: number; month: number };
};

export type AnalyticsDetail = {
  recent: Array<{ ts: number; path: string; ref?: string; uid?: string; title?: string }>;
  topPaths: Array<{ path: string; count: number }>;
  uniqueUsers: string[];
};

const metricKey = {
  hits: kHits,
  signups: kSignups,
} as const;

function dayKeyFromOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return dstr(date);
}

function computeDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) {
    if (!Number.isFinite(current) || current === 0) return 0;
    return null;
  }
  const delta = ((current - previous) / previous) * 100;
  return Number.isFinite(delta) ? Number(delta.toFixed(2)) : null;
}

async function sumMetric(metric: Metric, days: number, offset = 0): Promise<number> {
  const kv = await kvPromise;
  const tasks: Promise<number>[] = [];
  for (let i = 0; i < days; i += 1) {
    const dayKey = dayKeyFromOffset(i + offset);
    tasks.push(kv.getNum(metricKey[metric](dayKey)));
  }
  const values = await Promise.all(tasks);
  return values.reduce((acc, value) => acc + Number(value ?? 0), 0);
}

async function sumMetricRange(metric: Metric, start: Date, end: Date): Promise<number> {
  const kv = await kvPromise;
  const tasks: Promise<number>[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor <= end) {
    const key = metricKey[metric](dstr(cursor));
    tasks.push(kv.getNum(key));
    cursor.setDate(cursor.getDate() + 1);
  }
  const values = await Promise.all(tasks);
  return values.reduce((acc, value) => acc + Number(value ?? 0), 0);
}

async function getMetricValue(metric: Metric, offset: number): Promise<number> {
  const kv = await kvPromise;
  const value = await kv.getNum(metricKey[metric](dayKeyFromOffset(offset)));
  return Number.isFinite(value) ? value : 0;
}

async function buildSeries(days: number): Promise<{ labels: string[]; hits: number[]; signups: number[] }> {
  const kv = await kvPromise;
  const labels: string[] = [];
  const hits: number[] = [];
  const signups: number[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dayKey = dayKeyFromOffset(offset);
    labels.push(dayKey);
    const [hitsValue, signupValue] = await Promise.all([
      kv.getNum(kHits(dayKey)),
      kv.getNum(kSignups(dayKey)),
    ]);
    hits.push(Number.isFinite(hitsValue) ? hitsValue : 0);
    signups.push(Number.isFinite(signupValue) ? signupValue : 0);
  }
  return { labels, hits, signups };
}

async function fetchTopToday<K extends 'ref' | 'path'>(kind: K, limit: number) {
  const kv = await kvPromise;
  const todayKey = dayKeyFromOffset(0);
  const zKey = kind === 'ref' ? kRef(todayKey) : kPath(todayKey);
  const entries = await kv.ztop(zKey, limit);
  if (!Array.isArray(entries)) return [];
  return entries.map(entry => {
    const [label, score] = entry;
    return {
      label: String(label || (kind === 'ref' ? 'direct' : '/')),
      hits: Number(score ?? 0),
    };
  });
}

export async function loadAnalyticsSummary(): Promise<AnalyticsSummary> {
  const [hitsToday, hitsYesterday, signupsToday, signupsYesterday] = await Promise.all([
    getMetricValue('hits', 0),
    getMetricValue('hits', 1),
    getMetricValue('signups', 0),
    getMetricValue('signups', 1),
  ]);

  const [hits7, hitsPrev7, hits30, hitsPrev30, hits90, hitsPrev90, hits365, hitsPrev365] = await Promise.all([
    sumMetric('hits', 7, 0),
    sumMetric('hits', 7, 7),
    sumMetric('hits', 30, 0),
    sumMetric('hits', 30, 30),
    sumMetric('hits', 90, 0),
    sumMetric('hits', 90, 90),
    sumMetric('hits', 365, 0),
    sumMetric('hits', 365, 365),
  ]);

  const [signups7, signupsPrev7, signups30, signupsPrev30, signups90, signupsPrev90, signups365, signupsPrev365] = await Promise.all([
    sumMetric('signups', 7, 0),
    sumMetric('signups', 7, 7),
    sumMetric('signups', 30, 0),
    sumMetric('signups', 30, 30),
    sumMetric('signups', 90, 0),
    sumMetric('signups', 90, 90),
    sumMetric('signups', 365, 0),
    sumMetric('signups', 365, 365),
  ]);

  const series = await buildSeries(14);
  const [topRefsRaw, topPathsRaw] = await Promise.all([
    fetchTopToday('ref', 10),
    fetchTopToday('path', 10),
  ]);

  return {
    today: { hits: hitsToday, signups: signupsToday },
    yesterday: { hits: hitsYesterday, signups: signupsYesterday },
    totals: {
      hits: {
        value: hits30,
        trailing7: hits7,
        trailing30: hits30,
        trailing90: hits90,
        trailing365: hits365,
        delta: {
          DoD: computeDelta(hitsToday, hitsYesterday),
          WoW: computeDelta(hits7, hitsPrev7),
          MoM: computeDelta(hits30, hitsPrev30),
          QoQ: computeDelta(hits90, hitsPrev90),
          YoY: computeDelta(hits365, hitsPrev365),
        },
      },
      signups: {
        value: signups30,
        trailing7: signups7,
        trailing30: signups30,
        trailing90: signups90,
        trailing365: signups365,
        delta: {
          DoD: computeDelta(signupsToday, signupsYesterday),
          WoW: computeDelta(signups7, signupsPrev7),
          MoM: computeDelta(signups30, signupsPrev30),
          QoQ: computeDelta(signups90, signupsPrev90),
          YoY: computeDelta(signups365, signupsPrev365),
        },
      },
    },
    series,
    topReferrersToday: topRefsRaw.map(entry => ({ ref: entry.label, hits: entry.hits })),
    topPathsToday: topPathsRaw.map(entry => ({ path: entry.label, hits: entry.hits })),
  };
}

export async function loadAnalyticsTrends(): Promise<AnalyticsTrends> {
  const series = await buildSeries(30);
  const [hits7, hitsPrev7, hits30, hitsPrev30, hits90, hitsPrev90, hits365, hitsPrev365] = await Promise.all([
    sumMetric('hits', 7, 0),
    sumMetric('hits', 7, 7),
    sumMetric('hits', 30, 0),
    sumMetric('hits', 30, 30),
    sumMetric('hits', 90, 0),
    sumMetric('hits', 90, 90),
    sumMetric('hits', 365, 0),
    sumMetric('hits', 365, 365),
  ]);

  return {
    ...series,
    deltas: {
      WoW: computeDelta(hits7, hitsPrev7),
      MoM: computeDelta(hits30, hitsPrev30),
      QoQ: computeDelta(hits90, hitsPrev90),
      YoY: computeDelta(hits365, hitsPrev365),
    },
  };
}

export async function loadHitsTodayMonth(): Promise<HitsTodayMonth> {
  const today = dayKeyFromOffset(0);
  const kv = await kvPromise;
  const [hitsToday, signupsToday] = await Promise.all([
    kv.getNum(kHits(today)),
    kv.getNum(kSignups(today)),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const hitsMonth = await sumMetricRange('hits', monthStart, now);
  const signupsMonth = await sumMetricRange('signups', monthStart, now);

  return {
    hits: { today: Number.isFinite(hitsToday) ? hitsToday : 0, month: hitsMonth },
    signups: { today: Number.isFinite(signupsToday) ? signupsToday : 0, month: signupsMonth },
  };
}

async function fetchRecentEvents(days: number, limit: number): Promise<any[]> {
  const kv = await kvPromise;
  try {
    const slice = await kv.lrange('analytics:events', 0, 5000);
    const events = slice
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter((value): value is Record<string, unknown> => Boolean(value));
    if (!events.length) return [];
    const since = Date.now() - days * 864e5;
    return events
      .filter(event => Number(event?.ts) >= since)
      .slice(0, limit * 5); // keep extra before trimming to allow filtering by unique path/users
  } catch {
    return [];
  }
}

export async function loadAnalyticsDetail(days: number, recentLimit: number): Promise<AnalyticsDetail> {
  const events = await fetchRecentEvents(days, recentLimit);
  const topPathsMap = new Map<string, number>();
  const recent: Array<{ ts: number; path: string; ref?: string; uid?: string; title?: string }> = [];
  const usersSet = new Set<string>();

  for (const raw of events) {
    const ts = Number(raw?.ts);
    const path = String(raw?.path ?? '/');
    if (Number.isFinite(ts)) {
      recent.push({ ts, path, ref: raw?.ref ? String(raw.ref) : undefined, uid: raw?.uid ? String(raw.uid) : undefined, title: raw?.title ? String(raw.title) : undefined });
    }
    topPathsMap.set(path, (topPathsMap.get(path) ?? 0) + 1);
    if (raw?.uid) usersSet.add(String(raw.uid));
  }

  recent.sort((a, b) => b.ts - a.ts);

  const topPaths = [...topPathsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  return {
    recent: recent.slice(0, recentLimit),
    topPaths,
    uniqueUsers: Array.from(usersSet.values()),
  };
}
