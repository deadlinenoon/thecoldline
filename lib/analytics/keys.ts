export function dstr(d: Date = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}
export function kHits(day = dstr()) {
  return `analytics:hits:${day}`;
}
export function kSignups(day = dstr()) {
  return `analytics:signups:${day}`;
}
export function kRef(day = dstr()) {
  return `analytics:ref:${day}`;
}
export function kPath(day = dstr()) {
  return `analytics:path:${day}`;
}

