"use client";

/**
 * FriendsSidePanel — lightweight left-edge drawer rendered on Home, Lobby,
 * Career and (notably) the private-room waiting screen so the player can
 * peek at their friends list and, more importantly, chat with them to
 * share a custom-room code. The UI deliberately no longer exposes the
 * legacy "Invite to unranked" button — match invites were removed from
 * the client in favour of sharing custom-room codes through chat.
 *
 *   - GET  /api/friends/list               → friends roster
 *   - GET  /api/friends/messages/:friendId → existing chat log (for DM modal)
 *   - POST /api/friends/messages           → send DM
 *   - WS   /api/friends/ws/dm              → live DM push while modal open
 *   - DELETE /api/friends/:id              → unfriend
 *
 * A shared `pp_social_refresh` CustomEvent (dispatched from AppShell's
 * notify WebSocket) drives live refreshes so this mini list stays in
 * sync with the full Friends tab and navbar badge.
 *
 * Panel opens via an edge tab (kept on the left side of the viewport
 * just below the NavBar). Open/closed preference is persisted in
 * localStorage so the choice survives client-side route changes.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES, type ThemeId } from "@/lib/themes";
import API, { openWs } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { NavRankBadge, RANKS } from "./NavBar";
import { BannerRenderer } from "./BannerRenderer";
import { censorText, containsProfanity } from "@/lib/profanity";
import { requestFriendsBadgeRefresh } from "@/lib/navBadgeState";

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

type ContextMenuState = {
  x: number;
  y: number;
  friend: Friend;
} | null;

type DMState = {
  friend: Friend;
  loading: boolean;
  messages: { from_user: string; to_user: string; text: string; created_at: string | null }[];
  draft: string;
  sending: boolean;
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
  /**
   * When the player is sitting in a private-room waiting screen, the
   * caller can hand us the room code so we can prefill the DM draft
   * with "Join my match: ABCDEF". Lets the player share in one click.
   */
  roomCodeToShare?: string;
}

