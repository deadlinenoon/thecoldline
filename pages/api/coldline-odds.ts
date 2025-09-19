import type { NextApiRequest, NextApiResponse } from "next";
import { getLegacyGames, type GameLine } from "@/lib/providers/games";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<GameLine[] | { error: string }>
) {
  try {
    const games = await getLegacyGames();
    res.status(200).json(games);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "missing ODDS_API_KEY") {
      return res.status(200).json({ error: msg });
    }
    res.status(500).json({ error: msg });
  }
}
