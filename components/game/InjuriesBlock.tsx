import React from "react";
import useSWR from "swr";

const fetcher = async (u: string) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("Invalid JSON response");
  return r.json();
};

type InjuriesBlockProps = {
  teamA: string;
  teamB: string;
};

export default function InjuriesBlock({ teamA, teamB }: InjuriesBlockProps) {
  const { data, error, isLoading } = useSWR(
    `/api/injuries?teamA=${teamA}&teamB=${teamB}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) return <div className="text-sm text-zinc-400">Loading injuries…</div>;
  if (error) return <div className="text-sm text-red-400">Injuries error: {String((error as Error).message)}</div>;
  if (data?.error) return <div className="text-sm text-red-400">Injuries API: {String(data.error)}</div>;

  const home = Array.isArray(data?.home?.list) ? data.home.list : [];
  const away = Array.isArray(data?.away?.list) ? data.away.list : [];

  const renderName = (it: any) => {
    const fromObject = it?.player?.name;
    if (typeof fromObject === "string" && fromObject.trim()) return fromObject.trim();
    const first = typeof it?.player?.first_name === "string" ? it.player.first_name : it?.player?.firstName;
    const last = typeof it?.player?.last_name === "string" ? it.player.last_name : it?.player?.lastName;
    const fallback = `${first ?? ""} ${last ?? ""}`.trim();
    if (fallback) return fallback;
    if (typeof it?.name === "string" && it.name.trim()) return it.name.trim();
    if (typeof it?.player_name === "string" && it.player_name.trim()) return it.player_name.trim();
    return "Unnamed player";
  };

  const renderStatus = (it: any) => {
    const status = typeof it?.status === "string" && it.status.trim() ? it.status.trim() : null;
    const note = typeof it?.note === "string" && it.note.trim() ? it.note.trim() : null;
    return status || note || "status unknown";
  };

  return (
    <section aria-label="Injuries" className="space-y-2">
      <h4 className="text-sm font-medium">Injuries</h4>
      {home.length + away.length === 0 ? (
        <div className="text-xs text-zinc-400">No listed injuries.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ul className="space-y-1 text-sm">
            {home.map((it: any) => (
              <li key={it.id ?? renderName(it)} className="flex gap-2">
                <span className="text-zinc-300">{renderName(it)}</span>
                <span className="text-zinc-500">— {renderStatus(it)}</span>
              </li>
            ))}
          </ul>
          <ul className="space-y-1 text-sm">
            {away.map((it: any) => (
              <li key={it.id ?? renderName(it)} className="flex gap-2">
                <span className="text-zinc-300">{renderName(it)}</span>
                <span className="text-zinc-500">— {renderStatus(it)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
