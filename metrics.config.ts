export const metricsConfig = [
  {
    "id": "starting_center_out",
    "label": "Starting center out",
    "group": "Environment & Conditions",
    "weight": -0.7,
    "significance": "Medium",
    "description": "Snap timing and protection communication degrade, more pressure and drive stalls",
    "fallbackUsed": false
  },
  {
    "id": "holder_out",
    "label": "Holder out",
    "group": "Environment & Conditions",
    "weight": -0.5,
    "significance": "Medium",
    "description": "Field goal operation time and tilt consistency worsen, small but real scoring drop",
    "fallbackUsed": false
  },
  {
    "id": "long_snapper_out",
    "label": "Long snapper out",
    "group": "Environment & Conditions",
    "weight": -0.8,
    "significance": "High",
    "description": "Higher variance on snaps; bad or miscued kicks more likely, punts affected",
    "fallbackUsed": false
  },
  {
    "id": "kicker_punter_over_host",
    "label": "Kicker/punter over host",
    "group": "Environment & Conditions",
    "weight": -0.6,
    "significance": "Medium-High",
    "description": "Ball travels farther, visiting stamina taxed slightly",
    "fallbackUsed": false
  },
  {
    "id": "surface_mismatch_turf_vs_grass",
    "label": "Surface mismatch, turf vs grass",
    "group": "Environment & Conditions",
    "weight": -0.4,
    "significance": "Medium",
    "description": "Pitch efficiency change, injury spikes",
    "fallbackUsed": false
  },
  {
    "id": "wind_exposure_15_20_mph",
    "label": "Wind exposure 15-20 mph",
    "group": "Environment & Conditions",
    "weight": -0.6,
    "significance": "High",
    "description": "Passing efficiency down, deep shots pass-heavy side more",
    "fallbackUsed": false
  },
  {
    "id": "wind_critical_25_mph",
    "label": "Wind critical >25 mph",
    "group": "Environment & Conditions",
    "weight": -0.9,
    "significance": "High",
    "description": "Kicking efficiency and cadence impacted",
    "fallbackUsed": false
  },
  {
    "id": "rain_or_snow_steady",
    "label": "Rain or snow, steady",
    "group": "Environment & Conditions",
    "weight": -0.8,
    "significance": "High",
    "description": "Host scoring falls 1.5+, slight disadvantage to pass",
    "fallbackUsed": false
  },
  {
    "id": "dead_crowd_diluted_home_fans",
    "label": "Dead crowd, diluted home fans",
    "group": "Environment & Conditions",
    "weight": -0.5,
    "significance": "Medium",
    "description": "Reduces home field advantage through snap count and officiating pressure",
    "fallbackUsed": false
  },
  {
    "id": "time_zone_mismatch_early_body_clock",
    "label": "Time zone mismatch, early body clock",
    "group": "Environment & Conditions",
    "weight": -0.6,
    "significance": "Low",
    "description": "West-to-east at 1 a.m. internal time at 1 p.m. ET",
    "fallbackUsed": false
  },
  {
    "id": "run_pass_matchup_edge",
    "label": "Run/pass matchup edge",
    "group": "Matchup & Scheme",
    "weight": 0.6,
    "significance": "High",
    "description": "Team A match, bigger edge in pass phase",
    "fallbackUsed": false
  },
  {
    "id": "explosive_play_rate_edge",
    "label": "Explosive play rate edge",
    "group": "Matchup & Scheme",
    "weight": 0.3,
    "significance": "High",
    "description": "Explosive scoring and win probability",
    "fallbackUsed": false
  },
  {
    "id": "red_zone_efficiency_matchup",
    "label": "Red zone efficiency matchup",
    "group": "Matchup & Scheme",
    "weight": 0.8,
    "significance": "High",
    "description": "Big leverage yards, score nearly equally",
    "fallbackUsed": false
  },
  {
    "id": "third_down_efficiency",
    "label": "Third-down efficiency",
    "group": "Matchup & Scheme",
    "weight": 0.4,
    "significance": "Medium",
    "description": "Hidden yards and pace rates, smaller than offense/defense",
    "fallbackUsed": false
  },
  {
    "id": "special_teams_edge",
    "label": "Special teams edge",
    "group": "Matchup & Scheme",
    "weight": 0.7,
    "significance": "Medium-High",
    "description": "Field position, hidden points",
    "fallbackUsed": false
  },
  {
    "id": "pass_protection_vulnerability",
    "label": "Pass protection vulnerability",
    "group": "Matchup & Scheme",
    "weight": -0.4,
    "significance": "Medium",
    "description": "Drive-killing plays & defensive havoc, expected drive EPA losses",
    "fallbackUsed": false
  },
  {
    "id": "stacked_box_exploitability",
    "label": "Stacked box exploitability",
    "group": "Matchup & Scheme",
    "weight": 0.1,
    "significance": "Low",
    "description": "Ability to punish loaded boxes via RPO or play-action",
    "fallbackUsed": false
  },
  {
    "id": "cu_scheme_fit_tempo_vs_zone",
    "label": "CU scheme fit, tempo vs zone",
    "group": "Matchup & Scheme",
    "weight": 0.3,
    "significance": "Low-Medium",
    "description": "Mismatch in rush vs play-action heavy",
    "fallbackUsed": false
  },
  {
    "id": "coverage_exploitation_man_vs_zone",
    "label": "Coverage exploitation, man vs zone",
    "group": "Matchup & Scheme",
    "weight": 0.4,
    "significance": "Medium",
    "description": "Exploitable mismatch is persistent",
    "fallbackUsed": false
  },
  {
    "id": "defensive_snap_load_last_week",
    "label": "Defensive snap load, last week",
    "group": "Matchup & Scheme",
    "weight": -0.6,
    "significance": "Low-Medium",
    "description": "Lasted long previous week; unusually predictive next week",
    "fallbackUsed": false
  },
  {
    "id": "offensive_snap_load_last_week",
    "label": "Offensive snap load, last week",
    "group": "Matchup & Scheme",
    "weight": 0.3,
    "significance": "Low-Medium",
    "description": "Less persistent than defense",
    "fallbackUsed": false
  },
  {
    "id": "tempo_heavy_offense",
    "label": "Tempo heavy offense",
    "group": "Matchup & Scheme",
    "weight": 0.5,
    "significance": "Medium",
    "description": "Sustain cadence without extra rest",
    "fallbackUsed": false
  },
  {
    "id": "travel_miles_since_home_typical",
    "label": "Travel miles since home, typical",
    "group": "Fatigue/Travel/Pace",
    "weight": -0.3,
    "significance": "Low",
    "description": "Distance alone weak effect unless extreme or with timezone shifts",
    "fallbackUsed": false
  },
  {
    "id": "early_3rd_straight_road",
    "label": "Early 3rd straight road",
    "group": "Fatigue/Travel/Pace",
    "weight": -0.4,
    "significance": "Medium",
    "description": "West to east at 1 a.m. internal time at 1 p.m. ET",
    "fallbackUsed": false
  },
  {
    "id": "rest_day_differential_past_7_days",
    "label": "Rest day differential, past 7 days",
    "group": "Fatigue/Travel/Pace",
    "weight": 0.5,
    "significance": "Medium",
    "description": "Multi-day rest edge",
    "fallbackUsed": false
  },
  {
    "id": "late_bye_week_gap",
    "label": "Late bye week gap",
    "group": "Fatigue/Travel/Pace",
    "weight": 0.4,
    "significance": "Low",
    "description": "Rest plus install time",
    "fallbackUsed": false
  },
  {
    "id": "long_road_trip_penalty_3_straight",
    "label": "Long road trip penalty, 3 straight",
    "group": "Fatigue/Travel/Pace",
    "weight": -0.5,
    "significance": "Medium",
    "description": "Accumulates travel and routine disruption",
    "fallbackUsed": false
  },
  {
    "id": "high_payout_sandwich",
    "label": "High payout sandwich",
    "group": "Fatigue/Travel/Pace",
    "weight": -0.4,
    "significance": "Medium",
    "description": "Games in 1-12-1 day sequences",
    "fallbackUsed": false
  },
  {
    "id": "travel_dock_composite",
    "label": "Travel dock, composite",
    "group": "Fatigue/Travel/Pace",
    "weight": -0.7,
    "significance": "Medium",
    "description": "Combined body clock, rest, distance into one cap",
    "fallbackUsed": false
  },
  {
    "id": "dl_run_defense_injury_cluster",
    "label": "DL run defense injury cluster",
    "group": "Fatigue/Travel/Pace",
    "weight": -1.0,
    "significance": "High",
    "description": "Surface protection and efficiency drop markedly",
    "fallbackUsed": false
  },
  {
    "id": "cb_vs_wr1_mismatch_vs_balance",
    "label": "CB vs WR1 mismatch vs balance",
    "group": "Fatigue/Travel/Pace",
    "weight": -1.2,
    "significance": "High",
    "description": "Elite WR vs backup CB spikes opponent pass EPA",
    "fallbackUsed": false
  },
  {
    "id": "multiple_starters_on_same_unit",
    "label": "Multiple starters on same unit",
    "group": "Injuries",
    "weight": -1.1,
    "significance": "High",
    "description": "Unnamed combo metric, input the expected QB delta in points, from 1 to 14",
    "fallbackUsed": false
  },
  {
    "id": "d1_run_defense_injury_cluster",
    "label": "D1 run defense injury cluster",
    "group": "Injuries",
    "weight": -0.8,
    "significance": "Medium-High",
    "description": "Run coverage exposes separation issues",
    "fallbackUsed": false
  },
  {
    "id": "wr1_out_vs_heavy_man_defense",
    "label": "WR1 out vs heavy man defense",
    "group": "Injuries",
    "weight": -0.4,
    "significance": "Medium-High",
    "description": "Man vs off-type allocation threat decline",
    "fallbackUsed": false
  },
  {
    "id": "te_lost_on_12_personnel",
    "label": "TE lost on 12 personnel",
    "group": "Injuries",
    "weight": -0.3,
    "significance": "Medium",
    "description": "Explosive pass advantage loss",
    "fallbackUsed": false
  },
  {
    "id": "both_safeties_out_vs_pa_heavy",
    "label": "Both safeties out vs PA-heavy",
    "group": "Injuries",
    "weight": -0.6,
    "significance": "High",
    "description": "Safeties devastated on PA even for mobile QBs",
    "fallbackUsed": false
  },
  {
    "id": "edge_rushers_vs_mobile_qb_mismatch",
    "label": "Edge rushers vs mobile QB mismatch",
    "group": "Injuries",
    "weight": -0.4,
    "significance": "Medium",
    "description": "High throw leverage targets punch inside",
    "fallbackUsed": false
  },
  {
    "id": "nickel_cb_out_vs_slot_heavy",
    "label": "Nickel CB out vs slot-heavy",
    "group": "Injuries",
    "weight": -0.6,
    "significance": "Medium",
    "description": "Man-heavy defenses allow scramble lanes",
    "fallbackUsed": false
  },
  {
    "id": "kicker_punter_elevation",
    "label": "Kicker/punter elevation",
    "group": "Intangibles/Context",
    "weight": 0.1,
    "significance": "Low",
    "description": "Narrative, limited measurable edge on average",
    "fallbackUsed": false
  },
  {
    "id": "motivation_angle",
    "label": "Motivation angle",
    "group": "Intangibles/Context",
    "weight": 0.2,
    "significance": "Low",
    "description": "Signal prep edge in divisional style matchup",
    "fallbackUsed": false
  },
  {
    "id": "revenge_game",
    "label": "Revenge game",
    "group": "Intangibles/Context",
    "weight": 0.1,
    "significance": "Low",
    "description": "Impact in quick, minimal signal stand-alone",
    "fallbackUsed": false
  },
  {
    "id": "coaching_familiarity",
    "label": "Coaching familiarity",
    "group": "Intangibles/Context",
    "weight": 0.3,
    "significance": "Low",
    "description": "Evidence thin, often coincident with injuries",
    "fallbackUsed": false
  },
  {
    "id": "final_home_game_boost",
    "label": "Final home game boost",
    "group": "Intangibles/Context",
    "weight": 0.2,
    "significance": "Low",
    "description": "Home attendance push & wave to final hosts",
    "fallbackUsed": false
  },
  {
    "id": "ats_trend_5_1",
    "label": "ATS trend 5-1",
    "group": "Momentum & Profile",
    "weight": 0,
    "significance": "Low",
    "description": "ATS trend no extra power",
    "fallbackUsed": false
  },
  {
    "id": "ats_trend_vs_conference",
    "label": "ATS trend vs conference",
    "group": "Momentum & Profile",
    "weight": 0,
    "significance": "Low",
    "description": "Losses predictive beyond underlying efficiency",
    "fallbackUsed": false
  },
  {
    "id": "dvoa_differential_pass_10",
    "label": "DVOA differential, pass ~10%",
    "group": "Momentum & Profile",
    "weight": 0.5,
    "significance": "Medium",
    "description": "Passing smaller contribution to scoring",
    "fallbackUsed": false
  },
  {
    "id": "dvoa_differential_rush_10",
    "label": "DVOA differential, rush ~10%",
    "group": "Momentum & Profile",
    "weight": 0.5,
    "significance": "Medium",
    "description": "Often inflated for reds vs weak schedule",
    "fallbackUsed": false
  },
  {
    "id": "streak_stabilization_factor",
    "label": "Streak stabilization factor",
    "group": "Momentum & Profile",
    "weight": -0.5,
    "significance": "Medium",
    "description": "Week 1-3 extremes regress",
    "fallbackUsed": false
  },
  {
    "id": "average_margin_of_victory",
    "label": "Average margin of victory",
    "group": "Momentum & Profile",
    "weight": 1.0,
    "significance": "High",
    "description": "Better reflection than W/L, schedule-adjusted",
    "fallbackUsed": false
  },
  {
    "id": "epa_play_differential_3",
    "label": "EPA/play differential -3%",
    "group": "Momentum & Profile",
    "weight": 0.7,
    "significance": "Medium",
    "description": "Minimal signal beyond underlying efficiency",
    "fallbackUsed": false
  },
  {
    "id": "success_rate_differential_3",
    "label": "Success rate differential -3%",
    "group": "Momentum & Profile",
    "weight": 0.8,
    "significance": "Medium",
    "description": "Success rate components predict future scoring",
    "fallbackUsed": false
  },
  {
    "id": "yards_per_play_differential_0_2",
    "label": "Yards per play differential +0.2",
    "group": "Momentum & Profile",
    "weight": 1.0,
    "significance": "High",
    "description": "Strong link to point differential",
    "fallbackUsed": false
  },
  {
    "id": "epa_play_differential_0_3",
    "label": "EPA/play differential +0.3",
    "group": "Momentum & Profile",
    "weight": 1.5,
    "significance": "Very High",
    "description": "Better reflection than W/L, schedule-adjusted",
    "fallbackUsed": false
  },
  {
    "id": "success_rate_differential_3",
    "label": "Success rate differential +3%",
    "group": "Momentum & Profile",
    "weight": 1.0,
    "significance": "High",
    "description": "Small predictive value beyond spread",
    "fallbackUsed": false
  },
  {
    "id": "yards_per_play_differential_0_2",
    "label": "Yards per play differential +0.2",
    "group": "Momentum & Profile",
    "weight": 1.0,
    "significance": "High",
    "description": "Strong link to point differential",
    "fallbackUsed": false
  }
] as const;
