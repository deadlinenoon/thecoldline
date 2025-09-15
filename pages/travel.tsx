import dynamic from "next/dynamic";

const TravelMilesBarChart = dynamic(() => import("../components/TravelMilesBarChart"), { ssr: false });
const NextWeekTravelTable = dynamic(() => import("../components/NextWeekTravelTable"), { ssr: false });

export default function TravelPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">NFL 2025 travel</h1>
      <TravelMilesBarChart />
      <div className="mt-8" />
      <NextWeekTravelTable />
      <div className="mt-8 rounded border p-3 text-sm">
        Data updates Tuesdays at 12:01 AM Eastern via /api/travel/run and persists in Upstash.
      </div>
    </main>
  );
}

