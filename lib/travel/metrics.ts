import { DateTime } from "luxon";
import STADIUMS from "../../libs/nfl/stadiums";
import { buildTravelTable } from "../../libs/nfl/buildTravelTable";
import { normalizeTeam } from "../../libs/nfl/teams";
import { teamAbbr } from "../abbr";
import { loadSchedule } from "../io";
import { getNextWeek } from "../weeks";

export type TravelMetrics = {
  milesSinceLastGame: number;
  milesSinceLastHome: number;
  milesSeasonToDate: number;
  tzDiff: number;
};

const ttlSeconds = 8 * 24 * 60 * 60;

function tzFromLon(lon: number): number {
  if (!Number.isFinite(lon)) return 0;
  return Math.round((-lon) / 15);
}

function toAbbr(team: string): string {
  const canonical = normalizeTeam(team);
  const ab = teamAbbr(canonical);
  if (ab === "WSH") return "WAS";
  if (ab && ab !== canonical) return ab;
  const upper = team.toUpperCase();
  if (upper === "WSH") return "WAS";
  return upper.length <= 4 ? upper : canonical.toUpperCase();
}

function summarizeWeek(rows: Awaited<ReturnType<typeof buildTravelTable>>, week: number): Record<string, TravelMetrics> {
  const out: Record<string, TravelMetrics> = {};
  for (const row of rows) {
    if (row.week !== week) continue;
    const abbr = toAbbr(row.team);
    const home = STADIUMS[normalizeTeam(row.team)] ?? null;
    const tz = Math.abs(tzFromLon(row.game_lon) - tzFromLon(home?.lon ?? row.game_lon));
    out[abbr] = {
      milesSinceLastGame: Math.round(Number(row.distance_from_prev_location_mi ?? 0)),
      milesSinceLastHome: Math.round(Number(row.miles_since_last_home ?? 0)),
      milesSeasonToDate: Math.round(Number(row.cumulative_miles ?? 0)),
      tzDiff: tz,
    };
  }
  return out;
}

export async function determineTargetWeek(season: number): Promise<number> {
  try {
    const schedule = (await loadSchedule()).filter((g) => g.season === season);
    if (schedule.length === 0) throw new Error("no schedule rows for season");
    const nowET = DateTime.now().setZone("America/New_York");
    return getNextWeek(schedule, nowET);
  } catch {
    const fallbackWeek = Math.max(1, Math.min(18, Number(process.env.NEXT_PUBLIC_DEFAULT_WEEK ?? 1)));
    return fallbackWeek;
  }
}

export async function buildTravelMetrics(season: number, week: number | null): Promise<{
  week: number;
  metrics: Record<string, TravelMetrics>;
  table: Awaited<ReturnType<typeof buildTravelTable>>;
}> {
  const table = await buildTravelTable(season);
  const targetWeek = week && week > 0 ? week : await determineTargetWeek(season);
  const metrics = summarizeWeek(table, targetWeek);
  return { week: targetWeek, metrics, table };
}

export function travelCacheKey(season: number, week: number): string {
  return `travel:${season}:${week}`;
}

export function travelTableKey(season: number): string {
  return `travel:${season}:table`;
}

export const TRAVEL_TTL_SECONDS = ttlSeconds;
