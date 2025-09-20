import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import type { NextPage, GetServerSideProps } from 'next';
import { metricsConfig } from '@/metrics.config';

interface Team {
  id: number;
  location: string;
  name: string;
  full_name: string;
  abbreviation: string;
}
interface Game {
  id: number;
  date: string;
  week: number;
  season: number;
  status: string;
  venue: string;
  home_team: Team;
  visitor_team: Team;
}
interface OddsOutcome { name: string; point: number; price: number }
interface OddsMarket { key: string; outcomes: OddsOutcome[] }
interface OddsBook { key: string; title: string; markets: OddsMarket[] }
interface OddsGame {
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: OddsBook[];
}
interface Metric {
  name: string;
  value: number;
  isHFA?: boolean;
  significance?: string;
  description?: string;
}
interface CategoryMetrics { category: string; metrics: Metric[] }
interface GameData {
  game: Game;
  favoriteTeam: 'home' | 'away';
  spreadLabel: string;
  totalLabel: string;
  coldLineDiff: number;
  metrics: CategoryMetrics[];
  weather: { temp: number; label: string; icon: string };
}

const formatLineValue = (val: number): string => {
  if (Number.isNaN(val)) return '—';
  if (Math.abs(val) < 0.1) return 'PK';
  return Math.abs(val - Math.trunc(val)) < 0.001 ? val.toFixed(0) : val.toFixed(1);
};

const baseMetricCatalog: CategoryMetrics[] = Array.from(
  metricsConfig.reduce((map, metric) => {
    if (!map.has(metric.group)) {
      map.set(metric.group, [] as Metric[]);
    }
    const metrics = map.get(metric.group)!;
    metrics.push({
      name: metric.label,
      value: metric.weight,
      isHFA: /\bhome\b/i.test(metric.label) || /\bhome\b/i.test(metric.description ?? ''),
      significance: metric.significance,
      description: metric.description,
    });
    return map;
  }, new Map<string, Metric[]>())
).map(([category, metrics]) => ({ category, metrics }));

const cloneCategories = (): CategoryMetrics[] =>
  baseMetricCatalog.map((cat) => ({
    category: cat.category,
    metrics: cat.metrics.map((metric) => ({ ...metric })),
  }));

