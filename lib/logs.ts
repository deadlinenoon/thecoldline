export type WarnRow = { ts: number; slice: string; msg: string };
const RING: WarnRow[] = [];
const CAP = 100;

export function logWarn(slice: string, msg: any) {
  try {
    const row: WarnRow = { ts: Date.now(), slice, msg: String(msg ?? '') };
    RING.push(row);
    while (RING.length > CAP) RING.shift();
    // eslint-disable-next-line no-console
    console.warn(`[warn] ${slice}: ${row.msg}`);
  } catch {}
}

export function recentWarns(n = 20): WarnRow[] {
  const k = Math.max(1, Math.min(n, CAP));
  return RING.slice(-k);
}

