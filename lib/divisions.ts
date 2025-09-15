export type Division = 'AFC East'|'AFC North'|'AFC South'|'AFC West'|'NFC East'|'NFC North'|'NFC South'|'NFC West';

export const TEAM_DIVISION: Record<string, Division> = {
  // AFC East
  'Buffalo Bills':'AFC East','Miami Dolphins':'AFC East','New England Patriots':'AFC East','New York Jets':'AFC East',
  // AFC North
  'Baltimore Ravens':'AFC North','Cincinnati Bengals':'AFC North','Cleveland Browns':'AFC North','Pittsburgh Steelers':'AFC North',
  // AFC South
  'Houston Texans':'AFC South','Indianapolis Colts':'AFC South','Jacksonville Jaguars':'AFC South','Tennessee Titans':'AFC South',
  // AFC West
  'Denver Broncos':'AFC West','Kansas City Chiefs':'AFC West','Las Vegas Raiders':'AFC West','Los Angeles Chargers':'AFC West',
  // NFC East
  'Dallas Cowboys':'NFC East','New York Giants':'NFC East','Philadelphia Eagles':'NFC East','Washington Commanders':'NFC East',
  // NFC North
  'Chicago Bears':'NFC North','Detroit Lions':'NFC North','Green Bay Packers':'NFC North','Minnesota Vikings':'NFC North',
  // NFC South
  'Atlanta Falcons':'NFC South','Carolina Panthers':'NFC South','New Orleans Saints':'NFC South','Tampa Bay Buccaneers':'NFC South',
  // NFC West
  'Arizona Cardinals':'NFC West','Los Angeles Rams':'NFC West','San Francisco 49ers':'NFC West','Seattle Seahawks':'NFC West',
};

export function sameDivision(a:string,b:string){
  const da = TEAM_DIVISION[(a||'').trim()];
  const db = TEAM_DIVISION[(b||'').trim()];
  return da && db && da===db;
}

