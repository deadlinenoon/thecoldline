import type { InjuryItem, InjuryReport, InjuryTeamReport } from './types';

const toInjuryItem = (input: unknown): InjuryItem | null => {
  if (!input || typeof input !== 'object') return null;
  const entry = input as Record<string, unknown>;
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (!name) return null;
  return {
    name,
    status: typeof entry.status === 'string' ? entry.status : '—',
    position: typeof entry.position === 'string' ? entry.position : '',
    note: typeof entry.note === 'string' ? entry.note : '',
  };
};

const toInjuryTeamReport = (input: unknown): InjuryTeamReport => {
  const candidate = (input ?? {}) as Record<string, unknown>;
  const rawList = Array.isArray(candidate.list) ? candidate.list : [];
  const list = rawList
    .map(toInjuryItem)
    .filter((item): item is InjuryItem => Boolean(item));
  const rawCount = candidate.count;
  const count = typeof rawCount === 'number' && Number.isFinite(rawCount) ? rawCount : list.length;
  const sources = Array.isArray(candidate.sources)
    ? candidate.sources
        .map(source => (typeof source === 'string' ? source.trim() : ''))
        .filter(Boolean)
    : [];
  return { list, count, sources };
};

export const normalizeInjuryReport = (raw: unknown): InjuryReport => {
  const input = (raw ?? {}) as Record<string, unknown>;
  return {
    home: toInjuryTeamReport(input.home),
    away: toInjuryTeamReport(input.away),
    error: typeof input.error === 'string' ? input.error : undefined,
  };
};

export { toInjuryItem, toInjuryTeamReport };
