import type { InjuryItem, InjuryReport } from '@/lib/injuries/types';
import type { ColdLineAdjustmentDetail } from './adjustments';
import { buildAdjustment } from './adjustments';
import type { ColdLineWeightMap } from './weights';

const OUT_FLAGS = ['out', 'injured reserve', 'ir', 'doubtful', 'suspended', 'physically unable'];
const HOLDER_KEYWORDS = ['holder'];
const CENTER_KEYWORDS = ['center'];
const SNAPPER_KEYWORDS = ['long snapper', 'snapper'];

const OFFENSE_POSITIONS = new Set([
  'QB', 'RB', 'FB', 'HB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'OL', 'T', 'G'
]);
const DEFENSE_POSITIONS = new Set([
  'DL', 'DE', 'DT', 'EDGE', 'NG', 'NT', 'LB', 'ILB', 'OLB', 'MLB', 'CB', 'DB', 'S', 'FS', 'SS', 'NB', 'SAF'
]);
const SPECIAL_POSITIONS = new Set(['K', 'P', 'LS']);

export type TeamPerspective = 'home' | 'away';

function isOutStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  const normalized = status.trim().toLowerCase();
  return OUT_FLAGS.some(flag => normalized.includes(flag));
}

function categorizePosition(position: string | undefined | null, note: string | undefined | null): 'offense' | 'defense' | 'special' | 'unknown' {
  const base = (position || '').trim().toUpperCase();
  if (OFFENSE_POSITIONS.has(base)) return 'offense';
  if (DEFENSE_POSITIONS.has(base)) return 'defense';
  if (SPECIAL_POSITIONS.has(base)) return 'special';
  const composite = `${position ?? ''} ${note ?? ''}`.toLowerCase();
  if (CENTER_KEYWORDS.some(keyword => composite.includes(keyword))) return 'offense';
  if (SNAPPER_KEYWORDS.some(keyword => composite.includes(keyword))) return 'special';
  if (HOLDER_KEYWORDS.some(keyword => composite.includes(keyword))) return 'special';
  return 'unknown';
}

function findMatching(
  items: InjuryItem[] | undefined,
  predicate: (item: InjuryItem) => boolean,
): InjuryItem | null {
  if (!items) return null;
  for (const item of items) {
    if (predicate(item)) return item;
  }
  return null;
}

type TeamInjuryBucket = {
  offense: number;
  defense: number;
  special: number;
  items: InjuryItem[];
};

function collectTeamBuckets(list: InjuryItem[] | undefined): TeamInjuryBucket {
  const bucket: TeamInjuryBucket = { offense: 0, defense: 0, special: 0, items: [] };
  if (!list) return bucket;
  for (const item of list) {
    const side = categorizePosition(item.position, item.note);
    if (!isOutStatus(item.status)) continue;
    bucket.items.push(item);
    switch (side) {
      case 'offense':
        bucket.offense += 1;
        break;
      case 'defense':
        bucket.defense += 1;
        break;
      case 'special':
        bucket.special += 1;
        break;
      default:
        break;
    }
  }
  return bucket;
}

function hasKeyword(note: string | undefined | null, keywords: string[]): boolean {
  if (!note) return false;
  const lowered = note.toLowerCase();
  return keywords.some(keyword => lowered.includes(keyword));
}

const FALLBACK_CLUSTER_BASE = -1.2;
const FALLBACK_CLUSTER_EXTRA = -0.3;

function computeClusterPenalty(
  count: number,
  weightBase: number | undefined,
  weightExtra: number | undefined,
): number {
  if (count <= 2) return 0;
  const base = weightBase ?? FALLBACK_CLUSTER_BASE;
  const extra = weightExtra ?? FALLBACK_CLUSTER_EXTRA;
  const additional = count - 2;
  return base + (extra * additional);
}

function addOpponentPressurePenalty(
  current: number,
  weightExtra: number | undefined,
  isOpponentFavoured: boolean,
): number {
  if (!isOpponentFavoured) return current;
  const extra = weightExtra ?? FALLBACK_CLUSTER_EXTRA;
  return current + extra;
}

export type InjuryAdjustmentOptions = {
  weights: ColdLineWeightMap;
  report: InjuryReport | null;
  perspective: TeamPerspective;
  marketSpread: number | null;
};

export type TeamSplit = 'home' | 'away';

function teamKeyItems(report: InjuryReport | null, team: TeamSplit): InjuryItem[] {
  if (!report) return [];
  return team === 'home' ? report.home?.list ?? [] : report.away?.list ?? [];
}

