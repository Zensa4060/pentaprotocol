"use client";

/**
 * FriendsSidePanel — lightweight left-edge drawer rendered on the Home,
 * Lobby and Career screens so the player can peek at their friends list
 * and invite them to an unranked game without opening the full Friends
 * tab. Mirrors the core data / endpoints used by {@link FriendsScreen}:
 *
 *   - GET  /api/friends/list        → friends + blocked (blocked unused here)
 *   - GET  /api/friends/invites     → incoming match invites (pending)
 *   - POST /api/friends/invite      → sends an unranked invite
 *   - POST /api/friends/invites/:id/(accept|decline) → inbox actions
 *
 * A shared `pp_social_refresh` CustomEvent (dispatched from AppShell's
 * notify WebSocket) drives live refreshes so the mini list stays in sync
 * with the main Friends tab and navbar badge.
 *
 * The drawer is closed by default — the user opens it via a small edge
 * tab (kept on the left side of the viewport just below the NavBar).
 * Last-seen open/closed preference is persisted in localStorage so the
 * choice survives client-side route changes inside the current session.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES, type ThemeId } from "@/lib/themes";
import API from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { NavRankBadge, RANKS } from "./NavBar";
import { BannerRenderer } from "./BannerRenderer";
import { useApp } from "@/components/AppShell";

/** Shape parroted from FriendsScreen so the row visual lines up. */
interface Friend {
  id: string;
  username: string;
  level: number;
  elo: number;
  rank: string;
  avatar: string | null;
  banner: string;
  border_style: string;
  title: string;
  placement_matches: number;
  bio: string;
  online: boolean;
}

interface FriendInvite {
  id: string;
  from: Friend;
  board_mode: string;
  expires_at: string;
}

type ContextMenuState = {
  x: number;
  y: number;
  friend: Friend;
} | null;

const STORAGE_KEY = "pp_friends_side_panel_open";

interface Props {
  themeId: ThemeId;
  /** Optional hover SFX — wire it to AppShell's sfx.hover when available. */
  onHoverAction?: () => void;
  /** Some themes (space) use a transparent app background; the panel
   *  backdrop still needs solid contrast to stay readable over the
   *  starfield — callers can force that via this flag if they like,
   *  otherwise the component picks a sensible default per-theme. */
  forceSolidBackdrop?: boolean;
}

