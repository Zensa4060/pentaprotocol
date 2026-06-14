"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import API from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  formatDateKeyLocal,
  getUserKey,
  getWeekKeyLocal,
  getWeekStartLocal,
  loadMissionEvents,
  loadMissionState,
  saveMissionState,
  claimMissionReward,
  postClaimMissionToServer,
  syncMissionClaimedLocal,
  type MissionMatchEvent,
} from "@/lib/missionsClient";
import {
  computeMissionProgress,
  getDailyMissionIds,
  getPermanentMissionDefs,
  getWeeklyMissionIds,
  missionDefById,
  missionXpForMissionId,
  type MissionDef,
  type MissionPeriod,
} from "@/lib/missionsDefinitions";
import { SHARDS_LIGHT_SVG, SHARDS_DARK_SVG } from "@/lib/currencyIcons";
import { TITLES } from "./ProfileScreen";

// Map: mission ID → badge that unlocks when this mission is completed
const MISSION_BADGE_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  TITLES
    .filter(ti => ti.missionId)
    .map(ti => [ti.missionId!, { label: ti.label, color: ti.color }])
);

type Theme = (typeof THEMES)[ThemeId];
type ProfileLike = Record<string, unknown> & { level?: number; elo?: number };

function collectClaimableShardClaims(
  period: MissionPeriod,
  periodKey: string,
  missions: MissionDef[],
  events: MissionMatchEvent[],
  profile: ProfileLike,
  claimed: Record<string, true>,
): { missionId: string; shards: number; xp: number }[] {
  const out: { missionId: string; shards: number; xp: number }[] = [];
  for (const mission of missions) {
    const claimKey = `${period}:${periodKey}:${mission.id}`;
    if (claimed[claimKey]) continue;
    const progress = computeMissionProgress({ mission, events, profile });
    if (progress >= mission.progress.target) {
      out.push({ missionId: mission.id, shards: mission.shards, xp: missionXpForMissionId(mission.id) });
    }
  }
  return out;
}

function ShardIcon({ svg, size }: { svg: string; size: number }) {
  return (
    <span
      style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", `<svg width="${size}" height="${size}" `) }}
    />
  );
}

interface Props {
  themeId: ThemeId;
  initialTab?: "daily" | "weekly" | "permanent";
}

