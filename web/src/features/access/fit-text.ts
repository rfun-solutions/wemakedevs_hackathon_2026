/**
 * Largest integer font size in [min, max] for which `fits(size)` is true (binary search).
 * `fits` is monotone: if a size fits, every smaller size fits. Returns `min` when nothing fits.
 */
export function largestFit(min: number, max: number, fits: (size: number) => boolean): number {
  let lo = Math.floor(min);
  let hi = Math.floor(max);
  if (hi < lo) return lo;
  if (fits(hi)) return hi;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
