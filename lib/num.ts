export function toNum(v: any, d: number = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function pctInt(v: any): number {
  return Math.round(toNum(v, 0));
}

