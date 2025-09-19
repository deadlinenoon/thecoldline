"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type NFLTeam = "MIA" | "BUF" | "GB" | "CLE" | "LV" | "WSH" | "HOU" | "JAX";

type NFLGame = {
  id: string;
  away: NFLTeam;
  home: NFLTeam;
  marketSpreadHome: number;
  total: number;
  kickoff: string;
};

type DemoResult = {
  cold: number;
  edge: number;
  reason: string;
  mode: "spread";
};

type IconInfo =
  | { kind: "emoji"; value: string }
  | { kind: "image"; src: string; alt: string };

const NFL_GAMES: NFLGame[] = [
  {
    id: "mia-buf",
    away: "MIA",
    home: "BUF",
    marketSpreadHome: -12.5,
    total: 49.5,
    kickoff: "2025-11-30T20:20:00-05:00", // Sunday night
  },
  {
    id: "gb-cle",
    away: "GB",
    home: "CLE",
    marketSpreadHome: -2.5,
    total: 42.5,
    kickoff: "2025-11-27T16:30:00-05:00", // Thanksgiving
  },
  {
    id: "lv-wsh",
    away: "LV",
    home: "WSH",
    marketSpreadHome: -3.5,
    total: 44.5,
    kickoff: "2025-11-28T15:00:00-05:00", // Black Friday
  },
  {
    id: "hou-jax",
    away: "HOU",
    home: "JAX",
    marketSpreadHome: -1.5,
    total: 43.5,
    kickoff: "2025-12-22T20:15:00-05:00", // Monday night
  },
];

function getGameIcon(gameDate: string): IconInfo | null {
  const date = new Date(gameDate);
  if (Number.isNaN(date.getTime())) return null;

  const day = date.getDay();
  const month = date.getMonth();
  const dateNum = date.getDate();
  const hour = date.getHours();

  if (month === 10 && dateNum >= 23 && dateNum <= 29 && day === 4) {
    return { kind: "emoji", value: "🦃" };
  }

  if (month === 10 && dateNum >= 24 && dateNum <= 30 && day === 5) {
    return { kind: "emoji", value: "🛍️" };
  }

  if (month === 11 && dateNum === 25) {
    return { kind: "emoji", value: "🎄" };
  }

  if (day === 0 && hour >= 18) {
    return { kind: "image", src: "/assets/snf_logo.png", alt: "SNF" };
  }

  if (day === 1 && hour >= 18) {
    return { kind: "image", src: "/assets/mnf_logo.png", alt: "MNF" };
  }

  if (day === 6 && hour >= 18 && month >= 11) {
    return { kind: "emoji", value: "🪩" };
  }

  return null;
}

function fmtSpread(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "PK";
  return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
}

