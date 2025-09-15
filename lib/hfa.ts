// Authoritative Home Field Advantage tiers
// Exported for use across pages/components

export const DENVER = "Denver Broncos"; // 3.25

export const HFA_2_0 = new Set<string>([
  "Las Vegas Raiders","Jacksonville Jaguars","Los Angeles Rams","Los Angeles Chargers"
]);

export const HFA_3_0 = new Set<string>([
  "Seattle Seahawks","Cincinnati Bengals",
  "Baltimore Ravens","Buffalo Bills","Chicago Bears","Dallas Cowboys",
  "Detroit Lions","Green Bay Packers","Kansas City Chiefs","Miami Dolphins",
  "Minnesota Vikings","New England Patriots","Philadelphia Eagles",
  "Pittsburgh Steelers","San Francisco 49ers","Washington Commanders"
]);

export function hfaByTeam(home: string, neutral: boolean) {
  const t = (home || "").trim();
  if (neutral) return 1.5;
  if (t === DENVER) return 3.25;
  if (HFA_2_0.has(t)) return 2.0;
  if (HFA_3_0.has(t)) return 3.0; // Lions are here
  return 2.5;
}

export default hfaByTeam;

