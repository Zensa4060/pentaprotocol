import {
  formatDateKeyLocal,
  getWeekKeyLocal,
  getWeekStartLocal,
  loadMissionEvents,
  loadMissionState,
} from "./missionsClient";
import {
  computeMissionProgress,
  getDailyMissionIds,
  getPermanentMissionDefs,
  getWeeklyMissionIds,
  missionDefById,
} from "./missionsDefinitions";

type ProfileLike = Record<string, unknown> & { level?: number; elo?: number };

export function countClaimableMissions(userKey: string, profile: ProfileLike, nowMs: number): number {
  const missionState = loadMissionState(userKey);
  const eventsAll = loadMissionEvents(userKey);
  const todayKey = formatDateKeyLocal(new Date(nowMs));
  const weekKey = getWeekKeyLocal(new Date(nowMs));
  const weekStart = getWeekStartLocal(new Date(nowMs));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const eventsToday = eventsAll.filter((e) => formatDateKeyLocal(new Date(e.at)) === todayKey);
  const eventsWeek = eventsAll.filter((e) => e.at >= weekStart.getTime() && e.at < weekEnd.getTime());

  const claimed = (period: "daily" | "weekly" | "permanent", periodKey: string, missionId: string) =>
    Boolean(missionState.claimed[`${period}:${periodKey}:${missionId}`]);

  let n = 0;
  for (const id of getDailyMissionIds(new Date(nowMs), userKey)) {
    const m = missionDefById(id);
    if (!m || claimed("daily", todayKey, id)) continue;
    if (computeMissionProgress({ mission: m, events: eventsToday, profile }) >= m.progress.target) n++;
  }
  for (const id of getWeeklyMissionIds(weekStart, userKey)) {
    const m = missionDefById(id);
    if (!m || claimed("weekly", weekKey, id)) continue;
    if (computeMissionProgress({ mission: m, events: eventsWeek, profile }) >= m.progress.target) n++;
  }
  for (const m of getPermanentMissionDefs()) {
    if (claimed("permanent", "all_time", m.id)) continue;
    if (computeMissionProgress({ mission: m, events: eventsAll, profile }) >= m.progress.target) n++;
  }
  return n;
}
