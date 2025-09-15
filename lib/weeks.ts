import { DateTime } from "luxon";
import { Game } from "./types";

export function getCompletedThroughWeek(games: Game[], nowET: DateTime): number {
  const futureWeeks = new Set<number>();
  for (const g of games) {
    const t = DateTime.fromISO(g.game_date_local, { zone: "America/New_York" });
    if (t > nowET) futureWeeks.add(g.week);
  }
  if (futureWeeks.size === 0) return Math.max(...games.map(g => g.week));
  const next = Math.min(...Array.from(futureWeeks));
  return next - 1;
}

export function getNextWeek(games: Game[], nowET: DateTime): number {
  const done = getCompletedThroughWeek(games, nowET);
  const all = new Set(games.map(g => g.week));
  const candidates = Array.from(all).filter(w => w > done);
  if (candidates.length === 0) throw new Error("no next week");
  return Math.min(...candidates);
}

