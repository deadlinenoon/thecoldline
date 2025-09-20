'use client';

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import ColdGameCard from "@/components/game/ColdGameCard";
import { teamAbbr } from "@/lib/abbr";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(String(response.status));
  }
  return response.json();
};

type Team = { abbreviation: string; name: string };
type Game = {
  id: number;
  date: string;
  venue?: string | null;
  season?: number;
  week?: number;
  home_team: Team;
  away_team: Team;
};
type OddsOutcome = { name: string; point: number | null };
type OddsMarket = { key: "spreads" | "totals"; outcomes: OddsOutcome[] };
type OddsBook = { markets?: OddsMarket[] };
type OddsGame = {
  home_team: string;
  away_team: string;
  bookmakers?: OddsBook[];
};

function formatLineValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (Math.abs(value) < 0.1) return "PK";
  const isWhole = Math.abs(value - Math.trunc(value)) < 0.001;
  return isWhole ? value.toFixed(0) : value.toFixed(1);
}

function abbreviate(value: string): string {
  return teamAbbr(value).toUpperCase();
}

function pickOddsFor(game: Game, odds: OddsGame[]) {
  if (!Array.isArray(odds) || odds.length === 0) {
    return { spreadLabel: "—", totalLabel: "—" };
  }

  const targetHome = game.home_team.abbreviation.toUpperCase();
  const targetAway = game.away_team.abbreviation.toUpperCase();

  const match = odds.find(entry => {
    const homeAbbr = abbreviate(entry.home_team);
    const awayAbbr = abbreviate(entry.away_team);
    return homeAbbr === targetHome && awayAbbr === targetAway;
  });

  if (!match) {
    return { spreadLabel: "—", totalLabel: "—" };
  }

  const book = match.bookmakers?.[0];
  const markets = book?.markets ?? [];
  const spreadMarket = markets.find(market => market.key === "spreads");
  const totalMarket = markets.find(market => market.key === "totals");

  let spreadLabel = "—";
  if (spreadMarket?.outcomes?.length) {
    const favorite = spreadMarket.outcomes.find(outcome => typeof outcome.point === "number" && outcome.point < 0);
    if (favorite) {
      const abbr = abbreviate(favorite.name) || targetHome;
      spreadLabel = `${abbr} ${formatLineValue(favorite.point)}`;
    } else {
      spreadLabel = "PK";
    }
  }

  const totalOutcome = totalMarket?.outcomes?.find(outcome => typeof outcome.point === "number");
  const totalLabel = formatLineValue(totalOutcome?.point ?? null);

  return { spreadLabel, totalLabel };
}

function formatISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function ColdlinePage() {
  const [range, setRange] = useState<'today' | 'week'>('today');

  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => formatISO(today), [today]);
  const endDate = useMemo(() => {
    if (range === 'today') return formatISO(today);
    const future = new Date(today);
    future.setDate(future.getDate() + 6);
    return formatISO(future);
  }, [range, today]);

  const slateKey = `/api/slate?start=${startDate}&end=${endDate}`;
  const {
    data: slate,
    error: slateError,
    mutate: mutateSlate,
    isLoading: slateLoading,
  } = useSWR<Game[]>(slateKey, fetcher);
  const {
    data: odds,
    error: oddsError,
    mutate: mutateOdds,
  } = useSWR<OddsGame[]>(`/api/odds`, fetcher);

  const handleRefresh = () => {
    void mutateSlate();
    void mutateOdds();
  };

  const games = useMemo(() => {
    if (!slate) return [] as Game[];
    return [...slate].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [slate]);

  const loading = slateLoading || !slate || !odds;
  const error = slateError || oddsError;

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">Coldline</h1>
            <p className="text-sm text-slate-400">NFL slate metrics, odds, and weather insights in one place.</p>
          </div>
          <div className="flex items-center gap-2">
            {([['today', 'Today'], ['week', 'Next 7 Days']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  range === value
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/40'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
                type="button"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-slate-300">
            Loading matchups…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            Unable to load slate or odds. Please try refreshing.
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            No games scheduled in this window.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {games.map(game => {
              const { spreadLabel, totalLabel } = pickOddsFor(game, odds ?? []);
              return (
                <ColdGameCard
                  key={game.id}
                  g={game}
                  spreadLabel={spreadLabel}
                  totalLabel={totalLabel}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
