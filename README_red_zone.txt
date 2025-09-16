NFL Red Zone Efficiency (Offense/Defense)
----------------------------------------

This mini-repo computes team red zone trips and outcomes (TD, FG, Turnover, Stop) for NFL teams using the open nflfastR dataset via nfl_data_py. It writes tidy CSVs and renders two horizontal stacked bar charts.

Project layout
- red_zone/ package with pipeline.py and plotting.py
- scripts/red_zone.py CLI
- requirements.txt
- data/ local parquet cache per season (auto-created)
- output/ CSVs and charts

Install
  python -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt

Usage
  python scripts/red_zone.py --seasons 2024 2025

See the source files for full details and comments.

