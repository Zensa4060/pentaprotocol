"use client";
import React, { useEffect, useMemo, useState } from "react";
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
  claimMissionReward,
  type MissionMatchEvent,
  type RewardPlaceholder,
} from "@/lib/missionsClient";
import {
  computeMissionProgress,
  getDailyMissionIds,
  getPermanentMissionDefs,
  getWeeklyMissionIds,
  missionDefById,
  type MissionDef,
  type MissionPeriod,
} from "@/lib/missionsDefinitions";
import { SHARDS_LIGHT_SVG, SHARDS_DARK_SVG } from "@/lib/currencyIcons";

type Theme = (typeof THEMES)[ThemeId];
type ProfileLike = Record<string, unknown> & { level?: number; elo?: number };

interface Props {
  themeId: ThemeId;
}

export default function MissionsScreen({ themeId }: Props) {
  const t = THEMES[themeId];
  const shardsSvg = themeId === "classic_light" ? SHARDS_LIGHT_SVG : SHARDS_DARK_SVG;

  const { user, token, updateUser } = useAuthStore();
  const isGuest = !user || !token;

  const userKey = getUserKey(user);

  const [tab, setTab] = useState<"daily" | "weekly" | "permanent">("daily");
  const [profile, setProfile] = useState<ProfileLike>(() => (user ?? {}) as ProfileLike);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (isGuest) return;
    let cancelled = false;
    API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
      .then(res => {
        if (cancelled) return;
        setProfile(res.data as ProfileLike);
        updateUser?.(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isGuest, token, updateUser]);

  // Re-render when mission localStorage changes (from GameScreen or this screen).
  const [, setRev] = useState(0);
  useEffect(() => {
    const on = () => setRev(r => r + 1);
    window.addEventListener("pp_mission_event", on);
    window.addEventListener("pp_mission_state_change", on);
    return () => {
      window.removeEventListener("pp_mission_event", on);
      window.removeEventListener("pp_mission_state_change", on);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const todayKey = formatDateKeyLocal(new Date());
  const weekKey = getWeekKeyLocal(new Date());
  const weekStart = getWeekStartLocal(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const missionState = loadMissionState(userKey);
  const eventsAll = loadMissionEvents(userKey);
  const eventsToday = eventsAll.filter(e => formatDateKeyLocal(new Date(e.at)) === todayKey);
  const eventsWeek = eventsAll.filter(e => e.at >= weekStart.getTime() && e.at < weekEnd.getTime());

  const dailyIds = getDailyMissionIds(new Date(nowMs), userKey);
  const weeklyIds = getWeeklyMissionIds(weekStart, userKey);
  const permanentDefs = useMemo(() => getPermanentMissionDefs(), []);

  const formatCountdown = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const ss = String(sec).padStart(2, "0");
    return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  };
  const nextDaily = new Date(nowMs);
  nextDaily.setHours(24, 0, 0, 0);
  const dailyCountdown = formatCountdown(nextDaily.getTime() - nowMs);
  const weeklyCountdown = formatCountdown(weekEnd.getTime() - nowMs);

  const getClaimed = (period: MissionPeriod, periodKey: string, missionId: string) => {
    const claimKey = `${period}:${periodKey}:${missionId}`;
    return Boolean(missionState.claimed[claimKey]);
  };

  const startClaim = (period: MissionPeriod, periodKey: string, mission: MissionDef) => {
    if (isGuest) return;
    const mEvents = period === "daily" ? eventsToday : period === "weekly" ? eventsWeek : eventsAll;
    const progress = computeMissionProgress({ mission, events: mEvents, profile });
    if (progress < mission.progress.target) return;
    claimMissionReward({ userKey, period, periodKey, missionId: mission.id, shards: mission.shards });
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: themeId === "space" ? "url(/bg-earth.png) center/cover no-repeat" : t.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: "84px 18px 28px",
      zIndex: 1,
      overflowY: "auto",
      overflowX: "hidden",
      // Scale back down (was zoom:2).
      zoom: 1,
      transformOrigin: "top center",
      width: "100%"
    }}>
      {/* Background Glows */}
      <div style={{
        position: "absolute",
        width: "60vw",
        height: "60vw",
        background: `radial-gradient(circle, ${t.accent}15 0%, transparent 70%)`,
        top: "25%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 0
      }} />

      <div style={{ position: "relative", zIndex: 2, width: "calc(100vw - 36px)", maxWidth: 1600, overflow: "visible" }}>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <div style={{
                width: 62,
                height: 62,
                borderRadius: 12,
                background: `${t.accent}18`,
                border: `1px solid ${t.accent}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 20px ${t.accent}20`,
              }}>
                <img
                  src="/Pentaprotocol_Logo_Transparent.png"
                  alt="PentaProtocol"
                  style={{ width: 42, height: 42, objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(179,0,0,0.45))" }}
                />
              </div>
              <div>
                <div style={{ fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 900, color: t.text, letterSpacing: "0.08em" }}>
                  MISSIONS
                </div>
                <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textSecondary }}>
                  Daily / Weekly / Permanent Shard quests
                </div>
              </div>
            </div>
          </div>

          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "flex-end"
          }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 18, color: t.textSecondary }}>
              Available Mission Shards
            </div>
            <div style={{
              fontFamily: t.fontDisplay,
              fontSize: 32,
              fontWeight: 900,
              color: t.accent,
              display: "flex",
              alignItems: "center",
              gap: 10
            }}>
              <span
                style={{ width: 51, height: 51, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                dangerouslySetInnerHTML={{ __html: shardsSvg.replace("<svg ", `<svg width="51" height="51" `) }}
              />{" "}
              {missionState.shardBalance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 54, marginBottom: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {(["daily", "weekly", "permanent"] as const).map(x => {
            const active = tab === x;
            return (
              <button
                key={x}
                onClick={() => setTab(x)}
                style={{
                  background: active ? "rgba(179,0,0,0.28)" : "rgba(179,0,0,0.12)",
                  border: active ? "2px solid #B30000" : "1.5px solid rgba(179,0,0,0.65)",
                  color: "#B30000",
                  borderRadius: 12,
                  padding: "11px 18px",
                  fontFamily: t.fontDisplay,
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: active ? "0 0 20px rgba(179,0,0,0.35)" : "0 0 10px rgba(179,0,0,0.2)",
                  textShadow: "0 0 8px rgba(179,0,0,0.35)"
                }}
              >
                {x.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div style={{ paddingRight: 6 }}>
          {isGuest ? (
            <div style={{ padding: 18, background: `${t.bgCard}`, border: `1px solid ${t.border}55`, borderRadius: 14 }}>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 900, color: t.text, marginBottom: 6 }}>
                Sign in required
              </div>
              <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textSecondary }}>
                Missions are only available for signed-in players.
              </div>
            </div>
          ) : tab === "daily" ? (
            <MissionsList
              title="DAILY MISSIONS"
              subtitle="COMPLETE DAILY MISSIONS TO EARN SHARDS."
              timerText={`RESET IN ${dailyCountdown}`}
              period="daily"
              periodKey={todayKey}
              missionIds={dailyIds}
              events={eventsToday}
              profile={profile}
              getClaimed={getClaimed}
              onClaim={(mission) => startClaim("daily", todayKey, mission)}
              t={t}
              shardsSvg={shardsSvg}
            />
          ) : tab === "weekly" ? (
            <MissionsList
              title={`WEEKLY MISSIONS`}
              subtitle="COMPLETE WEEKLY MISSIONS TO EARN EXTRA SHARDS"
              timerText={`RESET IN ${weeklyCountdown}`}
              period="weekly"
              periodKey={weekKey}
              missionIds={weeklyIds}
              events={eventsWeek}
              profile={profile}
              getClaimed={getClaimed}
              onClaim={(mission) => startClaim("weekly", weekKey, mission)}
              t={t}
              shardsSvg={shardsSvg}
            />
          ) : (
            <PermanentMissionsPanel
              permanentDefs={permanentDefs}
              eventsAll={eventsAll}
              profile={profile}
              getClaimed={(missionId) => getClaimed("permanent", "all_time", missionId)}
              onClaim={(mission) => startClaim("permanent", "all_time", mission)}
              t={t}
              shardsSvg={shardsSvg}
            />
          )}
        </div>
      </div>

      <style>{`
        * { -webkit-font-smoothing: antialiased; }
      `}</style>
    </div>
  );
}

function RewardPlaceholderCard({ p, t }: { p: RewardPlaceholder; t: Theme }) {
  const label =
    p.kind === "picture" ? `Picture #${p.slot}` :
    p.kind === "banner" ? `Banner #${p.slot}` :
    p.kind === "border" ? `Border #${p.slot}` :
    p.kind === "boardSkin" ? `Grid Skin #${p.slot}` :
    `Piece Skin #${p.slot}`;
  return (
    <div style={{
      borderRadius: 10,
      padding: "10px 10px",
      border: `1px solid ${t.border}66`,
      background: `${t.bgCard}`,
      display: "flex",
      flexDirection: "column",
      gap: 4,
      minWidth: 160,
      flex: "0 0 auto"
    }}>
        <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, letterSpacing: "0.08em" }}>REWARD</div>
      <div style={{ fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 900, color: t.text }}>{label}</div>
      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSecondary }}>
        Placeholder (unlock later)
      </div>
    </div>
  );
}

