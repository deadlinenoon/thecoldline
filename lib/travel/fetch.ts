import type { TravelRow } from "./types";

export async function fetchTravel(): Promise<TravelRow[]> {
  try{
    const res = await fetch("/api/travel/data?kind=next_week", { cache: "no-store" });
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j) ? j as TravelRow[] : [];
  }catch{
    return [];
  }
}

