import { clamp, EXPECTATION_COEFFICIENTS, LEAGUE_MEANS, PRIOR_LIMITS } from './constants';
import getTeamPriors, { PriorsContext, TeamPriors } from './priors';

export type ExpectedPointsContext = PriorsContext & {
  priorsCache?: Map<string, TeamPriors>;
};

export type ExpectedPointsResult = {
  lambda_points: number;
  drives: number;
  pointsPerDrive: number;
  priors: TeamPriors;
  opponent: TeamPriors;
};

function cacheLookup(team: string, ctx: ExpectedPointsContext, opponent: string): TeamPriors {
  const cache = ctx.priorsCache;
  if (!cache) return getTeamPriors(team, opponent, ctx);
  const key = `${team}__${opponent}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const priors = getTeamPriors(team, opponent, ctx);
  cache.set(key, priors);
  return priors;
}

export function expectedPoints(teamId: string, opponentId: string, ctx: ExpectedPointsContext = {}): ExpectedPointsResult {
  if (!ctx.priorsCache) ctx.priorsCache = new Map<string, TeamPriors>();
  const teamPriors = cacheLookup(teamId, ctx, opponentId);
  const oppPriors = cacheLookup(opponentId, ctx, teamId);

  const coeff = EXPECTATION_COEFFICIENTS;

  let pointsPerDrive = coeff.intercept;
  pointsPerDrive += coeff.epaOff * teamPriors.epa_per_play_off;
  pointsPerDrive += coeff.successOff * (teamPriors.success_off - LEAGUE_MEANS.success_off);
  pointsPerDrive += coeff.redzoneOff * (teamPriors.redzone_off_td - LEAGUE_MEANS.redzone_off_td);
  pointsPerDrive += coeff.specialTeams * (teamPriors.st_epa / 4);

  pointsPerDrive -= coeff.defEpa * oppPriors.epa_per_play_def;
  pointsPerDrive -= coeff.defSuccess * (oppPriors.success_def - LEAGUE_MEANS.success_def);
  pointsPerDrive -= coeff.defRedzone * (oppPriors.redzone_def_td - LEAGUE_MEANS.redzone_def_td);

  const turnoverDelta = (teamPriors.turnovers_per_drive_off - oppPriors.takeaways_per_drive_def) / 2;
  pointsPerDrive -= coeff.turnoverScale * turnoverDelta;

  // Guardrail: keep points per drive within football bounds
  pointsPerDrive = clamp(pointsPerDrive, 0.3, 4);

  const drives = clamp(
    (teamPriors.pace_drives + oppPriors.pace_drives) / 2,
    PRIOR_LIMITS.pace_drives.min,
    PRIOR_LIMITS.pace_drives.max
  );

  let lambda = pointsPerDrive * drives;
  lambda += teamPriors.hfa * coeff.hfa;
  lambda = Math.max(0.1, lambda);

  return {
    lambda_points: lambda,
    drives,
    pointsPerDrive,
    priors: teamPriors,
    opponent: oppPriors,
  };
}

export default expectedPoints;
