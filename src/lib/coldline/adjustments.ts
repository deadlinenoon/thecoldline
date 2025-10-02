import type { ColdLineWeight } from './weights';

export type AdjustmentOrientation = 'home' | 'away' | 'neutral';

export type ColdLineAdjustmentDetail = {
  key: string;
  label: string;
  rawPoints: number;
  coldLine: number;
  epaPerPlayDelta: number;
  winProbabilityDelta: number;
  atsCoverDelta: number;
  significance?: string;
  source?: string;
  orientation: AdjustmentOrientation;
  explanation?: string;
};

const COLD_LINE_CAP = 3;
const FALLBACK_POINTS_TO_EPA = 0.0026; // ~0.26 EPA for 10 points (rule of thumb)
const FALLBACK_POINTS_TO_WIN = 0.27; // ~2.7 win% per point
const FALLBACK_POINTS_TO_ATS = 0.30; // ~3.0 ATS% per point

export const clampColdLine = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value > COLD_LINE_CAP) return COLD_LINE_CAP;
  if (value < -COLD_LINE_CAP) return -COLD_LINE_CAP;
  return Number(value);
};

function scaleFromWeight(weight: ColdLineWeight | undefined, rawPoints: number) {
  if (!weight) {
    return {
      cold: clampColdLine(rawPoints),
      epa: rawPoints * FALLBACK_POINTS_TO_EPA,
      win: rawPoints * FALLBACK_POINTS_TO_WIN,
      ats: rawPoints * FALLBACK_POINTS_TO_ATS,
      significance: undefined,
    };
  }

  const baseline = weight.coldLineAdjustment || weight.averageEffectPoints || 0;
  const scale = baseline === 0 ? 0 : rawPoints / baseline;
  const epa = weight.epaPerPlayDelta * scale;
  const win = weight.winProbabilityDelta * scale;
  const ats = weight.atsCoverDelta * scale;
  return {
    cold: clampColdLine(rawPoints),
    epa,
    win,
    ats,
    significance: weight.significance || undefined,
  };
}

export function buildAdjustment(
  key: string,
  label: string,
  rawPoints: number,
  orientation: AdjustmentOrientation,
  weight?: ColdLineWeight,
  extras: Partial<Pick<ColdLineAdjustmentDetail, 'source' | 'explanation'>> = {},
): ColdLineAdjustmentDetail {
  const scaled = scaleFromWeight(weight, rawPoints);
  return {
    key,
    label,
    rawPoints,
    coldLine: scaled.cold,
    epaPerPlayDelta: scaled.epa,
    winProbabilityDelta: scaled.win,
    atsCoverDelta: scaled.ats,
    significance: scaled.significance,
    orientation,
    source: extras.source,
    explanation: extras.explanation,
  };
}

export function remapForHomePerspective(adjustment: ColdLineAdjustmentDetail): ColdLineAdjustmentDetail {
  if (adjustment.orientation !== 'away') return adjustment;
  return {
    ...adjustment,
    rawPoints: -adjustment.rawPoints,
    coldLine: -adjustment.coldLine,
    epaPerPlayDelta: -adjustment.epaPerPlayDelta,
    winProbabilityDelta: -adjustment.winProbabilityDelta,
    atsCoverDelta: -adjustment.atsCoverDelta,
    orientation: 'away',
  };
}

export function mergeAdjustments(
  adjustments: ColdLineAdjustmentDetail[],
): {
  coldLineTotal: number;
  rawPointsTotal: number;
  epaPerPlayTotal: number;
  winProbabilityTotal: number;
  atsCoverTotal: number;
} {
  return adjustments.reduce(
    (acc, adj) => {
      acc.coldLineTotal += adj.coldLine;
      acc.rawPointsTotal += adj.rawPoints;
      acc.epaPerPlayTotal += adj.epaPerPlayDelta;
      acc.winProbabilityTotal += adj.winProbabilityDelta;
      acc.atsCoverTotal += adj.atsCoverDelta;
      return acc;
    },
    { coldLineTotal: 0, rawPointsTotal: 0, epaPerPlayTotal: 0, winProbabilityTotal: 0, atsCoverTotal: 0 },
  );
}

export type AdjustmentGroup = {
  title: string;
  adjustments: ColdLineAdjustmentDetail[];
};

export function sortAdjustmentsByMagnitude(adjustments: ColdLineAdjustmentDetail[]): ColdLineAdjustmentDetail[] {
  return [...adjustments].sort((a, b) => Math.abs(b.coldLine) - Math.abs(a.coldLine));
}
