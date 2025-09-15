import { useEffect, useState } from "react";

export default function AdminAnalytics() {
  const [summary, setSummary] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try { const r = await fetch('/api/analytics/summary', { cache: 'no-store' }); const j = await r.json(); if(!stop) setSummary(j); } catch {}
      try { const r = await fetch('/api/analytics/trends', { cache: 'no-store' }); const j = await r.json(); if(!stop) setTrends(j); } catch {}
    };
    load();
    const id1 = setInterval(load, 15000);
    return () => { stop = true; clearInterval(id1); };
  }, []);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <KPI label="Hits Today" value={summary?.today?.hits ?? 0} />
        <KPI label="Signups Today" value={summary?.today?.signups ?? 0} />
        <KPI label="Hits 7d" value={summary?.last7?.hits ?? 0} />
        <KPI label="Signups 7d" value={summary?.last7?.signups ?? 0} />
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card title="Top Referrers (Today)">
          <Table rows={(summary?.topReferrersToday ?? []).map((r:any)=>[r.ref, r.hits])} headers={["Referrer","Hits"]}/>
        </Card>
        <Card title="Top Paths (Today)">
          <Table rows={(summary?.topPathsToday ?? []).map((r:any)=>[r.path, r.hits])} headers={["Path","Hits"]}/>
        </Card>
      </section>

      <section className="mt-8">
        <Card title="30 Day Trends">
          <Trends data={trends}/>
        </Card>
      </section>
    </main>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-4">
      <div className="text-sm opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value?.toLocaleString?.() ?? String(value)}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string|number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          {headers.map(h=>
            <th key={h} className="text-left py-1 pr-3">{h}</th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td className="py-2 opacity-60" colSpan={headers.length}>No data yet</td></tr>
        ) : rows.map((r,i)=>(
          <tr key={i} className="border-b/50">
            {r.map((c,j)=><td key={j} className="py-1 pr-3">{String(c)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Trends({ data }: { data?: { labels: string[]; hits: number[]; signups: number[] } }) {
  if (!data) return <div className="text-sm opacity-60">Loading…</div>;
  return (
    <div className="text-xs grid gap-1">
      <div>Hits: {data.hits.join(", ")}</div>
      <div>Signups: {data.signups.join(", ")}</div>
    </div>
  );
}
