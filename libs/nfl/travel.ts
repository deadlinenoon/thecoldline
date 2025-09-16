import { milesBetween } from "../geo/haversine";
import STADIUMS from "./stadiums";
import INTERNATIONAL_2025 from "./international-venues-2025";
import { getSeasonSchedule } from "./schedule";
import type { ScheduleRow as Game } from "./schedule";
import { normalizeTeam } from "./teams";

// tolerant accessors so we build regardless of schedule row shape
const homeOf = (g: any) => g.homeTeam ?? g.home_team ?? g.home ?? g.h ?? "";
const awayOf = (g: any) => g.awayTeam ?? g.away_team ?? g.away ?? g.a ?? "";
const idOf   = (g: any) => g.gameId   ?? g.id        ?? g.gid  ?? g.key ?? "";

const normTeam = (t: string) => normalizeTeam(String(t || "").trim());

export type TravelRow = {
  team: string;
  week: number;
  opponent: string;
  home_away: "HOME" | "AWAY" | "BYE";
  game_city: string;
  game_lat: number;
  game_lon: number;
  distance_from_prev_location_mi: number;
  miles_since_last_home: number;
  cumulative_miles: number;
  note?: string;
};

function neutralFor(week: number, gameId: string, home: string, away: string) {
  return INTERNATIONAL_2025.find(v =>
    v.week === week && (
      (v.gameId && v.gameId === gameId) ||
      ((v.home_team === home && v.away_team === away) || (v.home_team === away && v.away_team === home))
    )
  );
}

export async function buildTravelTable(season: number): Promise<TravelRow[]> {
  const schedule: Game[] = await getSeasonSchedule(season);

  // Build per-team schedule weeks 1..18 with BYE inserted
  const teams = new Set<string>();
  for (const g of schedule) { teams.add(normTeam(homeOf(g))); teams.add(normTeam(awayOf(g))); }

  const rows: TravelRow[] = [];

  for (const team of Array.from(teams).sort()) {
    const games = schedule
      .filter(g => normTeam(homeOf(g)) === team || normTeam(awayOf(g)) === team)
      .sort((a, b) => a.week - b.week);

    const homeInfo = STADIUMS[team];
    if (!homeInfo) continue;
    let lastLat = homeInfo.lat;
    let lastLon = homeInfo.lon;
    let sinceHome = 0;
    let cumulative = 0;

    const byWeek = new Map<number, Game>();
    for (const g of games) byWeek.set((g as any).week ?? (g as any).wk ?? 0, g);

    for (let w = 1; w <= 18; w++) {
      const g = byWeek.get(w);
      if (!g) {
        // BYE week — carry location, distance 0
        rows.push({
          team,
          week: w,
          opponent: "",
          home_away: "BYE",
          game_city: homeInfo.city,
          game_lat: lastLat,
          game_lon: lastLon,
          distance_from_prev_location_mi: 0,
          miles_since_last_home: sinceHome,
          cumulative_miles: cumulative,
          note: "BYE",
        });
        continue;
        }

      const home = normTeam(homeOf(g));
      const away = normTeam(awayOf(g));
      const isHome = home === team;
      const opp = isHome ? away : home;

      const neutral = neutralFor(w, idOf(g), home, away);
      let city = ""; let lat = 0; let lon = 0; let note: string | undefined;
      if (neutral) {
        city = neutral.city; lat = neutral.lat; lon = neutral.lon; note = "Neutral site";
      } else if (isHome) {
        const s = STADIUMS[team]; city = s.city; lat = s.lat; lon = s.lon;
      } else {
        const s = STADIUMS[opp]; city = s.city; lat = s.lat; lon = s.lon;
      }

      const leg = milesBetween(lastLat, lastLon, lat, lon);
      cumulative += leg;
      sinceHome = isHome ? 0 : sinceHome + leg;

      rows.push({
        team,
        week: w,
        opponent: opp,
        home_away: isHome ? "HOME" : "AWAY",
        game_city: city,
        game_lat: lat,
        game_lon: lon,
        distance_from_prev_location_mi: leg,
        miles_since_last_home: sinceHome,
        cumulative_miles: cumulative,
        note,
      });

      lastLat = lat; lastLon = lon;
    }
  }

  return rows.sort((a, b) => a.team.localeCompare(b.team) || a.week - b.week);
}

export default buildTravelTable;
