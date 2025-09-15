export function favoriteFromSpread(spread: number): { favorite: "HOME" | "AWAY" | null; isPickEm: boolean } {
  const n = Number(spread);
  if (!Number.isFinite(n)) return { favorite: null, isPickEm: true };
  if (n === 0) return { favorite: null, isPickEm: true };
  return { favorite: n < 0 ? "HOME" : "AWAY", isPickEm: false };
}

