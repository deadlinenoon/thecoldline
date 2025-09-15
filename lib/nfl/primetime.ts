import { DateTime } from "luxon";

export type PrimetimeTag = "MNF" | "SNF" | "TNF" | null;

/**
 * Determine MNF, SNF, or TNF based on kickoff time in ISO.
 * Returns null if not a primetime broadcast.
 * Rules: America/New_York timezone, Monday evening → MNF, Sunday evening → SNF, Thursday evening → TNF.
 * "Evening" = start time hour >= 18 local. Treat Monday doubleheaders as MNF.
 */
export function getPrimetimeTag(kickoffISO: string): PrimetimeTag {
  if (!kickoffISO) return null;
  const et = DateTime.fromISO(kickoffISO, { zone: "America/New_York" });
  if (!et.isValid) return null;
  const h = et.hour;
  const isEvening = h >= 18;
  if (et.weekday === 1 && isEvening) return "MNF";
  if (et.weekday === 7 && isEvening) return "SNF";
  if (et.weekday === 4 && isEvening) return "TNF";
  return null;
}

export function isPrimetime(kickoffISO: string): boolean {
  return getPrimetimeTag(kickoffISO) !== null;
}

