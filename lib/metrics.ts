// Shared metric definitions and helpers

export type Metric = { name: string; weightRange: [number, number]; category: string; enabled: boolean; currentValue: number };
export const mk = (name: string, min = -3, max = 3, cat = "style"): Metric => ({ name, weightRange: [min, max], category: cat, enabled: true, currentValue: 0 });

// Base metric set (duplicated from the main page so both the app and tutorial can reference one source)
export const BASE: Metric[] = [
  // Environment / Stadium (8)
  { name: "Stadium_HFA", weightRange: [0, 3.25], category: "environment", enabled: true, currentValue: 0 },
  // Use symmetric range so the knob rests at center for neutral (most stadiums at or near sea level)
  { name: "Altitude_Effect", weightRange: [-1, 1], category: "environment", enabled: true, currentValue: 0 },
  { name: "Surface_Mismatch", weightRange: [-1, 1], category: "environment", enabled: true, currentValue: 0 },
  { name: "Wind_Exposure", weightRange: [-0.5, 0.5], category: "environment", enabled: true, currentValue: 0 },
  { name: "RealFeel_Temp_Penalty", weightRange: [-1, 1], category: "environment", enabled: true, currentValue: 0 },
  { name: "RainOrSnow_Adjustment", weightRange: [-1.5, 1.5], category: "environment", enabled: true, currentValue: 0 },
  { name: "Dead_Crowd_Dampener", weightRange: [-0.5, 0.5], category: "environment", enabled: true, currentValue: 0 },
  { name: "TimeZone_Travel", weightRange: [-0.5, 0.5], category: "environment", enabled: true, currentValue: 0 },

  // Matchup & Scheme (10)
  { name: "Run_Pass_Matchup_Edge", weightRange: [-1.5, 1.5], category: "style", enabled: true, currentValue: 0 },
  { name: "Explosive_Play_Rate", weightRange: [-0.75, 0.75], category: "style", enabled: true, currentValue: 0 },
  { name: "RedZone_Efficiency_Matchup", weightRange: [-1, 1], category: "style", enabled: true, currentValue: 0 },
  { name: "ThirdDown_Efficiency", weightRange: [-0.5, 0.5], category: "style", enabled: true, currentValue: 0 },
  { name: "Special_Teams_Edge", weightRange: [-0.5, 0.5], category: "style", enabled: true, currentValue: 0 },
  { name: "DeepBall_Vulnerability", weightRange: [-0.5, 0.5], category: "style", enabled: true, currentValue: 0 },
  { name: "Pass_Protection_Vulnerability", weightRange: [-1, 1], category: "style", enabled: true, currentValue: 0 },
  { name: "Stacked_Box_Exploitability", weightRange: [-0.5, 0.5], category: "style", enabled: true, currentValue: 0 },
  { name: "Offensive_Line_Scheme_Fit", weightRange: [-0.5, 0.5], category: "style", enabled: true, currentValue: 0 },
  { name: "Scheme_Coverage_Exploitation", weightRange: [-1, 1], category: "style", enabled: true, currentValue: 0 },

  // Fatigue / Travel / Pace (10)
  { name: "Defensive_Snap_Load", weightRange: [-1.25, 1.25], category: "fatigue", enabled: true, currentValue: 0 },
  { name: "Offensive_Snap_Load", weightRange: [-0.75, 0.75], category: "fatigue", enabled: true, currentValue: 0 },
  { name: "TimeOfPossession_Diff", weightRange: [-0.5, 0.5], category: "fatigue", enabled: true, currentValue: 0 },
  { name: "BackToBack_Stress", weightRange: [-0.5, 0.5], category: "fatigue", enabled: true, currentValue: 0 },
  { name: "Travel_Miles_Since_Home", weightRange: [-0.6, 0.6], category: "travel", enabled: true, currentValue: 0 },
  { name: "Early_Start_BodyClock", weightRange: [-1, 1], category: "travel", enabled: true, currentValue: 0 },
  { name: "Rest_Day_Differential", weightRange: [-0.6, 0.6], category: "rest", enabled: true, currentValue: 0 },
  { name: "Late_Bye_Week_Edge", weightRange: [0, 0.5], category: "rest", enabled: true, currentValue: 0 },
  { name: "Long_Road_Trip_Penalty", weightRange: [-0.5, 0.5], category: "travel", enabled: true, currentValue: 0 },
  { name: "High_Playcount_Sandwich", weightRange: [-0.5, 0.5], category: "fatigue", enabled: true, currentValue: 0 },
  { name: "Travel_Dock", weightRange: [-1, 1], category: "travel", enabled: true, currentValue: 0 },

  // Injuries (10)
  { name: "OL_Injury_Impact", weightRange: [-1, 1], category: "injury", enabled: true, currentValue: 0 },
  { name: "DL_RunDefense_Injury", weightRange: [-1, 1], category: "injury", enabled: true, currentValue: 0 },
  { name: "CB1_vs_WR1_Mismatch", weightRange: [-1, 1], category: "injury", enabled: true, currentValue: 0 },
  { name: "Multiple_Starters_Same_Unit", weightRange: [-1.5, 1.5], category: "injury", enabled: true, currentValue: 0 },
  { name: "QB_Tier_Drop", weightRange: [-10, 10], category: "injury", enabled: true, currentValue: 0 },
  { name: "WR1_Out_vs_ManDefense", weightRange: [-0.75, 0.75], category: "injury", enabled: true, currentValue: 0 },
  { name: "TE_Loss_on_12Personnel_Team", weightRange: [-0.5, 0.5], category: "injury", enabled: true, currentValue: 0 },
  { name: "Safeties_Out_vs_PlayAction_Team", weightRange: [-0.5, 0.5], category: "injury", enabled: true, currentValue: 0 },
  { name: "Edge_Rusher_Impact_on_MobileQB", weightRange: [-0.5, 0.5], category: "injury", enabled: true, currentValue: 0 },
  { name: "Nickel_CB_Out_vs_Slot_Heavy_O", weightRange: [-0.5, 0.5], category: "injury", enabled: true, currentValue: 0 },
  { name: "Coverage_Unit_vs_ScrambleQB", weightRange: [-0.5, 0.5], category: "injury", enabled: true, currentValue: 0 },
  { name: "Kicker_Holder_Disruption", weightRange: [-0.5, 0.5], category: "injury", enabled: true, currentValue: 0 },
  { name: "Starting_Center_Out", weightRange: [-0.75, 0.75], category: "injury", enabled: true, currentValue: 0 },
  { name: "Starting_Holder_Out", weightRange: [-0.5, 0.5], category: "injury", enabled: true, currentValue: 0 },
  { name: "Long_Snapper_Out", weightRange: [-0.75, 0.75], category: "injury", enabled: true, currentValue: 0 },
  { name: "Field_Goal_Snapper_Out", weightRange: [-0.75, 0.75], category: "injury", enabled: true, currentValue: 0 },

  // Intangibles / Context (12)
  { name: "Revenge_Game_Flag", weightRange: [-0.75, 0.75], category: "context", enabled: true, currentValue: 0 },
  { name: "Coaching_Familiarity", weightRange: [-1, 1], category: "context", enabled: true, currentValue: 0 },
  { name: "Motivational_Edge", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Letdown_Spot", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Final_Home_Game_Boost", weightRange: [0, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Division_Rivalry_Tightener", weightRange: [0, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Trap_Game_Spot", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "National_Spot_Letdown_NextWeek", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Jersey_Ceremony_Boost", weightRange: [0, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Flooded_Away_Crowd_Penalty", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Crowd_Noise_Advantage", weightRange: [0, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Coaching_Aggressiveness", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Home_Dog_Primetime", weightRange: [-1, 1], category: "context", enabled: true, currentValue: 0 },
  { name: "Head_to_Head_Streak", weightRange: [-5, 5], category: "context", enabled: true, currentValue: 0 },
  { name: "Rivalry_Trend", weightRange: [-3, 3], category: "context", enabled: true, currentValue: 0 },

  // Momentum & Profile (14)
  { name: "ATS_Trend_Last5", weightRange: [-1, 1], category: "momentum", enabled: true, currentValue: 0 },
  { name: "ATS_Trend_vs_Conf", weightRange: [-1, 1], category: "momentum", enabled: true, currentValue: 0 },
  { name: "DVOA_Diff_Total", weightRange: [-0.75, 0.75], category: "profile", enabled: true, currentValue: 0 },
  { name: "DVOA_Rush_vs_RushD", weightRange: [-1, 1], category: "profile", enabled: true, currentValue: 0 },
  { name: "DVOA_Pass_vs_PassD", weightRange: [-1, 1], category: "profile", enabled: true, currentValue: 0 },
  { name: "SOS_Deflator", weightRange: [-0.5, 0.5], category: "profile", enabled: true, currentValue: 0 },
  { name: "SOV_Deflator", weightRange: [-0.5, 0.5], category: "profile", enabled: true, currentValue: 0 },
  { name: "Early_Season_Overreaction", weightRange: [-0.5, 0.5], category: "profile", enabled: true, currentValue: 0 },
  { name: "Late_Season_Regression_Risk", weightRange: [-0.5, 0.5], category: "profile", enabled: true, currentValue: 0 },
  { name: "Streak_Stabilization_Factor", weightRange: [-0.5, 0.5], category: "profile", enabled: true, currentValue: 0 },
  { name: "Margin_Of_Victory_Avg", weightRange: [-0.5, 0.5], category: "profile", enabled: true, currentValue: 0 },
  { name: "EPA_Play_Diff", weightRange: [-1, 1], category: "profile", enabled: true, currentValue: 0 },
  { name: "Success_Rate_Diff", weightRange: [-1, 1], category: "profile", enabled: true, currentValue: 0 },
  { name: "Yards_Per_Play_Diff", weightRange: [-1, 1], category: "profile", enabled: true, currentValue: 0 },
  
  // ——— Additional Requested Metrics ———
  // 1) 3rd/4th down efficiency (offense/defense)
  { name: "ThirdDown_Offense_Eff", weightRange: [-1, 1], category: "style", enabled: true, currentValue: 0 },
  { name: "ThirdDown_Defense_Eff", weightRange: [-1, 1], category: "style", enabled: true, currentValue: 0 },
  { name: "FourthDown_Offense_Eff", weightRange: [-1, 1], category: "style", enabled: true, currentValue: 0 },
  { name: "FourthDown_Defense_Eff", weightRange: [-1, 1], category: "style", enabled: true, currentValue: 0 },

  // 2) Yards per play (off/def; run, pass, overall)
  { name: "YPP_Offense", weightRange: [-1, 1], category: "profile", enabled: true, currentValue: 0 },
  { name: "YPP_Defense", weightRange: [-1, 1], category: "profile", enabled: true, currentValue: 0 },
  { name: "YPR_Offense", weightRange: [-0.75, 0.75], category: "profile", enabled: true, currentValue: 0 },
  { name: "YPR_Defense", weightRange: [-0.75, 0.75], category: "profile", enabled: true, currentValue: 0 },
  { name: "YPPass_Offense", weightRange: [-0.75, 0.75], category: "profile", enabled: true, currentValue: 0 },
  { name: "YPPass_Defense", weightRange: [-0.75, 0.75], category: "profile", enabled: true, currentValue: 0 },

  // 3) Turnovers per game (off/def; fumbles, interceptions)
  { name: "Turnovers_Per_Game_Offense", weightRange: [-1, 1], category: "profile", enabled: true, currentValue: 0 },
  { name: "Takeaways_Per_Game_Defense", weightRange: [-1, 1], category: "profile", enabled: true, currentValue: 0 },
  { name: "INT_Thrown_Rate", weightRange: [-0.75, 0.75], category: "profile", enabled: true, currentValue: 0 },
  { name: "Fumbles_Lost_Rate", weightRange: [-0.75, 0.75], category: "profile", enabled: true, currentValue: 0 },
  { name: "INT_Generated_Rate", weightRange: [-0.75, 0.75], category: "profile", enabled: true, currentValue: 0 },
  { name: "Fumbles_Forced_Rate", weightRange: [-0.75, 0.75], category: "profile", enabled: true, currentValue: 0 },

  // 4) Special teams details
  { name: "ST_Return_Yardage_Edge", weightRange: [-0.5, 0.5], category: "special_teams", enabled: true, currentValue: 0 },
  { name: "ST_TD_Frequency", weightRange: [-0.5, 0.5], category: "special_teams", enabled: true, currentValue: 0 },
  { name: "ST_Blocked_Kicks_Punts", weightRange: [-0.5, 0.5], category: "special_teams", enabled: true, currentValue: 0 },

  // 5) Time of possession (team expression separate from diff)
  { name: "TimeOfPossession_Offense", weightRange: [-0.5, 0.5], category: "fatigue", enabled: true, currentValue: 0 },
  { name: "TimeOfPossession_Defense", weightRange: [-0.5, 0.5], category: "fatigue", enabled: true, currentValue: 0 },

  // 6) Penalties by type (off/def)
  { name: "Penalties_Offense_Holding", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Penalties_Defense_Holding", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Penalties_Offense_OPI", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },
  { name: "Penalties_Defense_DPI", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },

  // 7) Field goal specifics
  { name: "FG_Percentage_By_Distance", weightRange: [-0.75, 0.75], category: "special_teams", enabled: true, currentValue: 0 },
  { name: "Kicker_Dome_vs_Outdoor_Split", weightRange: [-0.5, 0.5], category: "special_teams", enabled: true, currentValue: 0 },
  { name: "Kicker_Estimated_Range", weightRange: [-0.5, 0.5], category: "special_teams", enabled: true, currentValue: 0 },

  // 8) PAT / 2PT
  { name: "XP_Accuracy", weightRange: [-0.5, 0.5], category: "special_teams", enabled: true, currentValue: 0 },
  { name: "TwoPoint_Conversion_Efficiency", weightRange: [-0.5, 0.5], category: "style", enabled: true, currentValue: 0 },

  // 9) Off‑field issues
  { name: "Off_Field_Distraction_Risk", weightRange: [-0.5, 0.5], category: "context", enabled: true, currentValue: 0 },

  // 10) Red zone turnovers (offense/defense)
  { name: "RedZone_Turnover_Rate_Offense", weightRange: [-0.75, 0.75], category: "style", enabled: true, currentValue: 0 },
  { name: "RedZone_Turnover_Rate_Defense", weightRange: [-0.75, 0.75], category: "style", enabled: true, currentValue: 0 },
];

// Descriptions
export const METRIC_DESC: Record<string, string> = {
  // environment / stadium
  Stadium_HFA: "Delta vs +3.0 baseline: Denver +0.25; Seahawks/Bengals + fortress teams 0.0; Raiders/Jags/Rams/Chargers -1.0; others -0.5; Neutral -1.5.",
  Altitude_Effect: "High altitude impact on visiting team conditioning.",
  Surface_Mismatch: "Turf ↔ grass transition penalty.",
  Wind_Exposure: "Passing/kicking degradation from wind.",
  RealFeel_Temp_Penalty: "Extreme temperature performance penalty.",
  RainOrSnow_Adjustment: "Precipitation impact on scoring/ball security.",
  Dead_Crowd_Dampener: "Quiet/checked-out crowd reduces home edge.",
  TimeZone_Travel: "Body-clock drag from cross-country travel.",

  // matchup & scheme
  Run_Pass_Matchup_Edge: "O strength vs D weakness (run/pass).",
  Explosive_Play_Rate: "Explosives created/allowed by scheme.",
  RedZone_Efficiency_Matchup: "Inside-20 scoring efficiency edge.",
  ThirdDown_Efficiency: "Move-the-chains advantage.",
  Special_Teams_Edge: "Hidden yards, field position, ST stability.",
  DeepBall_Vulnerability: "Defense vs vertical shots.",
  Pass_Protection_Vulnerability: "OL vs pass rush mismatch.",
  Stacked_Box_Exploitability: "Answer for 8 in the box.",
  Offensive_Line_Scheme_Fit: "OL fit for run concepts.",
  Scheme_Coverage_Exploitation: "Beating common coverage rules.",

  // fatigue / travel / pace
  Defensive_Snap_Load: "Defense gassed by recent snap volume.",
  Offensive_Snap_Load: "Offense wear from tempo/playcount.",
  TimeOfPossession_Diff: "Rest edge via possession split.",
  BackToBack_Stress: "Consecutive grinders toll.",
  Travel_Miles_Since_Home: "Accumulated miles fatigue.",
  Early_Start_BodyClock: "Early kick body-clock hit.",
  Rest_Day_Differential: "Prep days advantage.",
  Late_Bye_Week_Edge: "Fresh legs from late bye.",
  Long_Road_Trip_Penalty: "Extended time away from facility.",
  High_Playcount_Sandwich: "High-tempo games stacked.",

  // injuries
  OL_Injury_Impact: "OL absences affect protection/run.",
  DL_RunDefense_Injury: "DL losses vs run gaps.",
  CB1_vs_WR1_Mismatch: "Top CB out → WR1 leverage.",
  Multiple_Starters_Same_Unit: "Cluster injuries compound.",
  QB_Tier_Drop: "Starter → backup downgrade.",
  WR1_Out_vs_ManDefense: "WR1 out vs man-heavy defenses.",
  TE_Loss_on_12Personnel_Team: "12-personnel teams lose TE.",
  Safeties_Out_vs_PlayAction_Team: "Safety absences vs PA teams.",
  Edge_Rusher_Impact_on_MobileQB: "Rush availability vs scrambling QBs.",
  Nickel_CB_Out_vs_Slot_Heavy_O: "Nickel out vs slot volume.",
  Coverage_Unit_vs_ScrambleQB: "Secondary vs off-script plays.",
  Kicker_Holder_Disruption: "K/P/holder timing disruption risk.",
  Starting_Center_Out: "Center out: snap/timing + comms; extra dock for shotgun-heavy O.",
  Starting_Holder_Out: "Holder out: FG/PAT timing and laces risk (kicker chemistry).",
  Long_Snapper_Out: "Long snapper out: punt & FG snap risk (operation speed/accuracy).",
  Field_Goal_Snapper_Out: "FG snapper out: placekick snap risk on FG/PAT specifically.",

  // intangibles / context
  Revenge_Game_Flag: "Revenge angle motivation.",
  Coaching_Familiarity: "Staff/system familiarity advantage.",
  Motivational_Edge: "Season stakes & internal goals.",
  Letdown_Spot: "Flat spot after an emotional win.",
  Final_Home_Game_Boost: "Last home push.",
  Division_Rivalry_Tightener: "Divisional variance tighter.",
  Trap_Game_Spot: "Lookahead risk sandwiched spot.",
  National_Spot_Letdown_NextWeek: "Prime-time lookahead drag.",
  Jersey_Ceremony_Boost: "Ceremony pop.",
  Flooded_Away_Crowd_Penalty: "Visitor crowd takeover risk.",
  Crowd_Noise_Advantage: "Home communication disruption edge.",
  Coaching_Aggressiveness: "4th-down/pace/aggression tilt.",
  Head_to_Head_Streak: "Recent-series momentum (last 10).",
  Rivalry_Trend: "Five-year divisional trend (0.5 per win above 2).",

  // momentum & profile
  ATS_Trend_Last5: "Recent ATS form.",
  ATS_Trend_vs_Conf: "Historical ATS vs conference.",
  DVOA_Diff_Total: "Off minus Def overall efficiency.",
  DVOA_Rush_vs_RushD: "Rush O vs Rush D efficiency.",
  DVOA_Pass_vs_PassD: "Pass O vs Pass D efficiency.",
  SOS_Deflator: "Opp strength deflator.",
  SOV_Deflator: "Quality of wins deflator.",
  Early_Season_Overreaction: "Small-sample noise control.",
  Late_Season_Regression_Risk: "Regression to mean risk.",
  Streak_Stabilization_Factor: "Hot/cold streak cool-off odds.",
  Margin_Of_Victory_Avg: "True-strength score margin.",
  EPA_Play_Diff: "EPA/play differential.",
  Success_Rate_Diff: "Success rate differential.",
  Yards_Per_Play_Diff: "Yards/play differential.",
  
  // additions
  ThirdDown_Offense_Eff: "Offense 3rd-down conversion efficiency.",
  ThirdDown_Defense_Eff: "Defense 3rd-down stop efficiency.",
  FourthDown_Offense_Eff: "Offense 4th-down conversion efficiency.",
  FourthDown_Defense_Eff: "Defense 4th-down stop efficiency.",

  YPP_Offense: "Average yards per play on offense.",
  YPP_Defense: "Average yards per play allowed.",
  YPR_Offense: "Rush yards per attempt on offense.",
  YPR_Defense: "Rush yards per attempt allowed.",
  YPPass_Offense: "Pass yards per attempt/sack-adjusted on offense.",
  YPPass_Defense: "Pass yards per attempt allowed.",

  Turnovers_Per_Game_Offense: "Giveaways per game (lower is better).",
  Takeaways_Per_Game_Defense: "Takeaways per game (higher is better).",
  INT_Thrown_Rate: "Interceptions thrown rate.",
  Fumbles_Lost_Rate: "Fumbles lost rate.",
  INT_Generated_Rate: "Interceptions generated rate.",
  Fumbles_Forced_Rate: "Fumbles forced rate.",

  ST_Return_Yardage_Edge: "Kick/punt return yardage edge.",
  ST_TD_Frequency: "Special teams touchdowns frequency.",
  ST_Blocked_Kicks_Punts: "Blocked kicks/punts rate (for/against).",

  TimeOfPossession_Offense: "Offense possession sustain (drives/clock).",
  TimeOfPossession_Defense: "Defense possession suppression.",

  Penalties_Offense_Holding: "Offensive holding burden.",
  Penalties_Defense_Holding: "Defensive holding burden.",
  Penalties_Offense_OPI: "Offensive pass interference frequency.",
  Penalties_Defense_DPI: "Defensive pass interference frequency.",

  FG_Percentage_By_Distance: "FG% by distance profile.",
  Kicker_Dome_vs_Outdoor_Split: "Kicker dome vs outdoor split.",
  Kicker_Estimated_Range: "Estimated makeable range in current conditions.",

  XP_Accuracy: "Extra point accuracy.",
  TwoPoint_Conversion_Efficiency: "Two-point conversion efficiency.",

  Off_Field_Distraction_Risk: "Media/off-field distraction risk.",

  RedZone_Turnover_Rate_Offense: "Turnovers in the red zone (offense).",
  RedZone_Turnover_Rate_Defense: "Turnovers generated in the red zone (defense).",
};

// human-readable labels
export const HUMAN_LABEL: Record<string, string> = {
  Stadium_HFA: "Stadium HFA",
  RealFeel_Temp_Penalty: "RealFeel Temp Penalty",
  RainOrSnow_Adjustment: "Rain or Snow Adjustment",
  Starting_Center_Out: "Starting Center Out",
  Starting_Holder_Out: "Starting Holder Out",
  Long_Snapper_Out: "Long Snapper Out",
  Field_Goal_Snapper_Out: "Field Goal Snapper Out",
  Head_to_Head_Streak: "Head-to-Head Streak",
  Rivalry_Trend: "Rivalry Trend",
  ATS_Trend_Last5: "ATS Trend (Last 5)",
  ATS_Trend_vs_Conf: "ATS Trend vs Conference",
  DVOA_Diff_Total: "DVOA Diff (Total)",
  DVOA_Rush_vs_RushD: "DVOA Rush vs Rush D",
  DVOA_Pass_vs_PassD: "DVOA Pass vs Pass D",
  EPA_Play_Diff: "EPA/Play Diff",
  Success_Rate_Diff: "Success Rate Diff",
  Yards_Per_Play_Diff: "Yards/Play Diff",
};

export const humanMetric = (k: string) =>
  HUMAN_LABEL[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Effective range helper used in UI and docs
export function effectiveRange(name: string, configured: [number, number]): [number, number] {
  if (name === "Stadium_HFA") return configured; // keep delta range (e.g., [-1.5, +0.25])
  if (name === "QB_Tier_Drop") return [-10, 10]; // special: ±10
  const [min, max] = configured;
  const capMin = Math.max(min, -3);
  const capMax = Math.min(max, 3);
  return [capMin, capMax];
}

// Utility helpers used by autos
export function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }
export function roundToQuarter(v: number): number { return Math.round(v * 4) / 4; }
export function restFactor(days: number): number {
  if (days <= 0) return 1.10; // pathological
  if (days <= 5) return 1.10; // 4–5 → 1.10
  if (days === 6) return 1.00; // 6 → 1.00
  if (days === 7) return 0.90; // 7 → 0.90
  if (days <= 9) return 0.75; // 8–9 → 0.75
  return 0.60;               // 10+ → 0.60
}
