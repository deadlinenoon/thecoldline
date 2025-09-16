#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from typing import List

import pandas as pd

from red_zone.pipeline import RZConfig, load_pbp, compute_red_zone_trips
from red_zone.plotting import plot_horizontal_stacked


def main() -> int:
    ap = argparse.ArgumentParser(description="Compute NFL red zone offense/defense and plot charts")
    ap.add_argument("--seasons", nargs="+", type=int, required=True, help="Seasons, e.g. 2023 2024 2025")
    ap.add_argument("--min-week", type=int, default=None)
    ap.add_argument("--max-week", type=int, default=None)
    ap.add_argument("--outdir", type=str, default="output")
    args = ap.parse_args()

    seasons: List[int] = [int(s) for s in args.seasons]
    os.makedirs("data", exist_ok=True)
    os.makedirs(args.outdir, exist_ok=True)

    print(f"Loading play-by-play for seasons {seasons}…")
    pbp = load_pbp(seasons, RZConfig(), args.min_week, args.max_week)
    print(f"Loaded PBP rows: {len(pbp)}")

    print("Computing red zone trips and outcomes…")
    off, defi = compute_red_zone_trips(pbp)

    seas_tag = "_".join(str(s) for s in seasons)
    off_csv = os.path.join(args.outdir, f"red_zone_offense_{seas_tag}.csv")
    def_csv = os.path.join(args.outdir, f"red_zone_defense_{seas_tag}.csv")
    off_png = os.path.join(args.outdir, f"red_zone_offense_{seas_tag}.png")
    def_png = os.path.join(args.outdir, f"red_zone_defense_{seas_tag}.png")

    off.to_csv(off_csv, index=False)
    defi.to_csv(def_csv, index=False)

    # Charts
    subtitle = f"Seasons: {', '.join(str(s) for s in seasons)}"
    # Offense: sort by td_pct descending
    plot_horizontal_stacked(off, "Red Zone Efficiency — Offense", subtitle, off_png, sort_asc=False)
    # Defense: sort by td_pct ascending (lowest allowed first)
    plot_horizontal_stacked(defi, "Red Zone Efficiency — Defense (Allowed)", subtitle, def_png, sort_asc=True)

    # Console summary
    top_off = off.sort_values("td_pct", ascending=False).head(5)[["team","season","trips","td_pct"]]
    bot_def = defi.sort_values("td_pct", ascending=True).head(5)[["team","season","trips","td_pct"]]
    pd.set_option("display.max_rows", 20)
    print("\nTop 5 Offense TD%:\n", top_off.to_string(index=False))
    print("\nBest 5 Defense (lowest TD% allowed):\n", bot_def.to_string(index=False))

    print(f"\nWrote: {off_csv}\nWrote: {def_csv}\nWrote: {off_png}\nWrote: {def_png}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

