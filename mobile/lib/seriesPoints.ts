/** Match server `compute_segment_points` in `backend/app/routers/room.py` (draws add 0). */
export function seriesPointsFromHistory(
  hist: unknown[] | null | undefined,
): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  if (!Array.isArray(hist)) return { p1, p2 };
  for (const item of hist) {
    const w = typeof item === "string" ? item : (item as { winner?: string })?.winner;
    if (w === "P1") p1 += 1;
    else if (w === "P2") p2 += 1;
  }
  return { p1, p2 };
}
