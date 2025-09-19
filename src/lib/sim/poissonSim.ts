import { CLASSIC_FALLBACK, DEFAULT_SCORING_WEIGHTS, FOOTBALL_SCORE_GRID, LEAGUE_MEANS, POISSON_DEFAULT_CORRELATION, clamp } from '../model/constants';
import expectedPoints, { ExpectedPointsContext, ExpectedPointsResult } from '../model/expectation';
import type { TeamPriors } from '../model/priors';

export type SimTeam = {
  id: string;
  label: string;
  isHome?: boolean;
};

export type ClassicFallbackInput = {
  spread?: number | null;
  total?: number | null;
  marginStdev?: number;
  totalStdev?: number;
  correlation?: number;
};

export type SimulationDraw = { a: number; b: number };

export type SimulationSummary = {
  winPctA: number;
  winPctB: number;
  tiePct: number;
  meanTotal: number;
  meanMargin: number;
};

export type SimulationResult = {
  draws: SimulationDraw[];
  summary: SimulationSummary;
  usedFallback: boolean;
  meta: {
    lambdaA: number;
    lambdaB: number;
    engine: 'team' | 'classic';
  };
};

export type SimulationOptions = {
  teamA: SimTeam;
  teamB: SimTeam;
  n: number;
  seed?: number;
  corr?: number;
  roundToFootballGrid?: boolean;
  context?: ExpectedPointsContext;
  classicFallback?: ClassicFallbackInput;
  engine?: 'team' | 'classic';
};

const warnedFallback = new Set<string>();

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed?: number): () => number {
  if (typeof seed === 'number') return mulberry32(seed);
  return Math.random;
}

function erf(x: number): number {
  // Abramowitz and Stegun approximation
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(z: number): number {
  const v = 0.5 * (1 + erf(z / Math.SQRT2));
  return clamp(v, 1e-12, 1 - 1e-12);
}

function poissonInverse(lambda: number, u: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    // Normal approximation for higher rates
    const mean = lambda;
    const std = Math.sqrt(lambda);
    const approx = mean + std * inverseNormal(u);
    return Math.max(0, Math.round(approx));
  }
  const expNegLambda = Math.exp(-lambda);
  let cumulative = expNegLambda;
  let k = 0;
  let prob = expNegLambda;
  while (u > cumulative) {
    k += 1;
    prob *= lambda / k;
    cumulative += prob;
    if (k > 250) break;
  }
  return k;
}

