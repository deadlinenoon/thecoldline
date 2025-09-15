import fs from "node:fs/promises";
import path from "node:path";
import { Game, Venue } from "./types";

const root = process.cwd();
const p = (...xs: string[]) => path.join(root, "data", ...xs);

export async function loadJSON<T>(file: string): Promise<T> {
  const raw = await fs.readFile(p(file), "utf8");
  return JSON.parse(raw) as T;
}

export async function loadSchedule(): Promise<Game[]> {
  return loadJSON<Game[]>("nfl_2025_schedule.json");
}

export async function loadVenues(): Promise<Record<string, Venue>> {
  return loadJSON<Record<string, Venue>>("venues_2025.json");
}

export async function loadTeams(): Promise<Record<string, string>> {
  // map team to home venue id
  return loadJSON<Record<string, string>>("teams_2025.json");
}

export async function loadStayovers(): Promise<{ team: string; from_week: number; to_week: number; }[]> {
  try {
    return await loadJSON("stayover_overrides.json");
  } catch {
    return [];
  }
}

