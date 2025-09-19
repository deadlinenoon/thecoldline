import {
  TRAVEL_TTL_SECONDS as LEGACY_TRAVEL_TTL_SECONDS,
  travelTableKey as legacyTravelTableKey,
  travelCacheKey as legacyTravelCacheKey,
  determineTargetWeek as legacyDetermineTargetWeek,
  buildTravelMetrics as legacyBuildTravelMetrics,
} from '../../../lib/travel/metrics';

const TRAVEL_TTL_INTERNAL = LEGACY_TRAVEL_TTL_SECONDS;

export const TRAVEL_TTL_SECONDS: number = TRAVEL_TTL_INTERNAL;

export function travelTableKey(season: number): string {
  return legacyTravelTableKey(season);
}

export function travelCacheKey(season: number, week: number): string {
  return legacyTravelCacheKey(season, week);
}

export function determineTargetWeek(season: number): Promise<number> {
  return legacyDetermineTargetWeek(season);
}

export function buildTravelMetrics(season: number, week: number | null): Promise<any> {
  return legacyBuildTravelMetrics(season, week);
}
