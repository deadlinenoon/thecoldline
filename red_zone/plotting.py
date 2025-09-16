from __future__ import annotations

from typing import Optional

import matplotlib.pyplot as plt
import pandas as pd

COLORS = {
    "TD": "#2ecc71",
    "FG": "#f1c40f",
    "Turnover": "#e67e22",
    "Stop": "#e74c3c",
}


def _ensure_order(df: pd.DataFrame) -> pd.DataFrame:
    # Ensure columns exist
    for c in ["td_pct","fg_pct","turnover_pct","stop_pct"]:
        if c not in df.columns:
            df[c] = 0.0
    return df


def plot_horizontal_stacked(df: pd.DataFrame, title: str, subtitle: Optional[str], out_path: str, sort_asc: bool) -> None:
    df = _ensure_order(df.copy())
    # Sorting
    df = df.sort_values("td_pct", ascending=sort_asc)
    teams = df["team"].tolist()
    td = df["td_pct"].tolist()
    fg = df["fg_pct"].tolist()
    to = df["turnover_pct"].tolist()
    st = df["stop_pct"].tolist()

    n = len(teams)
    fig_h = max(8, 0.35 * n + 2)
    fig, ax = plt.subplots(figsize=(12, fig_h))

    y = range(n)
    ax.barh(y, td, color=COLORS["TD"], label="TD")
    ax.barh(y, fg, left=td, color=COLORS["FG"], label="FG")
    left2 = [a + b for a, b in zip(td, fg)]
    ax.barh(y, to, left=left2, color=COLORS["Turnover"], label="Turnover")
    left3 = [a + b for a, b in zip(left2, to)]
    ax.barh(y, st, left=left3, color=COLORS["Stop"], label="Stop")

    # Annotate segments >= 6%
    def annotate(seg_vals, left_vals, color):
        for i, (val, left) in enumerate(zip(seg_vals, left_vals)):
            if val >= 0.06:
                ax.text(left + val / 2, i, f"{val*100:.0f}%", va="center", ha="center", color="black", fontsize=8)

    annotate(td, [0.0] * n, COLORS["TD"])
    annotate(fg, td, COLORS["FG"])
    annotate(to, left2, COLORS["Turnover"])
    annotate(st, left3, COLORS["Stop"])

    ax.set_yticks(list(y))
    ax.set_yticklabels(teams)
    ax.set_xlim(0, 1)
    ax.set_xlabel("Share of Red Zone Trips")
    ax.set_title(title)
    if subtitle:
        ax.text(0, 1.02, subtitle, transform=ax.transAxes, fontsize=9, va="bottom")
    ax.legend(loc="lower right", bbox_to_anchor=(1.0, 1.02), ncol=4)
    ax.grid(axis="x", linestyle=":", alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=200)
    plt.close(fig)


