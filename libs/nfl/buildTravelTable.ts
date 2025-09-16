import STADIUMS, { StadiumInfo } from "./stadiums";
import { INTERNATIONAL_2025 } from "./international_2025";
import { normalizeTeam } from "./teams";
import { milesBetween } from "../geo/haversine";
import { getSeasonSchedule } from "./schedule";
import { DateTime } from "luxon";

export type TravelRow = {
  team: string;
  week: number;
  opponent: string;
  home_away: "home" | "away" | "bye";
  game_city: string;
  game_lat: number;
  game_lon: number;
  distance_from_prev_location_mi: number;
  miles_since_last_home: number;
  cumulative_miles: number;
  note?: string;
  is_primetime: boolean;
  is_dome: boolean;
};

type Loc = { lat: number; lon: number; city: string; roof: StadiumInfo['roof'] };

function teamHome(team: string): Loc {
  const info = STADIUMS[team];
  return { lat: info.lat, lon: info.lon, city: info.city, roof: info.roof };
}

export async function buildTravelTable(season: number): Promise<TravelRow[]> {
  const schedule = await getSeasonSchedule(season);
  const teams = Object.keys(STADIUMS);
  const byTeamWeek: Record<string, Record<number, { opp: string; isHome: boolean; dateUTC: string }>> = {};
  for (const t of teams) byTeamWeek[t] = {};

  for (const g of schedule) {
    const home = normalizeTeam(g.home);
    const away = normalizeTeam(g.away);
    const week = Number(g.week || 0);
    if (!week) continue; // ignore if week not known
    if (!byTeamWeek[home]) byTeamWeek[home] = {};
    if (!byTeamWeek[away]) byTeamWeek[away] = {};
    byTeamWeek[home][week] = { opp: away, isHome: true, dateUTC: g.dateUTC };
    byTeamWeek[away][week] = { opp: home, isHome: false, dateUTC: g.dateUTC };
  }

  const rows: TravelRow[] = [];
  for (const team of teams) {
    let prevLoc = teamHome(team);
    let milesSinceHome = 0;
    let cum = 0;
    for (let week = 1; week <= 18; week++) {
      const game = byTeamWeek[team][week];
      if (!game) {
        rows.push({
          team,
          week,
          opponent: "",
          home_away: "bye",
          game_city: prevLoc.city,
          game_lat: prevLoc.lat,
          game_lon: prevLoc.lon,
          distance_from_prev_location_mi: 0,
          miles_since_last_home: milesSinceHome,
          cumulative_miles: cum,
          note: "BYE",
          is_primetime: false,
          is_dome: prevLoc.roof === 'dome' || prevLoc.roof === 'retractable',
        });
        continue;
      }

      let loc: Loc;
      let note: string | undefined;
      const opp = game.opp;
      if (game.isHome) {
        loc = teamHome(team);
      } else {
        loc = teamHome(opp);
      }
      const intl = INTERNATIONAL_2025.find(
        (x) => x.week === week && ((normalizeTeam(x.home) === team && normalizeTeam(x.away) === opp) || (normalizeTeam(x.home) === opp && normalizeTeam(x.away) === team))
      );
      if (intl) {
        loc = { lat: intl.lat, lon: intl.lon, city: intl.city, roof: 'outdoor' };
        note = "Neutral site";
      }

      const dist = milesBetween(prevLoc.lat, prevLoc.lon, loc.lat, loc.lon);
      cum += dist;
      const kickoff = DateTime.fromISO(game.dateUTC).setZone('America/New_York');
      const hr = kickoff.hour;
      const wd = kickoff.weekday; // 1=Monday .. 7=Sunday
      const isPrime = (hr >= 19 && hr <= 22) && (wd === 1 || wd === 4 || wd === 7);
      const isDome = loc.roof === 'dome' || loc.roof === 'retractable';
      if (game.isHome) {
        milesSinceHome = 0;
      } else {
        milesSinceHome += dist;
      }
      rows.push({
        team,
        week,
        opponent: opp,
        home_away: game.isHome ? "home" : "away",
        game_city: loc.city,
        game_lat: loc.lat,
        game_lon: loc.lon,
        distance_from_prev_location_mi: dist,
        miles_since_last_home: milesSinceHome,
        cumulative_miles: cum,
        note,
        is_primetime: isPrime,
        is_dome: isDome,
      });
      prevLoc = loc;
    }
  }

  rows.sort((a, b) => (a.team === b.team ? a.week - b.week : a.team.localeCompare(b.team)));
  return rows;
}

export default buildTravelTable;
