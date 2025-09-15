import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { teamLogoUrl } from "../lib/logos";
import { fetchTravel } from "../lib/travel/fetch";
import type { TravelRow } from "../lib/travel/types";

type GameLine = {
  id: string;
  home: string;
  away: string;
  commenceTime: string;
  marketSpread: number | null;
  bookCount: number;
};

type Wx = {
  city: string;
  tempF: number;
  windMph: number;
  humidity: number;
  conditions: string;
  icon: string;
};

type Verdict = "Pass" | "Sprinkle" | "Play" | "Pound" | "Hammer" | "Whale";
const verdictFromGap = (gapAbs: number): Verdict => {
  if (gapAbs >= 10) return "Whale";
  if (gapAbs >= 7) return "Hammer";
  if (gapAbs >= 5) return "Pound";
  if (gapAbs >= 3) return "Play";
  if (gapAbs >= 1.5) return "Sprinkle";
  return "Pass";
};

const ColdBlue = "text-sky-300";
const HotRed = "text-red-400";

export default function Home() {
  const [games, setGames] = useState<GameLine[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wx, setWx] = useState<Wx | null>(null);
  const [travel, setTravel] = useState<TravelRow[]>([]);

  const [cold, setCold] = useState<number>(-3.5);
  const [hot, setHot] = useState<number | null>(null);
  const [showHot, setShowHot] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await fetch("/api/coldline-odds");
        const data = (await r.json()) as GameLine[] | { error: string };
        if (!mounted) return;
        if (Array.isArray(data)) {
          setGames(data);
          if (data.length && !activeId) setActiveId(data[0].id);
        } else if (data.error) {
          setErr(data.error);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Odds fetch error";
        setErr(message);
      }
    };
    load();
    return () => { mounted = false; };
  }, [activeId]);

  // Load upcoming travel rows once
  useEffect(() => {
    let mounted = true;
    fetchTravel().then(rows => { if (mounted) setTravel(rows); }).catch(()=>{ if(mounted) setTravel([]); });
    return () => { mounted = false; };
  }, []);

  const active = useMemo(() => games.find(g => g.id === activeId) || null, [games, activeId]);

  const travelByTeam = useMemo(() => {
    const m = new Map<string, TravelRow>();
    for (const r of travel) m.set(String(r.team).toLowerCase(), r);
    return m;
  }, [travel]);

  useEffect(() => {
    let mounted = true;
    const fetchWx = async () => {
      if (!active) return;
      // Reset weather when switching games so any derived wind exposure visuals
      // do not carry over a previous game's value.
      setWx(null);
      try {
        const r = await fetch(`/api/coldline-weather?team=${encodeURIComponent(active.home)}`);
        const data = (await r.json()) as Wx | { error: string };
        if (!mounted) return;
        if ("city" in data) setWx(data);
      } catch { /* ignore */ }
    };
    fetchWx();
    return () => { mounted = false; };
  }, [active?.home]);

  const market = active?.marketSpread ?? null;
  const diff = market === null ? null : Number((cold - market).toFixed(2));
  const signal = diff === null ? "Pass" : verdictFromGap(Math.abs(diff));

  const onPropagate = () => {
    if (market === null) return;
    setHot(market);
    setShowHot(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0f16] text-white" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
      {/* Removed overlay close button (×) to declutter header */}

      <main className="mx-auto max-w-6xl px-5 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-3">
            <img src="/logo-ice-script.svg" alt="The Cold Line" className="h-8 w-auto" />
            <span className="text-sm text-gray-400">Build Cold Line</span>
          </div>
          <Link href="/tutorial" className="text-cyan-300 text-sm underline hover:text-cyan-200">Tutorial</Link>
        </header>

        {err && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <section className="rounded-xl border border-[#14202e] bg-[#0e1520] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1 min-w-0">
              <label className="text-sm text-gray-300">Select game</label>
              <select
                className="mt-1 w-full max-w-xl rounded-lg bg-[#0b121b] border border-[#1a2635] px-3 py-2 outline-none"
                value={activeId ?? ""}
                onChange={(e) => setActiveId(e.target.value)}
              >
                {games.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.away} at {g.home}
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-0 md:ml-auto flex items-center gap-3 text-xs text-gray-400">
              <span>Books</span>
              <span className="rounded bg-[#0b121b] border border-[#1a2635] px-2 py-1">
                {active?.bookCount ?? 0}
              </span>
            </div>
          </div>
          {active && (
            <div className="mt-3 rounded-lg border border-[#1a2635] bg-[#0b121b] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={teamLogoUrl(active.away)} alt="" className="h-6 w-6" onError={(e)=>{ (e.target as HTMLImageElement).style.display='none'; }} />
                  <span className="text-sm text-gray-200">{active.away}</span>
                  {(() => { const t = travelByTeam.get(String(active.away).toLowerCase()); return t ? (
                    <span className="ml-1 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white" title="Away travel this week">
                      A Miles: {t.distance_from_prev_location_mi} • Since: {t.miles_since_last_home}
                    </span>
                  ) : null; })()}
                  <span className="text-gray-500">@</span>
                  <img src={teamLogoUrl(active.home)} alt="" className="h-6 w-6" onError={(e)=>{ (e.target as HTMLImageElement).style.display='none'; }} />
                  <span className="text-sm text-gray-200">{active.home}</span>
                  {(() => { const t = travelByTeam.get(String(active.home).toLowerCase()); return t ? (
                    <span className="ml-1 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white" title="Home travel this week">
                      H Miles: {t.distance_from_prev_location_mi} • Since: {t.miles_since_last_home}
                    </span>
                  ) : null; })()}
                </div>
                <div className="text-xs text-gray-400">{active.commenceTime ? new Date(active.commenceTime).toLocaleString() : ""}</div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#14202e] bg-[#0e1520] p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-300">Current Game</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-400">Cold Line</span>
                <span className={`text-2xl font-extrabold ${ColdBlue}`}>
                  {Number.isFinite(cold) ? cold.toFixed(2) : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-sky-400">Your model</p>
              <div className="mt-3">
                <input
                  type="number"
                  step="0.5"
                  value={cold}
                  onChange={(e) => setCold(parseFloat(e.target.value))}
                  className="w-32 rounded bg-[#0f1a28] border border-[#213149] px-2 py-1 text-sky-200 outline-none"
                />
              </div>
            </div>

            <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-400">Market Line</span>
                <span className="text-2xl font-extrabold text-gray-200">
                  {market === null ? "—" : market.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400">Avg of available books</p>
            </div>

            <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-400">Differential</span>
                <span className="text-2xl font-extrabold text-emerald-300">
                  {diff === null ? "—" : `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}`}
                </span>
              </div>
              <p className="mt-1 text-xs text-emerald-300">{signal}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-[#120f12] p-4 border border-[#351a1a]">
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-400">Hot Line</span>
                <span className={`text-2xl font-extrabold ${HotRed}`}>
                  {showHot && hot !== null ? hot.toFixed(2) : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-red-300">Shows after Propagate</p>
            </div>

            <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
              <span className="text-sm text-gray-400">Cold vs Hot</span>
              <div className="text-2xl font-extrabold">
                {showHot && hot !== null ? `${(cold - hot >= 0 ? "+" : "")}${(cold - hot).toFixed(2)}` : "—"}
              </div>
              <p className="mt-1 text-xs text-gray-400">Cold minus Hot</p>
            </div>

            <div className="rounded-lg bg-[#0b121b] p-4 border border-[#1a2635]">
              <span className="text-sm text-gray-400">Kickoff</span>
              <div className="text-sm text-gray-300">
                {active?.commenceTime ? new Date(active.commenceTime).toLocaleString() : "—"}
              </div>
              {wx && (
                <div className="mt-2 text-xs text-gray-400 flex items-center gap-3">
                  <Image src={`https://openweathermap.org/img/wn/${wx.icon}.png`} alt="" width={28} height={28} />
                  <span>{wx.city}</span>
                  <span>{Math.round(wx.tempF)}°F</span>
                  <span>Wind {Math.round(wx.windMph)} mph</span>
                  <span>Hum {Math.round(wx.humidity)}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-400">Set your Cold Line, then propagate to compare vs market.</p>
            <button
              onClick={onPropagate}
              disabled={market===null}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${market===null? 'bg-[#1a2635] text-gray-500 cursor-not-allowed' : 'bg-emerald-600/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-600/30'}`}
            >
              <span>Propagate to Hot</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
