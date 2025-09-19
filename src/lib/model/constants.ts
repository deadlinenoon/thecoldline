export const PRIOR_WEIGHTS = {
  lastSeason: 0.15,
  seasonToDate: 0.7,
  lastThree: 0.15,
} as const;

export const SHRINKAGE_K_PLAYS = 200;

export const LEAGUE_MEANS = {
  pace_drives: 11.3,
  epa_per_play_off: 0.02,
  epa_per_play_def: 0.02,
  success_off: 0.435,
  success_def: 0.435,
  redzone_off_td: 0.57,
  redzone_def_td: 0.57,
  st_epa: 0,
  turnovers_per_drive_off: 0.105,
  takeaways_per_drive_def: 0.105,
  explosive_rate_off: 0.13,
  explosive_rate_def: 0.13,
  hfa: 0,
} as const;

export const PRIOR_LIMITS = {
  pace_drives: { min: 8.2, max: 14.5 },
  epa: { min: -0.35, max: 0.45 },
  success: { min: 0.32, max: 0.55 },
  redzone: { min: 0.35, max: 0.8 },
  turnovers_per_drive_off: { min: 0.04, max: 0.2 },
  takeaways_per_drive_def: { min: 0.04, max: 0.22 },
  explosive_rate: { min: 0.07, max: 0.23 },
  st_epa: { min: -4, max: 4 },
  hfa: { min: -4, max: 4 },
} as const;

export const EXPECTATION_COEFFICIENTS = {
  intercept: 1.35,
  epaOff: 6.5,
  successOff: 2.3,
  redzoneOff: 3.6,
  specialTeams: 0.35,
  defEpa: 5.9,
  defSuccess: 2.1,
  defRedzone: 2.4,
  turnoverScale: 4,
  hfa: 0.18,
};

export const POISSON_DEFAULT_CORRELATION = 0.2;

export const CLASSIC_FALLBACK = {
  marginStdev: 13.5,
  totalStdev: 9,
  correlation: 0.35,
};

export const FOOTBALL_SCORE_GRID = [
  0, 2, 3, 5, 6, 7, 8, 9, 10,
  12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 27,
  28, 29, 30, 31, 32, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 50, 51,
  52, 53, 54, 55, 56, 57, 58, 59,
  60, 61, 62, 63, 64
];

export const DEFAULT_SCORING_WEIGHTS = {
  touchdown: 0.58,
  missedPat: 0.04,
  fieldGoal: 0.28,
  twoPoint: 0.05,
  safety: 0.01,
  bigPlay: 0.04,
} as const;

export const MAX_VISIBLE_SIM_ROWS = 1000;

export type PriorsSource = "league" | "blended" | "override";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const DEFAULT_PRIOR = {
  pace_drives: LEAGUE_MEANS.pace_drives,
  epa_per_play_off: LEAGUE_MEANS.epa_per_play_off,
  epa_per_play_def: LEAGUE_MEANS.epa_per_play_def,
  success_off: LEAGUE_MEANS.success_off,
  success_def: LEAGUE_MEANS.success_def,
  redzone_off_td: LEAGUE_MEANS.redzone_off_td,
  redzone_def_td: LEAGUE_MEANS.redzone_def_td,
  st_epa: LEAGUE_MEANS.st_epa,
  turnovers_per_drive_off: LEAGUE_MEANS.turnovers_per_drive_off,
  takeaways_per_drive_def: LEAGUE_MEANS.takeaways_per_drive_def,
  explosive_rate_off: LEAGUE_MEANS.explosive_rate_off,
  explosive_rate_def: LEAGUE_MEANS.explosive_rate_def,
  hfa: LEAGUE_MEANS.hfa,
} as const;
