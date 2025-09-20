import { deriveDefenseBreakdown, deriveOffenseBreakdown, normalizeSegments } from '@/lib/metrics/redzone';

describe('normalizeSegments', () => {
  it('clamps negatives to zero and renormalizes to sum to 1', () => {
    const order = ['td', 'fg', 'to', 'fail'];
    const result = normalizeSegments({ td: 0.7, fg: 0.25, to: -0.05, fail: 0.1 }, order);
    const sum = order.reduce((total, key) => total + result[key], 0);

    expect(result.to).toBe(0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('returns all zeros when the sanitized total is zero', () => {
    const order = ['td', 'fg'];
    const result = normalizeSegments({ td: -1, fg: -2 }, order);

    expect(result.td).toBe(0);
    expect(result.fg).toBe(0);
    expect(result.td + result.fg).toBe(0);
  });

  it('preserves proportions when inputs are valid', () => {
    const order = ['a', 'b'];
    const result = normalizeSegments({ a: 2, b: 1 }, order);

    expect(result.a).toBeCloseTo(2 / 3, 10);
    expect(result.b).toBeCloseTo(1 / 3, 10);
  });
});

describe('deriveOffenseBreakdown', () => {
  it('computes remaining fail share and normalizes to 1', () => {
    const breakdown = deriveOffenseBreakdown({ td: 0.61, fg: 0.22, turnover: 0.05 });
    const total = breakdown.td + breakdown.fg + breakdown.to + breakdown.fail;

    expect(breakdown.fail).toBeCloseTo(0.12, 2);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('deriveDefenseBreakdown', () => {
  it('yields zero-share and sums to 1', () => {
    const breakdown = deriveDefenseBreakdown({ tdAllowed: 0.5, fgAllowed: 0.2, takeaway: 0.1 });
    const total = breakdown.zero + breakdown.takeaway + breakdown.fg_allowed + breakdown.td_allowed;

    expect(breakdown.zero).toBeCloseTo(0.2, 2);
    expect(total).toBeCloseTo(1, 10);
  });
});
