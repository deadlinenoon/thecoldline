// Normalizes a variety of city names, nicknames, and abbreviations
// to canonical full team names used in STADIUMS.
const CANONICAL = [
  "Arizona Cardinals","Atlanta Falcons","Baltimore Ravens","Buffalo Bills","Carolina Panthers","Chicago Bears",
  "Cincinnati Bengals","Cleveland Browns","Dallas Cowboys","Denver Broncos","Detroit Lions","Green Bay Packers",
  "Houston Texans","Indianapolis Colts","Jacksonville Jaguars","Kansas City Chiefs","Las Vegas Raiders",
  "Los Angeles Chargers","Los Angeles Rams","Miami Dolphins","Minnesota Vikings","New England Patriots",
  "New Orleans Saints","New York Giants","New York Jets","Philadelphia Eagles","Pittsburgh Steelers",
  "San Francisco 49ers","Seattle Seahawks","Tampa Bay Buccaneers","Tennessee Titans","Washington Commanders"
];

const MAP: Record<string, string> = {};
for (const t of CANONICAL) MAP[t.toLowerCase()] = t;

const add = (aliases: string[], target: string) => {
  for (const a of aliases) MAP[a.toLowerCase().replace(/\./g,'').trim()] = target;
};

// City-only
add(["Arizona","Phoenix","Glendale"], "Arizona Cardinals");
add(["Atlanta"], "Atlanta Falcons");
add(["Baltimore"], "Baltimore Ravens");
add(["Buffalo","Orchard Park"], "Buffalo Bills");
add(["Carolina","Charlotte"], "Carolina Panthers");
add(["Chicago"], "Chicago Bears");
add(["Cincinnati"], "Cincinnati Bengals");
add(["Cleveland"], "Cleveland Browns");
add(["Dallas","Arlington"], "Dallas Cowboys");
add(["Denver"], "Denver Broncos");
add(["Detroit"], "Detroit Lions");
add(["Green Bay"], "Green Bay Packers");
add(["Houston"], "Houston Texans");
add(["Indianapolis"], "Indianapolis Colts");
add(["Jacksonville"], "Jacksonville Jaguars");
add(["Kansas City"], "Kansas City Chiefs");
add(["Las Vegas","Oakland","LA Raiders","L.A. Raiders"], "Las Vegas Raiders");
add(["Los Angeles Chargers","LA Chargers","L.A. Chargers","San Diego","San Diego Chargers"], "Los Angeles Chargers");
add(["Los Angeles Rams","LA Rams","L.A. Rams","St Louis","St. Louis Rams"], "Los Angeles Rams");
add(["Miami"], "Miami Dolphins");
add(["Minnesota","Minneapolis"], "Minnesota Vikings");
add(["New England","Foxborough","Foxboro"], "New England Patriots");
add(["New Orleans","NOLA"], "New Orleans Saints");
add(["NY Giants","N.Y. Giants","Giants"], "New York Giants");
add(["NY Jets","N.Y. Jets","Jets"], "New York Jets");
add(["Philadelphia","Philly"], "Philadelphia Eagles");
add(["Pittsburgh"], "Pittsburgh Steelers");
add(["San Francisco","SF 49ers","Santa Clara"], "San Francisco 49ers");
add(["Seattle"], "Seattle Seahawks");
add(["Tampa Bay","Tampa"], "Tampa Bay Buccaneers");
add(["Tennessee","Nashville"], "Tennessee Titans");
add(["Washington","Washington Football Team","Redskins"], "Washington Commanders");

// Nicknames
add(["Cardinals"], "Arizona Cardinals");
add(["Falcons"], "Atlanta Falcons");
add(["Ravens"], "Baltimore Ravens");
add(["Bills"], "Buffalo Bills");
add(["Panthers"], "Carolina Panthers");
add(["Bears"], "Chicago Bears");
add(["Bengals"], "Cincinnati Bengals");
add(["Browns"], "Cleveland Browns");
add(["Cowboys"], "Dallas Cowboys");
add(["Broncos"], "Denver Broncos");
add(["Lions"], "Detroit Lions");
add(["Packers"], "Green Bay Packers");
add(["Texans"], "Houston Texans");
add(["Colts"], "Indianapolis Colts");
add(["Jaguars"], "Jacksonville Jaguars");
add(["Chiefs"], "Kansas City Chiefs");
add(["Raiders"], "Las Vegas Raiders");
add(["Chargers"], "Los Angeles Chargers");
add(["Rams"], "Los Angeles Rams");
add(["Dolphins"], "Miami Dolphins");
add(["Vikings"], "Minnesota Vikings");
add(["Patriots"], "New England Patriots");
add(["Saints"], "New Orleans Saints");
add(["Giants"], "New York Giants");
add(["Jets"], "New York Jets");
add(["Eagles"], "Philadelphia Eagles");
add(["Steelers"], "Pittsburgh Steelers");
add(["49ers","Forty Niners"], "San Francisco 49ers");
add(["Seahawks"], "Seattle Seahawks");
add(["Buccaneers","Bucs"], "Tampa Bay Buccaneers");
add(["Titans"], "Tennessee Titans");
add(["Commanders"], "Washington Commanders");

// Abbreviations
add(["ARI"], "Arizona Cardinals");
add(["ATL"], "Atlanta Falcons");
add(["BAL"], "Baltimore Ravens");
add(["BUF"], "Buffalo Bills");
add(["CAR"], "Carolina Panthers");
add(["CHI"], "Chicago Bears");
add(["CIN"], "Cincinnati Bengals");
add(["CLE"], "Cleveland Browns");
add(["DAL"], "Dallas Cowboys");
add(["DEN"], "Denver Broncos");
add(["DET"], "Detroit Lions");
add(["GB","GNB"], "Green Bay Packers");
add(["HOU"], "Houston Texans");
add(["IND"], "Indianapolis Colts");
add(["JAX","JAC"], "Jacksonville Jaguars");
add(["KC","KAN"], "Kansas City Chiefs");
add(["LV","OAK","RAI"], "Las Vegas Raiders");
add(["LAC","SD"], "Los Angeles Chargers");
add(["LAR","STL"], "Los Angeles Rams");
add(["MIA"], "Miami Dolphins");
add(["MIN"], "Minnesota Vikings");
add(["NE","NWE"], "New England Patriots");
add(["NO","NOR"], "New Orleans Saints");
add(["NYG"], "New York Giants");
add(["NYJ"], "New York Jets");
add(["PHI","PHL"], "Philadelphia Eagles");
add(["PIT"], "Pittsburgh Steelers");
add(["SF","SFO"], "San Francisco 49ers");
add(["SEA"], "Seattle Seahawks");
add(["TB","TAM","TBB"], "Tampa Bay Buccaneers");
add(["TEN","OTI"], "Tennessee Titans");
add(["WSH","WAS","WDC"], "Washington Commanders");

export function normalizeTeam(input: string): string {
  const key = String(input || "").toLowerCase().replace(/\./g, "").trim();
  return MAP[key] || MAP[(key + " ").trim()] || input;
}

// Expose reverse map for quick normalization checks
export const TEAM_NORMALIZE_MAP: Readonly<Record<string, string>> = MAP;

export default normalizeTeam;
