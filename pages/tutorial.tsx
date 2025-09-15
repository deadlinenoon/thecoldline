import Link from "next/link";
import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";
import { BASE, METRIC_DESC, effectiveRange, humanMetric } from "../lib/metrics";
import { DENVER, HFA_2_0, HFA_3_0, hfaByTeam } from "../lib/hfa";

const Icon = {
  ArrowRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0-7.5 7.5M21 12H3"/>
    </svg>
  ),
  Info: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25v5.25m0-8.25h.008v.008H11.25V8.25z"/>
      <circle cx="12" cy="12" r="9"/>
    </svg>
  ),
  Cloud: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 0 0 4 4h10a4 4 0 0 0 1-7.874A6 6 0 0 0 7.5 8.25c-2.9 0-4.5 2.1-4.5 4.25z"/>
    </svg>
  ),
  Adjust: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h10.5m-10.5 0A2.25 2.25 0 0 1 6 4.5h0a2.25 2.25 0 0 1 2.25 2.25m6 0A2.25 2.25 0 0 1 16.5 4.5h0A2.25 2.25 0 0 1 18.75 6.75m-15 10.5h10.5m-10.5 0A2.25 2.25 0 0 0 6 19.5h0a2.25 2.25 0 0 0 2.25-2.25m6 0A2.25 2.25 0 0 0 16.5 19.5h0a2.25 2.25 0 0 0 2.25-2.25"/>
    </svg>
  ),
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm text-gray-800">{children}</div>
    </section>
  );
}

function TutorialPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(()=>{
    const onKey=(e: KeyboardEvent)=>{ if(e.key==='Escape'){ window.location.href='/'; } };
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  },[]);
  return (
    <div className="min-h-screen bg-cl-bg text-white" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
      <div className="relative">
        <Link href="/" className="sr-only">Home</Link>
        <div className="relative">
          {/* Close button overlay (does not affect header) */}
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" aria-label="Close Tutorial" title="Close Tutorial" className="absolute right-3 top-3 h-8 w-8 rounded-md grid place-items-center border border-cyan-300/50 text-cyan-200 hover:bg-cyan-300/10 focus:outline-none z-50">×</a>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl p-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tutorial</h1>
          <Link
            href="/tutorial.pdf"
            className="rounded-md border border-emerald-400/40 px-3 py-2 text-sm font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 hidden md:inline-block"
          >
            Download Tutorial (PDF)
          </Link>
        </header>

      <section id="video" className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">Intro Video</h2>
        <p className="mb-3 text-sm text-gray-700">A 20–30s walkthrough of the key parts of this page.</p>
        <video
          className="w-full rounded border border-gray-200 bg-black"
          controls
          preload="metadata"
          src="/tutorial.mp4"
        >
          Sorry, your browser doesn’t support embedded videos. You can download it instead.
        </video>
        <div className="mt-2 text-xs text-gray-600">
          If playback stutters on slow connections, <a className="text-emerald-600 underline" href="/tutorial.mp4">download the MP4</a> and play locally.
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="1) Market vs Cold Line">
          <div className="rounded-md bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Chiefs -3.5</span>
              <Icon.ArrowRight className="h-5 w-5 text-gray-500" />
              <span className="font-medium">Bears +3.5</span>
            </div>
            <div className="mt-2 text-gray-700">
              Cold Line example: <span className="font-semibold">Chiefs -2.0</span>
            </div>
            <p className="mt-2 text-gray-600">
              If Cold is shorter than Market on the favorite, value leans to the underdog.
            </p>
          </div>
          <p className="flex items-start gap-2 text-gray-700">
            <Icon.Info className="mt-0.5 h-5 w-5 text-gray-500" />
            Market is the consensus line. Cold Line is your adjusted number from sliders and inputs.
          </p>
        </Card>

        <Card title="2) Sliders">
          <div className="flex items-center gap-2">
            <Icon.Adjust className="h-5 w-5 text-gray-500" />
            <span>Move left = away team. Move right = home team.</span>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <div className="h-2 w-full rounded bg-gray-200">
              <div className="h-2 w-2/3 rounded bg-emerald-400" />
            </div>
            <div className="mt-2 text-gray-700">
              Running total: <span className="font-semibold">+1.5 to home</span>
            </div>
          </div>
        </Card>

        <Card title="3) How Deltas Work">
          <p className="text-gray-700">
            Every slider is a point delta applied to the favorite/underdog axis. Cold = snapHalf(Market favorite points + your total delta on the favorite axis).
            Move left to give points to the away team; move right to give points to the home team. Most sliders cap at ±3.0; special cases are noted.
          </p>
          <ul className="mt-2 list-disc pl-5 text-gray-700">
            <li>Positive delta favors the home team; negative favors the away team.</li>
            <li>Cold Line is snapped to half-points for readability.</li>
            <li>Differential = |Cold − Market| on the favorite axis.</li>
          </ul>
        </Card>

        <Card title="4) Differential and Recommendation">
          <div className="rounded-md bg-gray-50 p-3">
            <div className="text-gray-800">
              Market: <span className="font-semibold">Chiefs -3.5</span>
            </div>
            <div className="text-gray-800">
              Cold: <span className="font-semibold">Chiefs -1.0</span>
            </div>
            <div className="mt-2 font-semibold text-emerald-700">
              Differential: 2.5 points toward Bears
            </div>
            <div className="mt-1 text-base">
              Recommendation: <span className="font-semibold">🙂 Lean Bears</span>
            </div>
          </div>
          <p className="text-gray-700">
            Differential is the distance between Market and Cold, signed to the favorite.
          </p>
        </Card>

        <Card title="5) Verdict Scale">
          <div className="rounded-md bg-gray-50 p-3">
            <div className="h-2 w-full rounded bg-gradient-to-r from-gray-200 via-emerald-300 to-emerald-500" />
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-700">
              <div>🤝 Pass<br/>0.00–1.49</div>
              <div>🙂 Lean / 🎯 Play<br/>1.50–4.99</div>
              <div>🔨 Hammer → 🏠 House<br/>5.00+</div>
            </div>
          </div>
          <p className="text-gray-700">
            Tie handling: 1.50 goes to Lean. 3.00 goes to Play.
          </p>
        </Card>

        <Card title="5) Moneyline and Total">
          <div className="rounded-md bg-gray-50 p-3">
            <div className="text-gray-800">
              Moneyline (median): <span className="font-semibold">Away +135 / Home -155</span> <span className="text-gray-500">(with implied %)</span>
            </div>
            <div className="text-gray-800">
              Total (median): <span className="font-semibold">45.5</span>
            </div>
          </div>
          <p className="text-gray-700">
            We show consensus Moneyline and Total alongside Hot/Cold for quick context. Implied probability is shown under each moneyline.
          </p>
        </Card>

        <Card title="6) Weather">
          <div className="flex items-center gap-2">
            <Icon.Cloud className="h-5 w-5 text-gray-500" />
            <span>Weather is available inside the ~8 day forecast window.</span>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-gray-700">
              Outside that range you will see a note that forecast is not yet available.
            </p>
          </div>
        </Card>
      </div>

      {/* Adjustments provenance */}
      <div className="mt-6 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">Adjustments Provenance</h2>
        <ul className="list-disc pl-5 text-sm text-gray-800">
          <li>
            HFA: Baseline 3.0; we apply a per-team delta (Denver +0.25; fortress 0.00; Raiders/Jags/Rams/Chargers -1.00; default -0.50; Neutral -1.50). Shown with an “Auto” tag in the Stadium HFA metric and in the Cold Line box.
          </li>
          <li>
            Early Start Body Clock: West Coast (PT) away teams playing early CT/ET kicks get a dock (ET: -0.75; CT: -0.50). Shown with “Auto” in that metric and in the Cold Line box.
          </li>
          <li>
            Coaching Familiarity: Weights from team notes — 1.0 for OC/DC → Head Coach vs opponent; 0.5 for other coaches or starter players vs former team or explicit “revenge/reunion”. Capped at ±1.0, shown as “Auto” in the metric and in the Cold Line box. If you move it yourself, it shows “User”.
          </li>
          <li>
            Other user inputs: We list any additional non-zero sliders. You can expand/collapse long lists.
          </li>
        </ul>
      </div>

      {/* HFA section */}
      <div className="mt-6 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">Home Field Advantage (HFA)</h2>
        <p className="text-sm text-gray-800">
          The market bakes in roughly +3.0 for home teams. We apply a delta to that baseline based on venue context:
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
          <li><span className="font-semibold">Denver</span>: 3.25 HFA → <span className="font-semibold">+0.25 delta</span> vs 3.0</li>
          <li><span className="font-semibold">Fortress 3.0</span> (e.g., {Array.from(HFA_3_0).slice(0,4).join(", ")}…): 3.0 HFA → <span className="font-semibold">0.00 delta</span></li>
          <li><span className="font-semibold">Lower 2.0</span> (Raiders, Jaguars, Rams, Chargers): 2.0 HFA → <span className="font-semibold">-1.00 delta</span></li>
          <li><span className="font-semibold">Default 2.5</span>: 2.5 HFA → <span className="font-semibold">-0.50 delta</span></li>
          <li><span className="font-semibold">Neutral/International</span>: 1.5 HFA → <span className="font-semibold">-1.50 delta</span></li>
        </ul>
        <p className="mt-2 text-xs text-gray-600">
          Formal: delta = HFA(team, neutral) − 3.0. Example: HFA({DENVER}) = 3.25 → delta +0.25.
        </p>
      </div>

      {/* Glossary */}
      <div className="mt-6 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">Metric Glossary and Ranges</h2>
        <p className="text-sm text-gray-800">
          Sliders are deltas in points. Ranges below reflect effective caps used by the app.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {BASE.map(m => {
            const [min, max] = effectiveRange(m.name, m.weightRange);
            const desc = METRIC_DESC[m.name] || "";
            return (
              <div key={m.name} className="rounded border border-gray-200 bg-gray-50 p-3">
                <div className="text-sm font-semibold text-gray-900">
                  {humanMetric(m.name)}
                  <span className="ml-2 align-middle text-[11px] font-normal text-gray-500">[{m.category}]</span>
                </div>
                <div className="mt-1 text-xs text-gray-700">Range: {min} to {max} pts</div>
                {desc && <div className="mt-1 text-sm text-gray-700">{desc}</div>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Notes: Stadium HFA uses venue deltas vs 3.0; QB Tier Drop is allowed up to ±10. Others cap at ±3.0 unless configured narrower.
        </p>
      </div>

      <div className="mt-6 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">Choose your format</h2>
        <ul className="list-disc pl-5 text-sm text-gray-800">
          <li>Use this page for an interactive walkthrough.</li>
          <li>Or download the PDF for printing and offline reference.</li>
        </ul>
      </div>
    </main>
    </div>
  );
}

export default dynamic(() => Promise.resolve(TutorialPage), { ssr: false });
