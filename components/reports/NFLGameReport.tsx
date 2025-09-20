'use client';

import { useCallback, useState } from 'react';

type Props = {
  homeAbbr: string;
  awayAbbr: string;
  kickoffISO: string;
  angle?: string;
};

type ReportSuccess = {
  ok: true;
  report: string;
  contextSummary: {
    hasInjuries: boolean;
    hasWeather: boolean;
    hasOdds: boolean;
  };
};

type ReportError = {
  error?: string;
  details?: unknown;
};

export function NFLGameReport({ homeAbbr, awayAbbr, kickoffISO, angle }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportSuccess['contextSummary'] | null>(null);
  const canGenerate = Boolean(homeAbbr && awayAbbr && kickoffISO);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      setError('homeAbbr, awayAbbr, and kickoffISO are required');
      return;
    }
    setIsLoading(true);
    setError(null);
    setReport(null);
    setSummary(null);
    try {
      const response = await fetch('/api/reports/nfl-game-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ homeAbbr, awayAbbr, kickoffISO, angle }),
      });
      const json = (await response.json().catch(() => ({ error: 'Invalid JSON response' }))) as ReportSuccess | ReportError;
      if (!response.ok) {
        const message = 'error' in json && typeof json.error === 'string'
          ? json.error
          : `Request failed (HTTP ${response.status})`;
        setError(message);
        return;
      }
      if (!('ok' in json) || json.ok !== true) {
        setError('Unexpected response payload');
        return;
      }
      setReport(json.report);
      setSummary(json.contextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [angle, awayAbbr, canGenerate, homeAbbr, kickoffISO]);

  return (
    <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-200">AI Game Report</h4>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading || !canGenerate}
          className={`rounded px-3 py-1 text-sm font-semibold text-white transition ${isLoading || !canGenerate ? 'cursor-not-allowed bg-slate-700' : 'bg-indigo-600 hover:bg-indigo-500'}`}
        >
          {isLoading ? 'Generating…' : '🤖 Generate'}
        </button>
      </div>
      {error ? (
        <p className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>
      ) : null}
      {summary ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
          <div>
            <dt className="uppercase tracking-wide">Injuries</dt>
            <dd className={summary.hasInjuries ? 'text-emerald-300' : 'text-slate-500'}>
              {summary.hasInjuries ? 'included' : 'unavailable'}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Weather</dt>
            <dd className={summary.hasWeather ? 'text-emerald-300' : 'text-slate-500'}>
              {summary.hasWeather ? 'included' : 'unavailable'}
            </dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Odds</dt>
            <dd className={summary.hasOdds ? 'text-emerald-300' : 'text-slate-500'}>
              {summary.hasOdds ? 'included' : 'unavailable'}
            </dd>
          </div>
        </dl>
      ) : null}
      {report ? (
        <article className="mt-3 max-h-72 overflow-y-auto whitespace-pre-line rounded border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-100">
          {report}
        </article>
      ) : null}
    </div>
  );
}

export default NFLGameReport;
