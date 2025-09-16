import type { NextApiRequest, NextApiResponse } from "next";
import { getKV } from "../../../lib/kv";
import { kHits, kSignups, dstr } from "../../../lib/analytics/keys";

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d;
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const kv = await getKV();
  const days = Array.from({length:30},(_,i)=>daysAgo(29 - i));
  const labels = days.map(d=>dstr(d));
  const hits: number[] = [];
  const signups: number[] = [];
  for (const day of labels) {
    hits.push(await kv.getNum(kHits(day)));
    signups.push(await kv.getNum(kSignups(day)));
  }
  res.status(200).json({ labels, hits, signups });
}