export default function FriendsSidePanel({ themeId, onHoverAction, forceSolidBackdrop }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES] ?? THEMES.classic_dark;
  const router = useRouter();
  const { token } = useAuthStore();
  const { handleRoomReady } = useApp();

  const [open, setOpen] = useState<boolean>(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invites, setInvites] = useState<FriendInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [search, setSearch] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Hydrate open/closed state from localStorage on mount so the pref
     survives navigation between Home/Lobby/Career (all separate mounts). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setOpen(true);
    } catch {
      /* storage disabled — default closed */
    }
  }, []);

  const persistOpen = useCallback((next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const [listRes, invRes] = await Promise.all([
        API.get("/api/friends/list"),
        API.get("/api/friends/invites"),
      ]);
      setFriends(listRes.data?.friends ?? []);
      setInvites(invRes.data?.invites ?? []);
    } catch {
      /* silent — polling will retry */
    } finally {
      setLoading(false);
    }
  }, [token]);

  /* 30s poll — same cadence as the full Friends tab so we never lag
     behind it by more than a poll cycle. AppShell's notify WS dispatches
     `pp_social_refresh` for realtime nudges. */
  useEffect(() => {
    if (!token) return;
    void fetchAll();
    const id = window.setInterval(fetchAll, 30_000);
    return () => window.clearInterval(id);
  }, [fetchAll, token]);

  useEffect(() => {
    const onRefresh = () => { void fetchAll(); };
    window.addEventListener("pp_social_refresh", onRefresh);
    return () => window.removeEventListener("pp_social_refresh", onRefresh);
  }, [fetchAll]);

  /* Dismiss the context menu on any outside click or escape keystroke. */
  useEffect(() => {
    if (!contextMenu) return;
    const onDown = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const sendInvite = useCallback(async (f: Friend) => {
    if (!f.online) {
      showToast("Friend is offline — invites disabled.");
      return;
    }
    try {
      await API.post("/api/friends/invite", { friend_id: f.id });
      showToast(`Invite sent to ${f.username}.`);
      await fetchAll();
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(String(msg || "Could not send invite."));
    }
  }, [fetchAll, showToast]);

  const acceptInvite = useCallback(async (inv: FriendInvite) => {
    try {
      const res = await API.post(`/api/friends/invites/${inv.id}/accept`);
      const roomCode = String(res.data?.room_code || "");
      const slot = (res.data?.player_slot || "P2") as "P1" | "P2";
      const boardMode = String(res.data?.board_mode || "5x5_6x6_7x7");
      let roomPayload: Record<string, unknown> = { board_mode: boardMode, source: "friend_invite" };
      try {
        const roomRes = await API.get(`/api/room/queue/status/${roomCode}`);
        roomPayload = roomRes?.data ?? roomPayload;
      } catch {
        /* fall back to minimal payload */
      }
      showToast(`Joining ${inv.from.username}'s match…`);
      handleRoomReady(roomCode, slot, "unranked", {
        opponent: {
          name: inv.from.username,
          elo: inv.from.elo,
          avatar: inv.from.avatar,
          banner: inv.from.banner,
          level: inv.from.level,
          placement_matches: inv.from.placement_matches,
        },
      }, roomPayload);
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(String(msg || "Could not join match."));
      void fetchAll();
    }
  }, [fetchAll, handleRoomReady, showToast]);

  const declineInvite = useCallback(async (inv: FriendInvite) => {
    try {
      await API.post(`/api/friends/invites/${inv.id}/decline`);
      await fetchAll();
    } catch {
      /* ignore */
    }
  }, [fetchAll]);

  /* Online friends first, then offline; within each group alphabetically. */
  const sortedFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? friends.filter((f) => f.username.toLowerCase().includes(q))
      : friends;
    return [...filtered].sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.username.localeCompare(b.username);
    });
  }, [friends, search]);

  const onlineCount = useMemo(() => friends.filter((f) => f.online).length, [friends]);

  /* Theme-aware backdrop: darker on space theme so the panel stays
     readable over the moving starfield. */
  const panelBg = forceSolidBackdrop || themeId === "space"
    ? "rgba(8, 10, 20, 0.96)"
    : t.bgPanel;

  const panelWidth = 320;

  return (
    <>
      {/* Keyframes for the edge-toggle pulse. Scoped globally but keyed
         on a unique name so it doesn't leak into other components. */}
      <style>{`
        @keyframes pp-friends-tab-pulse {
          0%, 100% { transform: translateX(0); filter: drop-shadow(0 0 0 transparent); }
          50%      { transform: translateX(3px); filter: drop-shadow(0 0 6px var(--pp-fsp-glow, #fff)); }
        }
        @keyframes pp-friends-tab-glow {
          0%, 100% { box-shadow: 2px 2px 22px rgba(0,0,0,0.55), 0 0 14px var(--pp-fsp-glow, #fff)55, 0 0 30px var(--pp-fsp-glow, #fff)22; }
          50%      { box-shadow: 2px 2px 30px rgba(0,0,0,0.6),  0 0 28px var(--pp-fsp-glow, #fff)aa, 0 0 60px var(--pp-fsp-glow, #fff)55; }
        }
      `}</style>

      {/* Edge toggle — always visible so the drawer can be opened. */}
      <button
        type="button"
        onClick={() => persistOpen(!open)}
        onMouseEnter={onHoverAction}
        title={open ? "Hide friends" : "Show friends"}
        aria-label={open ? "Hide friends panel" : "Show friends panel"}
        style={{
          ["--pp-fsp-glow" as string]: t.accent,
          position: "fixed",
          left: 0,
          top: 120,
          zIndex: 150,
          transform: open ? `translateX(${panelWidth}px)` : "translateX(0)",
          transition: "transform 0.24s cubic-bezier(.22,.68,0,1.2)",
          width: 38,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderTopRightRadius: 12,
          borderBottomRightRadius: 12,
          border: `1.5px solid ${t.accent}`,
          borderLeft: "none",
          background: panelBg,
          color: t.accent,
          fontFamily: t.fontMono,
          fontSize: 24,
          fontWeight: 900,
          lineHeight: 1,
          cursor: "pointer",
          padding: 0,
          animation: open ? "none" : "pp-friends-tab-glow 2.4s ease-in-out infinite",
          boxShadow: `2px 2px 24px rgba(0,0,0,0.55), 0 0 20px ${t.accent}aa, 0 0 42px ${t.accent}55`,
          textShadow: `0 0 6px ${t.accent}, 0 0 14px ${t.accent}cc, 0 0 22px ${t.accent}77`,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            animation: open ? "none" : "pp-friends-tab-pulse 1.8s ease-in-out infinite",
          }}
        >
          {open ? "◀" : "▶"}
        </span>
        {onlineCount > 0 && !open && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 8,
              background: t.success,
              color: "#000",
              fontFamily: t.fontMono,
              fontSize: 9,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `2px solid ${t.bg}`,
              boxShadow: `0 0 10px ${t.success}aa`,
            }}
          >
            {onlineCount}
          </span>
        )}
      </button>

      {/* Slide-out panel. */}
      <aside
        aria-hidden={!open}
        style={{
          position: "fixed",
          left: 0,
          top: 80,
          bottom: 0,
          width: panelWidth,
          zIndex: 150,
          background: panelBg,
          borderRight: `1px solid ${t.border}`,
          boxShadow: open ? `2px 0 28px rgba(0,0,0,0.5), 0 0 18px ${t.accent}14` : "none",
          transform: open ? "translateX(0)" : `translateX(-${panelWidth + 4}px)`,
          transition: "transform 0.24s cubic-bezier(.22,.68,0,1.2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* Header. */}
        <div
          style={{
            padding: "14px 14px 10px",
            borderBottom: `1px solid ${t.border}66`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                fontFamily: t.fontDisplay,
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: "0.18em",
                color: t.text,
                textTransform: "uppercase",
              }}
            >
              Friends
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.1em" }}>
              {onlineCount} ONLINE · {friends.length} TOTAL
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => { onHoverAction?.(); router.push("/friends"); }}
              onMouseEnter={onHoverAction}
              title="Open full Friends tab"
              style={{
                padding: "6px 10px",
                background: "transparent",
                border: `1px solid ${t.accent}66`,
                borderRadius: 6,
                color: t.accent,
                fontFamily: t.fontMono,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.1em",
                cursor: "pointer",
              }}
            >
              OPEN TAB
            </button>
            <button
              type="button"
              onClick={() => persistOpen(false)}
              title="Close"
              style={{
                padding: "6px 10px",
                background: "transparent",
                border: `1px solid ${t.border}`,
                borderRadius: 6,
                color: t.textMuted,
                fontFamily: t.fontMono,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search. */}
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t.border}44` }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends…"
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "transparent",
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              color: t.text,
              fontFamily: t.fontBody,
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        {/* Scroll area. */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px 16px" }}>
          {/* Incoming match invites — shown first because they're short-TTL. */}
          {invites.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontFamily: t.fontMono,
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: t.accent,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Match invites · {invites.length}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      padding: "8px 10px",
                      background: `${t.accent}10`,
                      border: `1px solid ${t.accent}55`,
                      borderRadius: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: t.fontDisplay,
                            fontSize: 13,
                            fontWeight: 800,
                            color: t.text,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {inv.from.username}
                        </div>
                        <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.08em" }}>
                          WANTS TO PLAY · {inv.board_mode.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => acceptInvite(inv)}
                        onMouseEnter={onHoverAction}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          background: `${t.success}33`,
                          border: `1px solid ${t.success}`,
                          borderRadius: 6,
                          color: t.success,
                          fontFamily: t.fontMono,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                        }}
                      >
                        JOIN
                      </button>
                      <button
                        type="button"
                        onClick={() => declineInvite(inv)}
                        onMouseEnter={onHoverAction}
                        style={{
                          padding: "6px 10px",
                          background: "transparent",
                          border: `1px solid ${t.border}`,
                          borderRadius: 6,
                          color: t.textMuted,
                          fontFamily: t.fontMono,
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          cursor: "pointer",
                        }}
                      >
                        DECLINE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friend list. */}
          {loading ? (
            <div style={{ color: t.textMuted, fontFamily: t.fontMono, fontSize: 11, padding: "12px 4px" }}>
              Loading friends…
            </div>
          ) : sortedFriends.length === 0 ? (
            <div style={{ color: t.textMuted, fontFamily: t.fontBody, fontSize: 12, padding: "12px 4px", lineHeight: 1.5 }}>
              {friends.length === 0
                ? "No friends yet. Open the full Friends tab to add people by friend code."
                : "No friends match that search."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sortedFriends.map((f) => {
                const rank = (RANKS as Array<{ name: string; color: string }>).find((r) => r.name === f.rank) || RANKS[1];
                const dim = !f.online;
                return (
                  <div
                    key={f.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, friend: f });
                    }}
                    onMouseEnter={onHoverAction}
                    title="Right-click for options"
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: t.bgPanel,
                      border: `1px solid ${f.online ? `${t.accent}44` : `${t.border}66`}`,
                      borderRadius: 8,
                      cursor: "context-menu",
                      overflow: "hidden",
                      opacity: dim ? 0.55 : 1,
                      filter: dim ? "grayscale(0.85)" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {/* Faded banner behind the row. */}
                    <div style={{ position: "absolute", inset: 0, opacity: 0.22, pointerEvents: "none" }}>
                      <BannerRenderer bannerId={f.banner || "default"} hideLabels />
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(90deg, ${t.bgPanel}DD 0%, ${t.bgPanel}66 60%, transparent 100%)`,
                        pointerEvents: "none",
                      }}
                    />

                    <div style={{ position: "relative", width: 32, height: 32, flexShrink: 0 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          border: `1.5px solid ${f.online ? t.accent : t.border}`,
                          overflow: "hidden",
                          background: t.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {f.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.avatar} alt={f.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span
                            style={{
                              fontFamily: t.fontDisplay,
                              fontSize: 13,
                              fontWeight: 800,
                              color: t.text,
                            }}
                          >
                            {f.username.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          right: -2,
                          bottom: -2,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: f.online ? t.success : t.textMuted,
                          border: `2px solid ${t.bgPanel}`,
                        }}
                      />
                    </div>

                    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: t.fontDisplay,
                          fontSize: 13,
                          fontWeight: 800,
                          color: t.text,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {f.username}
                      </div>
                      <div
                        style={{
                          fontFamily: t.fontMono,
                          fontSize: 9,
                          letterSpacing: "0.06em",
                          color: rank.color,
                          textTransform: "uppercase",
                        }}
                      >
                        LV {f.level} · {f.rank} · {f.elo}
                      </div>
                    </div>

                    <div style={{ position: "relative" }}>
                      <NavRankBadge
                        rank={rank}
                        size={26}
                        isPlacement={Boolean(f.placement_matches && f.placement_matches < 5)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint. */}
        <div
          style={{
            padding: "8px 14px",
            borderTop: `1px solid ${t.border}44`,
            fontFamily: t.fontMono,
            fontSize: 9,
            letterSpacing: "0.12em",
            color: t.textMuted,
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          Right-click a friend for options
        </div>
      </aside>

      {/* Context menu — reuses the same actions as the full Friends tab. */}
      {contextMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1000) - 240),
            top: Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 1000) - 220),
            background: t.bgPanel,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
            zIndex: 500,
            minWidth: 220,
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {([
            {
              key: "invite",
              label: contextMenu.friend.online
                ? "Invite to unranked"
                : "Friend is offline — invite disabled",
              onClick: () => sendInvite(contextMenu.friend),
              disabled: !contextMenu.friend.online,
            },
            {
              key: "open-tab",
              label: "Open friends tab",
              onClick: () => router.push("/friends"),
              disabled: false,
            },
          ] as const).map((item) => (
            <button
              key={item.key}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                setContextMenu(null);
                item.onClick();
              }}
              onMouseEnter={onHoverAction}
              style={{
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${t.border}33`,
                color: t.text,
                fontFamily: t.fontBody,
                fontSize: 13,
                cursor: item.disabled ? "default" : "pointer",
                opacity: item.disabled ? 0.45 : 1,
                transition: "background 0.15s",
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = `${t.accent}10`; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Toast. */}
      {toast && (
        <div
          style={{
            position: "fixed",
            left: 20,
            bottom: 20,
            zIndex: 400,
            padding: "10px 16px",
            background: t.bgPanel,
            border: `1px solid ${t.accent}77`,
            borderRadius: 10,
            color: t.text,
            fontFamily: t.fontBody,
            fontSize: 13,
            boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${t.accent}33`,
            maxWidth: 320,
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
