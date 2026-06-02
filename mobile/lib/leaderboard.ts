/**
 * Leaderboard — ``GET /api/profile/leaderboard`` (top 20 by ELO).
 */

import API from "@/lib/api";
import { ApiError } from "@/lib/profile";
import type { LeaderboardRow } from "@/lib/types";

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  try {
    const res = await API.get<LeaderboardRow[]>("/api/profile/leaderboard");
    return res.data ?? [];
  } catch {
    throw new ApiError("Could not load the leaderboard.");
  }
}
