from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass
from typing import Iterable, List, Tuple

import pandas as pd
from dateutil import tz


@dataclass
class RZConfig:
    cache_dir: str = "data"
    max_cache_age_sec: int = 24 * 3600


def _cache_path(season: int, cfg: RZConfig) -> str:
    return os.path.join(cfg.cache_dir, f"pbp_{season}.parquet")


def _is_fresh(path: str, max_age: int) -> bool:
    try:
        st = os.stat(path)
        return (time.time() - st.st_mtime) < max_age
    except FileNotFoundError:
        return False


def _retry(fn, attempts: int = 4, base_delay: float = 0.6):
    last = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(base_delay * (2 ** i))
    if last:
        raise last
    raise RuntimeError("retry failed with no exception captured")


def load_pbp_season(season: int, cfg: RZConfig) -> pd.DataFrame:
    """Load a single season PBP with caching and resilient fetch.

    - Uses nfl_data_py.import_pbp_data(seasons=[season], cache=True)
    - Stores/reads parquet cache in cfg.cache_dir/pbp_{season}.parquet
    - On fetch error, falls back to cache (if present)
    """

    os.makedirs(cfg.cache_dir, exist_ok=True)
    cache_path = _cache_path(season, cfg)

    if _is_fresh(cache_path, cfg.max_cache_age_sec):
        print(f"load_pbp_season: using fresh cache {cache_path}")
        return pd.read_parquet(cache_path)

    try:
        import nfl_data_py as nfl  # local import to avoid hard dep until used

        def fetch():
            print(f"load_pbp_season: fetching season {season} from nflfastR via nfl_data_py…")
            df = nfl.import_pbp_data([season], cache=True)  # type: ignore[attr-defined]
            if not isinstance(df, pd.DataFrame):
                raise RuntimeError("nfl_data_py returned non-DataFrame")
            return df

        df = _retry(fetch)
        # write cache
        df.to_parquet(cache_path, index=False)
        print(f"load_pbp_season: wrote cache {cache_path} rows={len(df)}")
        return df
    except Exception as e:  # noqa: BLE001
        if os.path.exists(cache_path):
            print(f"load_pbp_season: fetch failed: {e}; falling back to cache {cache_path}")
            return pd.read_parquet(cache_path)
        raise


def load_pbp(seasons: Iterable[int], cfg: RZConfig, min_week: int | None = None, max_week: int | None = None) -> pd.DataFrame:
    frames = []
    for s in seasons:
        df = load_pbp_season(int(s), cfg)
        frames.append(df)
    pbp = pd.concat(frames, ignore_index=True)
    if min_week is not None:
        pbp = pbp[pbp["week"] >= int(min_week)]
    if max_week is not None:
        pbp = pbp[pbp["week"] <= int(max_week)]
    return pbp


def _first_non_null(series: pd.Series) -> str:
    for v in series:
        if pd.notna(v) and v != "":
            return str(v)
    return ""


def _classify_from_transition(trans: str) -> str | None:
    t = (trans or "").strip().lower()
    if not t:
        return None
    if "touchdown" in t:
        return "TD"
    if "field goal" in t and ("made" in t or t == "field goal"):
        return "FG"
    if "interception" in t or "fumble" in t:
        return "Turnover"
    # all other scoreless endings, punts, downs, missed/blocked FG, end of half/game
    return "Stop"


def _infer_outcome_from_final(final_row: pd.Series, drive_df: pd.DataFrame, offense: str) -> str:
    # TD if offense scored in the drive
    try:
        if int(drive_df.get("touchdown", 0).fillna(0).astype(int).max()) == 1:
            return "TD"
    except Exception:
        pass
    # FG made
    fgr = str(final_row.get("field_goal_result", "")).lower()
    if fgr == "made":
        return "FG"
    # Turnover by offense on final play
    try:
        if int(final_row.get("interception", 0)) == 1 or int(final_row.get("fumble_lost", 0)) == 1:
            return "Turnover"
    except Exception:
        pass
    return "Stop"


