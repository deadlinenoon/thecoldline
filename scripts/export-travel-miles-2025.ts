import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { buildTravelTable } from '../libs/nfl/buildTravelTable';

function toCSVCell(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function main() {
  const season = 2025;
  const rows = await buildTravelTable(season);
  const headers = [
    'team','week','opponent','home_away','game_city','game_lat','game_lon','distance_from_prev_location_mi','miles_since_last_home','cumulative_miles','note'
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const vals = [
      r.team, r.week, r.opponent, r.home_away, r.game_city, r.game_lat, r.game_lon,
      r.distance_from_prev_location_mi, r.miles_since_last_home, r.cumulative_miles, r.note || ''
    ];
    lines.push(vals.map(toCSVCell).join(','));
  }
  const dir = join(process.cwd(), 'data');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'travel_miles_2025.csv');
  writeFileSync(file, lines.join('\n'));
  // eslint-disable-next-line no-console
  console.log(`Wrote ${rows.length} rows to ${file}`);
}

main().catch((e)=>{ console.error('export-travel-miles-2025 failed', e); process.exit(1); });

