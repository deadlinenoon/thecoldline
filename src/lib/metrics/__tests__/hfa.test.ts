import hfaByTeam, { DENVER } from '@/lib/hfa';

describe('hfaByTeam', () => {
  const baseline = 3.0;

  it('gives Denver +0.25 delta vs baseline', () => {
    const value = hfaByTeam(DENVER, false);
    expect(value).toBeCloseTo(3.25, 2);
    expect(value - baseline).toBeCloseTo(0.25, 2);
  });

  it('returns fortress 3.0 venues matching the baseline', () => {
    ['Seattle Seahawks', 'Cincinnati Bengals', 'Baltimore Ravens', 'Buffalo Bills'].forEach((team) => {
      const value = hfaByTeam(team, false);
      expect(value).toBeCloseTo(3.0, 2);
      expect(value - baseline).toBeCloseTo(0.0, 2);
    });
  });

  it('returns lower 2.0 venues with -1.0 delta', () => {
    ['Las Vegas Raiders', 'Jacksonville Jaguars', 'Los Angeles Rams', 'Los Angeles Chargers'].forEach((team) => {
      const value = hfaByTeam(team, false);
      expect(value).toBeCloseTo(2.0, 2);
      expect(value - baseline).toBeCloseTo(-1.0, 2);
    });
  });

  it('assigns default 2.5 value with -0.5 delta', () => {
    const value = hfaByTeam('Philadelphia Eagles', false);
    expect(value).toBeCloseTo(2.5, 2);
    expect(value - baseline).toBeCloseTo(-0.5, 2);
  });

  it('handles neutral sites at 1.5 with -1.5 delta', () => {
    const value = hfaByTeam('Any Venue', true);
    expect(value).toBeCloseTo(1.5, 2);
    expect(value - baseline).toBeCloseTo(-1.5, 2);
  });
});