export default function FriendsSidePanel({ themeId, onHoverAction, forceSolidBackdrop, roomCodeToShare }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES] ?? THEMES.classic_dark;
  const router = useRouter();
  const { user, token } = useAuthStore();
  const meId = String((user as unknown as { id?: string; _id?: string })?.id
    ?? (user as unknown as { id?: string; _id?: string })?._id
    ?? "");

  const [open, setOpen] = useState<boolean>(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [search, setSearch] = useState("");
  const [dm, setDm] = useState<DMState>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dmScrollRef = useRef<HTMLDivElement | null>(null);
  const dmWsRef = useRef<WebSocket | null>(null);
  // Click-to-copy feedback for DM messages.
  const [copiedDmIdx, setCopiedDmIdx] = useState<number | null>(null);
  const copiedDmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedDmTimerRef.current) clearTimeout(copiedDmTimerRef.current);
  }, []);
  const handleCopyDm = useCallback((text: string, idx: number) => {
    if (!text) return;
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { /* ignore */ }
    };
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text).catch(fallback);
      } else fallback();
    } catch { fallback(); }
    setCopiedDmIdx(idx);
    if (copiedDmTimerRef.current) clearTimeout(copiedDmTimerRef.current);
    copiedDmTimerRef.current = setTimeout(() => setCopiedDmIdx(null), 1200);
  }, []);

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
      const listRes = await API.get("/api/friends/list");
      setFriends(listRes.data?.friends ?? []);
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

  /* ── Chat (DM) modal ────────────────────────────────────────────────── */

  const openDM = useCallback(async (f: Friend, prefillCode?: string) => {
    const prefill = prefillCode ? `Join my match: ${prefillCode}` : "";
    setDm({ friend: f, loading: true, messages: [], draft: prefill, sending: false });
    // Make sure the panel is open so the modal actually shows to the user.
    persistOpen(true);
    try {
      const res = await API.get(`/api/friends/messages/${f.id}`);
      setDm((d) => d && { ...d, loading: false, messages: res.data?.messages ?? [] });
      // Opening the thread marks the inbound messages as read on the
      // server. Nudge AppShell to refresh the friends badge + clear any
      // stale "new message" home-notice banner immediately instead of
      // waiting for the 30s poller.
      requestFriendsBadgeRefresh();
    } catch {
      setDm((d) => d && { ...d, loading: false });
    }
  }, [persistOpen]);

  const closeDM = useCallback(() => {
    setDm(null);
  }, []);

  const sendDM = useCallback(async () => {
    if (!dm) return;
    const text = dm.draft.trim();
    if (!text) return;
    if (containsProfanity(text)) {
      showToast("Message filtered for inappropriate language.");
    }
    const filtered = censorText(text);
    setDm((d) => d && { ...d, sending: true });
    try {
      await API.post("/api/friends/messages", { to_user: dm.friend.id, text: filtered });
      setDm((d) => d && { ...d, sending: false, draft: "" });
    } catch {
      setDm((d) => d && { ...d, sending: false });
    }
  }, [dm, showToast]);

  /* Live DM websocket — identical pattern to FriendsScreen. Only active
     while the DM modal is open. */
  useEffect(() => {
    if (!dm || !token) return;
    const friendId = String(dm.friend.id);
    const selfId = meId;
    let closed = false;

    const connect = async () => {
      try {
        const ws = await openWs("/api/friends/ws/dm");
        if (closed) { try { ws.close(); } catch {} return; }
        dmWsRef.current = ws;
        ws.onmessage = (event) => {
          let data: unknown = null;
          try { data = JSON.parse(event.data); } catch { return; }
          const d = data as { type?: string; message?: { from_user?: string; to_user?: string; text?: string; created_at?: string } };
          if (d?.type !== "dm_message" || !d?.message) return;
          const msg = d.message;
          const fromId = String(msg.from_user ?? "");
          const toId = String(msg.to_user ?? "");
          const isForActiveThread =
            (fromId === selfId && toId === friendId) ||
            (fromId === friendId && toId === selfId);
          if (!isForActiveThread) return;
          setDm((cur) => {
            if (!cur || String(cur.friend.id) !== friendId) return cur;
            return {
              ...cur,
              messages: [...cur.messages, {
                from_user: fromId,
                to_user: toId,
                text: String(msg.text ?? ""),
                created_at: msg.created_at ? String(msg.created_at) : null,
              }].slice(-500),
            };
          });
        };
        ws.onclose = () => {
          if (dmWsRef.current === ws) dmWsRef.current = null;
        };
      } catch {
        /* fall back to post-only — messages still send via HTTP */
      }
    };

    connect();

    return () => {
      closed = true;
      const ws = dmWsRef.current;
      dmWsRef.current = null;
      if (ws) { try { ws.close(); } catch {} }
    };
  }, [dm?.friend.id, meId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Keep scroll pinned to the latest message. */
  useEffect(() => {
    if (!dm || dm.loading) return;
    const el = dmScrollRef.current;
    if (!el) return;
    window.requestAnimationFrame(() => {
      if (dmScrollRef.current) {
        dmScrollRef.current.scrollTop = dmScrollRef.current.scrollHeight;
      }
    });
  }, [dm?.loading, dm?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Friend actions ─────────────────────────────────────────────────── */

  const removeFriend = useCallback(async (f: Friend) => {
    try {
      await API.delete(`/api/friends/${f.id}`);
      showToast(`${f.username} removed.`);
      if (dm && String(dm.friend.id) === String(f.id)) setDm(null);
      await fetchAll();
    } catch {
      showToast("Could not remove friend.");
    }
  }, [dm, fetchAll, showToast]);

  const goToFullTab = useCallback((params?: string) => {
    onHoverAction?.();
    router.push(params ? `/friends${params}` : "/friends");
  }, [onHoverAction, router]);

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
              onClick={() => goToFullTab()}
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

        {/* Room-code share hint — only shown while the caller is in a
            private waiting room. Helps users understand the intended
            flow now that match-invites were removed. */}
        {roomCodeToShare && !dm && (
          <div
            style={{
              padding: "10px 14px",
              borderBottom: `1px solid ${t.accent}33`,
              background: `${t.accent}10`,
              fontFamily: t.fontMono,
              fontSize: 11,
              color: t.text,
              letterSpacing: "0.06em",
              lineHeight: 1.45,
            }}
          >
            <div style={{ color: t.accent, fontWeight: 800, letterSpacing: "0.16em", marginBottom: 4 }}>
              ROOM · {roomCodeToShare.toUpperCase()}
            </div>
            Right-click a friend → <span style={{ color: t.accent }}>Send message</span> to share this code.
          </div>
        )}

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
                const rank = RANKS.find((r) => r.name === f.rank) || RANKS[1];
                const dim = !f.online;
                return (
                  <div
                    key={f.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, friend: f });
                    }}
                    onClick={() => {
                      // Single-click opens the chat. Sharing a room code is
                      // the primary reason the waiting-screen player opened
                      // this panel in the first place, so getting them into
                      // a thread with one tap is the UX we want.
                      void openDM(f, roomCodeToShare);
                    }}
                    onMouseEnter={onHoverAction}
                    title="Click to chat · right-click for more"
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: t.bgPanel,
                      border: `1px solid ${f.online ? `${t.accent}44` : `${t.border}66`}`,
                      borderRadius: 8,
                      cursor: "pointer",
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
          Click to chat · right-click for options
        </div>
      </aside>

      {/* Context menu — lean post-invite-removal: profile / message / career / remove. */}
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
              key: "message",
              label: roomCodeToShare ? "Send message · share code" : "Send message",
              onClick: () => void openDM(contextMenu.friend, roomCodeToShare),
              danger: false,
            },
            {
              key: "profile",
              label: "Open profile in Friends tab",
              onClick: () => goToFullTab(`?profile=${contextMenu.friend.id}`),
              danger: false,
            },
            {
              key: "career",
              label: "View career",
              onClick: () => goToFullTab(`?career=${contextMenu.friend.id}`),
              danger: false,
            },
            {
              key: "remove",
              label: "Remove friend",
              onClick: () => removeFriend(contextMenu.friend),
              danger: true,
            },
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => {
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
                color: item.danger ? t.danger : t.text,
                fontFamily: t.fontBody,
                fontSize: 13,
                cursor: "pointer",
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

      {/* Inline DM chat modal — centered, no route change, so a player who
          opened this on the private-room waiting screen doesn't lose their
          place. Mirrors the chat UI used by FriendsScreen's dmModal. */}
      {dm && (
        <div
          onClick={closeDM}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 92vw)",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              background: t.bgPanel,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              padding: 18,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: t.text }}>
                Chat · {dm.friend.username}
              </div>
              <button onClick={closeDM} style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, padding: "4px 10px", borderRadius: 6, fontFamily: t.fontMono, fontSize: 11, cursor: "pointer" }}>CLOSE</button>
            </div>

            {/* Quick-share strip — only shown when the caller gave us a
                room code to offer. One click inserts the template. */}
            {roomCodeToShare && (
              <button
                type="button"
                onClick={() => setDm((d) => d && { ...d, draft: `Join my match: ${roomCodeToShare.toUpperCase()}` })}
                onMouseEnter={onHoverAction}
                style={{
                  marginBottom: 10,
                  padding: "8px 12px",
                  background: `${t.accent}14`,
                  border: `1px dashed ${t.accent}88`,
                  borderRadius: 8,
                  color: t.accent,
                  fontFamily: t.fontMono,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                INSERT ROOM CODE · {roomCodeToShare.toUpperCase()}
              </button>
            )}

            <div
              ref={dmScrollRef}
              style={{ flex: 1, overflowY: "auto", border: `1px solid ${t.border}`, borderRadius: 8, padding: 10, marginBottom: 10, minHeight: 180, maxHeight: 380 }}
            >
              {dm.loading ? (
                <div style={{ color: t.textMuted, fontFamily: t.fontMono }}>Loading…</div>
              ) : dm.messages.length === 0 ? (
                <div style={{ color: t.textMuted, fontFamily: t.fontMono, textAlign: "center", padding: 20 }}>No messages yet.</div>
              ) : (
                dm.messages.map((m, i) => {
                  const mine = String(m.from_user) === meId;
                  const isCopied = copiedDmIdx === i;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: mine ? "flex-end" : "flex-start",
                        marginBottom: 6,
                        gap: 6,
                        alignItems: "flex-end",
                        flexDirection: mine ? "row-reverse" : "row",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "78%",
                          padding: "6px 10px",
                          background: mine ? `${t.accent}22` : t.bgCard,
                          border: `1px solid ${mine ? t.accent : t.border}`,
                          borderRadius: 8,
                          fontFamily: t.fontBody,
                          fontSize: 13,
                          color: t.text,
                          wordBreak: "break-word",
                          userSelect: "text",
                        }}
                      >
                        {m.text}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyDm(m.text, i)}
                        aria-label={isCopied ? "Copied" : "Copy message"}
                        style={{
                          flexShrink: 0,
                          background: isCopied ? `${t.accent}22` : "transparent",
                          border: `1px solid ${isCopied ? t.accent : `${t.border}AA`}`,
                          color: isCopied ? t.accent : t.textMuted,
                          fontFamily: t.fontMono,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          padding: "2px 6px",
                          borderRadius: 4,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {isCopied ? "COPIED" : "COPY"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={dm.draft}
                onChange={(e) => setDm((d) => d && { ...d, draft: e.target.value.slice(0, 500) })}
                placeholder="Write a message…"
                onKeyDown={(e) => { if (e.key === "Enter" && !dm.sending) void sendDM(); }}
                style={{ flex: 1, padding: "10px 12px", background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontFamily: t.fontBody, fontSize: 13 }}
              />
              <button
                onClick={sendDM}
                disabled={!dm.draft.trim() || dm.sending}
                style={{
                  padding: "10px 16px",
                  background: dm.draft.trim() ? t.accent : `${t.accent}44`,
                  border: `1px solid ${t.accent}`,
                  borderRadius: 8,
                  color: "#fff",
                  fontFamily: t.fontDisplay,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: dm.draft.trim() ? "pointer" : "default",
                }}
              >
                SEND
              </button>
            </div>
          </div>
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
