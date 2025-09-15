import { DateTime } from "luxon";
import { geodesicMiles } from "./distance";
import { Game, TravelRow, Venue } from "./types";

type Ctx = {
  homeVenueId: string;
  home: { lat: number; lon: number; name: string; city: string; country: string; roof: "Open-air" | "Domed" };
  lastLoc?: { lat: number; lon: number };
  lastWeek?: number;
  lastDate?: DateTime;
  milesSinceHome: number;
  ytd: number;
};

export function buildTravelRows(
  schedule: Game[],
  venues: Record<string, Venue>,
  teamHome: Record<string, string>,
  cutoffWeek: number,
  stayovers: { team: string; from_week: number; to_week: number; }[] = []
): TravelRow[] {
  const byWeek = new Map<number, Game[]>();
  for (const g of schedule) {
    if (!byWeek.has(g.week)) byWeek.set(g.week, []);
    byWeek.get(g.week)!.push(g);
  }
  for (const arr of byWeek.values()) arr.sort((a, b) => a.game_date_local.localeCompare(b.game_date_local));

  const ctx = new Map<string, Ctx>();
  const out: TravelRow[] = [];

  const isStay = (team: string, prevWeek: number | undefined, currWeek: number) => {
    if (!prevWeek) return false;
    return stayovers.some(o => o.team === team && o.from_week === prevWeek && o.to_week === currWeek);
  };

  const weeks = [...byWeek.keys()].filter(w => w <= cutoffWeek).sort((a, b) => a - b);

  for (const wk of weeks) {
    const games = byWeek.get(wk)!;
    for (const g of games) {
      const v = venues[g.venue_id];
      if (!v) throw new Error(`unknown venue_id ${g.venue_id} for week ${wk}`);

      const when = DateTime.fromISO(g.game_date_local, { zone: "America/New_York" });

      const pairs: [team: string, opp: string, site: "home" | "away" | "international"][] = [
        [g.home, g.away, v.international ? "international" : "home"],
        [g.away, g.home, v.international ? "international" : "away"]
      ];

      for (const [team, opp, site] of pairs) {
        let c = ctx.get(team);
        if (!c) {
          const homeVenueId = teamHome[team];
          const hv = venues[homeVenueId];
          if (!hv) throw new Error(`unknown home venue for ${team}`);
          c = {
            homeVenueId,
            home: { lat: hv.lat, lon: hv.lon, name: hv.name, city: hv.city, country: hv.country, roof: hv.roof },
            lastLoc: { lat: hv.lat, lon: hv.lon },
            milesSinceHome: 0,
            ytd: 0
          };
          ctx.set(team, c);
        }

        let notes: string | undefined;
        if (c.lastDate) {
          const days = when.diff(c.lastDate, "days").days;
          if (days <= 5) notes = "short week";
        }

        let origin = c.home;
        if (site !== "home") {
          const prevWeek = c.lastWeek;
          const stay = isStay(team, prevWeek, wk);
          if (stay && c.lastLoc) {
            origin = { lat: c.lastLoc.lat, lon: c.lastLoc.lon, name: "prev game", city: "", country: "", roof: c.home.roof } as any;
            notes = notes ? `${notes}; stayed on road` : "stayed on road";
          } else {
            origin = c.home;
          }
        }

        const leg = site === "home" ? 0 : geodesicMiles(origin.lat, origin.lon, v.lat, v.lon);

        const milesSinceHome = site === "home" ? 0 : c.milesSinceHome + leg;
        const ytd = c.ytd + leg;

        out.push({
          season: g.season,
          week: wk,
          team,
          opponent: opp,
          game_date_local: g.game_date_local,
          site_type: site,
          stadium_name: v.name,
          stadium_city: v.city,
          stadium_country: v.country,
          stadium_roof: v.roof,
          home_stadium: c.home.name,
          home_lat: c.home.lat,
          home_lon: c.home.lon,
          origin_lat: origin.lat,
          origin_lon: origin.lon,
          dest_lat: v.lat,
          dest_lon: v.lon,
          leg_miles: leg,
          miles_since_last_home: milesSinceHome,
          ytd_miles: ytd,
          notes
        });

        c.lastLoc = { lat: v.lat, lon: v.lon };
        c.lastWeek = wk;
        c.lastDate = when;
        c.ytd = ytd;
        c.milesSinceHome = site === "home" ? 0 : milesSinceHome;
      }
    }
  }

  return out;
}

export function aggregateYTD(rows: TravelRow[], cutoffWeek: number) {
  const slice = rows.filter(r => r.week <= cutoffWeek);
  const map = new Map<string, { team: string; ytd_miles: number; miles_since_last_home: number; last_week_played: number }>();
  for (const r of slice) {
    const prev = map.get(r.team) ?? { team: r.team, ytd_miles: 0, miles_since_last_home: 0, last_week_played: 0 };
    map.set(r.team, {
      team: r.team,
      ytd_miles: r.ytd_miles,
      miles_since_last_home: r.miles_since_last_home,
      last_week_played: Math.max(prev.last_week_played, r.week)
    });
  }
  const out = Array.from(map.values());
  out.sort((a, b) => b.ytd_miles - a.ytd_miles);
  return out;
}

