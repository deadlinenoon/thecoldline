export type StadiumInfo = {
  name: string;
  city: string;
  lat: number;
  lon: number;
  roof: 'outdoor' | 'dome' | 'retractable';
};

// Canonical keys are full team names used across the app
export const STADIUMS: Record<string, StadiumInfo> = {
  "Arizona Cardinals": { name: "State Farm Stadium", city: "Glendale, AZ", lat: 33.5276, lon: -112.2626, roof: 'retractable' },
  "Atlanta Falcons": { name: "Mercedes-Benz Stadium", city: "Atlanta, GA", lat: 33.7554, lon: -84.4008, roof: 'retractable' },
  "Baltimore Ravens": { name: "M&T Bank Stadium", city: "Baltimore, MD", lat: 39.2779, lon: -76.6228, roof: 'outdoor' },
  "Buffalo Bills": { name: "Highmark Stadium", city: "Orchard Park, NY", lat: 42.7738, lon: -78.7870, roof: 'outdoor' },
  "Carolina Panthers": { name: "Bank of America Stadium", city: "Charlotte, NC", lat: 35.2251, lon: -80.8526, roof: 'outdoor' },
  "Chicago Bears": { name: "Soldier Field", city: "Chicago, IL", lat: 41.8623, lon: -87.6167, roof: 'outdoor' },
  "Cincinnati Bengals": { name: "Paycor Stadium", city: "Cincinnati, OH", lat: 39.0954, lon: -84.5160, roof: 'outdoor' },
  "Cleveland Browns": { name: "Cleveland Browns Stadium", city: "Cleveland, OH", lat: 41.5061, lon: -81.6996, roof: 'outdoor' },
  "Dallas Cowboys": { name: "AT&T Stadium", city: "Arlington, TX", lat: 32.7473, lon: -97.0945, roof: 'retractable' },
  "Denver Broncos": { name: "Empower Field at Mile High", city: "Denver, CO", lat: 39.7439, lon: -105.0201, roof: 'outdoor' },
  "Detroit Lions": { name: "Ford Field", city: "Detroit, MI", lat: 42.3400, lon: -83.0456, roof: 'dome' },
  "Green Bay Packers": { name: "Lambeau Field", city: "Green Bay, WI", lat: 44.5013, lon: -88.0622, roof: 'outdoor' },
  "Houston Texans": { name: "NRG Stadium", city: "Houston, TX", lat: 29.6847, lon: -95.4107, roof: 'retractable' },
  "Indianapolis Colts": { name: "Lucas Oil Stadium", city: "Indianapolis, IN", lat: 39.7601, lon: -86.1639, roof: 'retractable' },
  "Jacksonville Jaguars": { name: "EverBank Stadium", city: "Jacksonville, FL", lat: 30.3240, lon: -81.6376, roof: 'outdoor' },
  "Kansas City Chiefs": { name: "GEHA Field at Arrowhead Stadium", city: "Kansas City, MO", lat: 39.0490, lon: -94.4839, roof: 'outdoor' },
  "Las Vegas Raiders": { name: "Allegiant Stadium", city: "Las Vegas, NV", lat: 36.0908, lon: -115.1830, roof: 'dome' },
  "Los Angeles Chargers": { name: "SoFi Stadium", city: "Inglewood, CA", lat: 33.9535, lon: -118.3387, roof: 'dome' },
  "Los Angeles Rams": { name: "SoFi Stadium", city: "Inglewood, CA", lat: 33.9535, lon: -118.3387, roof: 'dome' },
  "Miami Dolphins": { name: "Hard Rock Stadium", city: "Miami Gardens, FL", lat: 25.9580, lon: -80.2389, roof: 'outdoor' },
  "Minnesota Vikings": { name: "U.S. Bank Stadium", city: "Minneapolis, MN", lat: 44.9735, lon: -93.2577, roof: 'dome' },
  "New England Patriots": { name: "Gillette Stadium", city: "Foxborough, MA", lat: 42.0909, lon: -71.2643, roof: 'outdoor' },
  "New Orleans Saints": { name: "Caesars Superdome", city: "New Orleans, LA", lat: 29.9509, lon: -90.0815, roof: 'dome' },
  "New York Giants": { name: "MetLife Stadium", city: "East Rutherford, NJ", lat: 40.8135, lon: -74.0745, roof: 'outdoor' },
  "New York Jets": { name: "MetLife Stadium", city: "East Rutherford, NJ", lat: 40.8135, lon: -74.0745, roof: 'outdoor' },
  "Philadelphia Eagles": { name: "Lincoln Financial Field", city: "Philadelphia, PA", lat: 39.9008, lon: -75.1675, roof: 'outdoor' },
  "Pittsburgh Steelers": { name: "Acrisure Stadium", city: "Pittsburgh, PA", lat: 40.4468, lon: -80.0158, roof: 'outdoor' },
  "San Francisco 49ers": { name: "Levi's Stadium", city: "Santa Clara, CA", lat: 37.4030, lon: -121.9697, roof: 'outdoor' },
  "Seattle Seahawks": { name: "Lumen Field", city: "Seattle, WA", lat: 47.5952, lon: -122.3316, roof: 'outdoor' },
  "Tampa Bay Buccaneers": { name: "Raymond James Stadium", city: "Tampa, FL", lat: 27.9759, lon: -82.5033, roof: 'outdoor' },
  "Tennessee Titans": { name: "Nissan Stadium", city: "Nashville, TN", lat: 36.1665, lon: -86.7713, roof: 'outdoor' },
  "Washington Commanders": { name: "FedExField", city: "Landover, MD", lat: 38.9077, lon: -76.8645, roof: 'outdoor' },
};

export default STADIUMS;
