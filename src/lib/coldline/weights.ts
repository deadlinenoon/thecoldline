import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type ColdLineWeight = {
  metric: string;
  averageEffectPoints: number;
  coldLineAdjustment: number;
  epaPerPlayDelta: number;
  winProbabilityDelta: number;
  atsCoverDelta: number;
  significance: string;
};

export type ColdLineWeightMap = Map<string, ColdLineWeight>;

let cachedWeights: ColdLineWeightMap | null = null;
let cachedError: Error | null = null;

const WEIGHT_FILE_NAME = 'nfl_cold_line_weights_2000_2025.csv';

const candidatePaths = (): string[] => {
  const explicit = process.env.COLDLINE_WEIGHTS_PATH;
  const candidates: string[] = [];
  if (explicit) candidates.push(explicit.trim());
  candidates.push(path.join('/mnt/data', WEIGHT_FILE_NAME));
  candidates.push(path.join(process.cwd(), 'data', WEIGHT_FILE_NAME));
  return candidates;
};

async function loadCsv(): Promise<string | null> {
  const tried: Error[] = [];
  for (const candidate of candidatePaths()) {
    if (!candidate) continue;
    try {
      const contents = await readFile(candidate, 'utf8');
      if (contents && contents.trim()) return contents;
    } catch (error) {
      tried.push(error as Error);
    }
  }
  if (tried.length) {
    const message = tried.map((err, index) => `(${index + 1}) ${err.message}`).join('\n');
    cachedError = new Error(`Unable to load Cold Line weights CSV. Tried: \n${message}`);
  }
  return null;
}

function parseNumber(raw: string, fallback = 0): number {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : fallback;
}

function parseCsv(csv: string): ColdLineWeightMap {
  const lines = csv.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return new Map();
  const header = lines[0].split(',').map(col => col.trim().toLowerCase());
  const metricIndex = header.findIndex(col => col === 'metric');
  const avgIndex = header.findIndex(col => col === 'averageeffectpoints');
  const adjIndex = header.findIndex(col => col === 'coldlineadj' || col === 'coldlineadjustment');
  const epaIndex = header.findIndex(col => col === 'epaperplaydelta');
  const winIndex = header.findIndex(col => col === 'winprobdelt' || col === 'winprobdelta' || col === 'winprobabilitydelta');
  const atsIndex = header.findIndex(col => col === 'atscoverdelta' || col === 'atsdelta');
  const sigIndex = header.findIndex(col => col === 'significance');

  const out: ColdLineWeightMap = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i];
    if (!row) continue;
    const cells = row.split(',');
    const metricRaw = metricIndex >= 0 ? cells[metricIndex] ?? '' : '';
    const metric = metricRaw.trim();
    if (!metric) continue;
    const averageEffectPoints = avgIndex >= 0 ? parseNumber(cells[avgIndex] ?? '', 0) : 0;
    const coldLineAdjustment = adjIndex >= 0 ? parseNumber(cells[adjIndex] ?? '', 0) : averageEffectPoints;
    const epaPerPlayDelta = epaIndex >= 0 ? parseNumber(cells[epaIndex] ?? '', 0) : 0;
    const winProbabilityDelta = winIndex >= 0 ? parseNumber(cells[winIndex] ?? '', 0) : 0;
    const atsCoverDelta = atsIndex >= 0 ? parseNumber(cells[atsIndex] ?? '', 0) : 0;
    const significance = sigIndex >= 0 ? (cells[sigIndex] ?? '').trim() : '';

    out.set(metric, {
      metric,
      averageEffectPoints,
      coldLineAdjustment,
      epaPerPlayDelta,
      winProbabilityDelta,
      atsCoverDelta,
      significance,
    });
  }
  return out;
}

export async function loadColdLineWeights(): Promise<ColdLineWeightMap> {
  if (cachedWeights) return cachedWeights;
  if (cachedError) throw cachedError;
  const csv = await loadCsv();
  if (!csv) {
    cachedWeights = new Map();
    return cachedWeights;
  }
  cachedWeights = parseCsv(csv);
  return cachedWeights;
}

export async function getColdLineWeight(metric: string): Promise<ColdLineWeight | undefined> {
  const weights = await loadColdLineWeights();
  return weights.get(metric) ?? weights.get(metric.trim()) ?? weights.get(metric.replace(/__.*$/, ''));
}

export function invalidateColdLineWeightsCache(): void {
  cachedWeights = null;
  cachedError = null;
}