function PentaShardsIcon({ svg, size }: { svg: string; size: number }) {
  return (
    <span
      style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", `<svg width="${size}" height="${size}" `) }}
    />
  );
}

function MissionsList(props: {
  title: string;
  subtitle: string;
  timerText?: string;
  period: "daily" | "weekly";
  periodKey: string;
  missionIds: string[];
  events: MissionMatchEvent[];
  profile: Record<string, unknown>;
  getClaimed: (period: MissionPeriod, periodKey: string, missionId: string) => boolean;
  onClaim: (mission: MissionDef) => void;
  t: Theme;
  shardsSvg: string;
}) {
  const { title, subtitle, timerText, missionIds, events, profile, getClaimed, onClaim, t, shardsSvg } = props;

  return (
    <div style={{ paddingBottom: 26 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 900, color: t.text }}>{title}</div>
          {timerText && (
            <div style={{ fontFamily: t.fontMono, fontSize: 15, fontWeight: 900, color: "#B30000", letterSpacing: "0.08em" }}>
              {timerText}
            </div>
          )}
        </div>
        <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textSecondary, marginTop: 4 }}>{subtitle}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
        {missionIds.map(id => {
          const mission = missionDefById(id);
          if (!mission) return null;
          const claimed = getClaimed(props.period, props.periodKey, mission.id);
          const progress = computeMissionProgress({ mission, events, profile });
          const done = progress >= mission.progress.target;
          const progressPct = Math.max(0, Math.min(100, (progress / Math.max(1, mission.progress.target)) * 100));

          return (
            <div key={id} style={{
              borderRadius: 16,
              border: `1px solid ${t.border}66`,
              background: `${t.bgCard}`,
              padding: 14,
              position: "relative",
              overflow: "hidden",
              minHeight: 285
            }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 20% 10%, ${t.accent}18, transparent 45%)`, pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 900, color: t.text }}>{mission.title}</div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSecondary, marginTop: 4 }}>
                      {mission.description}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, letterSpacing: "0.1em" }}>REWARD</div>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 900, color: t.accent }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <PentaShardsIcon svg={shardsSvg} size={31} />
                        {mission.shards}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, letterSpacing: "0.08em", display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span>PROGRESS</span>
                    <span>{progress}/{mission.progress.target}</span>
                  </div>
                  <div style={{ height: 10, background: t.bg, borderRadius: 999, border: `1px solid ${t.border}44`, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progressPct}%`, background: `linear-gradient(90deg, ${t.accent}, ${t.p1})`, boxShadow: `0 0 18px ${t.accent}33` }} />
                  </div>
                </div>

                <div style={{ marginTop: "auto", paddingTop: 18, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                  {done ? (
                    claimed ? (
                      <div style={{ fontFamily: t.fontMono, fontSize: 12, color: "#4CAF50", fontWeight: 900 }}>CLAIMED ✓</div>
                    ) : (
                      <button
                        onClick={() => onClaim(mission)}
                        style={{
                          background: t.accent,
                          border: "none",
                          borderRadius: 12,
                          padding: "10px 14px",
                          fontFamily: t.fontDisplay,
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#000",
                          cursor: "pointer",
                          boxShadow: `0 0 28px ${t.accent}22`
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          CLAIM
                          <PentaShardsIcon svg={shardsSvg} size={28} />
                          {mission.shards}
                        </span>
                      </button>
                    )
                  ) : (
                    <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.text }}>Keep going…</div>
                  )}
                  {mission.difficulty && (
                    <div style={{
                      background: mission.difficulty === "hard" ? `${t.accent}22` : mission.difficulty === "medium" ? "rgba(255,255,255,0.06)" : "rgba(76,175,80,0.10)",
                      border: `1px solid ${t.border}66`,
                      borderRadius: 10,
                      padding: "8px 10px",
                      fontFamily: t.fontMono,
                      fontSize: 11,
                      color: t.textSecondary
                    }}>
                      {mission.difficulty.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 50, fontFamily: t.fontMono, fontSize: 30, fontWeight: 900, color: "#CC0000", letterSpacing: "0.06em", textAlign: "center" }}>
        SINGLEPLAYER MODES DO NOT CONTRIBUTE TO MISSIONS
      </div>
    </div>
  );
}

function PermanentMissionsPanel(props: {
  permanentDefs: MissionDef[];
  eventsAll: MissionMatchEvent[];
  profile: Record<string, unknown>;
  getClaimed: (missionId: string) => boolean;
  onClaim: (mission: MissionDef) => void;
  t: Theme;
  shardsSvg: string;
}) {
  const { permanentDefs, eventsAll, profile, getClaimed, onClaim, t, shardsSvg } = props;
  const [showAll, setShowAll] = useState(false);

  const groups = useMemo(() => {
    const level = permanentDefs.filter(m => m.progress.kind === "levelAtLeast");
    const ranks = permanentDefs.filter(m => m.progress.kind === "rankAtLeast");
    const winStreak = permanentDefs.filter(m => m.progress.kind === "streakRankedMax");
    const rankedWins = permanentDefs.filter(m => m.progress.kind === "rankedWinsTotalAtLeast");
    const totalWins = permanentDefs.filter(m => m.progress.kind === "totalWinsAtLeast");
    const rankedPlay = permanentDefs.filter(m => m.progress.kind === "rankedMatchesAtLeast");
    return { level, ranks, winStreak, rankedWins, totalWins, rankedPlay };
  }, [permanentDefs]);

  const flattened = useMemo(() => [...groups.level, ...groups.ranks, ...groups.winStreak, ...groups.rankedWins, ...groups.totalWins, ...groups.rankedPlay], [groups]);
  const visible = showAll ? flattened : flattened.slice(0, 30);

  const renderGroup = (title: string, defs: MissionDef[]) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div style={{ fontFamily: t.fontDisplay, fontWeight: 900, fontSize: 14, color: t.text }}>{title}</div>
        <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary }}>{defs.length} missions</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
        {defs.map(m => {
          const claimed = getClaimed(m.id);
          const progress = computeMissionProgress({ mission: m, events: eventsAll, profile });
          const done = progress >= m.progress.target;
          const pct = Math.max(0, Math.min(100, (progress / Math.max(1, m.progress.target)) * 100));

          return (
            <div key={m.id} style={{ borderRadius: 16, border: `1px solid ${t.border}66`, background: `${t.bgCard}`, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 900, color: t.text }}>{m.title}</div>
                  <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSecondary, marginTop: 4 }}>{m.description}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, letterSpacing: "0.1em" }}>SHARDS</div>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 900, color: t.accent }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <PentaShardsIcon svg={shardsSvg} size={31} />
                      {m.shards}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, letterSpacing: "0.08em", display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span>PROGRESS</span>
                  <span>{progress}/{m.progress.target}</span>
                </div>
                <div style={{ height: 10, background: t.bg, borderRadius: 999, border: `1px solid ${t.border}44`, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${t.accent}, ${t.p1})`, boxShadow: `0 0 18px ${t.accent}33` }} />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, letterSpacing: "0.1em", marginBottom: 8 }}>REWARD PLACEHOLDERS</div>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                  {(m.rewards ?? []).map((p, idx) => <RewardPlaceholderCard key={`${p.kind}:${p.slot}:${idx}`} p={p} t={t} />)}
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {done ? (
                  claimed ? (
                    <div style={{ fontFamily: t.fontMono, fontSize: 12, color: "#4CAF50", fontWeight: 900 }}>CLAIMED ✓</div>
                  ) : (
                    <button
                      onClick={() => onClaim(m)}
                      style={{
                        background: t.accent,
                        border: "none",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontFamily: t.fontDisplay,
                        fontSize: 12,
                        fontWeight: 900,
                        color: "#000",
                        cursor: "pointer",
                        boxShadow: `0 0 28px ${t.accent}22`
                      }}
                    >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      CLAIM
                              <PentaShardsIcon svg={shardsSvg} size={28} />
                      {m.shards}
                    </span>
                    </button>
                  )
                ) : (
                  <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textSecondary }}>Not yet</div>
                )}
                {!done && m.difficulty && (
                  <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, border: `1px solid ${t.border}66`, background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: 10 }}>
                    {m.difficulty.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: 30 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 900, color: t.text }}>PERMANENT MISSIONS</div>
        <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textSecondary, marginTop: 4 }}>
          COMPLETE PERMANENT MISSIONS TO EARN NOT JUST SHARDS BUT FREE BANNERS AND GRIDS TOO.
        </div>
      </div>

      {!showAll ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
          <button
            onClick={() => setShowAll(true)}
            style={{
              background: `${t.accent}18`,
              border: `1px solid ${t.accent}66`,
              color: t.accent,
              borderRadius: 12,
              padding: "10px 14px",
              fontFamily: t.fontDisplay,
              fontSize: 12,
              fontWeight: 900,
              cursor: "pointer"
            }}
          >
            Show more missions
          </button>
          <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textSecondary }}>Showing first 30 missions</div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
          <button
            onClick={() => setShowAll(false)}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${t.border}66`,
              color: t.textSecondary,
              borderRadius: 12,
              padding: "10px 14px",
              fontFamily: t.fontDisplay,
              fontSize: 12,
              fontWeight: 900,
              cursor: "pointer"
            }}
          >
            Collapse
          </button>
          <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textSecondary }}>Showing all missions</div>
        </div>
      )}

      {showAll ? (
        <>
          {renderGroup("Level Milestones", groups.level)}
          {renderGroup("Rank Milestones", groups.ranks)}
          {renderGroup("Winstreak", groups.winStreak)}
          {renderGroup("Ranked Wins Totals", groups.rankedWins)}
          {renderGroup("Total Wins Totals", groups.totalWins)}
          {renderGroup("Ranked Play Totals", groups.rankedPlay)}
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
          {visible.map(m => (
            <div key={m.id} style={{ borderRadius: 16, border: `1px solid ${t.border}66`, background: `${t.bgCard}`, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 900, color: t.text }}>{m.title}</div>
                  <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSecondary, marginTop: 4 }}>{m.description}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, letterSpacing: "0.1em" }}>SHARDS</div>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 900, color: t.accent }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <PentaShardsIcon svg={shardsSvg} size={31} />
                      {m.shards}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                {(() => {
                  const claimed = getClaimed(m.id);
                  const progress = computeMissionProgress({ mission: m, events: eventsAll, profile });
                  const done = progress >= m.progress.target;
                  const pct = Math.max(0, Math.min(100, (progress / Math.max(1, m.progress.target)) * 100));
                  return (
                    <>
                      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, letterSpacing: "0.08em", display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span>PROGRESS</span>
                        <span>{progress}/{m.progress.target}</span>
                      </div>
                      <div style={{ height: 10, background: t.bg, borderRadius: 999, border: `1px solid ${t.border}44`, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${t.accent}, ${t.p1})`, boxShadow: `0 0 18px ${t.accent}33` }} />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, letterSpacing: "0.1em", marginBottom: 8 }}>REWARD PLACEHOLDERS</div>
                        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                          {(m.rewards ?? []).slice(0, 5).map((p, idx) => <RewardPlaceholderCard key={`${p.kind}:${p.slot}:${idx}`} p={p} t={t} />)}
                        </div>
                      </div>
                      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        {done ? (
                          claimed ? (
                            <div style={{ fontFamily: t.fontMono, fontSize: 12, color: "#4CAF50", fontWeight: 900 }}>CLAIMED ✓</div>
                          ) : (
                            <button
                              onClick={() => onClaim(m)}
                              style={{
                                background: t.accent,
                                border: "none",
                                borderRadius: 12,
                                padding: "10px 14px",
                                fontFamily: t.fontDisplay,
                                fontSize: 12,
                                fontWeight: 900,
                                color: "#000",
                                cursor: "pointer",
                                boxShadow: `0 0 28px ${t.accent}22`
                              }}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                CLAIM
                                <PentaShardsIcon svg={shardsSvg} size={28} />
                                {m.shards}
                              </span>
                            </button>
                          )
                        ) : (
                          <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textSecondary }}>Not yet</div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

