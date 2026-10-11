export const SWITCH_OPTIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180] as const;

/** Index of the session the entry gate should scan: session i becomes active `minutes` after session i-1 starts. */
export function autoSessionIndex(starts: string[], now: number, minutes: number): number {
  let idx = 0;
  for (let i = 1; i < starts.length; i++) {
    if (now >= new Date(starts[i - 1]!).getTime() + minutes * 60_000) idx = i;
  }
  return idx;
}
