/** Great-circle distance in miles, rounded to nearest mile. */
export function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // no travel if identical coords
  if (lat1 === lat2 && lon1 === lon2) return 0;

  // Haversine fallback
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const R_MILES = 3958.7613;
  return Math.round(R_MILES * c);
}

// Back-compat: keep previous named export expected by computeTravel
export function geodesicMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return milesBetween(lat1, lon1, lat2, lon2);
}

export default milesBetween;
