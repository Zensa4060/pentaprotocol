export type MissionMatchEvent = {
  id: string;
  at: number; // epoch ms
  matchKind: "ranked" | "unranked" | "bot";
  result: "win" | "loss" | "draw";
  rulebreakerUsed: boolean;
  botDifficulty?: "easy" | "medium" | "hard";
  myElo?: number;
  opponentElo?: number;
};

export type RewardPlaceholder = { kind: "picture" | "banner" | "border" | "boardSkin" | "pieceSkin"; slot: number };

export type MissionClaimState = {
  shardBalance: number;
  claimed: Record<string, true>;
};

const stateKey = (userKey: string) => `pp_mission_state_${userKey}`;
const eventsKey = (userKey: string) => `pp_mission_events_${userKey}`;

export function getUserKey(user: unknown): string {
  const u = user as { _id?: unknown; id?: unknown } | null | undefined;
  const id = u?._id ?? u?.id;
  return id !== undefined && id !== null ? String(id) : "guest";
}

export function formatDateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ISO-like week start (Monday) based on local time.
export function getWeekStartLocal(d: Date): Date {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const day = dt.getDay(); // 0 Sun..6 Sat
  const diffToMonday = (day + 6) % 7; // Mon->0 ... Sun->6
  dt.setDate(dt.getDate() - diffToMonday);
  return dt;
}

export function getWeekKeyLocal(d: Date): string {
  return formatDateKeyLocal(getWeekStartLocal(d));
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function loadMissionEvents(userKey: string): MissionMatchEvent[] {
  const raw = typeof window !== "undefined" ? localStorage.getItem(eventsKey(userKey)) : null;
  const events = safeParse<MissionMatchEvent[]>(raw, []);
  return Array.isArray(events) ? events.slice(-500).sort((a, b) => a.at - b.at) : [];
}

export function loadMissionState(userKey: string): MissionClaimState {
  const raw = typeof window !== "undefined" ? localStorage.getItem(stateKey(userKey)) : null;
  return safeParse<MissionClaimState>(raw, { shardBalance: 0, claimed: {} });
}

export function saveMissionState(userKey: string, next: MissionClaimState) {
  localStorage.setItem(stateKey(userKey), JSON.stringify(next));
}

export function pushMissionEvent(userKey: string, evt: Omit<MissionMatchEvent, "id">) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const full: MissionMatchEvent = { ...evt, id };
  const raw = localStorage.getItem(eventsKey(userKey));
  const events = safeParse<MissionMatchEvent[]>(raw, []);

  // De-dupe very near duplicates (same payload recorded twice).
  const dedupeWindowMs = 2500;
  const isNearDuplicate = events.some(e =>
    Math.abs(e.at - full.at) <= dedupeWindowMs &&
    e.matchKind === full.matchKind &&
    e.result === full.result &&
    e.rulebreakerUsed === full.rulebreakerUsed &&
    e.botDifficulty === full.botDifficulty &&
    e.myElo === full.myElo &&
    e.opponentElo === full.opponentElo
  );
  if (!isNearDuplicate) {
    events.push(full);
    localStorage.setItem(eventsKey(userKey), JSON.stringify(events.slice(-700)));
  }

  window.dispatchEvent(new CustomEvent("pp_mission_event"));
}

export function claimMissionReward(args: { userKey: string; period: "daily" | "weekly" | "permanent"; periodKey: string; missionId: string; shards: number }) {
  const { userKey, period, periodKey, missionId, shards } = args;
  const st = loadMissionState(userKey);
  const claimKey = `${period}:${periodKey}:${missionId}`;
  if (st.claimed[claimKey]) return false;

  st.claimed[claimKey] = true;
  st.shardBalance += shards;
  saveMissionState(userKey, st);

  window.dispatchEvent(new CustomEvent("pp_mission_state_change"));
  return true;
}