export function buildInjuryAdjustments(
  report: InjuryReport | null,
  weights: ColdLineWeightMap,
  marketSpread: number | null,
): ColdLineAdjustmentDetail[] {
  if (!report) return [];
  const adjustments: ColdLineAdjustmentDetail[] = [];

  const teamBuckets = {
    home: collectTeamBuckets(report.home?.list),
    away: collectTeamBuckets(report.away?.list),
  } as const;

  const addMetric = (
    team: TeamSplit,
    key: string,
    label: string,
    rawPoints: number,
    explanation?: string,
  ) => {
    if (rawPoints === 0) return;
    const weight = weights.get(key) ?? weights.get(key.replace(/__.*$/, ''));
    const orientation: TeamPerspective = team === 'home' ? 'home' : 'away';
    const adjustedPoints = team === 'home' ? rawPoints : -rawPoints;
    adjustments.push(
      buildAdjustment(
        `${key}__${team}`,
        label,
        adjustedPoints,
        orientation,
        weight,
        explanation ? { explanation } : undefined,
      ),
    );
  };

  // Center, holder, snapper checks
  (['home', 'away'] as TeamSplit[]).forEach(team => {
    const list = teamKeyItems(report, team);
    if (!list.length) return;
    const weightCenter = weights.get('Starting_Center_Out');
    const weightHolder = weights.get('Starting_Holder_Out') ?? weights.get('Kicker_Holder_Disruption');
    const weightFgSnapper = weights.get('Starting_FG_Snapper_Out') ?? weights.get('Long_Snapper_Out');
    const weightPuntSnapper = weights.get('Starting_Punt_Snapper_Out') ?? weights.get('Long_Snapper_Out');

    const centerInjury = findMatching(list, item => isOutStatus(item.status) && (
      (item.position ?? '').toUpperCase() === 'C' || hasKeyword(item.note, CENTER_KEYWORDS)
    ));
    if (centerInjury && weightCenter) {
      const label = `${team === 'home' ? 'Home' : 'Away'} starting center out`;
      addMetric(team, 'Starting_Center_Out', label, weightCenter.coldLineAdjustment, `Detected ${centerInjury.name}`);
    }

    const holderInjury = findMatching(list, item => isOutStatus(item.status) && (
      (item.position ?? '').toUpperCase() === 'P' || hasKeyword(item.note, HOLDER_KEYWORDS)
    ));
    if (holderInjury && weightHolder) {
      const label = `${team === 'home' ? 'Home' : 'Away'} holder disruption`;
      addMetric(team, 'Starting_Holder_Out', label, weightHolder.coldLineAdjustment, `Detected ${holderInjury.name}`);
    }

    const longSnapperInjury = findMatching(list, item => isOutStatus(item.status) && (
      (item.position ?? '').toUpperCase() === 'LS' || hasKeyword(item.note, SNAPPER_KEYWORDS)
    ));
    if (longSnapperInjury && weightFgSnapper) {
      const label = `${team === 'home' ? 'Home' : 'Away'} FG snapper out`;
      addMetric(team, 'Starting_FG_Snapper_Out', label, weightFgSnapper.coldLineAdjustment, `Detected ${longSnapperInjury.name}`);
      if (weightPuntSnapper) {
        addMetric(team, 'Starting_Punt_Snapper_Out', `${team === 'home' ? 'Home' : 'Away'} punt snapper risk`, weightPuntSnapper.coldLineAdjustment, `Detected ${longSnapperInjury.name}`);
      }
    }
  });

  const extraWeight = weights.get('Multiple_Starters_Add_On');
  const baseWeight = weights.get('Multiple_Starters_Same_Unit');

  const applyCluster = (
    team: TeamSplit,
    side: 'offense' | 'defense',
    count: number,
  ) => {
    if (count <= 2) return;
    const rawPenalty = computeClusterPenalty(count, baseWeight?.coldLineAdjustment, extraWeight?.coldLineAdjustment);
    const opponentFavoured = (() => {
      if (marketSpread == null || Number.isNaN(marketSpread)) return false;
      if (team === 'home') {
        return marketSpread > 0.5; // home is underdog
      }
      return marketSpread < -0.5; // away is underdog when spread favours home
    })();
    const penaltyWithOpponent = addOpponentPressurePenalty(
      rawPenalty,
      extraWeight?.coldLineAdjustment,
      opponentFavoured,
    );
    const label = `${team === 'home' ? 'Home' : 'Away'} ${side} starters out (${count})`;
    addMetric(team, 'Multiple_Starters_Same_Unit', label, penaltyWithOpponent);
  };

  applyCluster('home', 'offense', teamBuckets.home.offense);
  applyCluster('home', 'defense', teamBuckets.home.defense);
  applyCluster('away', 'offense', teamBuckets.away.offense);
  applyCluster('away', 'defense', teamBuckets.away.defense);

  return adjustments;
}
