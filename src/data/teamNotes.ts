export type TeamNote = {
  text: string;
  /** If set, hide the note when kickoff is AFTER this ISO date (inclusive boundary). */
  expiresBefore?: string; // "YYYY-MM-DD"
  /** Only show if this team is the home or away team (omit for both). */
  appliesIfHome?: boolean;
  appliesIfAway?: boolean;
  /** Only show if opponent name contains one of these fragments (case-insensitive). */
  opponentIncludes?: string[];
};

export const TEAM_NOTES: Record<string, TeamNote[]> = {
  /* ========== AFC EAST ========== */
  "Buffalo Bills": [
    { text: "Four of their first five games are at home." },
    { text: "Three of their first five are in primetime." },
    { text: "Chiefs visit Buffalo in Week 9." },
    { text: "Weeks 12–16: four road games in five weeks." }
  ],
  "Miami Dolphins": [
    { text: "3 of last 5 in cold weather: @ Jets, Steelers, Patriots." },
    { text: "Five primetime games, plus a game vs Washington in Spain." },
    { text: "No 4:00 games on schedule." }
  ],
  "New England Patriots": [
    { text: "Weeks 5–7: three straight road games @ Bills, @ Saints, @ Titans." },
    { text: "Week 7: Patriots @ Titans (Vrabel coached Tennessee 2018–23)." },
    { text: "Three of the first four games are at home." },
    { text: "Week 1: Raiders @ Patriots (Brady is a Raiders minority owner)." }
  ],
  "New York Jets": [
    { text: "Week 1: Steelers @ Jets — Justin Fields was with PIT last year.", opponentIncludes: ["steelers"] },
    { text: "3 of last 4 games on the road." },
    { text: "London Week 6 vs Broncos; no bye in Week 7 (schedule compression).", opponentIncludes: ["broncos"] },
    { text: "14 of 17 games at 1:00 — low national windows." }
  ],

  /* ========== AFC NORTH ========== */
  "Baltimore Ravens": [
    { text: "Five of their first seven are at home." },
    { text: "Weeks 5–8: three home games + a bye." },
    { text: "Weeks 9–11: three straight road games @ Dolphins, @ Vikings, @ Browns." },
    { text: "Play Bengals in Weeks 13 and 15.", opponentIncludes: ["bengals"] },
    { text: "Three of their last four are on the road." }
  ],
  "Cincinnati Bengals": [
    { text: "Last 3 years: 5–10 in Weeks 1–5, 25–10 from Week 6 on (slow starts)." },
    { text: "Three of their first four are on the road." },
    { text: "Four primetime games + four 4:25 games (not west coast)." },
    { text: "Weeks 7–10: three home games, then a bye." }
  ],
  "Cleveland Browns": [
    { text: "QB room: 40-year-old Flacco plus two rookies." },
    { text: "First and last game are vs Cincinnati.", opponentIncludes: ["bengals"] },
    { text: "14 of 17 in the Eastern time zone." },
    { text: "No primetime games; Week 5 vs Vikings in England.", opponentIncludes: ["vikings"], expiresBefore: "2025-10-07" }
  ],
  "Pittsburgh Steelers": [
    { text: "Only 5 of 17 are vs 2024 playoff teams." },
    { text: "Four primetime games + vs Vikings in Ireland.", opponentIncludes: ["vikings"] },
    { text: "Ravens games fall in Weeks 14 and 18.", opponentIncludes: ["ravens"] }
  ],

  /* ========== AFC SOUTH ========== */
  "Houston Texans": [
    { text: "Weeks 8–10: three straight home games." },
    { text: "Visit SoFi twice: Week 1 vs Rams; Week 17 vs Chargers.", opponentIncludes: ["rams","chargers"] },
    { text: "Chargers beat Texans 32–12 in playoffs last year.", opponentIncludes: ["chargers"] },
    { text: "Week 14 at Chiefs (lost 23–14 to KC in playoffs LY).", opponentIncludes: ["chiefs"], expiresBefore: "2025-12-08" }
  ],
  "Indianapolis Colts": [
    { text: "Four of their first six are at home." },
    { text: "Visit SoFi twice: Rams Week 4; Chargers Week 7.", opponentIncludes: ["rams","chargers"] },
    { text: "Only one primetime game: Week 16 vs 49ers.", opponentIncludes: ["49ers"], expiresBefore: "2025-12-22" },
    { text: "12 of 17 games are in domes." }
  ],
  "Jacksonville Jaguars": [
    { text: "Only one game in England (Week 7 vs Rams).", opponentIncludes: ["rams"], expiresBefore: "2025-10-13" },
    { text: "Only one primetime: Week 5 vs Chiefs.", opponentIncludes: ["chiefs"], expiresBefore: "2025-09-29" },
    { text: "Colts games in Weeks 14/17.", opponentIncludes: ["colts"] },
    { text: "Titans games in Weeks 13/18.", opponentIncludes: ["titans"] }
  ],
  "Tennessee Titans": [
    { text: "Weeks 4–6: three straight road games (all domes): @ Texans, @ Cardinals, @ Raiders." },
    { text: "No primetime games; low expectations." },
    { text: "Weeks 9–13: four home games + bye." },
    { text: "Only likely cold game: Week 14 at Browns.", opponentIncludes: ["browns"], expiresBefore: "2025-12-09" }
  ],

  /* ========== AFC WEST ========== */
  "Denver Broncos": [
    { text: "Open with all three division rivals in the first three games." },
    { text: "Season opener vs Chiefs on Friday night in Brazil.", opponentIncludes: ["chiefs"], expiresBefore: "2025-09-07" },
    { text: "Five primetime games; league expectations are high." }
  ],
  "Kansas City Chiefs": [
    { text: "Open in Brazil vs Chargers; host Eagles in Week 2.", opponentIncludes: ["chargers","eagles"] },
    { text: "5 of first 8 are in primetime." },
    { text: "Weeks 6–8: three straight home games." },
    { text: "Play on both Thanksgiving and Christmas this year.", expiresBefore: "2025-12-26" }
  ],
  "Las Vegas Raiders": [
    { text: "Two of first three on East Coast: @ Patriots, @ Commanders." },
    { text: "Open vs Patriots; Pete Carroll coached NE 1997–99 (historical cross-over)." },
    { text: "Weeks 15–16: only time with consecutive road games." }
  ],
  "Los Angeles Chargers": [
    { text: "Open vs Chiefs in Brazil." },
    { text: "Two East Coast trips in Weeks 4 & 6 — heavy early travel." },
    { text: "Three of last four are on the road." },
    { text: "Five primetime games; expectations high." }
  ],

  /* ========== NFC EAST ========== */
  "Dallas Cowboys": [
    { text: "Open at Super Bowl champion Eagles (Week 1).", opponentIncludes: ["eagles"], appliesIfAway: true, expiresBefore: "2025-09-08" },
    { text: "Four Thursday games this season." },
    { text: "Weeks 12–16: four home games in five weeks." },
    { text: "Play on both Thanksgiving and Christmas.", expiresBefore: "2025-12-26" }
  ],
  "New York Giants": [
    { text: "Open with road games at Commanders & Cowboys.", opponentIncludes: ["commanders","cowboys"], appliesIfAway: true },
    { text: "Cowboys games in Weeks 2 & 18.", opponentIncludes: ["cowboys"] },
    { text: "Late bye (Week 14).", expiresBefore: "2025-12-08" },
    { text: "Only one road game in the last five weeks." }
  ],
  "Philadelphia Eagles": [
    { text: "No back-to-back home games all season." },
    { text: "Commanders games in Weeks 16 & 18.", opponentIncludes: ["commanders"] },
    { text: "Giants games in Weeks 6 & 8.", opponentIncludes: ["giants"] },
    { text: "Host Bears on Black Friday (day after Thanksgiving).", opponentIncludes: ["bears"], expiresBefore: "2025-11-29" }
  ],
  "Washington Commanders": [
    { text: "18-1 to win SB (moved from 150-1 last year)." },
    { text: "Last four games vs NFC East rivals." },
    { text: "Weeks 4–8: four road games in five weeks." },
    { text: "Five primetime games + Week 8 in Spain.", expiresBefore: "2025-10-20" }
  ],

  /* ========== NFC NORTH ========== */
  "Chicago Bears": [
    { text: "Detroit games in Weeks 2 & 18.", opponentIncludes: ["lions"] },
    { text: "Three of last four at home." },
    { text: "Weeks 4–9: four road games + bye." },
    { text: "New HC Ben Johnson left Lions for Bears — both have young QBs." }
  ],
  "Detroit Lions": [
    { text: "Two new coordinators — price of success." },
    { text: "Weeks 12–14: three straight home games." },
    { text: "Week 15 at Rams: Stafford–Goff reunion.", opponentIncludes: ["rams"], expiresBefore: "2025-12-15" },
    { text: "Play on both Thanksgiving and Christmas.", expiresBefore: "2025-12-26" }
  ],
  "Green Bay Packers": [
    { text: "Open with home games vs Lions & Commanders.", opponentIncludes: ["lions","commanders"], appliesIfHome: true },
    { text: "Three of last four on the road." },
    { text: "Four primetime games + four 4:25 games." },
    { text: "Bears games in Weeks 14 & 16.", opponentIncludes: ["bears"] }
  ],
  "Minnesota Vikings": [
    { text: "Week 1: at Bears on MNF.", opponentIncludes: ["bears"], appliesIfAway: true, expiresBefore: "2025-09-09" },
    { text: "Weeks 2–3: two straight home games.", appliesIfHome: true },
    { text: "Weeks 4–5: Ireland + England (international travel).", expiresBefore: "2025-10-01" },
    { text: "Week 6: bye; Week 7 host Eagles.", opponentIncludes: ["eagles"], appliesIfHome: true, expiresBefore: "2025-10-20" },
    { text: "Weeks 8–16: six road games in nine weeks." },
    { text: "Weeks 17–18: home vs Lions/Packers.", opponentIncludes: ["lions","packers"], appliesIfHome: true }
  ],

  /* ========== NFC SOUTH ========== */
  "Atlanta Falcons": [
    { text: "Early bye (Week 5).", expiresBefore: "2025-10-06" },
    { text: "Week 2 at Vikings (Cousins ‘revenge’ if still a Falcon).", opponentIncludes: ["vikings"], expiresBefore: "2025-09-08" },
    { text: "12 of 17 in domes." },
    { text: "Four primetime games + Week 9 in Germany (no bye after).", expiresBefore: "2025-11-03" }
  ],
  "Carolina Panthers": [
    { text: "Three of first four on the road." },
    { text: "Week 9 in Germany vs Falcons (no bye after).", opponentIncludes: ["falcons"], expiresBefore: "2025-11-03" },
    { text: "Bucs games in Weeks 16/18.", opponentIncludes: ["buccaneers"] }
  ],
  "New Orleans Saints": [
    { text: "Unclear QB room (likely young starter)." },
    { text: "Open with home games vs Cardinals/49ers.", opponentIncludes: ["cardinals","49ers"], appliesIfHome: true },
    { text: "Finish @ Titans/@ Falcons (road close)." },
    { text: "No primetime games; expectations low." }
  ],
  "Tampa Bay Buccaneers": [
    { text: "Open with road games @ Falcons/@ Texans." },
    { text: "Weeks 13–15: three straight home games." },
    { text: "Four primetime games (three on the road)." },
    { text: "Four of last five vs NFC South rivals." }
  ],

  /* ========== NFC WEST ========== */
  "Arizona Cardinals": [
    { text: "Three of last four on the road." },
    { text: "12 of 17 in domes." },
    { text: "Rams games in Weeks 14/18.", opponentIncludes: ["rams"] },
    { text: "Only two games in the Eastern time zone." }
  ],
  "Los Angeles Rams": [
    { text: "Three of first four vs AFC East teams." },
    { text: "Week 7 vs Jaguars in England.", opponentIncludes: ["jaguars"], expiresBefore: "2025-10-13" },
    { text: "Weeks 8–12: three home games + bye." },
    { text: "Two of last three are in primetime." }
  ],
  "San Francisco 49ers": [
    { text: "Open with road games vs teams with new QBs (Seahawks/Saints)." },
    { text: "Three of last four at home." },
    { text: "Five primetime games (two in last three weeks)." },
    { text: "First and last game vs Seahawks.", opponentIncludes: ["seahawks"] }
  ],
  "Seattle Seahawks": [
    { text: "Week 13: Darnold vs old team (Vikings).", opponentIncludes: ["vikings"], expiresBefore: "2025-12-02" },
    { text: "Kupp vs old team (Rams) in Weeks 11/16.", opponentIncludes: ["rams"] },
    { text: "Five trips to the Eastern time zone." },
    { text: "Finish with road games @ Panthers/@ 49ers." }
  ],

  /* ===== Holiday matchups (date-bound) ===== */
  "Detroit Lions (THX)": [
    { text: "Thanksgiving game: Packers @ Lions.", opponentIncludes: ["packers"], expiresBefore: "2025-11-28" }
  ],
  "Dallas Cowboys (THX)": [
    { text: "Thanksgiving game: Chiefs @ Cowboys.", opponentIncludes: ["chiefs"], expiresBefore: "2025-11-28" }
  ],
  "Baltimore Ravens (THX)": [
    { text: "Thanksgiving game: Bengals @ Ravens.", opponentIncludes: ["bengals"], expiresBefore: "2025-11-28" }
  ],
  "Washington Commanders (XMAS)": [
    { text: "Christmas game: Cowboys @ Washington.", opponentIncludes: ["cowboys"], expiresBefore: "2025-12-26" }
  ],
  "Minnesota Vikings (XMAS)": [
    { text: "Christmas game: Lions @ Vikings.", opponentIncludes: ["lions"], expiresBefore: "2025-12-26" }
  ],
  "Kansas City Chiefs (XMAS)": [
    { text: "Christmas game: Broncos @ Chiefs.", opponentIncludes: ["broncos"], expiresBefore: "2025-12-26" }
  ]
};
