export function normalizeSegments(input: Record<string, number>, order: string[]): Record<string, number> {
  const sanitized: Record<string, number> = {};

  for (const key of order) {
    const raw = input?.[key];
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    sanitized[key] = value < 0 ? 0 : value;
  }

  const total = order.reduce((acc, key) => acc + sanitized[key], 0);
  if (total <= 0) {
    return order.reduce<Record<string, number>>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});
  }

  return order.reduce<Record<string, number>>((acc, key) => {
    acc[key] = sanitized[key] / total;
    return acc;
  }, {});
}

const clampInput = (value: number | null | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value;
};

export function deriveOffenseBreakdown({ td, fg, turnover }: { td?: number | null; fg?: number | null; turnover?: number | null }): { td: number; fg: number; fail: number; to: number } {
  const tdValue = clampInput(td);
  const fgValue = clampInput(fg);
  const turnoverValue = clampInput(turnover);
  const failValue = Math.max(0, 1 - tdValue - fgValue - turnoverValue);

  const normalized = normalizeSegments(
    { td: tdValue, fg: fgValue, to: turnoverValue, fail: failValue },
    ['td', 'fg', 'to', 'fail']
  );

  return {
    td: normalized.td ?? 0,
    fg: normalized.fg ?? 0,
    fail: normalized.fail ?? 0,
    to: normalized.to ?? 0,
  };
}

export function deriveDefenseBreakdown({ tdAllowed, fgAllowed, takeaway }: { tdAllowed?: number | null; fgAllowed?: number | null; takeaway?: number | null }): { zero: number; takeaway: number; fg_allowed: number; td_allowed: number } {
  const tdValue = clampInput(tdAllowed);
  const fgValue = clampInput(fgAllowed);
  const takeawayValue = clampInput(takeaway);
  const zeroValue = Math.max(0, 1 - tdValue - fgValue - takeawayValue);

  const normalized = normalizeSegments(
    { zero: zeroValue, takeaway: takeawayValue, fg_allowed: fgValue, td_allowed: tdValue },
    ['zero', 'takeaway', 'fg_allowed', 'td_allowed']
  );

  return {
    zero: normalized.zero ?? 0,
    takeaway: normalized.takeaway ?? 0,
    fg_allowed: normalized.fg_allowed ?? 0,
    td_allowed: normalized.td_allowed ?? 0,
  };
}