export default function MissionsScreen({ themeId, initialTab }: Props) {
  const t = THEMES[themeId];
  const router = useRouter();
  const shardsSvg = themeId === "classic_2" ? SHARDS_LIGHT_SVG : SHARDS_DARK_SVG;

  const { user, token, updateUser } = useAuthStore();
  const userKey = getUserKey(user);

  const [tab, setTab] = useState<"daily" | "weekly" | "permanent">(initialTab ?? "daily");
  useEffect(() => {
    if (initialTab && initialTab !== tab) setTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  const [profile, setProfile] = useState<ProfileLike>(() => (user ?? {}) as ProfileLike);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then(res => { if (!cancelled) { setProfile(res.data as ProfileLike); updateUser?.(res.data); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, updateUser]);

  const [, setRev] = useState(0);
  useEffect(() => {
    const on = () => setRev(r => r + 1);
    window.addEventListener("pp_mission_event", on);
    window.addEventListener("pp_mission_state_change", on);
    return () => { window.removeEventListener("pp_mission_event", on); window.removeEventListener("pp_mission_state_change", on); };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Seed the local claimed ledger from the server's authoritative
  // ``mission_claims`` map. Previously the claimed state lived only in
  // localStorage, so on a fresh device / cleared cache every already-claimed
  // mission reappeared as claimable. We merge any server-claimed keys the
  // local copy is missing, then notify so the board re-renders.
  useEffect(() => {
    if (!userKey) return;
    const serverClaims = (profile as { mission_claims?: Record<string, boolean> }).mission_claims;
    if (!serverClaims || typeof serverClaims !== "object") return;
    const local = loadMissionState(userKey);
    let changed = false;
    for (const [key, val] of Object.entries(serverClaims)) {
      if (val && !local.claimed[key]) {
        local.claimed[key] = true;
        changed = true;
      }
    }
    if (changed) {
      saveMissionState(userKey, local);
      window.dispatchEvent(new CustomEvent("pp_mission_state_change"));
    }
  }, [profile, userKey]);

  const unifiedNow = new Date(nowMs);
  const todayKey = formatDateKeyLocal(unifiedNow);
  const weekKey = getWeekKeyLocal(unifiedNow);
  const weekStart = getWeekStartLocal(unifiedNow);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const missionState = loadMissionState(userKey);
  const eventsAll = loadMissionEvents(userKey);
  const eventsToday = eventsAll.filter(e => formatDateKeyLocal(new Date(e.at)) === todayKey);
  const eventsWeek = eventsAll.filter(e => e.at >= weekStart.getTime() && e.at < weekEnd.getTime());

  const dailyIds = getDailyMissionIds(new Date(nowMs), userKey);
  const weeklyIds = getWeeklyMissionIds(weekStart, userKey);
  const permanentDefs = useMemo(() => getPermanentMissionDefs(), []);

  const fmt = (ms: number, forceDays = false) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(s / 86400);
    const h = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return (days > 0 || forceDays) ? `${days}d ${h}:${m}:${sec}` : `${h}:${m}:${sec}`;
  };
  const nextDaily = new Date(unifiedNow); nextDaily.setHours(24, 0, 0, 0);
  const dailyCountdown = fmt(nextDaily.getTime() - unifiedNow.getTime());
  const weeklyCountdown = fmt(weekEnd.getTime() - unifiedNow.getTime(), true);

  const getClaimed = (period: MissionPeriod, periodKey: string, missionId: string) =>
    Boolean(missionState.claimed[`${period}:${periodKey}:${missionId}`]);

  const startClaim = async (period: MissionPeriod, periodKey: string, mission: MissionDef) => {
    if (!token) return;
    const mEvents = period === "daily" ? eventsToday : period === "weekly" ? eventsWeek : eventsAll;
    const progress = computeMissionProgress({ mission, events: mEvents, profile });
    if (progress < mission.progress.target) return;
    try {
      const res = await postClaimMissionToServer({ period, periodKey, missionId: mission.id });
      if (res.xp_awarded > 0) claimMissionReward({ userKey, period, periodKey, missionId: mission.id, shards: mission.shards });
      else if (res.already_claimed) syncMissionClaimedLocal({ userKey, period, periodKey, missionId: mission.id });
      updateUser?.(res.profile);
      setProfile(prev => ({ ...prev, ...res.profile }));
    } catch { /* noop */ }
  };

  const dailyMissionDefs = useMemo(() => dailyIds.map(id => missionDefById(id)).filter((m): m is MissionDef => m != null), [dailyIds]);
  const weeklyMissionDefs = useMemo(() => weeklyIds.map(id => missionDefById(id)).filter((m): m is MissionDef => m != null), [weeklyIds]);

  const dailyClaimAll = useMemo(() => collectClaimableShardClaims("daily", todayKey, dailyMissionDefs, eventsToday, profile, missionState.claimed), [dailyMissionDefs, eventsToday, profile, todayKey, missionState.claimed]);
  const weeklyClaimAll = useMemo(() => collectClaimableShardClaims("weekly", weekKey, weeklyMissionDefs, eventsWeek, profile, missionState.claimed), [weeklyMissionDefs, eventsWeek, profile, weekKey, missionState.claimed]);
  const permClaimAll = useMemo(() => collectClaimableShardClaims("permanent", "all_time", permanentDefs, eventsAll, profile, missionState.claimed), [permanentDefs, eventsAll, profile, missionState.claimed]);

  const runClaimAll = async (period: MissionPeriod, periodKey: string, claims: { missionId: string; shards: number; xp: number }[]) => {
    if (!token || claims.length === 0) return;
    for (const c of claims) {
      try {
        const res = await postClaimMissionToServer({ period, periodKey, missionId: c.missionId });
        if (res.xp_awarded > 0) claimMissionReward({ userKey, period, periodKey, missionId: c.missionId, shards: c.shards });
        else if (res.already_claimed) syncMissionClaimedLocal({ userKey, period, periodKey, missionId: c.missionId });
        updateUser?.(res.profile);
        setProfile(prev => ({ ...prev, ...res.profile }));
      } catch { break; }
    }
  };

  const ip = themeId === "pixel";
  const accent = "#B30000";

  const tabs = [
    { id: "daily" as const, label: "Daily", timer: `Resets in ${dailyCountdown}`, claimable: dailyClaimAll.length },
    { id: "weekly" as const, label: "Weekly", timer: `Resets in ${weeklyCountdown}`, claimable: weeklyClaimAll.length },
    { id: "permanent" as const, label: "Permanent", timer: "Never expires", claimable: permClaimAll.length },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: themeId === "space" ? "transparent" : t.bg,
      display: "flex", flexDirection: "column",
      padding: "72px 0 0",
      zIndex: 1, overflow: "hidden",
    }}>
      {/* Header bar */}
      <div style={{
        flexShrink: 0,
        padding: "16px 24px 0",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: ip ? 2 : 10,
            background: `${accent}18`, border: `1.5px solid ${accent}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 18px ${accent}22`,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 900, color: t.text, letterSpacing: "0.06em" }}>
              MISSIONS
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary }}>
              Earn Shards &amp; XP 
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        flexShrink: 0, display: "flex", gap: 0,
        padding: "14px 24px 0",
        borderBottom: `1px solid ${t.border}`,
        marginTop: 4,
      }}>
        {tabs.map(({ id, label, timer, claimable }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => { setTab(id); router.push(`/missions/${id}`); }}
              style={{
                background: "none", border: "none",
                borderBottom: active ? `3px solid ${accent}` : "3px solid transparent",
                padding: "10px 20px 12px",
                cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                marginBottom: -1,
                transition: "border-color 0.18s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: active ? 800 : 600, color: active ? accent : t.textSecondary, letterSpacing: "0.06em", transition: "color 0.18s" }}>
                  {label.toUpperCase()}
                </span>
                {claimable > 0 && (
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#4CAF50", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: t.fontMono, fontSize: 10, fontWeight: 900, color: "#fff" }}>
                    {claimable}
                  </span>
                )}
              </div>
              <span style={{ fontFamily: t.fontMono, fontSize: 9, color: active ? `${accent}aa` : t.textSecondary, letterSpacing: "0.08em" }}>
                {timer.toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 24px 32px" }}>
        {tab === "daily" && (
          <MissionGrid
            period="daily" periodKey={todayKey}
            missionIds={dailyIds} events={eventsToday} profile={profile}
            getClaimed={getClaimed} onClaim={(m) => startClaim("daily", todayKey, m)}
            claimAll={dailyClaimAll} onClaimAll={dailyClaimAll.length > 0 ? () => runClaimAll("daily", todayKey, dailyClaimAll) : undefined}
            t={t} shardsSvg={shardsSvg} ip={ip}
          />
        )}
        {tab === "weekly" && (
          <MissionGrid
            period="weekly" periodKey={weekKey}
            missionIds={weeklyIds} events={eventsWeek} profile={profile}
            getClaimed={getClaimed} onClaim={(m) => startClaim("weekly", weekKey, m)}
            claimAll={weeklyClaimAll} onClaimAll={weeklyClaimAll.length > 0 ? () => runClaimAll("weekly", weekKey, weeklyClaimAll) : undefined}
            t={t} shardsSvg={shardsSvg} ip={ip}
          />
        )}
        {tab === "permanent" && (
          <PermanentPanel
            permanentDefs={permanentDefs} eventsAll={eventsAll} profile={profile}
            getClaimed={(id) => getClaimed("permanent", "all_time", id)}
            onClaim={(m) => startClaim("permanent", "all_time", m)}
            claimAll={permClaimAll} onClaimAll={permClaimAll.length > 0 ? () => runClaimAll("permanent", "all_time", permClaimAll) : undefined}
            t={t} shardsSvg={shardsSvg} ip={ip}
          />
        )}

        <div style={{
          marginTop: 32, padding: "12px 20px",
          background: `${t.bgCard}`,
          border: `1px solid #B3000033`,
          borderLeft: `3px solid #B30000`,
          borderRadius: ip ? 2 : 10,
          fontFamily: t.fontMono, fontSize: 12, color: "#CC0000", fontWeight: 700, letterSpacing: "0.04em",
        }}>
          Training modes do not contribute to mission progress.
        </div>
      </div>

      <style>{`* { -webkit-font-smoothing: antialiased; }`}</style>
    </div>
  );
}

// ── Mission card grid ────────────────────────────────────────────────────────

function MissionGrid({ period, periodKey, missionIds, events, profile, getClaimed, onClaim, claimAll, onClaimAll, t, shardsSvg, ip }: {
  period: "daily" | "weekly"; periodKey: string;
  missionIds: string[]; events: MissionMatchEvent[]; profile: Record<string, unknown>;
  getClaimed: (period: MissionPeriod, periodKey: string, missionId: string) => boolean;
  onClaim: (mission: MissionDef) => void;
  claimAll: { missionId: string; shards: number; xp: number }[];
  onClaimAll?: () => void;
  t: Theme; shardsSvg: string; ip: boolean;
}) {
  const totalShards = claimAll.reduce((s, c) => s + c.shards, 0);
  const totalXp = claimAll.reduce((s, c) => s + c.xp, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          type="button"
          onClick={totalShards > 0 ? onClaimAll : undefined}
          disabled={totalShards === 0}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: totalShards > 0 ? "#4CAF5018" : `${t.bgCard}`,
            border: `2px solid ${totalShards > 0 ? "#4CAF50" : t.border}`,
            color: totalShards > 0 ? "#4CAF50" : t.textSecondary,
            borderRadius: ip ? 2 : 10,
            padding: "9px 16px",
            fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800,
            cursor: totalShards > 0 ? "pointer" : "default",
            letterSpacing: "0.06em",
            opacity: totalShards === 0 ? 0.45 : 1,
            transition: "all 0.2s",
          }}
        >
          CLAIM ALL
          {totalShards > 0 && (
            <>
              <ShardIcon svg={shardsSvg} size={18} />
              <span>{totalShards}</span>
              <span style={{ fontFamily: t.fontMono, fontSize: 10, color: "#C9A227", fontWeight: 900 }}>+{totalXp.toLocaleString()} XP</span>
            </>
          )}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {missionIds.map(id => {
          const mission = missionDefById(id);
          if (!mission) return null;
          const claimed = getClaimed(period, periodKey, mission.id);
          const progress = computeMissionProgress({ mission, events, profile });
          const done = progress >= mission.progress.target;
          const pct = Math.min(100, (progress / Math.max(1, mission.progress.target)) * 100);
          const xp = missionXpForMissionId(mission.id);

          return (
            <MissionCard
              key={id}
              mission={mission}
              claimed={claimed}
              done={done}
              progress={progress}
              progressPct={pct}
              xp={xp}
              onClaim={() => onClaim(mission)}
              t={t}
              shardsSvg={shardsSvg}
              ip={ip}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Single mission card ──────────────────────────────────────────────────────

function MissionCard({ mission, claimed, done, progress, progressPct, xp, onClaim, t, shardsSvg, ip, gold }: {
  mission: MissionDef; claimed: boolean; done: boolean; progress: number; progressPct: number;
  xp: number; onClaim: () => void; t: Theme; shardsSvg: string; ip: boolean; gold?: string;
}) {
  const isSpecial = !!mission.specialReward;
  const color = isSpecial ? (gold ?? "#D4AF37") : t.accent;
  const accent = "#B30000";

  return (
    <div style={{
      borderRadius: ip ? 2 : 14,
      border: `1.5px solid ${claimed ? "#4CAF5030" : done ? `${accent}55` : `${t.border}66`}`,
      background: t.bgCard,
      padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 10,
      position: "relative", overflow: "hidden",
      opacity: claimed ? 0.65 : 1,
      transition: "opacity 0.2s",
    }}>
      {/* Glow if done */}
      {done && !claimed && (
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at top left, ${accent}0A, transparent 60%)`, pointerEvents: "none" }} />
      )}

      {/* Top row: title + reward */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isSpecial && (
            <div style={{ fontFamily: t.fontMono, fontSize: 9, color, letterSpacing: "0.14em", fontWeight: 900, marginBottom: 3 }}>★ SPECIAL</div>
          )}
          <div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 800, color: isSpecial ? color : t.text, lineHeight: 1.3 }}>
            {mission.title}
          </div>
          <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSecondary, marginTop: 3, lineHeight: 1.4 }}>
            {mission.description}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
            <ShardIcon svg={shardsSvg} size={20} />
            <span style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 900, color }}>{mission.shards}</span>
          </div>
          <div style={{ fontFamily: t.fontMono, fontSize: 10, color: "#C9A227", fontWeight: 800, marginTop: 2 }}>
            +{xp.toLocaleString()} XP
          </div>
        </div>
      </div>

      {/* Badge unlock hint */}
      {MISSION_BADGE_MAP[mission.id] && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${MISSION_BADGE_MAP[mission.id].color}14`,
          border: `1px solid ${MISSION_BADGE_MAP[mission.id].color}44`,
          borderRadius: 6, padding: "4px 10px", alignSelf: "flex-start",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill={MISSION_BADGE_MAP[mission.id].color} opacity="0.9"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span style={{ fontFamily: t.fontMono, fontSize: 9, fontWeight: 800, color: MISSION_BADGE_MAP[mission.id].color, letterSpacing: "0.1em" }}>
            UNLOCKS BADGE: {MISSION_BADGE_MAP[mission.id].label.toUpperCase()}
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textSecondary, letterSpacing: "0.06em" }}>PROGRESS</span>
          <span style={{ fontFamily: t.fontMono, fontSize: 10, color: done ? "#4CAF50" : t.textSecondary, fontWeight: 700 }}>
            {progress}/{mission.progress.target}
          </span>
        </div>
        <div style={{ height: 6, background: `${t.border}44`, borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progressPct}%`,
            background: done ? "#4CAF50" : `linear-gradient(90deg, ${accent}, ${t.p1 ?? accent})`,
            borderRadius: 999, transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* Special reward */}
      {isSpecial && mission.specialReward && (
        <div style={{
          background: `${color}10`, border: `1px solid ${color}33`,
          borderRadius: ip ? 2 : 8, padding: "8px 10px",
        }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 9, color, letterSpacing: "0.1em", marginBottom: 2 }}>CAPSTONE REWARD</div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 800, color }}>{mission.specialReward.label}</div>
          {mission.specialReward.description && (
            <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{mission.specialReward.description}</div>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
        {claimed ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: t.fontMono, fontSize: 12, color: "#4CAF50", fontWeight: 800 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            CLAIMED
          </div>
        ) : done ? (
          <button
            onClick={onClaim}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: isSpecial ? color : accent,
              border: "none", borderRadius: ip ? 2 : 8,
              padding: "8px 14px",
              fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800,
              color: "#000", cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            CLAIM
            <ShardIcon svg={shardsSvg} size={18} />
            {mission.shards}
          </button>
        ) : (
          <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary }}>
            {Math.round(progressPct)}% complete
          </div>
        )}
        {mission.difficulty && !claimed && (
          <span style={{
            fontFamily: t.fontMono, fontSize: 10, color: t.textSecondary,
            background: t.bgPanel ?? t.bg,
            border: `1px solid ${t.border}44`,
            borderRadius: 6, padding: "3px 8px",
          }}>
            {mission.difficulty.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Permanent missions panel ─────────────────────────────────────────────────

function PermanentPanel({ permanentDefs, eventsAll, profile, getClaimed, onClaim, claimAll, onClaimAll, t, shardsSvg, ip }: {
  permanentDefs: MissionDef[]; eventsAll: MissionMatchEvent[]; profile: Record<string, unknown>;
  getClaimed: (id: string) => boolean;
  onClaim: (mission: MissionDef) => void;
  claimAll: { missionId: string; shards: number; xp: number }[];
  onClaimAll?: () => void;
  t: Theme; shardsSvg: string; ip: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const gold = t.gold ?? "#D4AF37";

  const specialMission = useMemo(() => permanentDefs.find(m => m.id === "perm_rank_legend"), [permanentDefs]);
  const groups = useMemo(() => ({
    level:       permanentDefs.filter(m => m.progress.kind === "levelAtLeast"),
    ranks:       permanentDefs.filter(m => m.progress.kind === "rankAtLeast" && m.id !== "perm_rank_legend"),
    winStreak:   permanentDefs.filter(m => m.progress.kind === "streakRankedMax"),
    rankedWins:  permanentDefs.filter(m => m.progress.kind === "rankedWinsTotalAtLeast"),
    totalWins:   permanentDefs.filter(m => m.progress.kind === "totalWinsAtLeast"),
    rankedPlay:  permanentDefs.filter(m => m.progress.kind === "rankedMatchesAtLeast"),
  }), [permanentDefs]);

  const flattened = useMemo(() => [
    ...groups.level, ...groups.ranks, ...groups.winStreak,
    ...groups.rankedWins, ...groups.totalWins, ...groups.rankedPlay,
  ], [groups]);
  const visible = showAll ? flattened : flattened.slice(0, 30);

  const totalShards = claimAll.reduce((s, c) => s + c.shards, 0);
  const totalXp = claimAll.reduce((s, c) => s + c.xp, 0);

  const renderCard = (m: MissionDef) => {
    const claimed = getClaimed(m.id);
    const progress = computeMissionProgress({ mission: m, events: eventsAll, profile });
    const done = progress >= m.progress.target;
    const pct = Math.min(100, (progress / Math.max(1, m.progress.target)) * 100);
    const xp = missionXpForMissionId(m.id);
    return (
      <MissionCard
        key={m.id}
        mission={m}
        claimed={claimed}
        done={done}
        progress={progress}
        progressPct={pct}
        xp={xp}
        onClaim={() => onClaim(m)}
        t={t}
        shardsSvg={shardsSvg}
        ip={ip}
        gold={gold}
      />
    );
  };

  const renderGroup = (title: string, defs: MissionDef[]) => defs.length === 0 ? null : (
    <div style={{ marginBottom: 24 }} key={title}>
      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, letterSpacing: "0.14em", fontWeight: 700, marginBottom: 10 }}>
        {title.toUpperCase()} <span style={{ opacity: 0.6 }}>({defs.length})</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
        {defs.map(m => renderCard(m))}
      </div>
    </div>
  );

  return (
    <div>
      {/* Claim all */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          type="button"
          onClick={totalShards > 0 ? onClaimAll : undefined}
          disabled={totalShards === 0}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: totalShards > 0 ? "#4CAF5018" : `${t.bgCard}`,
            border: `2px solid ${totalShards > 0 ? "#4CAF50" : t.border}`,
            color: totalShards > 0 ? "#4CAF50" : t.textSecondary,
            borderRadius: ip ? 2 : 10,
            padding: "9px 16px",
            fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800,
            cursor: totalShards > 0 ? "pointer" : "default",
            letterSpacing: "0.06em",
            opacity: totalShards === 0 ? 0.45 : 1,
            transition: "all 0.2s",
          }}
        >
          CLAIM ALL
          {totalShards > 0 && (
            <>
              <ShardIcon svg={shardsSvg} size={18} />
              <span>{totalShards}</span>
              <span style={{ fontFamily: t.fontMono, fontSize: 10, color: "#C9A227", fontWeight: 900 }}>+{totalXp.toLocaleString()} XP</span>
            </>
          )}
        </button>
      </div>

      {/* Special mission (Chronicle/Legend) pinned at top */}
      {specialMission && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, color: gold, letterSpacing: "0.14em", fontWeight: 700, marginBottom: 10 }}>
            ★ SPECIAL MISSION
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
            {renderCard(specialMission)}
          </div>
        </div>
      )}

      {/* Show more / collapse */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            background: `${t.accent ?? "#B30000"}12`, border: `1px solid ${t.accent ?? "#B30000"}44`,
            color: t.accent ?? "#B30000", borderRadius: ip ? 2 : 8,
            padding: "7px 14px",
            fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 800,
            cursor: "pointer", letterSpacing: "0.06em",
          }}
        >
          {showAll ? "COLLAPSE" : "SHOW ALL MISSIONS"}
        </button>
        <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary }}>
          {showAll ? `All ${flattened.length} missions` : `Showing first 30 of ${flattened.length}`}
        </span>
      </div>

      {showAll ? (
        <>
          {renderGroup("Level Milestones", groups.level)}
          {renderGroup("Rank Milestones", groups.ranks)}
          {renderGroup("Win Streak", groups.winStreak)}
          {renderGroup("Ranked Wins", groups.rankedWins)}
          {renderGroup("Total Wins", groups.totalWins)}
          {renderGroup("Ranked Matches", groups.rankedPlay)}
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
          {visible.filter(m => m.id !== "perm_rank_legend").map(m => renderCard(m))}
        </div>
      )}
    </div>
  );
}