function inverseNormal(u: number): number {
  // Peter J. Acklam approximation
  if (u <= 0 || u >= 1) {
    return u === 0 ? -Infinity : Infinity;
  }
  const a = [
    -3.969683028665376e+01,
    2.209460984245205e+02,
    -2.759285104469687e+02,
    1.383577518672690e+02,
    -3.066479806614716e+01,
    2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01,
    1.615858368580409e+02,
    -1.556989798598866e+02,
    6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
    4.374664141464968e+00,
    2.938163982698783e+00
  ];
  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e+00,
    3.754408661907416e+00
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (u < plow) {
    const q = Math.sqrt(-2 * Math.log(u));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (u > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - u));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = u - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function buildScoringDistribution(priors: TeamPriors) {
  const leagueRedzone = LEAGUE_MEANS.redzone_off_td;
  const leagueExplosive = LEAGUE_MEANS.explosive_rate_off;

  const tdBase = clamp(0.45 + (priors.redzone_off_td - leagueRedzone) * 0.9, 0.25, 0.82);
  const explosiveBonus = clamp((priors.explosive_rate_off - leagueExplosive) * 1.3, -0.12, 0.12);
  const fgBase = clamp(
    DEFAULT_SCORING_WEIGHTS.fieldGoal + (leagueRedzone - priors.redzone_off_td) * 0.4 - explosiveBonus * 0.25,
    0.12,
    0.5
  );
  const twoPoint = clamp(DEFAULT_SCORING_WEIGHTS.twoPoint + explosiveBonus * 0.4, 0.01, 0.12);
  const safety = clamp(DEFAULT_SCORING_WEIGHTS.safety + (priors.takeaways_per_drive_def - priors.turnovers_per_drive_off) * 0.05, 0.005, 0.04);
  const tdWithXp = tdBase * 0.88;
  const tdMissed = tdBase * 0.12 + DEFAULT_SCORING_WEIGHTS.missedPat;

  let weights = [
    { points: 7, weight: tdWithXp },
    { points: 6, weight: tdMissed },
    { points: 8, weight: twoPoint },
    { points: 3, weight: fgBase },
    { points: 2, weight: safety },
  ];

  const totalWeight = weights.reduce((acc, w) => acc + w.weight, 0);
  if (totalWeight <= 0) weights = weights.map(w => ({ ...w, weight: 1 / weights.length }));
  else weights = weights.map(w => ({ ...w, weight: w.weight / totalWeight }));

  const expectedPointsPerEvent = weights.reduce((acc, w) => acc + w.points * w.weight, 0);
  return { weights, expectedPointsPerEvent };
}

function samplePointsFromDistribution(count: number, distribution: Array<{ points: number; weight: number }>, rng: () => number): number {
  if (count <= 0) return 0;
  const cumulative: number[] = [];
  let acc = 0;
  for (const entry of distribution) {
    acc += entry.weight;
    cumulative.push(acc);
  }
  let totalPoints = 0;
  for (let i = 0; i < count; i += 1) {
    const u = rng();
    const target = u * acc;
    const idx = cumulative.findIndex(c => target <= c + 1e-12);
    const entry = distribution[idx >= 0 ? idx : distribution.length - 1];
    totalPoints += entry.points;
  }
  return totalPoints;
}

function roundScore(score: number, useGrid: boolean): number {
  if (!useGrid) return Math.round(score);
  const grid = FOOTBALL_SCORE_GRID;
  if (score >= grid[grid.length - 1]) return Math.round(score);
  let best = grid[0];
  let bestDiff = Math.abs(score - best);
  for (const value of grid) {
    const diff = Math.abs(score - value);
    if (diff < bestDiff) {
      best = value;
      bestDiff = diff;
    }
  }
  return best;
}

function priorsAvailable(result: ExpectedPointsResult): boolean {
  const meta = result.priors.meta;
  if (!meta) return false;
  if (meta.source === 'league' && (meta.samplePlays ?? 0) === 0) return false;
  return true;
}

function makeFallbackKey(teamA: SimTeam, teamB: SimTeam): string {
  return `${teamA.id}__${teamB.id}`;
}

export function simulateClassic(options: SimulationOptions & { fallback?: ClassicFallbackInput }): SimulationResult {
  const { teamA, teamB, n, seed, roundToFootballGrid } = options;
  const fallback = options.fallback ?? options.classicFallback ?? {};
  const rng = createRng(seed);

  const spread = fallback.spread ?? 0;
  const total = fallback.total ?? 43.5;
  const marginMean = -spread;
  const totalMean = total;
  const marginStd = fallback.marginStdev ?? CLASSIC_FALLBACK.marginStdev;
  const totalStd = fallback.totalStdev ?? CLASSIC_FALLBACK.totalStdev;
  const corr = clamp(fallback.correlation ?? CLASSIC_FALLBACK.correlation, -0.95, 0.95);

  const draws: SimulationDraw[] = [];
  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let sumTotal = 0;
  let sumMargin = 0;

  for (let i = 0; i < n; i += 1) {
    const [z1, z2] = randomNormalPair(rng);
    const margin = marginMean + marginStd * z1;
    const totalScore = totalMean + totalStd * (corr * z1 + Math.sqrt(1 - corr * corr) * z2);

    let scoreB = clamp((totalScore + margin) / 2, 0, 80);
    let scoreA = clamp(totalScore - scoreB, 0, 80);
    scoreA = roundScore(scoreA, !!roundToFootballGrid);
    scoreB = roundScore(scoreB, !!roundToFootballGrid);

    draws.push({ a: scoreA, b: scoreB });
    if (scoreA > scoreB) winsA += 1;
    else if (scoreB > scoreA) winsB += 1;
    else ties += 1;
    sumTotal += scoreA + scoreB;
    sumMargin += scoreB - scoreA;
  }

  const summary: SimulationSummary = {
    winPctA: winsA / n,
    winPctB: winsB / n,
    tiePct: ties / n,
    meanTotal: sumTotal / n,
    meanMargin: sumMargin / n,
  };

  return {
    draws,
    summary,
    usedFallback: true,
    meta: {
      lambdaA: Math.max(0.1, (totalMean - marginMean) / 2),
      lambdaB: Math.max(0.1, (totalMean + marginMean) / 2),
      engine: 'classic',
    },
  };
}

function randomNormalPair(rng: () => number): [number, number] {
  const u1 = clamp(rng(), 1e-12, 1 - 1e-12);
  const u2 = rng();
  const radius = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  return [radius * Math.cos(theta), radius * Math.sin(theta)];
}

export function simulateMatchupPoisson(options: SimulationOptions): SimulationResult {
  const { teamA, teamB, n, seed, roundToFootballGrid } = options;
  const correlation = options.corr ?? POISSON_DEFAULT_CORRELATION;
  const rng = createRng(seed);
  const context = options.context ?? {};

  const expA = expectedPoints(teamA.id, teamB.id, context);
  const expB = expectedPoints(teamB.id, teamA.id, context);

  const forceClassic = options.engine === 'classic';
  const missingPriors = !priorsAvailable(expA) || !priorsAvailable(expB);

  if (forceClassic || missingPriors) {
    const key = makeFallbackKey(teamA, teamB);
    if (missingPriors && process.env.NODE_ENV !== 'production' && !warnedFallback.has(key)) {
      console.warn(`simulateMatchupPoisson falling back to classic engine for ${teamA.id} vs ${teamB.id}`);
      warnedFallback.add(key);
    }
    return simulateClassic({ ...options, fallback: options.classicFallback, engine: 'classic' });
  }

  const profileA = buildScoringDistribution(expA.priors);
  const profileB = buildScoringDistribution(expB.priors);
  const lambdaEventsA = Math.max(0.05, expA.lambda_points / Math.max(0.5, profileA.expectedPointsPerEvent));
  const lambdaEventsB = Math.max(0.05, expB.lambda_points / Math.max(0.5, profileB.expectedPointsPerEvent));

  const draws: SimulationDraw[] = [];
  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let sumTotal = 0;
  let sumMargin = 0;

  for (let i = 0; i < n; i += 1) {
    const [zA, zIndependent] = randomNormalPair(rng);
    const zB = correlation * zA + Math.sqrt(1 - correlation * correlation) * zIndependent;
    const uA = normalCdf(zA);
    const uB = normalCdf(zB);

    const eventsA = poissonInverse(lambdaEventsA, uA);
    const eventsB = poissonInverse(lambdaEventsB, uB);

    let pointsA = samplePointsFromDistribution(eventsA, profileA.weights, rng);
    let pointsB = samplePointsFromDistribution(eventsB, profileB.weights, rng);

    pointsA = roundScore(pointsA, !!roundToFootballGrid);
    pointsB = roundScore(pointsB, !!roundToFootballGrid);

    draws.push({ a: pointsA, b: pointsB });
    if (pointsA > pointsB) winsA += 1;
    else if (pointsB > pointsA) winsB += 1;
    else ties += 1;

    sumTotal += pointsA + pointsB;
    sumMargin += pointsB - pointsA;
  }

  const summary: SimulationSummary = {
    winPctA: winsA / n,
    winPctB: winsB / n,
    tiePct: ties / n,
    meanTotal: sumTotal / n,
    meanMargin: sumMargin / n,
  };

  return {
    draws,
    summary,
    usedFallback: false,
    meta: {
      lambdaA: expA.lambda_points,
      lambdaB: expB.lambda_points,
      engine: 'team',
    },
  };
}

export default simulateMatchupPoisson;
