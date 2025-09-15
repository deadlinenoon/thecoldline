export function computeFatigueAutos(prevOffPlays: number, prevDefPlays: number): number {
  const o = Number(prevOffPlays)||0; const d = Number(prevDefPlays)||0;
  const total = o + d;
  if (total >= 175) return 3;
  if (total >= 160) return 2;
  if (total >= 140) return 1;
  return 0;
}

