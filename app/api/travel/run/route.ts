import { DateTime } from "luxon";
import { loadSchedule, loadStayovers, loadTeams, loadVenues } from "../../../../lib/io";
import { buildTravelRows, aggregateYTD } from "../../../../lib/computeTravel";
import { getCompletedThroughWeek, getNextWeek } from "../../../../lib/weeks";
import { putJSON, setStamp } from "../../../../lib/store";

function isExactlyTues0001ET(now = DateTime.now().setZone("America/New_York")) {
  return now.weekday === 2 && now.hour === 0 && now.minute === 1;
}

export async function GET() {
  if (!isExactlyTues0001ET()) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
  }

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

    return new Response(
      JSON.stringify({
        ok: true,
        completed_through_week: doneWeek,
        next_week: nextWeek,
        ytd_count: ytd.length,
        next_week_count: nextWeekRows.length,
        updated_at: nowET.toISO(),
      }),
      { status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "unknown error" }), { status: 500 });
  }
}

