/**
 * Pure attendance-percentage math, kept free of any database dependency so
 * it can be unit tested in isolation and reused anywhere.
 *
 * Calculates how many additional consecutive future classes a student would
 * need to attend to reach the minimum required attendance percentage, given
 * their current present/total counts. Uses exact algebra:
 *   (present + x) / (total + x) >= minPct/100
 *   => x >= (minPct*total - 100*present) / (100 - minPct)
 */
export function classesNeededForTarget(
  present: number,
  total: number,
  minPercentage: number,
): number {
  if (minPercentage >= 100) return Infinity;
  const currentPct = total > 0 ? (present / total) * 100 : 0;
  if (currentPct >= minPercentage) return 0;
  const numerator = minPercentage * total - 100 * present;
  const denominator = 100 - minPercentage;
  return Math.max(0, Math.ceil(numerator / denominator));
}

export function attendancePercentage(present: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((present / total) * 1000) / 10;
}