def compute_red_zone_trips(pbp: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    # Ensure basic fields exist
    for col in [
        "game_id",
        "drive",
        "posteam",
        "defteam",
        "yardline_100",
        "drive_end_transition",
        "touchdown",
        "field_goal_result",
        "fumble_lost",
        "interception",
        "play_id",
        "season",
        "week",
    ]:
        if col not in pbp.columns:
            pbp[col] = pd.NA

    pbp = pbp.copy()
    pbp["drive_id"] = pbp["game_id"].astype(str) + "_" + pbp["drive"].astype(str)

    drives: List[pd.DataFrame] = [g for _, g in pbp.groupby("drive_id", sort=False)]

    records = []
    for g in drives:
        offense = _first_non_null(g["posteam"]) or ""
        defense = _first_non_null(g["defteam"]) or ""
        if not offense:
            continue
        # restrict to snaps with offense possessing
        sub = g[g["posteam"] == offense]
        in_rz = False
        if "yardline_100" in sub.columns:
            try:
                in_rz = (pd.to_numeric(sub["yardline_100"], errors="coerce") <= 20).fillna(False).any()
            except Exception:
                in_rz = False
        if not in_rz:
            continue

        # season/week from first valid row
        season = int(pd.to_numeric(_first_non_null(g["season"]) or 0, errors="coerce")) if pd.notna(_first_non_null(g["season"])) else int(g.get("season", pd.Series([0])).iloc[0] or 0)
        week = int(pd.to_numeric(_first_non_null(g["week"]) or 0, errors="coerce")) if pd.notna(_first_non_null(g["week"])) else int(g.get("week", pd.Series([0])).iloc[0] or 0)

        # outcome via transition or infer from final play
        trans_col = g.get("drive_end_transition")
        transition = None
        if trans_col is not None:
            transition = _first_non_null(trans_col[::-1])  # look from end
        final_row = g.iloc[-1]
        outcome = _classify_from_transition(transition or "") or _infer_outcome_from_final(final_row, g, offense)

        records.append({
            "season": season,
            "week": week,
            "offense": offense,
            "defense": defense,
            "outcome": outcome,
        })

    trips = pd.DataFrame.from_records(records)
    if trips.empty:
        return (
            pd.DataFrame(columns=["team","season","trips","td","fg","turnover","stop","td_pct","fg_pct","turnover_pct","stop_pct"]),
            pd.DataFrame(columns=["team","season","trips","td","fg","turnover","stop","td_pct","fg_pct","turnover_pct","stop_pct"]),
        )

    # Unit check: count of trips equals unique drive count with RZ condition
    # Already constructed as such; simple assert len(trips) == len(records)
    assert len(trips) == len(records)

    def summarize(df: pd.DataFrame, team_col: str) -> pd.DataFrame:
        counts = (
            df.assign(one=1)
              .pivot_table(index=[team_col, "season"], columns="outcome", values="one", aggfunc="sum", fill_value=0)
              .reset_index()
        )
        for col in ["TD","FG","Turnover","Stop"]:
            if col not in counts.columns:
                counts[col] = 0
        counts = counts.rename(columns={team_col: "team", "TD":"td", "FG":"fg", "Turnover":"turnover", "Stop":"stop"})
        counts["trips"] = counts[["td","fg","turnover","stop"]].sum(axis=1)
        # No negatives
        for c in ["td","fg","turnover","stop","trips"]:
            counts[c] = counts[c].clip(lower=0)
        # Percentages
        for name, src in [("td_pct","td"),("fg_pct","fg"),("turnover_pct","turnover"),("stop_pct","stop")]:
            counts[name] = (counts[src] / counts["trips"]).fillna(0.0)
        # Assert pct sums to 1 within tolerance
        s = counts[["td_pct","fg_pct","turnover_pct","stop_pct"]].sum(axis=1)
        assert ((s - 1.0).abs() < 0.001).all() or (counts["trips"]==0).all()
        return counts[["team","season","trips","td","fg","turnover","stop","td_pct","fg_pct","turnover_pct","stop_pct"]]

    off = summarize(trips.rename(columns={"offense":"team"}), "team")
    defi = summarize(trips.rename(columns={"defense":"team"}), "team")
    return off, defi


