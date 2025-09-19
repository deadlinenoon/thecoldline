import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import GameCard from '../src/components/game/GameCard';
import { expectedPoints } from '../src/lib/model/expectation';
import { LEAGUE_MEANS } from '../src/lib/model/constants';
import getTeamPriors, { type PriorsContext } from '../src/lib/model/priors';
import simulateMatchupPoisson from '../src/lib/sim/poissonSim';

function testPriorsShrinkage() {
  const league = LEAGUE_MEANS.epa_per_play_off;
  const highContext: PriorsContext = {
    seasonToDate: {
      "Test Team": {
        epa_per_play_off: 0.18,
        plays: 450,
        pace_drives: 11.6,
        success_off: 0.47,
        redzone_off_td: 0.62,
      },
    },
  };
  const lowContext: PriorsContext = {
    seasonToDate: {
      "Test Team": {
        epa_per_play_off: 0.18,
        plays: 30,
        pace_drives: 11.6,
        success_off: 0.47,
        redzone_off_td: 0.62,
      },
    },
  };
  const priorsHigh = getTeamPriors('Test Team', 'Opponent', highContext);
  const priorsLow = getTeamPriors('Test Team', 'Opponent', lowContext);
  const target = 0.18;
  assert.ok(Math.abs(priorsHigh.epa_per_play_off - target) < Math.abs(priorsLow.epa_per_play_off - target), 'high sample should stay closer to target');
  assert.ok(Math.abs(priorsLow.epa_per_play_off - league) < Math.abs(priorsHigh.epa_per_play_off - league), 'low sample should shrink toward league mean');
}

function testExpectedPointsMonotonic() {
  const baseline: PriorsContext = {
    seasonToDate: {
      Alpha: {
        pace_drives: 11.1,
        epa_per_play_off: 0.01,
        success_off: 0.43,
        redzone_off_td: 0.56,
        plays: 420,
      },
      Beta: {
        pace_drives: 11.0,
        epa_per_play_def: 0.015,
        success_def: 0.44,
        redzone_def_td: 0.55,
        plays: 420,
      },
    },
  };

  const aggressive: PriorsContext = {
    seasonToDate: {
      Alpha: {
        pace_drives: 11.6,
        epa_per_play_off: 0.09,
        success_off: 0.5,
        redzone_off_td: 0.65,
        plays: 420,
      },
      Beta: {
        pace_drives: 11.0,
        epa_per_play_def: 0.015,
        success_def: 0.44,
        redzone_def_td: 0.55,
        plays: 420,
      },
    },
  };

  const baselineLambda = expectedPoints('Alpha', 'Beta', baseline).lambda_points;
  const aggressiveLambda = expectedPoints('Alpha', 'Beta', aggressive).lambda_points;
  assert.ok(aggressiveLambda > baselineLambda, 'higher offensive inputs should raise expected points');
}

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function testCorrelationTightensMargin() {
  const overrides = {
    Alpha: {
      pace_drives: 11.2,
      epa_per_play_off: 0.05,
      success_off: 0.46,
      redzone_off_td: 0.6,
      st_epa: 0,
      turnovers_per_drive_off: 0.1,
      epa_per_play_def: 0.02,
      success_def: 0.44,
      redzone_def_td: 0.58,
      takeaways_per_drive_def: 0.12,
      explosive_rate_off: 0.15,
      explosive_rate_def: 0.12,
      hfa: 0,
    },
    Beta: {
      pace_drives: 11.4,
      epa_per_play_off: 0.03,
      success_off: 0.45,
      redzone_off_td: 0.58,
      st_epa: 0.1,
      turnovers_per_drive_off: 0.11,
      epa_per_play_def: 0.018,
      success_def: 0.43,
      redzone_def_td: 0.57,
      takeaways_per_drive_def: 0.11,
      explosive_rate_off: 0.14,
      explosive_rate_def: 0.13,
      hfa: 0,
    },
  } satisfies PriorsContext['overrides'];

  const baseContext: PriorsContext = { overrides };
  const lowCorr = simulateMatchupPoisson({
    teamA: { id: 'Alpha', label: 'Alpha' },
    teamB: { id: 'Beta', label: 'Beta', isHome: true },
    n: 1000,
    seed: 42,
    corr: 0.05,
    roundToFootballGrid: true,
    context: baseContext,
  });
  const highCorr = simulateMatchupPoisson({
    teamA: { id: 'Alpha', label: 'Alpha' },
    teamB: { id: 'Beta', label: 'Beta', isHome: true },
    n: 1000,
    seed: 42,
    corr: 0.8,
    roundToFootballGrid: true,
    context: baseContext,
  });

  const lowStd = stdDev(lowCorr.draws.map(d => d.b - d.a));
  const highStd = stdDev(highCorr.draws.map(d => d.b - d.a));
  assert.ok(highStd < lowStd, 'higher correlation should tighten margin distribution');
}

function testGameCardSnapshot() {
  const overrides = {
    "Green Bay Packers": {
      pace_drives: 11.3,
      epa_per_play_off: 0.04,
      success_off: 0.46,
      redzone_off_td: 0.6,
      st_epa: 0.1,
      turnovers_per_drive_off: 0.1,
      takeaways_per_drive_def: 0.12,
      epa_per_play_def: 0.02,
      success_def: 0.44,
      redzone_def_td: 0.58,
      explosive_rate_off: 0.15,
      explosive_rate_def: 0.13,
      hfa: 0,
    },
    "Chicago Bears": {
      pace_drives: 11.5,
      epa_per_play_off: 0.05,
      success_off: 0.47,
      redzone_off_td: 0.62,
      st_epa: 0.05,
      turnovers_per_drive_off: 0.11,
      takeaways_per_drive_def: 0.11,
      epa_per_play_def: 0.018,
      success_def: 0.43,
      redzone_def_td: 0.56,
      explosive_rate_off: 0.16,
      explosive_rate_def: 0.12,
      hfa: 0,
    },
  } satisfies PriorsContext['overrides'];

  const redZoneMatchup = {
    teamA: {
      teamId: 'Green Bay Packers',
      displayName: 'Green Bay Packers',
      redZone: {
        offense: { td: 0.64, fg: 0.18, turnover: 0.08 },
        defense: { tdAllowed: 0.52, fgAllowed: 0.28, takeaway: 0.1 },
      },
    },
    teamB: {
      teamId: 'Chicago Bears',
      displayName: 'Chicago Bears',
      redZone: {
        offense: { td: 0.58, fg: 0.24, turnover: 0.06 },
        defense: { tdAllowed: 0.49, fgAllowed: 0.32, takeaway: 0.08 },
      },
    },
  };

  const markup = renderToStaticMarkup(
    React.createElement(GameCard, {
      home: 'Chicago Bears',
      away: 'Green Bay Packers',
      kickoff: '2025-09-01T20:20:00Z',
      marketSpread: -3,
      marketTotal: 47.5,
      defaultIterations: 10,
      simulationContext: { overrides },
      matchup: redZoneMatchup,
    })
  );

  assert.ok(markup.includes('Simulations'));
  assert.ok(markup.includes('Green Bay Packers logo'));
  assert.ok(!markup.includes('Home vs'));
  assert.ok(!markup.includes('Away team'));
  assert.ok(markup.includes('Red Zone'));
  assert.ok(markup.includes('data-testid="red-zone-bar"'));
}

function run() {
  testPriorsShrinkage();
  testExpectedPointsMonotonic();
  testCorrelationTightensMargin();
  testGameCardSnapshot();
  console.log('modelSimulation tests passed');
}

run();
