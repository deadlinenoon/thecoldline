import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_: NextApiRequest, res: NextApiResponse) {
  const have = {
    ODDS_API_KEY: !!process.env.ODDS_API_KEY || !!process.env.NEXT_PUBLIC_ODDS_API_KEY,
    OPENWEATHERMAP_API_KEY: !!process.env.OPENWEATHERMAP_API_KEY,
    ALLSPORTS_OR_BALLDONTLIE: !!process.env.BALLDONTLIE_ALL_ACCESS_KEY || !!process.env.ALLSPORTS_API_KEY,
  };
  res.status(200).json({ ok: true, have });
}
