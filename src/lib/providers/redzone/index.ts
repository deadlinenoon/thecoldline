import { balldontlieFetch } from '@/lib/providers/balldontlie/client';
import type { MatchupContextArgs } from '@/lib/providers/balldontlie';

export type RedZoneMatchupFeed = {
  home?: Record<string, unknown> | null;
  away?: Record<string, unknown> | null;
};

const FEED_PATH = 'sports/nfl/matchups/red-zone';
const FEED_TTL_MS = 5 * 60 * 1000;

export async function getRedZoneMatchupFeed(args: MatchupContextArgs): Promise<RedZoneMatchupFeed | null> {
  try {
    const payload = await balldontlieFetch<RedZoneMatchupFeed>(FEED_PATH, {
      searchParams: {
        home: args.home,
        away: args.away,
        kickoff: args.kickoff ?? undefined,
        sport: (args.sport ?? 'nfl').toLowerCase(),
      },
      cacheTtlMs: FEED_TTL_MS,
    });
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  } catch {
    return null;
  }
}
