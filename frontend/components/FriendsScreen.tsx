"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import API, { openWs } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { BannerRenderer } from "./BannerRenderer";
import { NavRankBadge, RANKS, getRank } from "./NavBar";
import { clearFriendsNavBadge, setFriendsNavBadgeCount } from "@/lib/navBadgeState";
import { useApp } from "@/components/AppShell";
import { censorText, containsProfanity } from "@/lib/profanity";

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

interface FriendRequest {
  id: string;
  from: Friend;
  created_at: string | null;
  source?: string;
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

type ProfileModalState = {
  mode: "profile" | "career";
  friend: Friend;
  loading: boolean;
  error: string | null;
  data: any;
} | null;

type DMModalState = {
  friend: Friend;
  loading: boolean;
  messages: { from_user: string; to_user: string; text: string; created_at: string | null }[];
  draft: string;
  sending: boolean;
} | null;

interface Props {
  themeId: ThemeId;
  onHoverAction?: () => void;
}

export default function FriendsScreen({ themeId, onHoverAction }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const isSpace = themeId === "space";
  const router = useRouter();
  const { user, token } = useAuthStore();
  const meId = (user as any)?.id || (user as any)?._id || "";
  const { handleRoomReady } = useApp();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [invitesRemaining, setInvitesRemaining] = useState<number>(5);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [invites, setInvites] = useState<FriendInvite[]>([]);
  const [friendCode, setFriendCode] = useState<string>("");
  const [addCodeInput, setAddCodeInput] = useState<string>("");
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [profileModal, setProfileModal] = useState<ProfileModalState>(null);
  const [dmModal, setDmModal] = useState<DMModalState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dmMessagesScrollRef = useRef<HTMLDivElement | null>(null);
  const dmWsRef = useRef<WebSocket | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const [listRes, reqRes, invRes, codeRes] = await Promise.all([
        API.get("/api/friends/list"),
        API.get("/api/friends/requests"),
        API.get("/api/friends/invites"),
        API.get("/api/friends/me/code"),
      ]);
      setFriends(listRes.data?.friends ?? []);
      setInvitesRemaining(Number(listRes.data?.invites_remaining ?? 5));
      setRequests(reqRes.data?.requests ?? []);
      setInvites(invRes.data?.invites ?? []);
      setFriendCode(String(codeRes.data?.friend_code ?? ""));
      const unreadDm = Number(listRes.data?.unread_dm_count ?? 0);
      setFriendsNavBadgeCount(
        (reqRes.data?.requests?.length ?? 0) + (invRes.data?.invites?.length ?? 0) + unreadDm,
      );
    } catch {
      /* transient — the poller will retry */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
    const id = window.setInterval(fetchAll, 30_000);
    return () => window.clearInterval(id);
  }, [fetchAll]);

  useEffect(() => {
    const onSocialRefresh = (e: Event) => {
      const msg = (e as CustomEvent)?.detail;
      if (msg?.type === "friend_removed" && dmModal && String(msg.friend_id || "") === String(dmModal.friend.id)) {
        setDmModal(null);
        showToast("This friend was removed.");
      }
      void fetchAll();
    };
    window.addEventListener("pp_social_refresh", onSocialRefresh);
    return () => window.removeEventListener("pp_social_refresh", onSocialRefresh);
  }, [fetchAll, dmModal, showToast]);

  useEffect(() => {
    const pendingFriendId = sessionStorage.getItem("pp_open_dm_friend_id");
    if (!pendingFriendId || friends.length === 0) return;
    const friend = friends.find((f) => String(f.id) === String(pendingFriendId));
    if (!friend) return;
    sessionStorage.removeItem("pp_open_dm_friend_id");
    void openDM(friend);
  }, [friends, openDM]);

  useEffect(() => {
    clearFriendsNavBadge();
  }, []);

  const onSendRequest = useCallback(async () => {
    const code = addCodeInput.trim().toUpperCase();
    if (!code) return;
    try {
      const res = await API.post("/api/friends/request", { friend_code: code });
      const status = String(res.data?.status || "");
      if (status === "already_friends") setAddMsg({ ok: true, text: "You're already friends." });
      else if (status === "accepted") setAddMsg({ ok: true, text: "You're now friends — a reverse request was pending." });
      else setAddMsg({ ok: true, text: "Friend request sent." });
      setAddCodeInput("");
      await fetchAll();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Could not send request.";
      setAddMsg({ ok: false, text: String(msg) });
    }
  }, [addCodeInput, fetchAll]);

  const acceptRequest = useCallback(async (r: FriendRequest) => {
    try {
      await API.post(`/api/friends/requests/${r.id}/accept`);
      showToast(`${r.from.username} added.`);
      await fetchAll();
    } catch {
      showToast("Could not accept.");
    }
  }, [fetchAll, showToast]);

  const declineRequest = useCallback(async (r: FriendRequest) => {
    try {
      await API.post(`/api/friends/requests/${r.id}/decline`);
      await fetchAll();
    } catch {
      /* ignore */
    }
  }, [fetchAll]);

  const acceptInvite = useCallback(async (inv: FriendInvite) => {
    try {
      const res = await API.post(`/api/friends/invites/${inv.id}/accept`);
      const roomCode = String(res.data?.room_code || "");
      const slot = (res.data?.player_slot || "P2") as "P1" | "P2";
      const boardMode = String(res.data?.board_mode || "5x5_6x6_7x7");
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
      }, { board_mode: boardMode });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Could not join match.";
      showToast(String(msg));
      fetchAll();
    }
  }, [handleRoomReady, showToast, fetchAll]);

  const declineInvite = useCallback(async (inv: FriendInvite) => {
    try {
      await API.post(`/api/friends/invites/${inv.id}/decline`);
      await fetchAll();
    } catch {
      /* ignore */
    }
  }, [fetchAll]);

  const removeFriend = useCallback(async (f: Friend) => {
    try {
      await API.delete(`/api/friends/${f.id}`);
      showToast(`${f.username} removed.`);
      await fetchAll();
    } catch {
      showToast("Could not remove friend.");
    }
  }, [fetchAll, showToast]);

  const sendInvite = useCallback(async (f: Friend) => {
    if (!f.online) {
      showToast("Friend is offline — invites disabled.");
      return;
    }
    if (invitesRemaining <= 0) {
      showToast("Daily invite limit reached (5 / 24h).");
      return;
    }
    try {
      await API.post("/api/friends/invite", { friend_id: f.id });
      showToast(`Invite sent to ${f.username}.`);
      await fetchAll();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Could not send invite.";
      showToast(String(msg));
    }
  }, [invitesRemaining, fetchAll, showToast]);

  const openProfile = useCallback(async (f: Friend) => {
    setProfileModal({ mode: "profile", friend: f, loading: true, error: null, data: null });
    try {
      const res = await API.get(`/api/friends/profile/${f.id}`);
      setProfileModal((p) => p && { ...p, loading: false, data: res.data?.profile ?? null });
    } catch {
      setProfileModal((p) => p && { ...p, loading: false, error: "Could not load profile." });
    }
  }, []);

  const openCareer = useCallback(async (f: Friend) => {
    setProfileModal({ mode: "career", friend: f, loading: true, error: null, data: null });
    try {
      const res = await API.get(`/api/friends/career/${f.id}`);
      setProfileModal((p) => p && { ...p, loading: false, data: res.data?.history ?? [] });
    } catch {
      setProfileModal((p) => p && { ...p, loading: false, error: "Could not load career." });
    }
  }, []);

  const openDM = useCallback(async (f: Friend) => {
    setDmModal({ friend: f, loading: true, messages: [], draft: "", sending: false });
    try {
      const res = await API.get(`/api/friends/messages/${f.id}`);
      setDmModal((d) => d && { ...d, loading: false, messages: res.data?.messages ?? [] });
    } catch {
      setDmModal((d) => d && { ...d, loading: false });
    }
  }, []);

  const sendDM = useCallback(async () => {
    if (!dmModal) return;
    const text = dmModal.draft.trim();
    if (!text) return;
    if (containsProfanity(text)) {
      showToast("Message filtered for inappropriate language.");
    }
    const filtered = censorText(text);
    setDmModal((d) => d && { ...d, sending: true });
    try {
      await API.post("/api/friends/messages", { to_user: dmModal.friend.id, text: filtered });
      setDmModal((d) => d && { ...d, sending: false, draft: "" });
    } catch {
      setDmModal((d) => d && { ...d, sending: false });
    }
  }, [dmModal, showToast]);

  // Live websocket updates while DM modal is open.
  useEffect(() => {
    if (!dmModal || !token) return;
    const friendId = String(dmModal.friend.id);
    const selfId = String(meId);
    let closed = false;

    const connect = async () => {
      try {
        const ws = await openWs("/api/friends/ws/dm");
        if (closed) {
          try { ws.close(); } catch {}
          return;
        }
        dmWsRef.current = ws;
        ws.onmessage = (event) => {
          let data: any = null;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }
          if (data?.type !== "dm_message" || !data?.message) return;
          const msg = data.message;
          const fromId = String(msg.from_user ?? "");
          const toId = String(msg.to_user ?? "");
          const activeFriend = friendId;
          const isForActiveThread =
            (fromId === selfId && toId === activeFriend) ||
            (fromId === activeFriend && toId === selfId);
          if (!isForActiveThread) return;
          setDmModal((d) => {
            if (!d || String(d.friend.id) !== activeFriend) return d;
            return {
              ...d,
              messages: [...d.messages, {
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
        // Socket may fail during transient network/deploy events.
      }
    };
    connect();

    return () => {
      closed = true;
      const ws = dmWsRef.current;
      dmWsRef.current = null;
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [dmModal?.friend.id, meId, token]);

  // Always open and stay pinned to latest chat at the bottom.
  useEffect(() => {
    if (!dmModal || dmModal.loading) return;
    const el = dmMessagesScrollRef.current;
    if (!el) return;
    window.requestAnimationFrame(() => {
      if (dmMessagesScrollRef.current) {
        dmMessagesScrollRef.current.scrollTop = dmMessagesScrollRef.current.scrollHeight;
      }
    });
  }, [dmModal?.loading, dmModal?.messages.length]);

  const copyFriendCode = useCallback(async () => {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      showToast("Friend code copied.");
    } catch {
      showToast("Copy failed.");
    }
  }, [friendCode, showToast]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.username.toLowerCase().includes(q));
  }, [friends, searchQuery]);

  const online = filteredFriends.filter((f) => f.online);
  const offline = filteredFriends.filter((f) => !f.online);

  const renderFriendRow = (f: Friend) => {
    const dim = !f.online;
    const rank = (RANKS as any[]).find((r) => r.name === f.rank) || RANKS[1];
    return (
      <div
        key={f.id}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, friend: f });
        }}
        onDoubleClick={() => openProfile(f)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          background: t.bgPanel,
          border: `1px solid ${f.online ? `${t.accent}44` : `${t.border}66`}`,
          borderRadius: 10,
          overflow: "hidden",
          cursor: "pointer",
          opacity: dim ? 0.55 : 1,
          filter: dim ? "grayscale(0.9)" : "none",
          transition: "all 0.15s",
        }}
        onMouseEnter={() => { onHoverAction?.(); }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 0.35, pointerEvents: "none" }}>
          <BannerRenderer bannerId={f.banner || "default"} hideLabels />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to right, ${t.bgPanel}dd 0%, ${t.bgPanel}88 60%, transparent 100%)`,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: t.bgCard,
              border: `2px solid ${f.online ? rank.color : t.border}`,
              overflow: "hidden",
              flexShrink: 0,
              position: "relative",
            }}
          >
            {f.avatar ? (
              <img src={f.avatar} alt={f.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.fontDisplay, fontWeight: 900, color: t.text, fontSize: 16 }}>
                {(f.username[0] || "?").toUpperCase()}
              </div>
            )}
            <div
              style={{
                position: "absolute",
                right: -1,
                bottom: -1,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: f.online ? "#22c55e" : "#64748b",
                border: `2px solid ${t.bgPanel}`,
              }}
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: 15,
                  fontWeight: 800,
                  color: t.text,
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {f.username}
              </span>
              <span
                style={{
                  fontFamily: t.fontMono,
                  fontSize: 10,
                  color: t.textMuted,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                LV {f.level}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span style={{ fontFamily: t.fontMono, fontSize: 11, color: rank.color, fontWeight: 700, letterSpacing: "0.12em" }}>
                {f.rank}
              </span>
              <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted }}>· {f.elo} ELO</span>
            </div>
          </div>
          <NavRankBadge rank={rank} size={36} isPlacement={Boolean(f.placement_matches && f.placement_matches < 5)} />
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted, fontFamily: t.fontMono }}>
        Sign in to access your friends list.
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        zIndex: 2,
        background: isSpace ? "rgba(2,4,15,0.86)" : t.bg,
        color: t.text,
        padding: "90px 24px 40px",
        fontFamily: t.fontBody,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.3em" }}>SOCIAL · PROTOCOL</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 32, fontWeight: 900, color: t.text, letterSpacing: "0.02em" }}>Friends</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: t.bgPanel,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: "8px 14px",
            }}
          >
            <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.18em" }}>YOUR CODE</div>
            <div style={{ fontFamily: t.fontMono, fontWeight: 900, fontSize: 18, color: t.accent, letterSpacing: "0.12em" }}>{friendCode || "—"}</div>
            <button
              onClick={copyFriendCode}
              onMouseEnter={onHoverAction}
              style={{
                background: `${t.accent}18`,
                border: `1px solid ${t.accent}55`,
                color: t.accent,
                fontFamily: t.fontMono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                padding: "5px 10px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              COPY
            </button>
          </div>
        </div>

        {/* Add friend + counters strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 10 }}>SEND REQUEST</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={addCodeInput}
                onChange={(e) => setAddCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="Enter friend code"
                maxLength={16}
                onKeyDown={(e) => e.key === "Enter" && onSendRequest()}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: t.inputBg,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  color: t.text,
                  fontFamily: t.fontMono,
                  fontSize: 14,
                  letterSpacing: "0.12em",
                }}
              />
              <button
                onClick={onSendRequest}
                onMouseEnter={onHoverAction}
                style={{
                  padding: "10px 16px",
                  background: t.accent,
                  border: `1px solid ${t.accent}`,
                  borderRadius: 8,
                  color: "#fff",
                  fontFamily: t.fontDisplay,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                SEND
              </button>
            </div>
            {addMsg && (
              <div
                style={{
                  marginTop: 10,
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: addMsg.ok ? `${t.accent}18` : `${t.danger}18`,
                  border: `1px solid ${addMsg.ok ? t.accent : t.danger}`,
                  color: addMsg.ok ? t.accent : t.danger,
                  fontFamily: t.fontMono,
                  fontSize: 12,
                }}
              >
                {addMsg.text}
              </div>
            )}
          </div>

          <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 10 }}>INVITE BUDGET · 24H</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 40, fontWeight: 900, color: t.accent }}>{invitesRemaining}</div>
              <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted }}>of 5 unranked invites left</div>
            </div>
            <div style={{ marginTop: 8, fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, lineHeight: 1.4 }}>
              Invite an online friend to an unranked match. Budget resets on a rolling 24-hour window.
            </div>
          </div>
        </div>

        {/* Pending requests */}
        {(requests.length > 0 || invites.length > 0) && (
          <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 10 }}>
              PENDING · {requests.length} REQUEST{requests.length === 1 ? "" : "S"} · {invites.length} INVITE{invites.length === 1 ? "" : "S"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {requests.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, border: `1px solid ${t.border}`, borderRadius: 8 }}>
                  <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.accent, letterSpacing: "0.1em" }}>FRIEND REQ</span>
                  <span style={{ fontFamily: t.fontDisplay, fontWeight: 700, color: t.text }}>{r.from.username}</span>
                  <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted }}>LV {r.from.level} · {r.from.elo} ELO</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button
                      onClick={() => acceptRequest(r)}
                      onMouseEnter={onHoverAction}
                      style={{ padding: "5px 10px", background: `${t.accent}22`, border: `1px solid ${t.accent}`, borderRadius: 6, color: t.accent, fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      ACCEPT
                    </button>
                    <button
                      onClick={() => declineRequest(r)}
                      style={{ padding: "5px 10px", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 6, color: t.textMuted, fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      DECLINE
                    </button>
                  </div>
                </div>
              ))}
              {invites.map((inv) => (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, border: `1px solid ${t.accent}55`, borderRadius: 8, background: `${t.accent}08` }}>
                  <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.accent, letterSpacing: "0.1em" }}>MATCH INVITE</span>
                  <span style={{ fontFamily: t.fontDisplay, fontWeight: 700, color: t.text }}>{inv.from.username}</span>
                  <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted }}>{inv.board_mode}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button
                      onClick={() => acceptInvite(inv)}
                      onMouseEnter={onHoverAction}
                      style={{ padding: "5px 10px", background: t.accent, border: `1px solid ${t.accent}`, borderRadius: 6, color: "#fff", fontFamily: t.fontMono, fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                    >
                      JOIN
                    </button>
                    <button
                      onClick={() => declineInvite(inv)}
                      style={{ padding: "5px 10px", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 6, color: t.textMuted, fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      DECLINE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search friends…"
            style={{
              flex: 1,
              padding: "10px 14px",
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              color: t.text,
              fontFamily: t.fontMono,
              fontSize: 13,
            }}
          />
          <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.18em" }}>
            {online.length} ONLINE · {offline.length} OFFLINE
          </span>
        </div>

        {/* Friends list */}
        {loading ? (
          <div style={{ color: t.textMuted, fontFamily: t.fontMono, textAlign: "center", padding: 40 }}>Loading friends…</div>
        ) : friends.length === 0 ? (
          <div style={{ color: t.textMuted, fontFamily: t.fontMono, textAlign: "center", padding: 40 }}>
            Your friends list is empty. Share your friend code or add someone with theirs.
          </div>
        ) : (
          <>
            {online.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: "#22c55e", letterSpacing: "0.2em", marginBottom: 8 }}>ONLINE · {online.length}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
                  {online.map(renderFriendRow)}
                </div>
              </div>
            )}
            {offline.length > 0 && (
              <div>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 8 }}>OFFLINE · {offline.length}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
                  {offline.map(renderFriendRow)}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            left: Math.min(contextMenu.x, window.innerWidth - 240),
            top: Math.min(contextMenu.y, window.innerHeight - 280),
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
            { key: "profile", label: "Show profile", onClick: () => openProfile(contextMenu.friend) },
            {
              key: "invite",
              label: contextMenu.friend.online
                ? `Invite to unranked (${invitesRemaining} left)`
                : "Friend is offline — invite disabled",
              onClick: () => sendInvite(contextMenu.friend),
              disabled: !contextMenu.friend.online || invitesRemaining <= 0,
            },
            { key: "message", label: "Send message", onClick: () => openDM(contextMenu.friend) },
            { key: "career", label: "View career", onClick: () => openCareer(contextMenu.friend) },
            { key: "remove", label: "Remove friend", onClick: () => removeFriend(contextMenu.friend), danger: true },
          ] as const).map((item) => (
            <button
              key={item.key}
              disabled={(item as any).disabled}
              onClick={() => {
                if (!(item as any).disabled) {
                  setContextMenu(null);
                  item.onClick();
                }
              }}
              onMouseEnter={onHoverAction}
              style={{
                width: "100%",
                padding: "10px 14px",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${t.border}33`,
                color: (item as any).danger ? t.danger : t.text,
                fontFamily: t.fontBody,
                fontSize: 13,
                cursor: (item as any).disabled ? "default" : "pointer",
                opacity: (item as any).disabled ? 0.45 : 1,
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

      {/* Profile / Career modal */}
      {profileModal && (
        <div
          onClick={() => setProfileModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(540px, 92vw)", maxHeight: "80vh", overflow: "auto", background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 900, color: t.text }}>
                {profileModal.friend.username} · {profileModal.mode === "profile" ? "Profile" : "Career"}
              </div>
              <button onClick={() => setProfileModal(null)} style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, padding: "4px 10px", borderRadius: 6, fontFamily: t.fontMono, fontSize: 11, cursor: "pointer" }}>CLOSE</button>
            </div>
            {profileModal.loading && <div style={{ color: t.textMuted, fontFamily: t.fontMono }}>Loading…</div>}
            {profileModal.error && <div style={{ color: t.danger, fontFamily: t.fontMono }}>{profileModal.error}</div>}
            {!profileModal.loading && !profileModal.error && profileModal.mode === "profile" && profileModal.data && (
              <>
                <div style={{ position: "relative", height: 140, borderRadius: 10, overflow: "hidden", border: `1px solid ${t.border}`, marginBottom: 12 }}>
                  <BannerRenderer bannerId={profileModal.data.banner || "default"} hideLabels />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  <Stat t={t} label="ELO" value={String(profileModal.data.elo ?? 0)} color={getRank(profileModal.data.elo).color} />
                  <Stat t={t} label="LEVEL" value={String(profileModal.data.level ?? 0)} />
                  <Stat t={t} label="RANK" value={String(profileModal.data.rank ?? "")} color={getRank(profileModal.data.elo).color} />
                  <Stat t={t} label="WINS" value={String(profileModal.data.wins ?? 0)} color="#22c55e" />
                  <Stat t={t} label="LOSSES" value={String(profileModal.data.losses ?? 0)} color={t.danger} />
                  <Stat t={t} label="DRAWS" value={String(profileModal.data.draws ?? 0)} />
                </div>
                {profileModal.data.bio ? (
                  <div style={{ marginTop: 14, fontFamily: t.fontBody, fontSize: 13, color: t.textSecondary, whiteSpace: "pre-wrap" }}>{profileModal.data.bio}</div>
                ) : null}
              </>
            )}
            {!profileModal.loading && !profileModal.error && profileModal.mode === "career" && Array.isArray(profileModal.data) && (
              <div>
                {profileModal.data.length === 0 ? (
                  <div style={{ color: t.textMuted, fontFamily: t.fontMono, textAlign: "center", padding: 20 }}>No matches recorded yet.</div>
                ) : (
                  profileModal.data.map((m: any) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${t.border}33` }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontFamily: t.fontMono, color: t.textMuted, fontSize: 11 }}>{new Date(m.played_at).toLocaleString()}</span>
                        <span style={{ fontFamily: t.fontDisplay, color: t.text, fontSize: 14 }}>vs {m.opponent_username}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted }}>{m.mode.toUpperCase()}</span>
                        <span
                          style={{
                            fontFamily: t.fontDisplay,
                            fontSize: 13,
                            fontWeight: 800,
                            color: m.result === "win" ? "#22c55e" : m.result === "loss" ? t.danger : t.gold,
                            textTransform: "uppercase",
                          }}
                        >
                          {m.result}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DM modal */}
      {dmModal && (
        <div
          onClick={() => setDmModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(520px, 92vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18, overflow: "hidden" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: t.text }}>Chat · {dmModal.friend.username}</div>
              <button onClick={() => setDmModal(null)} style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, padding: "4px 10px", borderRadius: 6, fontFamily: t.fontMono, fontSize: 11, cursor: "pointer" }}>CLOSE</button>
            </div>
            <div
              ref={dmMessagesScrollRef}
              style={{ flex: 1, overflowY: "auto", border: `1px solid ${t.border}`, borderRadius: 8, padding: 10, marginBottom: 10, minHeight: 180, maxHeight: 380 }}
            >
              {dmModal.loading ? (
                <div style={{ color: t.textMuted, fontFamily: t.fontMono }}>Loading…</div>
              ) : dmModal.messages.length === 0 ? (
                <div style={{ color: t.textMuted, fontFamily: t.fontMono, textAlign: "center", padding: 20 }}>No messages yet.</div>
              ) : (
                dmModal.messages.map((m, i) => {
                  const mine = String(m.from_user) === String(meId);
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 6 }}>
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
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={dmModal.draft}
                onChange={(e) => setDmModal((d) => d && { ...d, draft: e.target.value.slice(0, 500) })}
                placeholder="Write a message…"
                onKeyDown={(e) => e.key === "Enter" && !dmModal.sending && sendDM()}
                style={{ flex: 1, padding: "10px 12px", background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontFamily: t.fontBody, fontSize: 13 }}
              />
              <button
                onClick={sendDM}
                disabled={!dmModal.draft.trim() || dmModal.sending}
                style={{ padding: "10px 16px", background: dmModal.draft.trim() ? t.accent : `${t.accent}44`, border: `1px solid ${t.accent}`, borderRadius: 8, color: "#fff", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, cursor: dmModal.draft.trim() ? "pointer" : "default" }}
              >
                SEND
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.92)",
            border: `1px solid ${t.accent}`,
            borderRadius: 8,
            padding: "8px 16px",
            fontFamily: t.fontMono,
            fontSize: 12,
            color: t.text,
            zIndex: 600,
            letterSpacing: "0.04em",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({
  t,
  label,
  value,
  color,
}: {
  t: typeof THEMES["classic_dark"];
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.18em" }}>{label}</div>
      <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 900, color: color ?? t.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}
