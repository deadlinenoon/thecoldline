function clamp(x:number, a:number, b:number){ return Math.max(a, Math.min(b, x)); }

export function computeTravelDock(milesSinceLastGame:number, milesSinceLastHome:number, milesSeasonToDate:number, tzDiff:number): number {
  const m1 = Number(milesSinceLastGame)||0;
  const m2 = Number(milesSinceLastHome)||0;
  const m3 = Number(milesSeasonToDate)||0;
  const tz = Number(tzDiff)||0;
  let dock = 0;
  dock += Math.min(0.5, m1 / 2000);
  dock += Math.min(0.25, m2 / 3000);
  dock += Math.min(0.25, m3 / 15000);
  dock += clamp(tz * 0.1, 0, 0.25);
  return Math.round(dock * 4) / 4;
}