const ColdLinePanel: NextPage<{ games: GameData[] }> = ({ games }) => {
  const [expandedGames, setExpandedGames] = useState<Record<number, boolean>>(
    Object.fromEntries(games.map((g) => [g.game.id, false])),
  );
  const allCategories = useMemo(
    () => Array.from(new Set(games.flatMap((g) => g.metrics.map((cat) => cat.category)))),
    [games],
  );
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(allCategories.map((cat) => [cat, true])),
  );

  const toggleGame = (gameId: number) => {
    setExpandedGames((prev) => ({ ...prev, [gameId]: !prev[gameId] }));
  };
  const expandAll = () => {
    setExpandedGames(Object.fromEntries(games.map((g) => [g.game.id, true])));
  };
  const collapseAll = () => {
    setExpandedGames(Object.fromEntries(games.map((g) => [g.game.id, false])));
  };
  const toggleCategory = (category: string) => {
    setVisibleCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <div className="bg-gray-900 text-gray-100 p-4">
      <div className="mb-3">
        <button
          onClick={expandAll}
          className="px-3 py-1 mr-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md"
        >
          Collapse All
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        {allCategories.map((cat) => (
          <label key={cat} className="flex items-center space-x-1">
            <input
              type="checkbox"
              className="form-checkbox rounded text-blue-500 bg-gray-800 border-gray-600 focus:ring-blue-500"
              checked={visibleCategories[cat]}
              onChange={() => toggleCategory(cat)}
            />
            <span>{cat}</span>
          </label>
        ))}
      </div>

      {games.map(({ game, favoriteTeam, spreadLabel, totalLabel, coldLineDiff, metrics, weather }) => {
        const dt = new Date(game.date);
        const dateStr = `${dt.getMonth() + 1}/${dt.getDate()}`;
        let hours = dt.getHours();
        const minutes = dt.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = ((hours + 11) % 12) + 1;
        const timeStr =
          minutes === 0
            ? `${hours}${ampm.toLowerCase()}`
            : `${hours}:${minutes.toString().padStart(2, '0')}${ampm.toLowerCase()}`;
        const weatherText = `${weather.icon} ${Math.round(weather.temp)}°F${weather.label ? ` ${weather.label}` : ''}`;
        const diffClass = coldLineDiff < 0 ? 'text-green-500' : coldLineDiff > 0 ? 'text-red-500' : 'text-gray-300';

        return (
          <div key={game.id} className="mb-4 p-4 bg-gray-800 rounded-md shadow-md">
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>
                {dateStr} {timeStr} {weatherText} {game.venue}
              </span>
              <button
                onClick={() => toggleGame(game.id)}
                className="text-gray-400 hover:text-gray-200 focus:outline-none"
                aria-label="Toggle metrics"
              >
                <svg
                  className={`w-5 h-5 transform transition-transform ${expandedGames[game.id] ? 'rotate-180' : 'rotate-0'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className="flex justify-between items-baseline mt-1">
              <div className="text-lg">
                <Image
                  src={`/images/logos/${game.visitor_team.abbreviation}.png`}
                  alt={game.visitor_team.name}
                  className="w-6 h-6 inline mr-1 align-middle"
                  width={24}
                  height={24}
                />
                <span className={favoriteTeam === 'away' ? 'font-bold text-gray-100' : 'font-medium text-gray-100'}>
                  {game.visitor_team.abbreviation}
                </span>
                <span className="mx-1 text-gray-300">@</span>
                <Image
                  src={`/images/logos/${game.home_team.abbreviation}.png`}
                  alt={game.home_team.name}
                  className="w-6 h-6 inline mr-1 align-middle"
                  width={24}
                  height={24}
                />
                <span className={favoriteTeam === 'home' ? 'font-bold text-gray-100' : 'font-medium text-gray-100'}>
                  {game.home_team.abbreviation}
                </span>
              </div>
              <div className="text-lg">
                <span className="mr-4">
                  Spread: <span className="font-semibold">{spreadLabel}</span>
                </span>
                <span className="mr-4">
                  O/U: <span className="font-semibold">{totalLabel}</span>
                </span>
                <span className={`font-semibold ${diffClass}`}>
                  {coldLineDiff > 0 ? '+' : ''}
                  {coldLineDiff.toFixed(1)}
                </span>
              </div>
            </div>
            {expandedGames[game.id] && (
              <div className="mt-3 pt-3 border-t border-gray-700 text-sm">
                {metrics
                  .filter((cat) => visibleCategories[cat.category])
                  .map((cat) => (
                    <div key={cat.category} className="mb-3">
                      <div className="font-semibold text-gray-200 mb-1">{cat.category}</div>
                      {cat.metrics.map((metric) => (
                        <div key={metric.name} className="flex justify-between pl-4">
                          <span
                            className={metric.isHFA ? 'text-blue-300' : ''}
                            title={metric.description || ''}
                          >
                            {metric.name}
                            {metric.significance ? ` (${metric.significance})` : ''}
                            {metric.isHFA && ' *'}
                          </span>
                          <span className={`${metric.value >= 0 ? 'text-green-400' : 'text-red-400'} ml-4`}>
                            {metric.value > 0 ? '+' : ''}
                            {metric.value.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ColdLinePanel;

export const getServerSideProps: GetServerSideProps = async () => {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10));
  }
  const datesQuery = dates.map((d) => `dates[]=${d}`).join('&');
  const season = today.getMonth() < 2 ? today.getFullYear() - 1 : today.getFullYear();

  const balledBase =
    process.env.BALLDONTLIE_ALL_ACCESS_BASE_URL ||
    process.env.NEXT_PUBLIC_BALLEDONTLIE_BASE_URL ||
    'https://api.balldontlie.io/v1';
  const balledKey =
    process.env.BALLDONTLIE_ALL_ACCESS_KEY ||
    process.env.NEXT_PUBLIC_BALLEDONTLIE_KEY ||
    '';

  const gamesRes = await fetch(
    `${balledBase.replace(/\/$/, '')}/games?${datesQuery}&seasons[]=${season}`,
    {
      headers: balledKey ? { Authorization: balledKey } : undefined,
    },
  );
  const gamesData = await gamesRes.json();
  const games: Game[] = gamesData.data || [];

  const oddsUrl = 'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds';
  const oddsKey = process.env.ODDS_API_KEY || '';
  const oddsRes = await fetch(
    `${oddsUrl}?regions=us&markets=spreads,totals&apiKey=${encodeURIComponent(oddsKey)}`,
  );
  const oddsData: OddsGame[] = (await oddsRes.json()) || [];

  const findOddsForGame = (homeName: string, awayName: string): {
    spread: number;
    favoriteTeam: 'home' | 'away';
    total: number;
  } => {
    const oddsGame = oddsData.find(
      (og) => og.home_team === homeName && og.away_team === awayName,
    );
    let spread = 0;
    let favorite: 'home' | 'away' = 'home';
    let total = 0;
    if (oddsGame && oddsGame.bookmakers.length) {
      const book = oddsGame.bookmakers[0];
      const spreadMarket = book.markets.find((m) => m.key === 'spreads');
      const totalMarket = book.markets.find((m) => m.key === 'totals');
      if (spreadMarket && spreadMarket.outcomes.length) {
        const favOutcome = spreadMarket.outcomes.find((o) => o.point < 0);
        if (favOutcome) {
          spread = favOutcome.point;
          favorite = favOutcome.name === homeName ? 'home' : 'away';
        }
      }
      if (totalMarket && totalMarket.outcomes.length) {
        total = totalMarket.outcomes[0].point;
      }
    }
    return { spread, favoriteTeam: favorite, total };
  };

  const fetchWeatherForCity = async (city: string) => {
    try {
      const apiKey = process.env.OPENWEATHERMAP_API_KEY;
      if (!apiKey) return null;
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},US&units=imperial&appid=${apiKey}`,
      );
      const data = await res.json();
      if (!data.main) return null;
      const temp = data.main.temp;
      const cond = data.weather && data.weather[0] ? data.weather[0].main : '';
      let label = '';
      if (/Rain|Thunderstorm/.test(cond)) label = 'Rain';
      else if (/Snow/.test(cond)) label = 'Snow';
      else if (data.main.humidity > 70) label = 'Humid';
      else if (temp <= 32) label = 'Cold';
      let icon = '☀️';
      if (/Clouds/.test(cond)) icon = '☁️';
      if (/Rain|Drizzle|Thunderstorm/.test(cond)) icon = '🌧️';
      if (/Snow/.test(cond)) icon = '❄️';
      if (/Clear/.test(cond)) icon = '☀️';
      return { temp, label, icon };
    } catch (error) {
      console.warn('[weather] fetch failed', error);
      return null;
    }
  };

  const cityMap: Record<string, string> = {
    Carolina: 'Charlotte',
    Minnesota: 'Minneapolis',
    Tennessee: 'Nashville',
    'New England': 'Foxborough',
    Washington: 'Washington',
    Arizona: 'Glendale',
    'New York': 'East Rutherford',
    Vegas: 'Las Vegas',
  };

  const gamesWithData: GameData[] = [];
  for (const game of games) {
    const homeName = game.home_team.full_name;
    const awayName = game.visitor_team.full_name;
    const { spread, favoriteTeam, total } = findOddsForGame(homeName, awayName);
    const spreadLabel = favoriteTeam === 'home'
      ? `${game.home_team.abbreviation} ${formatLineValue(spread)}`
      : `${game.visitor_team.abbreviation} ${formatLineValue(spread)}`;
    const totalLabel = formatLineValue(total);

    const categoriesMetrics = cloneCategories();
    const coldLineDiff = categoriesMetrics.reduce(
      (sum, cat) => sum + cat.metrics.reduce((acc, metric) => acc + metric.value, 0),
      0,
    );

    const city = cityMap[game.home_team.location] || game.home_team.location;
    const weather =
      (await fetchWeatherForCity(city)) || ({ temp: 70, label: '', icon: '☀️' } as const);

    gamesWithData.push({
      game,
      favoriteTeam,
      spreadLabel,
      totalLabel,
      coldLineDiff,
      metrics: categoriesMetrics,
      weather,
    });
  }

  gamesWithData.sort((a, b) => new Date(a.game.date).getTime() - new Date(b.game.date).getTime());

  return { props: { games: gamesWithData } };
};
