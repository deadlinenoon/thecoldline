import { withApiKey } from "../net/withApiKey";
import { normalizeTeam } from "./teams";

export type ScheduleRow = { gameId: string; week: number; home: string; away: string; dateUTC: string };

async function fetchESPNWeek(season: number, week: number): Promise<ScheduleRow[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 } });
  if (!res.ok) throw new Error(`ESPN schedule fetch failed ${res.status}`);
  const json: any = await res.json();
  const events: any[] = json?.events || [];
  const rows: ScheduleRow[] = [];
  for (const e of events) {
    const id = String(e?.id ?? `${season}-w${week}-${rows.length}`);
    const comp = e?.competitions?.[0];
    const date = String(e?.date || comp?.date || new Date().toISOString());
    const home = comp?.competitors?.find((c: any) => c?.homeAway === "home")?.team?.displayName || comp?.competitors?.[0]?.team?.displayName;
    const away = comp?.competitors?.find((c: any) => c?.homeAway === "away")?.team?.displayName || comp?.competitors?.[1]?.team?.displayName;
    if (!home || !away) continue;
    rows.push({ gameId: `espn:${id}`, week, home: normalizeTeam(home), away: normalizeTeam(away), dateUTC: new Date(date).toISOString() });
  }
  return rows;
}

async function fetchOddsApiSeason(season: number): Promise<ScheduleRow[]> {
  // The Odds API event listing may not include full season; best effort.
  const base = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events?all=true&season=${season}`;
  const { url, init } = withApiKey(base);
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Odds API events failed ${res.status}`);
  const data: any[] = await res.json();
  const out: ScheduleRow[] = [];
  for (const ev of data) {
    const id = ev?.id ? `odds:${ev.id}` : `odds:${season}-${ev?.commence_time || ev?.date || "tbd"}`;
    const home = normalizeTeam(ev?.home_team || ev?.teams?.[0] || "");
    const away = normalizeTeam(ev?.away_team || ev?.teams?.[1] || "");
    if (!home || !away) continue;
    // Derive week as 0; will be refined elsewhere if provider lacks week granularity
    const dateUTC = new Date(String(ev?.commence_time || ev?.date || new Date().toISOString())).toISOString();
    out.push({ gameId: id, week: 0, home, away, dateUTC });
  }
  return out;
}

export async function getSeasonSchedule(season: number): Promise<ScheduleRow[]> {
  try {
    const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
    const results: ScheduleRow[] = [];
    for (const w of weeks) {
      try {
        const rows = await fetchESPNWeek(season, w);
        results.push(...rows);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`schedule: ESPN week ${w} failed`, e);
      }
    }
    if (results.length > 0) return results;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("schedule: ESPN primary failed", e);
  }
  try {
    const alt = await fetchOddsApiSeason(season);
    return alt;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("schedule: Odds API fallback failed", e);
  }
  return [];
}

export default getSeasonSchedule;