function formatReason(input: string): string {
  return input
    .split(" ")
    .map((part) => (part ? part[0]?.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function renderIcon(icon: IconInfo | null) {
  if (!icon) return null;
  if (icon.kind === "emoji") {
    return (
      <span className="ml-1 text-lg" aria-hidden>
        {icon.value}
      </span>
    );
  }
  return (
    <Image
      src={icon.src}
      alt={icon.alt}
      width={40}
      height={16}
      className="inline-logo h-4 w-auto"
      priority={false}
    />
  );
}

function iconSuffix(icon: IconInfo | null) {
  if (!icon) return "";
  if (icon.kind === "emoji") return ` ${icon.value}`;
  return icon.alt ? ` (${icon.alt})` : "";
}

function demoColdLineSpread(
  market: number,
  controls: { weather: number; travel: number; fatigue: number }
): DemoResult {
  const w = (controls.weather - 50) / 50;
  const t = (controls.travel - 50) / 50;
  const f = (controls.fatigue - 50) / 50;

  const delta = w * 1.2 + t * 0.8 + f * 0.6;
  const points = delta * 1.8;
  const cold = market + points;
  const edge = cold - market;

  const top = Math.max(Math.abs(w), Math.abs(t), Math.abs(f));
  const reason =
    top === Math.abs(w) ? "wind" : top === Math.abs(t) ? "travel load" : "short rest";

  return { cold, edge, reason, mode: "spread" };
}

export default function Page() {
  const [selectedNflId, setSelectedNflId] = useState(NFL_GAMES[0].id);
  const [weather, setWeather] = useState(50);
  const [travel, setTravel] = useState(50);
  const [fatigue, setFatigue] = useState(50);

  const nflGame = useMemo(
    () => NFL_GAMES.find((g) => g.id === selectedNflId) ?? NFL_GAMES[0],
    [selectedNflId]
  );

  const calc = useMemo(
    () => demoColdLineSpread(nflGame.marketSpreadHome, { weather, travel, fatigue }),
    [nflGame, weather, travel, fatigue]
  );

  const primaryIcon = getGameIcon(nflGame.kickoff);
  const coldValueLabel = `${nflGame.home} ${fmtSpread(calc.cold)}`;
  const edgeLabel = "Edge vs spread";
  const marketValueLabel = `${nflGame.home} ${fmtSpread(nflGame.marketSpreadHome)}`;
  const driverLabel = formatReason(calc.reason);
  const activeGames = NFL_GAMES;
  const selectValue = nflGame.id;

  return (
    <main className="min-h-screen bg-[#0A0F16] text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-cyan-500/20 ring-1 ring-cyan-400/40">
            <span className="text-sm text-cyan-300">CL</span>
          </div>
          <span className="font-semibold tracking-wide">The Cold Line</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm text-white/80 md:flex">
          <a href="#product" className="hover:text-white">
            Product
          </a>
          <a href="#research" className="hover:text-white">
            Research
          </a>
          <a href="#tutorial" className="hover:text-white">
            Tutorial
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="/app"
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium hover:bg-cyan-400"
          >
            Launch App
          </a>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 pt-8 pb-12 md:grid-cols-2">
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Build your Cold Line in ten seconds
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Transparent inputs. Seventy active metrics. You control the weight.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/app"
              className="rounded-md bg-cyan-500 px-5 py-2.5 text-sm font-medium hover:bg-cyan-400"
            >
              Launch App
            </a>
            <a
              href="#demo"
              className="rounded-md border border-white/15 px-5 py-2.5 text-sm font-medium hover:bg-white/5"
            >
              Try the demo
            </a>
            <a
              href="#tour"
              className="rounded-md border border-white/15 px-5 py-2.5 text-sm font-medium hover:bg-white/5"
            >
              Watch tour
            </a>
          </div>
        </div>

        <div
          id="demo"
          className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">Mini demo</div>
            <div className="text-xs text-white/50">Updated 11:12 AM CT</div>
          </div>
          <div className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm text-white/80">Game</label>
              <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-[#101726] px-3 py-1 text-xs uppercase tracking-wide text-white/60">
                NFL Demo
              </span>
            </div>
            <select
              className="mt-2 w-full rounded-md border border-white/10 bg-[#0E1420] px-3 py-2 text-sm focus:outline-none"
              value={selectValue}
              onChange={(e) => setSelectedNflId(e.target.value)}
            >
              {activeGames.map((game) => {
                const icon = getGameIcon(game.kickoff);
                return (
                  <option key={game.id} value={game.id}>
                    {game.away} at {game.home} Market {game.home} {fmtSpread(game.marketSpreadHome)}
                    {iconSuffix(icon)}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <Slider
              label="Weather"
              value={weather}
              onChange={setWeather}
              helperLeft="calm"
              helperRight="wind"
            />
            <Slider
              label="Travel"
              value={travel}
              onChange={setTravel}
              helperLeft="light"
              helperRight="heavy"
            />
            <Slider
              label="Fatigue"
              value={fatigue}
              onChange={setFatigue}
              helperLeft="fresh"
              helperRight="short rest"
            />
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-[#0E1420] p-4">
            <div className="text-sm text-white/70">Output</div>
            <div className="mt-2 flex flex-wrap items-end gap-4">
              <div>
                <div className="text-xs text-white/60">Cold Line</div>
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <span>{coldValueLabel}</span>
                  {renderIcon(primaryIcon)}
                </div>
                <div className="text-xs text-white/50">Market {marketValueLabel}</div>
              </div>
              <div>
                <div className="text-xs text-white/60">{edgeLabel}</div>
                <div
                  className={`text-2xl font-semibold ${
                    calc.edge >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {calc.edge >= 0 ? "+" : ""}
                  {calc.edge.toFixed(1)}
                </div>
              </div>
              <div className="ml-auto text-sm">
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/70">
                  Driver: {driverLabel}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-white/60">
            Drag the levers. If the edge holds against the market, open the app and set targets.
          </p>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/3">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="text-xs uppercase tracking-wide text-white/60">Live edges</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {NFL_GAMES.slice(1, 4).map((game, i) => {
              const icon = getGameIcon(game.kickoff);
              const { cold, edge } = demoColdLineSpread(game.marketSpreadHome, {
                weather: 52 + i * 8,
                travel: 48 + i * 6,
                fatigue: 44 + i * 4,
              });
              return (
                <div key={game.id} className="rounded-lg border border-white/10 bg-[#0E1420] p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span>
                      {game.away} at {game.home}
                    </span>
                    {renderIcon(icon)}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    Market {game.home} {fmtSpread(game.marketSpreadHome)} Cold Line {game.home} {fmtSpread(cold)}
                  </div>
                  <div
                    className={`mt-1 text-sm font-medium ${
                      edge >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    Edge {edge >= 0 ? "+" : ""}
                    {edge.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="product" className="mx-auto max-w-7xl px-6 py-10">
        <h2 className="text-2xl font-semibold">What moves the number</h2>
        <p className="mt-2 text-white/70">
          The model rolls up unit level inputs into transparent categories. You can lock defaults or adjust.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {[
            { title: "Environment", items: ["weather", "surface", "altitude", "wind"] },
            { title: "Style", items: ["pace", "pass rate", "explosive rate", "trench wins"] },
            { title: "Fatigue", items: ["short rest", "plays run", "snap share", "injuries"] },
            { title: "Travel", items: ["miles", "direction", "time zones"] },
            { title: "Rest", items: ["bye", "mini bye", "practice"] },
          ].map((card) => (
            <div key={card.title} className="rounded-lg border border-white/10 bg-[#0E1420] p-4">
              <div className="font-medium">{card.title}</div>
              <ul className="mt-2 space-y-1 text-sm text-white/70">
                {card.items.map((it) => (
                  <li key={it}>• {it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="research" className="mx-auto max-w-7xl px-6 pb-16">
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm text-white/70">Research spotlight</div>
              <h3 className="text-xl font-semibold">Red Zone Efficiency update</h3>
              <p className="mt-1 text-sm text-white/70">
                Offense and defense. Drive level truth. Charts and CSVs included.
              </p>
            </div>
            <a
              href="/research/red-zone"
              className="rounded-md border border-white/15 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Read the breakdown
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-white/3">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-[#0E1420] p-6">
            <h4 className="text-lg font-semibold">For bettors</h4>
            <p className="mt-1 text-sm text-white/70">
              Build the number, compare to market, track targets, export.
            </p>
            <a
              href="/app"
              className="mt-4 inline-block rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium hover:bg-cyan-400"
            >
              Launch App
            </a>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0E1420] p-6">
            <h4 className="text-lg font-semibold">For Survivor teams</h4>
            <p className="mt-1 text-sm text-white/70">
              Usage tracking, exposure limits, chat intel rollups. Private access only.
            </p>
            <a
              href="/survivor"
              className="mt-4 inline-block rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
            >
              Request access
            </a>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-6 py-10 text-xs text-white/50">
        Data sources include The Odds API, nflfastR, and OpenWeather. Not a sportsbook. For research.
      </footer>
    </main>
  );
}

function Slider({
  label,
  value,
  onChange,
  helperLeft,
  helperRight,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  helperLeft: string;
  helperRight: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <label className="text-white/80">{label}</label>
        <div className="text-white/60">{value}</div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-cyan-400"
      />
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-white/50">
        <span>{helperLeft}</span>
        <span>{helperRight}</span>
      </div>
    </div>
  );
}
