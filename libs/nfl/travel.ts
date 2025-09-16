import { milesBetween } from "../geo/haversine";
import STADIUMS from "./stadiums";
import INTERNATIONAL_2025 from "./international-venues-2025";
import { getSeasonSchedule, Game } from "./schedule";

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

function normTeam(name: string): string {
  // Normalize known variations; default to input
  const map: Record<string, string> = {
    "LA Rams": "Los Angeles Rams",
    "Los Angeles Rams": "Los Angeles Rams",
    "LA Chargers": "Los Angeles Chargers",
    "Los Angeles Chargers": "Los Angeles Chargers",
    "Washington Football Team": "Washington Commanders",
  };
  return map[name] || name;
}

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
  for (const g of schedule) { teams.add(normTeam(g.home_team)); teams.add(normTeam(g.away_team)); }

  const rows: TravelRow[] = [];

  for (const team of Array.from(teams).sort()) {
    const games = schedule
      .filter(g => normTeam(g.home_team) === team || normTeam(g.away_team) === team)
      .sort((a, b) => a.week - b.week);

    const homeInfo = STADIUMS[team];
    if (!homeInfo) continue;
    let lastLat = homeInfo.lat;
    let lastLon = homeInfo.lon;
    let sinceHome = 0;
    let cumulative = 0;

    const byWeek = new Map<number, Game>();
    for (const g of games) byWeek.set(g.week, g);

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

      const home = normTeam(g.home_team);
      const away = normTeam(g.away_team);
      const isHome = home === team;
      const opp = isHome ? away : home;

      const neutral = neutralFor(w, g.id, home, away);
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

