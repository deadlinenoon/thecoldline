import type { NextApiRequest, NextApiResponse } from "next";
import { getJSON, putJSON, setStamp } from "../../../lib/store";
import { DateTime } from "luxon";
import { loadSchedule, loadStayovers, loadTeams, loadVenues } from "../../../lib/io";
import { buildTravelRows, aggregateYTD } from "../../../lib/computeTravel";
import { getCompletedThroughWeek, getNextWeek } from "../../../lib/weeks";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const kind = String(req.query.kind || "ytd");
  const force = String(req.query.force || "0") === "1";
  if (!["ytd", "next_week", "updated_at"].includes(kind)) {
    return res.status(400).json({ error: "invalid kind" });
  }
  const key = kind === "ytd" ? "travel:2025:ytd" : kind === "next_week" ? "travel:2025:next_week" : "travel:2025:updated_at";

  let data = await getJSON(key);

  if (!data || force) {
    try {
      const schedule = await loadSchedule();
      const venues = await loadVenues();
      const teams = await loadTeams();
      const stayovers = await loadStayovers();

      const nowET = DateTime.now().setZone("America/New_York");
      const doneWeek = getCompletedThroughWeek(schedule, nowET);
      const nextWeek = getNextWeek(schedule, nowET);

      const rowsThroughDone = buildTravelRows(schedule, venues, teams, doneWeek, stayovers);
      const ytd = aggregateYTD(rowsThroughDone, doneWeek);

      const rowsThroughNext = buildTravelRows(schedule, venues, teams, nextWeek, stayovers);
      const nextWeekRows = rowsThroughNext.filter(r => r.week === nextWeek);

      await putJSON("travel:2025:ytd", ytd);
      await putJSON("travel:2025:next_week", nextWeekRows);
      await setStamp("travel:2025:updated_at");

      data = kind === "ytd" ? ytd : kind === "next_week" ? nextWeekRows : await getJSON("travel:2025:updated_at");
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "recompute failure" });
    }
  }

  if (!data) return res.status(404).json({ error: "not found" });
  res.status(200).json(data);
}
