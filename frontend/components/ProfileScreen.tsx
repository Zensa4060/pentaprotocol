"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import API from "@/lib/api";
import { containsProfanity, validateUsername } from "@/lib/profanity";
import { SHARDS_LIGHT_SVG, SHARDS_DARK_SVG, PROTO_LIGHT_SVG, PROTO_DARK_SVG } from "@/lib/currencyIcons";
import { loadCustomTheme, saveCustomTheme } from "@/lib/customTheme";
import { useBannerShineEnabled, saveBannerShineEnabled } from "@/lib/bannerShinePreference";
import type { Screen } from "@/lib/types";
import { getUserKey, loadMissionState } from "@/lib/missionsClient";
import { computeLevelProgress } from "@/lib/xpLevel";
import { BannerRenderer } from "./BannerRenderer";
import { rankGlowVisualStrength, buildRankEmblemGlowFilter, rankHaloGradientForRank, NavRankBadge, getRank, RANKS } from "./NavBar";
import { openDiscordInvite } from "@/lib/community";
// ── Supabase storage client ───────────────────────────────────────────────────
import { getSupabase, isSupabaseConfigured, formatSupabaseUploadError } from "@/lib/supabase";

function apiErrorDetail(e: unknown, fallback: string): string {
  const err = e as {
    response?: { data?: { detail?: unknown }; status?: number };
    code?: string;
    message?: string;
  };
  if (err.response?.status === 500) {
    return "Something went wrong on the server. Please try again in a moment.";
  }
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length > 0 && typeof (d[0] as { msg?: string }).msg === "string") {
    return (d as { msg: string }[]).map((x) => x.msg).join("; ");
  }
  if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
    return "Network error — check your connection and try again.";
  }
  return fallback;
}


export const TITLES: {
  id: string; label: string; color: string; glow: string;
  unlockDesc: string;
  condition: (profile: any) => boolean;
  animation: "none" | "pulse" | "shimmer" | "flicker" | "rainbow" | "fire" | "electric";
}[] = [
  { id: "newcomer",     label: "Newcomer",       color: "#9CA3AF", glow: "#9CA3AF44",
    unlockDesc: "Default title",         condition: () => true,                                   animation: "none" },
  { id: "sharpshooter", label: "Sharpshooter",   color: "#60A5FA", glow: "#60A5FA44",
    unlockDesc: "Win 10 ranked matches", condition: p => (p.wins || 0) >= 10,                    animation: "pulse" },
  { id: "strategist",   label: "Strategist",     color: "#34D399", glow: "#34D39944",
    unlockDesc: "Reach 1000 ELO",        condition: p => (p.elo || 0) >= 1000,                   animation: "shimmer" },
  { id: "gladiator",    label: "Gladiator",      color: "#F97316", glow: "#F9731644",
    unlockDesc: "Win 50 ranked matches", condition: p => (p.wins || 0) >= 50,                    animation: "flicker" },
  { id: "emerald_eye",  label: "Emerald Eye",    color: "#10B981", glow: "#10B98144",
    unlockDesc: "Reach Emerald rank",    condition: p => (p.elo || 0) >= 1500,                   animation: "pulse" },
  { id: "penta_master", label: "Penta Master",   color: "#FF3333", glow: "#FF333344",
    unlockDesc: "Reach Master rank",     condition: p => (p.elo || 0) >= 2000,                   animation: "fire" },
  { id: "the_legend",   label: "The Legend",     color: "#F59E0B", glow: "#F59E0B44",
    unlockDesc: "Reach Legend rank",     condition: p => (p.elo || 0) >= 2500,                   animation: "rainbow" },
  { id: "centurion",    label: "Centurion",      color: "#C084FC", glow: "#C084FC44",
    unlockDesc: "Win 100 ranked matches",condition: p => (p.wins || 0) >= 100,                   animation: "electric" },
  { id: "unbreakable",  label: "Unbreakable",    color: "#FB7185", glow: "#FB718544",
    unlockDesc: "Win 3 Rulebreaker rounds in a row", condition: p => (p.rb_wins || 0) >= 3,     animation: "flicker" },
  { id: "veteran",      label: "Veteran",        color: "#A78BFA", glow: "#A78BFA44",
    unlockDesc: "Play 200 total games",  condition: p => ((p.wins||0)+(p.losses||0)+(p.draws||0)) >= 200, animation: "shimmer" },
  { id: "protocol",     label: "Protocol",       color: "#38BDF8", glow: "#38BDF844",
    unlockDesc: "Reach level 20",        condition: p => (p.level || 0) >= 20,                   animation: "electric" },
  { id: "architect",    label: "Architect",      color: "#E879F9", glow: "#E879F944",
    unlockDesc: "Reach level 50",        condition: p => (p.level || 0) >= 50,                   animation: "rainbow" },
];

import DigitalRainBanner    from "./DigitalRainBanner";
import LightsaberDuelBanner from "./LightsaberDuelBanner";
import ArcadeBanner         from "./ArcadeBanner";
import HyperdriveBanner     from "./HyperdriveBanner";
import NorthernLightsBanner from "./NorthernLightsBanner";
import VoidCollapseBanner   from "./VoidCollapseBanner";
import LavaFlowBanner       from "./LavaFlowBanner";
import ParticleWebBanner    from "./ParticleWebBanner";
import InkDropBanner        from "./InkDropBanner";
import ThunderStormBanner   from "./ThunderStormBanner";
import NeonPulseBanner      from "./NeonPulseBanner";
import DeepSeaBanner        from "./DeepSeaBanner";
import PrismaticLightBanner from "./PrismaticLightBanner";
import SandDunesBanner      from "./SandDunesBanner";
import EmberPhoenixBanner   from "./EmberPhoenixBanner";
import CrystalCaveBanner    from "./CrystalCaveBanner";
import HackerTerminalBanner from "./HackerTerminalBanner";
import TidalSurgeBanner     from "./TidalSurgeBanner";
import SolarWindBanner      from "./SolarWindBanner";
import LavaLampBanner       from "./LavaLampBanner";

const BANNERS: {
  id: string; label: string; gradient: string;
  component?: React.ComponentType<{ style?: React.CSSProperties }>;
  unlockDesc: string; condition: (p: any) => boolean;
}[] = [
  { id: "default",         label: "Default",         gradient: "linear-gradient(135deg,#1a1a2e,#16213e)", unlockDesc: "Default banner",       condition: () => true },
  { id: "digital_rain",    label: "Digital Rain",    gradient: "linear-gradient(135deg,#000702,#14532d)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("digital_rain"),    component: DigitalRainBanner },
  { id: "lightsaber_duel", label: "Lightsaber Duel", gradient: "linear-gradient(135deg,#06020e,#0d0520)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("lightsaber_duel"), component: LightsaberDuelBanner },
  { id: "arcade",          label: "Arcade",          gradient: "linear-gradient(135deg,#000010,#000520)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("arcade"),          component: ArcadeBanner },
  { id: "hyperdrive",      label: "Hyperdrive",      gradient: "linear-gradient(135deg,#02030e,#05041a)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("hyperdrive"),      component: HyperdriveBanner },
  { id: "northern_lights", label: "Northern Lights", gradient: "linear-gradient(135deg,#000c12,#010f18)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("northern_lights"), component: NorthernLightsBanner },
  { id: "void_collapse",   label: "Void Collapse",   gradient: "linear-gradient(135deg,#02010c,#0a0518)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("void_collapse"),   component: VoidCollapseBanner },
  { id: "lava_flow",       label: "Lava Flow",       gradient: "linear-gradient(135deg,#060100,#200400)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("lava_flow"),       component: LavaFlowBanner },
  { id: "particle_web",    label: "Particle Web",    gradient: "linear-gradient(135deg,#060810,#0b1030)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("particle_web"),    component: ParticleWebBanner },
  { id: "ink_drop",        label: "Ink Drop",        gradient: "linear-gradient(135deg,#f6f4f0,#fafaf7)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("ink_drop"),        component: InkDropBanner },
  { id: "thunder_storm",   label: "Thunder Storm",   gradient: "linear-gradient(135deg,#060810,#080e20)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("thunder_storm"),   component: ThunderStormBanner },
  { id: "neon_pulse",      label: "Neon Pulse",      gradient: "linear-gradient(135deg,#04020c,#0c0520)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("neon_pulse"),      component: NeonPulseBanner },
  { id: "deep_sea",        label: "Deep Sea",        gradient: "linear-gradient(135deg,#00020a,#00061a)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("deep_sea"),        component: DeepSeaBanner },
  { id: "prismatic_light", label: "Prismatic Light", gradient: "linear-gradient(135deg,#f0f2f8,#f8fafc)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("prismatic_light"), component: PrismaticLightBanner },
  { id: "sand_dunes",      label: "Sand Dunes",      gradient: "linear-gradient(135deg,#c47820,#e8a830)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("sand_dunes"),      component: SandDunesBanner },
  { id: "ember_phoenix",   label: "Ember Phoenix",   gradient: "linear-gradient(135deg,#040100,#1c0400)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("ember_phoenix"),   component: EmberPhoenixBanner },
  { id: "crystal_cave",    label: "Crystal Cave",    gradient: "linear-gradient(135deg,#080515,#0e0820)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("crystal_cave"),    component: CrystalCaveBanner },
  { id: "hacker_terminal", label: "Hacker Terminal", gradient: "linear-gradient(135deg,#010804,#021408)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("hacker_terminal"), component: HackerTerminalBanner },
  { id: "tidal_surge",     label: "Tidal Surge",     gradient: "linear-gradient(135deg,#010c1a,#002040)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("tidal_surge"),     component: TidalSurgeBanner },
  { id: "solar_wind",      label: "Solar Wind",      gradient: "linear-gradient(135deg,#060200,#130500)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("solar_wind"),      component: SolarWindBanner },
  { id: "lava_lamp",       label: "Lava Lamp",       gradient: "linear-gradient(135deg,#0e0500,#1c0800)", unlockDesc: "Purchase for 299 PC",  condition: (p:any) => (p?.purchased_items||[]).includes("lava_lamp"),       component: LavaLampBanner },
];

export const PROFILE_BORDERS: {
  id: string; label: string; tier: "basic"|"rare"|"epic"|"legendary";
  css: string;
  glowColor: string;
  unlockDesc: string;
  condition: (profile: any) => boolean;
  animation: "none" | "pulse" | "spin" | "rainbow" | "fire" | "electric";
}[] = [
  { id: "none",          label: "No Border",       tier: "basic",
    css: "none", glowColor: "#9CA3AF",
    unlockDesc: "Default — no border",
    condition: () => true,                          animation: "none" },
];

const TIER_COLOR: Record<string, string> = {
  basic: "#9CA3AF", rare: "#60A5FA", epic: "#A78BFA", legendary: "#F59E0B",
};



function TitleBadge({ title, onClick }: { title: typeof TITLES[0]; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`title-anim-${title.animation}`}
      style={{ padding:"4px 20px", borderRadius:40, border:`2px solid ${title.color}44`, background:`${title.color}12`, cursor:onClick?"pointer":"default", transition:"all 0.15s", display:"inline-flex", alignItems:"center" }}>
      <span style={{ fontFamily:"var(--font-mono, monospace)", fontSize:22, fontWeight:700, color:title.color, letterSpacing:"0.08em" }}>{title.label}</span>
    </div>
  );
}

function resolveAvatar(p: any): string | undefined {
  return p?.avatar || p?.avatar_url || p?.profile_avatar || undefined;
}

function AvatarWithBorder({ profile, size=68, borderDef, accentColor, bgColor, p1, p2 }: {
  profile: any; size?: number; borderDef: typeof PROFILE_BORDERS[0];
  accentColor: string; bgColor: string; p1: string; p2: string;
}) {
  const isNoBorder = borderDef.id === "none";
  const isRainbow  = borderDef.id === "rainbow_halo";
  const animClass  = isNoBorder ? "" : `border-anim-${borderDef.animation}`;
  let shadow = "none";
  if (!isNoBorder) shadow = isRainbow ? "0 0 0 3px #FF6B6B, 0 0 0 6px #FFD700, 0 0 20px #FF6B6BAA" : borderDef.css;
  return (
    <div className={animClass} style={{ width:size, height:size, borderRadius:"50%", background:`linear-gradient(135deg,${p1},${p2})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.41, border:`3px solid ${bgColor}`, overflow:"hidden", boxShadow:shadow, position:"relative", flexShrink:0 }}>
      {resolveAvatar(profile) ? <img src={resolveAvatar(profile)!} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : "👤"}
    </div>
  );
}

type EditTab = "profile" | "banner" | "border" | "title" | "password" | "email";
interface Props { themeId: ThemeId; onHoverAction?: () => void; onClickAction?: () => void; setScreenAction: (s: Screen) => void; initialEditMode?: boolean; }

const LockSVG = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export default function ProfileScreen({ themeId, onHoverAction, onClickAction, setScreenAction, initialEditMode }: Props) {
  const t = THEMES[themeId];
  const router = useRouter();
  const { user, token, updateUser } = useAuthStore();
  const bannerShineEnabled = useBannerShineEnabled((user as any)?.id ?? (user as any)?._id ?? null);
  const [profile, setProfile]             = useState<any>(null);
  const [missionShardBonus, setMissionShardBonus] = useState(0);
  const [loading, setLoading]             = useState(true);
  const [profileError, setProfileError]   = useState<string | null>(null);
  const [profileFetchKey, setProfileFetchKey] = useState(0);
  // Single source of truth for the displayed banner — always driven by
  // localStorage so it stays in sync with CareerScreen, GameScreen, etc.
  const [displayBannerId, setDisplayBannerId] = useState<string>(
    () => loadCustomTheme().bannerSkin || "default"
  );

  const [twoFASection, setTwoFASection]   = useState<"idle"|"setup"|"disable">("idle");
  const [qrCode, setQrCode]               = useState("");
  const [secret, setSecret]               = useState("");
  const [totpInput, setTotpInput]         = useState("");
  const [twoFALoading, setTwoFALoading]   = useState(false);
  const [twoFAMsg, setTwoFAMsg]           = useState<{text:string;ok:boolean}|null>(null);
  const [twoFAReady, setTwoFAReady]       = useState(false);

  const [showEdit, setShowEdit]           = useState(!!initialEditMode);
  const [editTab, setEditTab]             = useState<EditTab>("profile");
  const [editMsg, setEditMsg]             = useState<{text:string;ok:boolean}|null>(null);
  const [editLoading, setEditLoading]     = useState(false);

  const [editBio, setEditBio]             = useState("");
  const [editUsername, setEditUsername]   = useState("");

  // ── Avatar state — File object + local preview URL, never base64 ──────────
  const [avatarFile, setAvatarFile]       = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [editBanner, setEditBanner]       = useState<string>("default");
  const [editBorder, setEditBorder]       = useState<string>("none");
  const [editTitle, setEditTitle]         = useState<string>("newcomer");

  const [pwCurrent, setPwCurrent]         = useState("");
  const [pwNew, setPwNew]                 = useState("");
  const [pwConfirm, setPwConfirm]         = useState("");
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew]         = useState(false);
  const [pwTotpStep, setPwTotpStep]       = useState<"idle"|"awaiting_otp">("idle");
  const [pwOtpCode, setPwOtpCode]         = useState("");

  const [emailNew, setEmailNew]           = useState("");
  const [emailPw, setEmailPw]             = useState("");
  const [showEmailPw, setShowEmailPw]     = useState(false);
  const [emailTotpStep, setEmailTotpStep] = useState<"idle"|"awaiting_otp">("idle");
  const [emailOtpCode, setEmailOtpCode]   = useState("");

  // ── Delete account ─────────────────────────────────────────────────────────
  const [showDeleteZone, setShowDeleteZone]   = useState(false);
  const [deletePw, setDeletePw]               = useState("");
  const [deleteLoading, setDeleteLoading]     = useState(false);
  const [deleteMsg, setDeleteMsg]             = useState<{text:string;ok:boolean}|null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const resolveAvatar = (p: any): string | undefined =>
    p?.avatar || p?.avatar_url || p?.profile_avatar || undefined;

  useEffect(() => {
    if (!user) { setLoading(false); setProfileError(null); return; }
    setProfileError(null);
    setProfile((p: any) => p ?? { ...user, totp_enabled: (user as any)?.totp_enabled ?? false });
    setTwoFAReady(true);
    setLoading(false);
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const res = await API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
        if (cancelled) return;
        setProfile(res.data);
        updateUser(res.data);
        setTwoFAReady(true);
        // Keep localStorage in sync with the API value.
        // If the user has never equipped a banner locally (still "default"),
        // adopt the API value so all screens agree on first load.
        // If localStorage already has a custom value, trust it (it's more recent).
        const ct = loadCustomTheme();
        const localSkin = ct.bannerSkin || "default";
        const apiSkin   = res.data?.banner || "default";
        if (localSkin === "default" && apiSkin !== "default") {
          saveCustomTheme({ ...ct, bannerSkin: apiSkin });
          setDisplayBannerId(apiSkin);
          window.dispatchEvent(new Event("pp_custom_theme_changed"));
        } else {
          setDisplayBannerId(localSkin);
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.code === "ECONNABORTED" ? "Request timed out." : e?.message || "Could not load profile.";
        if (!user) setProfileError(msg);
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, [user, profileFetchKey]);

  // When Edit Profile opens with `initialEditMode` (/profile/edit), `openEdit`
  // never runs — so username/bio/banner fields stay empty until we sync from
  // `profile` once it exists. Same transition logic covers a late API fetch
  // after the modal is already visible.
  const editModalSyncedRef = useRef(false);
  useEffect(() => {
    if (!showEdit) {
      editModalSyncedRef.current = false;
      return;
    }
    if (!profile) return;

    const shouldSeed = !editModalSyncedRef.current;
    if (!shouldSeed) return;

    editModalSyncedRef.current = true;
    setEditBio(profile.bio || "");
    const u = profile.username || (user as { username?: string } | null)?.username || "";
    setEditUsername(u);
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditBanner(profile.banner || "default");
    setEditBorder(profile.border_style || "none");
    setEditTitle(profile.title || "newcomer");
  }, [showEdit, profile, user]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) {
      setMissionShardBonus(0);
      return;
    }
    const userKey = getUserKey(user);
    let last = -1;
    const refresh = () => {
      const v = loadMissionState(userKey).shardBalance || 0;
      if (v !== last) {
        last = v;
        setMissionShardBonus(v);
      }
    };
    refresh();
    window.addEventListener("pp_mission_state_change", refresh);
    window.addEventListener("storage", refresh);
    const pollId = window.setInterval(refresh, 2000);
    return () => {
      window.removeEventListener("pp_mission_state_change", refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(pollId);
    };
  }, [user]);

  // Sync banner whenever CollectionScreen or any other screen equips
  // something — they all fire "pp_custom_theme_changed".
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      const skin = loadCustomTheme().bannerSkin || "default";
      setDisplayBannerId(skin);
      setProfile((p: any) => p ? { ...p, banner: skin } : p);
    };
    window.addEventListener("pp_custom_theme_changed", sync);
    return () => window.removeEventListener("pp_custom_theme_changed", sync);
  }, []);

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background: themeId === "space" ? "transparent" : t.bg }}>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted }}>Loading…</div>
    </div>
  );
  if (!user) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background: themeId === "space" ? "transparent" : t.bg }}>
      <div style={{ fontFamily:t.fontDisplay, fontSize:24, color:t.textMuted }}>Sign in to view your profile</div>
    </div>
  );
  if (!profile) return null;

  const elo      = profile.elo || 500;
  const placementCount = profile.placement_matches || 0;
  const isPlacement = placementCount < 5;
  const placementCol = "#FF33FF";
  const rank     = getRank(elo, isPlacement);
  const nextRank = RANKS[RANKS.indexOf(rank) + 1] || null;
  const progress = nextRank ? ((elo - rank.min) / (rank.max - rank.min)) * 100 : 100;
  
  // For placement matches bar
  const placementPct = (placementCount / 5) * 100;
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const activeTitle     = TITLES.find(ti => ti.id === (profile.title || "newcomer")) || TITLES[0];
  const activeBanner    = BANNERS.find(b => b.id === displayBannerId) || BANNERS[0];
  const activeBorderDef = PROFILE_BORDERS.find(b => b.id === (profile.border_style || "none")) || PROFILE_BORDERS[0];

  // ── 2FA helpers ───────────────────────────────────────────────────────────
  const start2FASetup = async () => {
    setTwoFALoading(true); setTwoFAMsg(null);
    try {
      const r = await API.post("/api/auth/2fa/setup", {}, authHeader);
      setQrCode(r.data.qr_code); setSecret(r.data.secret);
      setTwoFASection("setup");
    } catch (e: unknown) {
      setTwoFAMsg({ text: apiErrorDetail(e, "Failed to start setup"), ok: false });
    } finally { setTwoFALoading(false); }
  };
  const confirm2FA = async () => {
    if (totpInput.trim().length !== 6) { setTwoFAMsg({ text:"Enter the 6-digit code", ok:false }); return; }
    setTwoFALoading(true); setTwoFAMsg(null);
    try {
      await API.post("/api/auth/2fa/confirm", { code: totpInput.trim() }, authHeader);
      setTwoFAMsg({ text:"2FA enabled!", ok:true });
      setTwoFASection("idle");
      setProfile((p: any) => ({ ...p, totp_enabled: true }));
      setTotpInput("");
    } catch (e: unknown) {
      setTwoFAMsg({ text: apiErrorDetail(e, "Invalid code"), ok:false });
    } finally { setTwoFALoading(false); }
  };
  const disable2FA = async () => {
    if (totpInput.trim().length !== 6) { setTwoFAMsg({ text:"Enter code to confirm", ok:false }); return; }
    setTwoFALoading(true); setTwoFAMsg(null);
    try {
      await API.post("/api/auth/2fa/disable", { code: totpInput.trim() }, authHeader);
      setTwoFAMsg({ text:"2FA disabled.", ok:true });
      setTwoFASection("idle");
      setProfile((p: any) => ({ ...p, totp_enabled: false }));
      setTotpInput("");
    } catch (e: unknown) {
      setTwoFAMsg({ text: apiErrorDetail(e, "Invalid code"), ok:false });
    } finally { setTwoFALoading(false); }
  };

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const openEdit = (tab: EditTab = "profile") => {
    setEditBio(profile.bio || "");
    setEditUsername(
      profile.username || (user as { username?: string } | null)?.username || "",
    );
    // Reset avatar state — never carry over old base64
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditBanner(profile.banner || "default");
    setEditBorder(profile.border_style || "none");
    setEditTitle(profile.title || "newcomer");
    setPwCurrent(""); setPwNew(""); setPwConfirm("");
    setPwTotpStep("idle"); setPwOtpCode("");
    setEmailNew(""); setEmailPw("");
    setEmailTotpStep("idle"); setEmailOtpCode("");
    setEditMsg(null);
    setEditTab(tab);
    // Skip the useEffect duplicate seed on the same tick as setShowEdit(true)
    editModalSyncedRef.current = true;
    setShowEdit(true);
    if (typeof window !== "undefined" && window.location.pathname !== "/profile/edit") {
      router.push("/profile/edit");
    }
  };

  const closeEdit = () => {
    setShowEdit(false);
    setEditMsg(null);
    if (typeof window !== "undefined" && window.location.pathname === "/profile/edit") {
      router.push("/profile");
    }
  };

  // ── Avatar file handler — stores File object + blob URL preview only ─────
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
      setEditMsg({ text:"Only JPEG, PNG or WebP allowed", ok:false }); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setEditMsg({ text:"Image must be under 2MB", ok:false }); return;
    }
    // Revoke previous preview URL to avoid memory leaks
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file)); // local preview only — never base64
  };

  // ── Submit profile — uploads file to Supabase, saves URL to MongoDB ───────
  const submitProfile = async () => {
    setEditMsg(null);
    if (editUsername !== profile.username) {
      const err = validateUsername(editUsername);
      if (err) { setEditMsg({ text:err, ok:false }); return; }
    }
    if (containsProfanity(editBio)) {
      setEditMsg({ text:"Bio contains inappropriate content", ok:false }); return;
    }
    setEditLoading(true);
    try {
      let avatarUrl: string | null = null;

      let avatarSkipped = false;
      if (avatarFile) {
        const sb = getSupabase();
        if (!sb) {
          avatarSkipped = true;
        } else {
          // Use user ID as filename so each user always overwrites their own avatar
          const userId = (user as any)?.id ?? (user as any)?._id ?? Date.now().toString();
          const ext    = avatarFile.name.split(".").pop() || "jpg";
          const path   = `${userId}.${ext}`;

          try {
            const { data: uploadData, error: uploadError } = await sb.storage
              .from("avatars")
              .upload(path, avatarFile, {
                upsert: true,           // overwrite existing avatar
                contentType: avatarFile.type,
              });

            if (uploadError) {
              throw new Error(formatSupabaseUploadError(uploadError.message));
            }

            // Get permanent public URL — just a short string, not base64
            const { data: urlData } = sb.storage.from("avatars").getPublicUrl(uploadData.path);

            // Add cache-busting so the browser picks up the new image immediately
            avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
          } catch (uploadErr: unknown) {
            const msg =
              uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
            throw new Error(formatSupabaseUploadError(msg));
          }
        }
      }

      const payload: any = {};
      if (editUsername !== profile.username)  payload.username = editUsername;
      if (editBio !== (profile.bio || ""))    payload.bio      = editBio;
      if (avatarUrl)                          payload.avatar   = avatarUrl; // short URL ✅

      if (!Object.keys(payload).length) {
        if (avatarSkipped) {
          setEditMsg({
            text: "Photo uploads aren’t available on this site yet. Remove the new image or save your other changes (username / bio).",
            ok: false,
          });
          return;
        }
        closeEdit();
        return;
      }

      const res = await API.put("/api/profile/me", payload, authHeader);
      setProfile(res.data);
      updateUser(res.data);
      setEditMsg({
        text: avatarSkipped
          ? "Profile updated. Your new photo couldn’t be saved — photo uploads aren’t enabled on this deployment yet."
          : "Profile updated!",
        ok: true,
      });
      // Clean up local preview
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview(null);
      setTimeout(() => closeEdit(), 900);
    } catch (e: any) {
      setEditMsg({ text: e.response?.data?.detail || e.message || "Update failed", ok:false });
    } finally { setEditLoading(false); }
  };

  const submitBanner = async () => {
    setEditMsg(null); setEditLoading(true);
    try {
      const res = await API.put("/api/profile/me", { banner: editBanner }, authHeader);
      setProfile(res.data);
      updateUser(res.data);
      const cur = loadCustomTheme();
      saveCustomTheme({ ...cur, bannerSkin: editBanner });
      window.dispatchEvent(new Event("pp_custom_theme_changed"));
      setEditMsg({ text:"Banner updated!", ok:true });
      setTimeout(() => closeEdit(), 900);
    } catch(e:any) {
      setEditMsg({ text: e.response?.data?.detail || "Update failed", ok:false });
    } finally { setEditLoading(false); }
  };

  const submitBorder = async () => {
    setEditMsg(null); setEditLoading(true);
    try {
      const res = await API.put("/api/profile/me", { border_style: editBorder }, authHeader);
      setProfile(res.data);
      setEditMsg({ text:"Border equipped!", ok:true });
      setTimeout(() => closeEdit(), 900);
    } catch(e:any) {
      setEditMsg({ text: e.response?.data?.detail || "Update failed", ok:false });
    } finally { setEditLoading(false); }
  };

  const submitTitle = async () => {
    setEditMsg(null); setEditLoading(true);
    try {
      const res = await API.put("/api/profile/me", { title: editTitle }, authHeader);
      setProfile(res.data);
      setEditMsg({ text:"Badge equipped!", ok:true });
      setTimeout(() => closeEdit(), 900);
    } catch(e:any) {
      setEditMsg({ text: e.response?.data?.detail || "Update failed", ok:false });
    } finally { setEditLoading(false); }
  };

  const submitPassword = async () => {
    setEditMsg(null);
    if (!enabled) { setEditMsg({ text:"You must enable Two-Factor Authentication (2FA) before changing your password.", ok:false }); return; }
    if (!pwCurrent) { setEditMsg({ text:"Enter your current password", ok:false }); return; }
    if (pwNew.length < 8) { setEditMsg({ text:"New password must be at least 8 characters", ok:false }); return; }
    if (pwNew !== pwConfirm) { setEditMsg({ text:"New passwords do not match", ok:false }); return; }
    if (pwTotpStep === "idle") {
      setEditLoading(true);
      try {
        await API.post("/api/otp/change-password/send", {}, authHeader);
        setPwTotpStep("awaiting_otp");
        setEditMsg({ text:"A 6-digit OTP has been sent to your email.", ok:true });
      } catch(e:any) {
        setEditMsg({ text: e.response?.data?.detail || "Failed to send OTP", ok:false });
      } finally { setEditLoading(false); }
      return;
    }
    if (pwOtpCode.trim().length !== 6) { setEditMsg({ text:"Enter the 6-digit OTP sent to your email", ok:false }); return; }
    setEditLoading(true);
    try {
      await API.post("/api/otp/change-password/verify", { current_password:pwCurrent, new_password:pwNew, otp:pwOtpCode.trim() }, authHeader);
      setEditMsg({ text:"Password changed successfully!", ok:true });
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setPwTotpStep("idle"); setPwOtpCode("");
    } catch(e:any) {
      setEditMsg({ text: e.response?.data?.detail || "Failed to change password", ok:false });
      setPwTotpStep("idle"); setPwOtpCode("");
    } finally { setEditLoading(false); }
  };

  const submitEmail = async () => {
    setEditMsg(null);
    if (!enabled) { setEditMsg({ text:"You must enable Two-Factor Authentication (2FA) before changing your email.", ok:false }); return; }
    if (!emailNew || !emailNew.includes("@")) { setEditMsg({ text:"Enter a valid email address", ok:false }); return; }
    if (emailTotpStep === "idle") {
      setEditLoading(true);
      try {
        await API.post("/api/otp/change-email/send", { new_email: emailNew }, authHeader);
        setEmailTotpStep("awaiting_otp");
        setEditMsg({ text:`A 6-digit OTP has been sent to ${emailNew}.`, ok:true });
      } catch(e:any) {
        setEditMsg({ text: e.response?.data?.detail || "Failed to send OTP", ok:false });
      } finally { setEditLoading(false); }
      return;
    }
    if (emailOtpCode.trim().length !== 6) { setEditMsg({ text:"Enter the 6-digit OTP sent to your new email", ok:false }); return; }
    setEditLoading(true);
    try {
      await API.post("/api/otp/change-email/verify", { new_email:emailNew, otp:emailOtpCode.trim() }, authHeader);
      setEditMsg({ text:"Email updated successfully!", ok:true });
      setEmailNew(""); setEmailPw("");
      setEmailTotpStep("idle"); setEmailOtpCode("");
      const res = await API.get("/api/profile/me", authHeader);
      setProfile(res.data);
      updateUser(res.data);
    } catch(e:any) {
      setEditMsg({ text: e.response?.data?.detail || "Failed to update email", ok:false });
      setEmailTotpStep("idle"); setEmailOtpCode("");
    } finally { setEditLoading(false); }
  };

  const enabled = Boolean((profile as any)?.totp_enabled ?? (user as any)?.totp_enabled);

  const rankedW   = profile.wins            || 0;
  const rankedL   = profile.losses          || 0;
  const draws     = profile.draws           || 0;
  const totalGames = rankedW + rankedL + draws;
  const userXp = Number(profile.xp || 0);
  const userLevel = Number(profile.level || 1);
  const { level: computedLevelFromXp } = computeLevelProgress(userLevel, userXp);

  const stats = [
    { l:"Ranked W",    v: rankedW,   c:"#5BE888" },
    { l:"Ranked L",    v: rankedL,   c: t.danger },
    { l:"Win Rate",    v: rankedW + rankedL > 0 ? `${Math.round((rankedW/(rankedW+rankedL))*100)}%` : "0%", c: t.accent },
    { l:"Total Games", v: totalGames, c: t.text },
    { l:"Draws",       v: draws,     c: t.gold },
    { l:"ELO",         v: isPlacement ? "?" : elo,       c: isPlacement ? placementCol : rank.color },
    { l:"Penta Shards",   v: (profile.pentashards ?? profile.shards ?? 0) + missionShardBonus, c:"#4FC3F7" },
    { l:"Proto Credits",  v: profile.protocredits || 0, c:"#FFD700" },
  ];

  const TABS: { id: EditTab; label: string }[] = [
    { id: "profile",  label: "Profile"  },
    { id: "border",   label: "Border"   },
    { id: "title",    label: "Badges"   },
    { id: "password", label: "Password" },
    { id: "email",    label: "Email"    },
  ];

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"10px 12px",
    background: t.inputBg, border:`1px solid ${t.border}`,
    borderRadius:7, color:t.text,
    fontFamily:t.fontMono, fontSize:14,
    boxSizing:"border-box",
  };

  const pwStrength = (pw: string) => {
    if (!pw) return null;
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label:"Weak",   color:"#EF4444", w:"25%" };
    if (score <= 3) return { label:"Fair",   color:"#F59E0B", w:"55%" };
    if (score <= 4) return { label:"Good",   color:"#60A5FA", w:"78%" };
    return              { label:"Strong", color:"#34D399", w:"100%" };
  };
  const strength = pwStrength(pwNew);

  const previewBorderDef = PROFILE_BORDERS.find(b => b.id === editBorder) || PROFILE_BORDERS[0];
  const previewIsRainbow = previewBorderDef.id === "rainbow_halo";
  const previewShadow    = previewBorderDef.id === "none" ? "none"
    : previewIsRainbow ? "0 0 0 3px #FF6B6B, 0 0 0 6px #FFD700, 0 0 20px #FF6B6BAA"
    : previewBorderDef.css;

  const TwoFARequired = () => (
    <div style={{ background:`${t.danger}10`, border:`1px solid ${t.danger}44`, borderRadius:10, padding:"16px 18px", display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ fontSize:22 }}>🔒</div>
        <div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:14, fontWeight:700, color:t.danger }}>2FA Required</div>
          <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.textMuted, marginTop:2 }}>You must enable Two-Factor Authentication before changing sensitive account details.</div>
        </div>
      </div>
      <button onClick={() => closeEdit()} style={{ padding:"9px 16px", background:`${t.accent}18`, border:`1px solid ${t.accent}`, borderRadius:8, color:t.accent, fontFamily:t.fontDisplay, fontSize:12, fontWeight:700, cursor:"pointer", alignSelf:"flex-start" }}>
        ← Go enable 2FA first
      </button>
    </div>
  );

  return (
    <>
    <style>{`
      .title-anim-none { }
      .title-anim-pulse { animation: titlePulse 2s ease-in-out infinite; }
      @keyframes titlePulse { 0%, 100% { box-shadow: 0 0 0 0 transparent; opacity: 1; } 50% { box-shadow: 0 0 10px 2px var(--tc, #60A5FA); opacity: 0.85; } }
      .title-anim-shimmer { position: relative; overflow: hidden; }
      .title-anim-shimmer::after { content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent); animation: titleShimmer 2.4s ease-in-out infinite; }
      @keyframes titleShimmer { 0% { left: -100%; } 100% { left: 160%; } }
      .title-anim-flicker { animation: titleFlicker 3s linear infinite; }
      @keyframes titleFlicker { 0%,19%,21%,23%,25%,54%,56%,100% { opacity: 1; } 20%,22%,24%,55% { opacity: 0.4; } }
      .title-anim-fire { animation: titleFire 1.5s ease-in-out infinite alternate; }
      @keyframes titleFire { 0% { box-shadow: 0 0 4px #FF3333, 0 0 8px #FF6600; } 100% { box-shadow: 0 0 10px #FF6600, 0 0 20px #FF3333AA; } }
      .title-anim-rainbow { animation: titleRainbow 3s linear infinite; }
      @keyframes titleRainbow { 0% { border-color: #FF6B6B44; } 16% { border-color: #FFD70044; } 33% { border-color: #5BE88844; } 50% { border-color: #60A5FA44; } 66% { border-color: #A78BFA44; } 83% { border-color: #FB718544; } 100% { border-color: #FF6B6B44; } }
      .title-anim-electric { animation: titleElectric 0.8s steps(1) infinite; }
      @keyframes titleElectric { 0%,100% { box-shadow: 0 0 6px #38BDF8, 0 0 12px #A78BFA; } 25% { box-shadow: 0 0 2px #38BDF8; } 50% { box-shadow: 0 0 10px #A78BFA; } 75% { box-shadow: 0 0 4px #38BDF8; } }
      .border-anim-none { }
      .border-anim-pulse { animation: borderPulse 2s ease-in-out infinite; }
      @keyframes borderPulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.5) saturate(1.4); } }
      .border-anim-fire { animation: borderFire 1.5s ease-in-out infinite alternate; }
      @keyframes borderFire { 0% { filter: drop-shadow(0 0 4px #FF3333); } 100% { filter: drop-shadow(0 0 10px #FF6600); } }
      .border-anim-electric { animation: borderElectric 0.6s steps(1) infinite; }
      @keyframes borderElectric { 0%,100% { filter: drop-shadow(0 0 5px #A78BFA); } 50% { filter: drop-shadow(0 0 8px #38BDF8); } }
      .border-anim-rainbow { animation: borderRainbow 3s linear infinite; }
      @keyframes borderRainbow { 0% { filter: drop-shadow(0 0 6px #FF6B6B); } 33% { filter: drop-shadow(0 0 6px #5BE888); } 66% { filter: drop-shadow(0 0 6px #A78BFA); } 100% { filter: drop-shadow(0 0 6px #FF6B6B); } }
      .edit-tab-btn { transition: all 0.18s ease; }
      .edit-tab-btn:hover { opacity: 0.85; }
      .banner-card { transition: transform 0.15s ease; cursor:pointer; }
      .banner-card:hover { transform: translateY(-2px); }
      .title-pill { transition: all 0.15s ease; cursor:pointer; }
      .title-pill:hover { transform: translateY(-1px); }
      .pw-eye { cursor:pointer; user-select:none; opacity:0.5; transition:opacity 0.15s; }
      .pw-eye:hover { opacity:1; }
      .rank-badge-container { position: relative; overflow: visible; }
      .rank-badge-container:hover { transform: scale(1.08); }
      @keyframes shineSweep { from { transform: translateX(-50%); } to { transform: translateX(100%); } }
      /* Mobile-only currency strip at the top of the Profile page. The
         NavBar hides its currency pills on mobile (see NavBar.tsx) so
         this block gives phone users a prominent, always-in-view
         balance without scrolling through the stats grid. Hidden on
         ≥ 640px so the desktop / tablet layout is untouched. */
      .pp-prof-mobile-currencies { display: none; }
      @media (max-width: 639px) {
        .pp-prof-mobile-currencies { display: grid !important; }
      }
    `}</style>

    <div style={{ position:"fixed", inset:0, zIndex:2, padding:"84px 24px 48px", overflowY:"auto", background: themeId === "space" ? "transparent" : t.bg, transition:"background 0.4s" }}>

      {profileError && (
        <div style={{ marginBottom:12, padding:"10px 14px", background:`${t.danger}18`, border:`1px solid ${t.danger}44`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <span style={{ fontFamily:t.fontMono, fontSize:13, color:t.textMuted }}>{profileError} Check your connection.</span>
          <button type="button" onClick={() => { setProfileError(null); setProfileFetchKey(k => k+1); }} style={{ padding:"6px 12px", background:t.accent, border:"none", borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:12, fontWeight:700, cursor:"pointer" }}>Retry</button>
        </div>
      )}

      {/* ── Banner + Avatar + Name ─────────────────────────────────────────── */}
      <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:16, marginBottom:18, overflow:"hidden", position:"relative", minHeight:200 }}>
        <div style={{ position:"absolute", inset:0, zIndex:0, opacity:1.0 }}>
          <BannerRenderer bannerId={activeBanner.id} />
          {bannerShineEnabled && (
            <div style={{ position:"absolute", top:0, left:"-150%", width:"200%", height:"100%", background:"linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.1) 38%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.1) 42%, rgba(255,255,255,0) 50%)", zIndex:1, animation:"shineSweep 4s infinite linear" }} />
          )}
        </div>
        <div onClick={() => { onClickAction?.(); openEdit("banner"); }} style={{ height:100, cursor:"pointer", position:"relative", zIndex:2, overflow:"hidden" }} title="Change banner">
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"flex-end", padding:"0 16px", opacity:0, transition:"opacity 0.2s" }}
            onMouseEnter={e => { onHoverAction?.(); (e.currentTarget as HTMLElement).style.opacity="1"; }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity="0"}>
            <div style={{ background:"rgba(0,0,0,0.6)", border:`1px solid ${t.border}`, borderRadius:6, padding:"4px 12px", fontFamily:t.fontMono, fontSize:11, color:"#fff", letterSpacing:"0.1em" }}>CHANGE BANNER</div>
          </div>
        </div>
        <div style={{ position:"relative", zIndex:3, display:"flex", alignItems:"flex-end", gap:22, padding:"0 26px 26px", flexWrap:"wrap", background:"linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)", height:"100%", boxSizing:"border-box" }}>
          <div style={{ position:"relative", flexShrink:0 }}>
            <AvatarWithBorder profile={profile} size={72} borderDef={activeBorderDef} accentColor={t.accent} bgColor={t.bg} p1={t.p1} p2={t.p2} />
            <div onClick={() => { onClickAction?.(); openEdit("profile"); }} style={{ position:"absolute", bottom:0, right:0, width:24, height:24, borderRadius:"50%", background:t.accent, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:11, border:`2px solid ${t.bg}`, boxShadow:"0 0 10px rgba(0,0,0,0.5)" }}>✏</div>
          </div>
          <div style={{ flex:1, minWidth:150 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:4 }}>
              <div style={{ fontFamily:t.fontDisplay, fontSize:26, fontWeight:700, color:t.text, textShadow:"0 2px 10px rgba(0,0,0,0.8)" }}>{profile.username}</div>
              <TitleBadge title={activeTitle} onClick={() => { onClickAction?.(); openEdit("title"); }} />
            </div>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap", alignItems:"center" }}>
              <div style={{ fontFamily:t.fontMono, fontSize:17, color:t.text, textShadow:"0 1px 4px rgba(0,0,0,0.5)" }}>LVL <span style={{ color:t.accent, fontWeight:700, fontSize:20 }}>{computedLevelFromXp}</span></div>
              <div style={{ display:"flex", alignItems:"center", gap:7, "--rank-col": isPlacement ? placementCol : rank.color } as any}>
                <NavRankBadge rank={rank} size={43} isPlacement={isPlacement} />
                <span style={{ fontFamily:t.fontBody, fontSize:18, color: isPlacement ? placementCol : rank.color, fontWeight:600, textShadow:"0 1px 4px rgba(0,0,0,0.5)" }}>
                  {isPlacement ? "PLACEMENT" : rank.name}
                </span>
              </div>
            </div>
            {profile.bio && <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted, marginTop:6, fontStyle:"italic", textShadow:"0 1px 4px rgba(0,0,0,0.5)" }}>"{profile.bio}"</div>}
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:12, flexShrink:0 }}>
            <button onClick={() => { onClickAction?.(); openEdit("profile"); }}
              style={{ padding:"8px 18px", background:"rgba(0,0,0,0.6)", border:`1px solid ${t.accent}`, borderRadius:8, color:t.accent, fontFamily:t.fontDisplay, fontSize:12, fontWeight:700, cursor:"pointer", backdropFilter:"blur(4px)", transition:"all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background=t.accent; e.currentTarget.style.color="#000"; }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(0,0,0,0.6)"; e.currentTarget.style.color=t.accent; }}>
              ✏ Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* ── Discord community CTA ──────────────────────────────────────────
          Mirrors the home and community-screen Discord buttons so the
          invite is reachable from anywhere a logged-in player normally
          ends up. URL lives in lib/community.ts. */}
      <div style={{
        background: "linear-gradient(135deg, rgba(88,101,242,0.18), rgba(88,101,242,0.06))",
        border: "1px solid rgba(88,101,242,0.55)",
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: 18,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        boxShadow: "0 0 18px rgba(88,101,242,0.18)",
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: "rgba(88,101,242,0.28)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#fff",
          boxShadow: "inset 0 0 12px rgba(88,101,242,0.45)",
        }}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 800, color: t.text, letterSpacing: "0.05em" }}>
            Join the PentaProtocol community
          </div>
          <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            Hop into Discord to find squadmates, get patch notes, and chat with the devs.
          </div>
        </div>
        <button
          type="button"
          onClick={openDiscordInvite}
          onMouseEnter={(e) => {
            onHoverAction?.();
            e.currentTarget.style.background = "#5865F2";
            e.currentTarget.style.boxShadow = "0 0 22px rgba(88,101,242,0.7)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(88,101,242,0.92)";
            e.currentTarget.style.boxShadow = "0 0 14px rgba(88,101,242,0.45)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          style={{
            padding: "10px 18px",
            background: "rgba(88,101,242,0.92)",
            border: "1px solid #5865F2",
            borderRadius: 9,
            color: "#fff",
            fontFamily: t.fontDisplay,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
            boxShadow: "0 0 14px rgba(88,101,242,0.45)",
            transition: "background 160ms ease, box-shadow 160ms ease, transform 160ms ease",
            flexShrink: 0,
          }}
          aria-label="Join the PentaProtocol Discord community (opens in a new tab)"
        >
          Join Discord ↗
        </button>
      </div>

      {/* ── ELO Progress bar ──────────────────────────────────────────────── */}
      <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px", marginBottom:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:9, flexWrap:"wrap", gap:6, alignItems:"center" }}>
          <span style={{ display:"flex", alignItems:"center", gap:8, fontFamily:t.fontDisplay, fontSize:17, color: isPlacement ? placementCol : rank.color, fontWeight:800, letterSpacing:"0.05em", "--rank-col": isPlacement ? placementCol : rank.color } as any}>
            <NavRankBadge rank={rank} size={42} isPlacement={isPlacement} />
            {isPlacement ? "PLACEMENT IN PROGRESS" : rank.name}
          </span>
          {!isPlacement && nextRank && (
            <span style={{ display:"flex", alignItems:"center", gap:7, fontFamily:t.fontDisplay, fontSize:15, color:t.text, fontWeight:700, "--rank-col":nextRank.color } as any}>
              <NavRankBadge rank={nextRank} size={36} isPlacement={false} />{nextRank.name}
              {rank.name === nextRank.name
                ? <span style={{ color:t.accent }}>&nbsp;· MAX RANK</span>
                : <span style={{ color:t.accent }}>&nbsp;· {rank.max - elo} ELO away</span>}
            </span>
          )}
          {isPlacement && (
            <span style={{ fontFamily:t.fontDisplay, fontSize:14, color:t.accent, fontWeight:700 }}>
              {5 - placementCount} MATCHES REMAINING
            </span>
          )}
        </div>
        <div style={{ height:10, background:t.bgCard, borderRadius:5, overflow:"hidden", border:`1px solid ${t.border}` }}>
          <div style={{ height:"100%", width:`${isPlacement ? (placementCount/5)*100 : progress}%`, background: isPlacement ? `linear-gradient(90deg, #9CA3AF, ${placementCol})` : `linear-gradient(90deg,${rank.color},${t.accent})`, borderRadius:5, boxShadow:`0 0 10px ${isPlacement ? placementCol : rank.color}55`, transition:"width 1s ease" }} />
        </div>
        <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, marginTop:5, textAlign:"right" }}>
          {isPlacement ? `${placementCount} / 5` : `${elo} / ${nextRank ? rank.max : "MAX"}`}
        </div>
      </div>

      {/* ── Mobile-only currency strip ─────────────────────────────────────
          Shown only on narrow viewports (see ``.pp-prof-mobile-currencies``
          in the <style> block above). Duplicates the Penta Shards / Proto
          Credits balances that now live in the stats grid below so mobile
          users see them at a glance. The nav bar's currency pills are
          hidden on mobile to keep the top bar uncluttered. */}
      <div
        className="pp-prof-mobile-currencies"
        style={{
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: (themeId === "classic_light" ? SHARDS_LIGHT_SVG : SHARDS_DARK_SVG).replace('<svg ', '<svg width="36" height="36" ') }} />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: "#4FC3F7", lineHeight: 1.1 }}>
              {((profile.pentashards ?? profile.shards ?? 0) + missionShardBonus).toLocaleString()}
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.12em", fontWeight: 600 }}>PENTA SHARDS</div>
          </div>
        </div>
        <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: (themeId === "classic_light" ? PROTO_LIGHT_SVG : PROTO_DARK_SVG).replace('<svg ', '<svg width="36" height="36" ') }} />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: "#FFD700", lineHeight: 1.1 }}>
              {(profile.protocredits || 0).toLocaleString()}
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.12em", fontWeight: 600 }}>PROTO CREDITS</div>
          </div>
        </div>
      </div>

      {/* ── XP / Level bar ───────────────────────────────────────────────── */}
      {(() => {
        const { level: lvl, rem: xpIntoLevel, nextXp: xpNeeded, progress } = computeLevelProgress(userLevel, userXp);
        const pct = Math.min(progress, 100);
        return (
          <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px", marginBottom:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle at 32% 28%, rgba(139,0,0,0.42), rgba(26,5,5,0.92))",
                    border: "2px solid #8B0000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: t.fontDisplay,
                    fontSize: 22,
                    fontWeight: 900,
                    color: "#B91C1C",
                    boxShadow:
                      "0 0 12px rgba(139,0,0,0.95), 0 0 26px rgba(91,0,0,0.65), inset 0 0 14px rgba(0,0,0,0.55)",
                    textShadow:
                      "0 0 2px #0a0a0a, 0 0 4px #0a0a0a, 0 0 10px rgba(139,0,0,0.95), 0 0 20px rgba(91,0,0,0.75)",
                  }}
                >
                  {lvl}
                </div>
                <div
                  style={{
                    fontFamily: t.fontMono,
                    fontSize: 20,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    color: "#B91C1C",
                    textShadow:
                      "0 0 2px #0a0a0a, 0 0 4px #0a0a0a, 0 0 10px rgba(139,0,0,0.9), 0 0 22px rgba(91,0,0,0.55)",
                  }}
                >
                  LEVEL {lvl}
                </div>
              </div>
              <div style={{ fontFamily:t.fontMono, fontSize:18, color:"#FFFFFF", lineHeight:1.1 }}>
                <span style={{ color:"#FFFFFF", fontWeight:700 }}>{xpIntoLevel.toLocaleString()}</span>{" / "}{xpNeeded.toLocaleString()} XP
              </div>
            </div>
            <div style={{ height:10, background:t.bgCard, borderRadius:5, overflow:"hidden", border:`1px solid ${t.border}` }}>
              <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${t.accent},${t.p1})`, borderRadius:5, boxShadow:`0 0 10px ${t.accentGlow}55`, transition:"width 1s ease" }} />
            </div>
            <div style={{ fontFamily:t.fontMono, fontSize:17, color:"#FFFFFF", marginTop:10, textAlign:"right", lineHeight:1.15 }}>
              Level Progress: {xpIntoLevel.toLocaleString()} / {xpNeeded.toLocaleString()} · {(xpNeeded - xpIntoLevel).toLocaleString()} XP to level {lvl + 1}
            </div>
          </div>
        );
      })()}

      {/* ── Stats grid ────────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(136px,1fr))", gap:12, marginBottom:18 }}>
        {stats.map((s, i) => {
          const isPenta = s.l === "Penta Shards";
          const isProto = s.l === "Proto Credits";
          return (
            <div key={i} style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:10, padding:"15px 17px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ fontFamily:t.fontDisplay, fontSize:24, fontWeight:700, color:s.c }}>{s.v}</div>
                {isPenta && <div style={{ width:32, height:32, flexShrink:0 }} dangerouslySetInnerHTML={{ __html: (themeId==="classic_light"?SHARDS_LIGHT_SVG:SHARDS_DARK_SVG).replace('<svg ','<svg width="32" height="32" ') }} />}
                {isProto && <div style={{ width:32, height:32, flexShrink:0 }} dangerouslySetInnerHTML={{ __html: (themeId==="classic_light"?PROTO_LIGHT_SVG:PROTO_DARK_SVG).replace('<svg ','<svg width="32" height="32" ') }} />}
              </div>
              <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.text, letterSpacing:"0.08em", fontWeight:600 }}>{s.l.toUpperCase()}</div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom row: Rank Ladder + Security ────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:14, alignItems:"start" }}>
        <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px" }}>
          <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.text, letterSpacing:"0.15em", marginBottom:12, fontWeight:600 }}>RANK LADDER · SEASON II</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {RANKS.map((r, i) => {
              const isUnranked = r.name === "UNRANKED";
              const isActive = isPlacement ? isUnranked : (r.name === rank.name);
              return (
                <div key={r.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", borderRadius: 12,
                  background: isActive ? `${r.color}15` : "transparent",
                  border: `1px solid ${isActive ? r.color + "44" : "rgba(255,255,255,0.06)"}`,
                  boxShadow: isActive ? `0 0 20px ${r.color}11` : "none",
                  transition: "all 0.3s ease",
                  opacity: 1
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    {isUnranked ? (
                      <NavRankBadge rank={r} size={28} isPlacement={true} />
                    ) : (
                      <div style={{
                        width: 28,
                        height: 28,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "visible",
                        position: "relative",
                      }}>
                        <img
                          src={r.img!}
                          style={{
                            width: ["ROOKIE", "SKILLED", "MYTHIC"].includes(r.name) ? 41 : 28,
                            height: ["ROOKIE", "SKILLED", "MYTHIC"].includes(r.name) ? 41 : 28,
                            objectFit: "contain",
                            filter: isActive ? `drop-shadow(0 0 8px ${r.color}aa)` : "none",
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            pointerEvents: "none",
                          }}
                        />
                      </div>
                    )}
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: isActive ? 800 : 700, color: isActive ? r.color : t.textSecondary, letterSpacing: "0.05em" }}>
                      {r.name}
                    </div>
                  </div>
                  <div style={{ fontFamily: t.fontMono, fontSize: 13, fontWeight: 700, color: isActive ? r.color : t.textMuted }}>
                    {isUnranked ? "?" : (r.max >= 1000000 ? `${r.min} and greater` : `${r.min} to ${r.max}`)}
                  </div>
                  {isActive && <div style={{ background:`${r.color}18`, border:`1px solid ${r.color}`, color:r.color, fontFamily:t.fontMono, fontSize:11, padding:"3px 10px", borderRadius:10, fontWeight:700, marginLeft: 12 }}>YOU</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div id="display" style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px", scrollMarginTop:80 }}>
          <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.text, letterSpacing:"0.15em", marginBottom:12, fontWeight:600 }}>DISPLAY</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <div>
              <div style={{ fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, color:t.text, marginBottom:3 }}>Banner shine</div>
              <div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted }}>Diagonal highlight on profile, career, match-found, and in-match banners.</div>
            </div>
            <button
              type="button"
              onClick={() => { onClickAction?.(); saveBannerShineEnabled(!bannerShineEnabled); }}
              style={{
                padding:"10px 18px",
                borderRadius:10,
                border:`2px solid ${bannerShineEnabled ? t.accent : t.border}`,
                background: bannerShineEnabled ? `${t.accent}22` : "transparent",
                color: bannerShineEnabled ? t.accent : t.textMuted,
                fontFamily:t.fontDisplay,
                fontSize:14,
                fontWeight:900,
                cursor:"pointer",
                flexShrink:0,
                letterSpacing:"0.06em",
              }}
            >
              {bannerShineEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <div id="security" style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px", scrollMarginTop:80 }}>
          <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.text, letterSpacing:"0.15em", marginBottom:12, fontWeight:600 }}>SECURITY</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div>
              <div style={{ fontFamily:t.fontDisplay, fontSize:14, fontWeight:700, color:t.text, marginBottom:3 }}>Two-Factor Auth</div>
              <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.textMuted }}>Google Authenticator · Authy</div>
            </div>
          </div>
          {twoFAMsg && (
            <div style={{ background:twoFAMsg.ok?"#4CAF5014":`${t.danger}14`, border:`1px solid ${twoFAMsg.ok?"#4CAF50":t.danger}`, borderRadius:6, padding:"8px 12px", marginBottom:12, color:twoFAMsg.ok?"#4CAF50":t.danger, fontFamily:t.fontBody, fontSize:12 }}>
              {twoFAMsg.ok?"✓":""} {twoFAMsg.text}
            </div>
          )}
          {twoFASection==="idle" && (enabled ? (
            <>
              <div style={{ fontFamily:t.fontBody, fontSize:12, color:"#4CAF50", marginBottom:10 }}>✅ 2FA is enabled — your account is protected.</div>
              <button onClick={() => { onClickAction?.(); setTwoFAMsg(null); setTwoFASection("disable"); }} disabled={twoFALoading}
                style={{ width:"100%", padding:"10px", background:`${t.danger}18`, border:`1px solid ${t.danger}`, borderRadius:8, color:t.danger, fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Disable 2FA
              </button>
            </>
          ) : (
            <>
              <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.textMuted, marginBottom:10 }}>❌ 2FA is not enabled. Add an extra layer of security.</div>
              <button onClick={() => { onClickAction?.(); setTwoFAMsg(null); start2FASetup(); }} disabled={twoFALoading}
                style={{ width:"100%", padding:"10px", background:`${t.accent}18`, border:`1px solid ${t.accent}`, borderRadius:8, color:t.accent, fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {twoFALoading?"Please wait…":"Enable 2FA"}
              </button>
            </>
          ))}
          {twoFASection==="setup" && (
            <>
              <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.textMuted, marginBottom:10 }}>Scan with <strong style={{ color:t.textSecondary }}>Google Authenticator</strong> or <strong style={{ color:t.textSecondary }}>Authy</strong>, then enter the code.</div>
              {qrCode && <img src={qrCode} alt="2FA QR" style={{ width:160, height:160, borderRadius:8, border:`2px solid ${t.border}`, marginBottom:10, display:"block" }} />}
              <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, marginBottom:12, wordBreak:"break-all" }}>Key: <span style={{ color:t.accent }}>{secret}</span></div>
              <input type="text" value={totpInput} maxLength={6} placeholder="000000" autoFocus onChange={e => setTotpInput(e.target.value.replace(/\D/g,""))} onKeyDown={e => e.key==="Enter"&&confirm2FA()}
                style={{ width:"100%", padding:"10px", background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:7, color:t.text, fontFamily:t.fontMono, fontSize:24, letterSpacing:"0.35em", textAlign:"center", boxSizing:"border-box", marginBottom:10 }} />
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { onClickAction?.(); confirm2FA(); }} disabled={twoFALoading} style={{ flex:1, padding:"10px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:12, fontWeight:800, cursor:"pointer" }}>{twoFALoading?"Verifying…":"Confirm"}</button>
                <button onClick={() => { onClickAction?.(); setTwoFASection("idle"); setTotpInput(""); setTwoFAMsg(null); }} style={{ padding:"10px 14px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:12, cursor:"pointer" }}>Cancel</button>
              </div>
            </>
          )}
          {twoFASection==="disable" && (
            <>
              <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.textMuted, marginBottom:10 }}>Enter your authenticator code to disable 2FA.</div>
              <input type="text" value={totpInput} maxLength={6} placeholder="000000" autoFocus onChange={e => setTotpInput(e.target.value.replace(/\D/g,""))} onKeyDown={e => e.key==="Enter"&&disable2FA()}
                style={{ width:"100%", padding:"10px", background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:7, color:t.text, fontFamily:t.fontMono, fontSize:24, letterSpacing:"0.35em", textAlign:"center", boxSizing:"border-box", marginBottom:10 }} />
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { onClickAction?.(); disable2FA(); }} disabled={twoFALoading} style={{ flex:1, padding:"10px", background:`${t.danger}18`, border:`1px solid ${t.danger}`, borderRadius:8, color:t.danger, fontFamily:t.fontDisplay, fontSize:12, fontWeight:700, cursor:"pointer" }}>{twoFALoading?"Disabling…":"Disable"}</button>
                <button onClick={() => { onClickAction?.(); setTwoFASection("idle"); setTotpInput(""); setTwoFAMsg(null); }} style={{ padding:"10px 14px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:12, cursor:"pointer" }}>Cancel</button>
              </div>
            </>
          )}
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => {
                onClickAction?.();
                if (typeof window !== "undefined") {
                  window.open("/patchnotes", "_blank", "noopener,noreferrer");
                }
              }}
              onMouseEnter={e => { onHoverAction?.(); (e.currentTarget as HTMLElement).style.borderColor=t.accent; (e.currentTarget as HTMLElement).style.color=t.accent; (e.currentTarget as HTMLElement).style.background=`${t.accent}12`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor=t.border; (e.currentTarget as HTMLElement).style.color=t.textSecondary; (e.currentTarget as HTMLElement).style.background="transparent"; }}
              style={{
                width: "100%",
                padding: "10px",
                background: "transparent",
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                color: t.textSecondary,
                fontFamily: t.fontDisplay,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.15s",
              }}
            >
              <span>PATCH NOTES</span>
              <span style={{ opacity: 0.6, fontSize: 10 }}>↗</span>
            </button>
          </div>
          <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${t.border}44`, display:"flex", flexDirection:"column", gap:7 }}>
            <button onClick={() => { onClickAction?.(); openEdit("password"); }}
              style={{ width:"100%", padding:"9px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:12, fontWeight:600, cursor:"pointer", textAlign:"left" as const, transition:"all 0.15s" }}
              onMouseEnter={e => { onHoverAction?.(); (e.currentTarget as HTMLElement).style.borderColor=t.accent; (e.currentTarget as HTMLElement).style.color=t.accent; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor=t.border; (e.currentTarget as HTMLElement).style.color=t.textMuted; }}>
              Change Password
            </button>
            <button onClick={() => { onClickAction?.(); openEdit("email"); }}
              style={{ width:"100%", padding:"9px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:12, fontWeight:600, cursor:"pointer", textAlign:"left" as const, transition:"all 0.15s" }}
              onMouseEnter={e => { onHoverAction?.(); (e.currentTarget as HTMLElement).style.borderColor=t.accent; (e.currentTarget as HTMLElement).style.color=t.accent; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor=t.border; (e.currentTarget as HTMLElement).style.color=t.textMuted; }}>
              Change Email
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* ── Delete Account (Danger Zone) ──────────────────────────────────── */}
      <div style={{ background:t.bgPanel, border:`1px solid ${t.danger}33`, borderRadius:12, padding:"16px 22px", marginTop:18 }}>
        <div
          onClick={() => { onClickAction?.(); setShowDeleteZone(z => !z); setDeleteMsg(null); setDeletePw(""); setDeleteConfirmText(""); }}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", userSelect:"none" }}
        >
          <div>
            <div style={{ fontFamily:t.fontMono, fontSize:18, color:t.danger, letterSpacing:"0.15em", fontWeight:1000 }}>DANGER ZONE</div>
            <div style={{ fontFamily:t.fontBody, fontSize:14, color:t.danger, marginTop:3 }}>Permanently delete your account and all associated data</div>
          </div>
          <div style={{ fontFamily:t.fontMono, fontSize:16, color:t.textMuted, transition:"transform 0.2s", transform: showDeleteZone ? "rotate(180deg)" : "rotate(0)" }}>▾</div>
        </div>

        {showDeleteZone && (
          <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${t.danger}22` }}>
            <div style={{ background:`${t.danger}0C`, border:`1px solid ${t.danger}33`, borderRadius:8, padding:"12px 16px", marginBottom:14 }}>
              <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.danger, lineHeight:1.6 }}>
                ⚠️ This action is <strong>permanent and irreversible</strong>. Deleting your account will:
              </div>
              <ul style={{ fontFamily:t.fontBody, fontSize:12, color:t.textMuted, lineHeight:1.8, margin:"8px 0 0", paddingLeft:18 }}>
                <li>Erase your profile, ELO, level, and match history</li>
                <li>Forfeit all ProtoCredits and PentaShards</li>
                <li>Remove all purchased items (boards, banners, cosmetics)</li>
                <li>Delete payment and transaction records</li>
              </ul>
            </div>

            {deleteMsg && (
              <div style={{ background:deleteMsg.ok?"#4CAF5014":`${t.danger}14`, border:`1px solid ${deleteMsg.ok?"#4CAF50":t.danger}`, borderRadius:6, padding:"8px 12px", marginBottom:12, color:deleteMsg.ok?"#4CAF50":t.danger, fontFamily:t.fontBody, fontSize:12 }}>
                {deleteMsg.text}
              </div>
            )}

            {profile.has_password ? (
              <>
                <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.textMuted, marginBottom:8 }}>Enter your password to confirm:</div>
                <input
                  type="password"
                  value={deletePw}
                  onChange={e => setDeletePw(e.target.value)}
                  placeholder="Your password"
                  style={{ width:"100%", padding:"10px 12px", background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:7, color:t.text, fontFamily:t.fontMono, fontSize:14, boxSizing:"border-box", marginBottom:10 }}
                />
              </>
            ) : (
              <div style={{ background:`${t.accent}0C`, border:`1px solid ${t.accent}33`, borderRadius:8, padding:"10px 14px", marginBottom:14, fontFamily:t.fontBody, fontSize:12, color:t.textMuted }}>
                ℹ This account is linked to Google. No password is required for deletion.
              </div>
            )}

            <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.textMuted, marginBottom:8 }}>Type <strong style={{ color:t.danger }}>DELETE</strong> to confirm:</div>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{ width:"100%", padding:"10px 12px", background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:7, color:t.text, fontFamily:t.fontMono, fontSize:14, boxSizing:"border-box", marginBottom:14 }}
            />

            <button
              disabled={deleteLoading || (profile.has_password && !deletePw) || deleteConfirmText !== "DELETE"}
              onClick={async () => {
                onClickAction?.();
                setDeleteLoading(true); setDeleteMsg(null);
                try {
                  await API.post("/api/auth/delete-account", { password: profile.has_password ? deletePw : "DELETE" });
                  setDeleteMsg({ text: "Account deleted. You will be signed out.", ok: true });
                  setTimeout(() => {
                    // Post F-03 the JWT + device token are HttpOnly cookies
                    // cleared by the backend's /auth/logout; we only have
                    // non-secret entries to wipe client-side.
                    try { API.post("/api/auth/logout").catch(() => {}); } catch {}
                    localStorage.removeItem("pp_user");
                    localStorage.removeItem("pp_legal_accept_v1");
                    window.location.reload();
                  }, 1800);
                } catch (e: any) {
                  setDeleteMsg({ text: apiErrorDetail(e, "Failed to delete account"), ok: false });
                } finally { setDeleteLoading(false); }
              }}
              style={{
                width:"100%", padding:"11px",
                background: ((profile.has_password && !deletePw) || deleteConfirmText !== "DELETE") ? `${t.danger}18` : t.danger,
                border:`1px solid ${t.danger}`,
                borderRadius:8, color: ((profile.has_password && !deletePw) || deleteConfirmText !== "DELETE") ? t.danger : "#fff",
                fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, cursor: ((profile.has_password && !deletePw) || deleteConfirmText !== "DELETE") ? "not-allowed" : "pointer",
                opacity: deleteLoading ? 0.5 : 1,
                transition:"all 0.2s",
              }}
            >
              {deleteLoading ? "Deleting…" : "Permanently Delete My Account"}
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT PROFILE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showEdit && (
        <div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:18, width:"min(560px,100%)", maxHeight:"88vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:`0 32px 80px rgba(0,0,0,0.6)` }}>

            <div style={{ padding:"20px 26px 0", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:t.text }}>Edit Profile</div>
              <button onClick={() => closeEdit()} style={{ background:"transparent", border:"none", color:t.textMuted, fontSize:20, cursor:"pointer", lineHeight:1, padding:"0 4px" }}>✕</button>
            </div>

            <div style={{ display:"flex", gap:4, padding:"14px 26px 0", flexShrink:0, overflowX:"auto" }}>
              {TABS.map(tab => (
                <button key={tab.id} className="edit-tab-btn"
                  onClick={() => { onClickAction?.(); setEditTab(tab.id); setEditMsg(null); }}
                  style={{ padding:"8px 16px", borderRadius:"8px 8px 0 0", background:editTab===tab.id?t.bgCard:"transparent", border:`1px solid ${editTab===tab.id?t.border:"transparent"}`, borderBottom:editTab===tab.id?`1px solid ${t.bgCard}`:`1px solid ${t.border}44`, color:editTab===tab.id?t.accent:t.textSecondary, fontFamily:t.fontMono, fontSize:13, fontWeight:(editTab===tab.id?800:600) as React.CSSProperties["fontWeight"], letterSpacing:"0.08em" as React.CSSProperties["letterSpacing"], cursor:"pointer" as React.CSSProperties["cursor"], whiteSpace:"nowrap" as const, display:"flex", alignItems:"center", gap:5, transition:"color 0.15s, background 0.15s" }}>
                  {tab.label.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ height:1, background:t.border+"44", flexShrink:0, marginTop:-1 }} />

            <div style={{ overflowY:"auto", padding:"20px 26px", flex:1, display:"flex", flexDirection:"column", gap:16 }}>

              {editMsg && (
                <div style={{ background:editMsg.ok?"#4CAF5014":`${t.danger}14`, border:`1px solid ${editMsg.ok?"#4CAF50":t.danger}`, borderRadius:6, padding:"8px 12px", color:editMsg.ok?"#4CAF50":t.danger, fontFamily:t.fontBody, fontSize:13, flexShrink:0 }}>
                  {editMsg.ok?"✓":""} {editMsg.text}
                </div>
              )}

              {/* ── TAB: PROFILE ─────────────────────────────────────────── */}
              {editTab==="profile" && (
                <>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:8 }}>PROFILE PICTURE</div>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      {/* Preview: shows local blob URL or existing avatar URL — never base64 */}
                      <div style={{ width:56, height:56, borderRadius:"50%", background:`linear-gradient(135deg,${t.p1},${t.p2})`, overflow:"hidden", border:`2px solid ${t.border}`, flexShrink:0 }}>
                        {(avatarPreview || resolveAvatar(profile))
                          ? <img src={avatarPreview || resolveAvatar(profile)!} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                          : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>👤</div>}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        <label style={{ padding:"8px 16px", background:`${t.accent}18`, border:`1px solid ${t.accent}`, borderRadius:8, color:t.accent, fontFamily:t.fontDisplay, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                          Choose Image
                          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarFile} style={{ display:"none" }} />
                        </label>
                        {avatarFile && (
                          <div style={{ fontFamily:t.fontMono, fontSize:10, color:"#4CAF50" }}>
                            ✓ {avatarFile.name} ({(avatarFile.size/1024).toFixed(0)}KB) — ready when you save
                          </div>
                        )}
                      </div>
                      <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted }}>
                        Max 2MB · JPEG/PNG/WebP
                        <br />
                        Saved with your profile and shown wherever your avatar appears
                        {!isSupabaseConfigured && (
                          <>
                            <br />
                            <span style={{ color: "#f59e0b" }}>
                              Photo uploads aren&apos;t available on this deployment yet. You can still update username and bio, or try again later.
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>USERNAME</div>
                    <input value={editUsername} maxLength={12} onChange={e => setEditUsername(e.target.value)} style={inputStyle} />
                    <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted, marginTop:4 }}>3–12 chars · letters, numbers, @ and _ only</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>BIO</div>
                    <textarea value={editBio} maxLength={200} onChange={e => setEditBio(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily:t.fontBody, fontSize:13, resize:"vertical" }} />
                    <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted, marginTop:2 }}>{editBio.length}/200</div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={submitProfile} disabled={editLoading} style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s", boxShadow:`0 0 12px ${t.accentGlow}33` }}>
                      {editLoading ? (avatarFile ? "Uploading your pfp…" : "Saving…") : "Save Changes"}
                    </button>
                    <button onClick={() => closeEdit()} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>Cancel</button>
                  </div>
                </>
              )}

              {/* ── TAB: BORDER ──────────────────────────────────────────── */}
              {editTab==="border" && (
                <>
                  <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>Profile borders appear around your avatar. Higher-tier borders have special animations.</div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" as const }}>
                    {(["basic","rare","epic","legendary"] as const).map(tier => (
                      <div key={tier} style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:TIER_COLOR[tier] }} />
                        <span style={{ fontFamily:t.fontMono, fontSize:10, color:TIER_COLOR[tier], letterSpacing:"0.08em", textTransform:"uppercase" as const }}>{tier}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 16px", background:t.bgCard, borderRadius:12, border:`1px solid ${t.border}` }}>
                    <div className={previewBorderDef.id !== "none" ? `border-anim-${previewBorderDef.animation}` : ""}
                      style={{ width:52, height:52, borderRadius:"50%", background:`linear-gradient(135deg,${t.p1},${t.p2})`, border:`3px solid ${t.bg}`, boxShadow:previewShadow, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0, overflow:"hidden" }}>
                      {resolveAvatar(profile) ? <img src={resolveAvatar(profile)!} style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"50%" }} /> : "👤"}
                    </div>
                    <div>
                      <div style={{ fontFamily:t.fontDisplay, fontSize:14, fontWeight:700, color:t.text }}>{previewBorderDef.label}</div>
                      <div style={{ fontFamily:t.fontMono, fontSize:10, color:TIER_COLOR[previewBorderDef.tier], letterSpacing:"0.08em" }}>{previewBorderDef.tier.toUpperCase()} · {previewBorderDef.animation !== "none" ? previewBorderDef.animation.toUpperCase() + " ANIMATION" : "No animation"}</div>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {PROFILE_BORDERS.map(b => {
                      const unlocked = b.condition(profile);
                      const selected = editBorder === b.id;
                      const tc = TIER_COLOR[b.tier];
                      const isRainbow = b.id === "rainbow_halo";
                      const itemShadow = b.id === "none" ? "none" : isRainbow ? "0 0 0 3px #FF6B6B, 0 0 0 6px #FFD700, 0 0 20px #FF6B6BAA" : b.css;
                      return (
                        <div key={b.id} onClick={() => unlocked && setEditBorder(b.id)}
                          style={{ borderRadius:12, padding:"14px 14px 12px", background:selected?`${tc}10`:t.bgCard, border:`2px solid ${selected?tc:unlocked?tc+"33":t.border+"33"}`, opacity:unlocked?1:0.42, cursor:unlocked?"pointer":"not-allowed", boxShadow:selected?`0 0 18px ${tc}44`:"none", transition:"all 0.18s", display:"flex", alignItems:"center", gap:12 }}>
                          <div className={unlocked && b.id !== "none" ? `border-anim-${b.animation}` : ""} style={{ width:42, height:42, borderRadius:"50%", flexShrink:0, background:`linear-gradient(135deg,${t.p1},${t.p2})`, border:`2px solid ${t.bg}`, boxShadow:unlocked&&b.id!=="none"?itemShadow:"none" }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                              <span style={{ fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, color:unlocked?t.text:t.textMuted }}>{b.label}</span>
                              <span style={{ fontFamily:t.fontMono, fontSize:9, fontWeight:700, color:tc, letterSpacing:"0.1em", background:`${tc}18`, padding:"1px 6px", borderRadius:4 }}>{b.tier.toUpperCase()}</span>
                            </div>
                            <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted }}>{unlocked?"Unlocked":b.unlockDesc}</div>
                          </div>
                          {!unlocked && <LockSVG />}
                          {unlocked && selected && <div style={{ width:18, height:18, borderRadius:"50%", background:tc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#000", fontWeight:700, flexShrink:0 }}>✓</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={submitBorder} disabled={editLoading} style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s" }}>
                      {editLoading?"Saving…":"Equip Border"}
                    </button>
                    <button onClick={() => closeEdit()} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>Cancel</button>
                  </div>
                </>
              )}

              {/* ── TAB: BADGES ───────────────────────────────────────────── */}
              {editTab==="title" && (
                <>
                  <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>Your badge appears below your username. Earn badges by ranking up, winning matches, and reaching milestones.</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {TITLES.map(ti => {
                      const unlocked = ti.condition(profile);
                      const selected = editTitle === ti.id;
                      return (
                        <div key={ti.id} className="title-pill" onClick={() => unlocked && setEditTitle(ti.id)}
                          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 16px", borderRadius:10, border:`1px solid ${selected?ti.color:unlocked?ti.color+"44":t.border+"33"}`, background:selected?`${ti.color}14`:unlocked?`${ti.color}06`:"transparent", opacity:unlocked?1:0.4, cursor:unlocked?"pointer":"not-allowed", boxShadow:selected?`0 0 12px ${ti.glow}`:"none", transition:"all 0.15s" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                            <div style={{ width:10, height:10, borderRadius:"50%", background:ti.color, boxShadow:`0 0 6px ${ti.glow}`, flexShrink:0 }} />
                            <div>
                              <div className={unlocked?`title-anim-${ti.animation}`:""} style={{ display:"inline-block", padding:"1px 8px", borderRadius:10, border:`1px solid ${ti.color}44`, background:`${ti.color}12`, marginBottom:4 }}>
                                <span style={{ fontFamily:t.fontMono, fontSize:13, fontWeight:700, color:unlocked?ti.color:t.textMuted, letterSpacing:"0.04em" }}>{ti.label}</span>
                              </div>
                              <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted, marginTop:2 }}>{ti.unlockDesc}</div>
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                            {!unlocked && <LockSVG />}
                            {unlocked && selected && <div style={{ width:18, height:18, borderRadius:"50%", background:ti.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#000", fontWeight:700 }}>✓</div>}
                            {unlocked && !selected && <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted }}>EQUIP</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={submitTitle} disabled={editLoading} style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s" }}>
                      {editLoading?"Saving…":"Equip Badge"}
                    </button>
                    <button onClick={() => closeEdit()} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>Cancel</button>
                  </div>
                </>
              )}

              {/* ── TAB: PASSWORD ────────────────────────────────────────── */}
              {editTab==="password" && (
                <>
                  {!enabled ? <TwoFARequired /> : (
                    <>
                      <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>Choose a strong password with at least 8 characters, mixing letters, numbers and symbols.</div>
                      <div>
                        <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>CURRENT PASSWORD</div>
                        <div style={{ position:"relative" }}>
                          <input type={showPwCurrent?"text":"password"} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} placeholder="Enter current password" style={{ ...inputStyle, paddingRight:42 }} />
                          <span className="pw-eye" onClick={() => setShowPwCurrent(v=>!v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center" }}>
                            {showPwCurrent
                              ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>NEW PASSWORD</div>
                        <div style={{ position:"relative" }}>
                          <input type={showPwNew?"text":"password"} value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="Enter new password" style={{ ...inputStyle, paddingRight:42 }} />
                          <span className="pw-eye" onClick={() => setShowPwNew(v=>!v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center" }}>
                            {showPwNew
                              ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                          </span>
                        </div>
                        {pwNew && strength && (
                          <div style={{ marginTop:8 }}>
                            <div style={{ height:4, background:t.bgCard, borderRadius:2, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:strength.w, background:strength.color, borderRadius:2, transition:"width 0.3s ease, background 0.3s ease" }} />
                            </div>
                            <div style={{ fontFamily:t.fontMono, fontSize:10, color:strength.color, marginTop:3 }}>{strength.label}</div>
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>CONFIRM NEW PASSWORD</div>
                        <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="Re-enter new password" style={{ ...inputStyle, borderColor:pwConfirm&&pwNew&&pwConfirm!==pwNew?t.danger:t.border }} />
                        {pwConfirm && pwNew && pwConfirm !== pwNew && <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.danger, marginTop:3 }}>Passwords do not match</div>}
                      </div>
                      {pwTotpStep === "awaiting_otp" && (
                        <div style={{ background:`${t.accent}08`, border:`1px solid ${t.accent}33`, borderRadius:10, padding:"14px 16px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                            <div style={{ width:28, height:28, borderRadius:"50%", background:`${t.accent}18`, border:`1px solid ${t.accent}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>📧</div>
                            <div>
                              <div style={{ fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, color:t.accent }}>OTP Sent</div>
                              <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted }}>Enter the 6-digit code sent to your email</div>
                            </div>
                          </div>
                          <input type="text" value={pwOtpCode} maxLength={6} autoFocus onChange={e => setPwOtpCode(e.target.value.replace(/\D/g,""))} placeholder="000000" style={{ ...inputStyle, fontSize:22, letterSpacing:"0.35em", textAlign:"center" as const }} />
                          <button onClick={() => { setPwTotpStep("idle"); setPwOtpCode(""); setEditMsg(null); }} style={{ marginTop:8, background:"none", border:"none", color:t.textMuted, fontFamily:t.fontBody, fontSize:12, cursor:"pointer", padding:0 }}>← Cancel</button>
                        </div>
                      )}
                      <div style={{ display:"flex", gap:10 }}>
                        <button onClick={submitPassword} disabled={editLoading} style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s" }}>
                          {editLoading?"Saving…":pwTotpStep==="awaiting_otp"?"Confirm & Change Password":"Send OTP & Continue"}
                        </button>
                        <button onClick={() => closeEdit()} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>Cancel</button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── TAB: EMAIL ───────────────────────────────────────────── */}
              {editTab==="email" && (
                <>
                  {!enabled ? <TwoFARequired /> : (
                    <>
                      <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>
                        Current email: <span style={{ color:t.text, fontWeight:600 }}>{profile.email || "not set"}</span>
                      </div>
                      <div style={{ background:`${t.accent}0A`, border:`1px solid ${t.accent}22`, borderRadius:8, padding:"10px 14px", fontFamily:t.fontBody, fontSize:12, color:t.textMuted }}>
                        ℹ An OTP will be sent to your new email to verify it.
                      </div>
                      <div>
                        <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>NEW EMAIL ADDRESS</div>
                        <input type="email" value={emailNew} onChange={e => setEmailNew(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                      </div>
                      {emailTotpStep === "awaiting_otp" && (
                        <div style={{ background:`${t.accent}08`, border:`1px solid ${t.accent}33`, borderRadius:10, padding:"14px 16px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                            <div style={{ width:28, height:28, borderRadius:"50%", background:`${t.accent}18`, border:`1px solid ${t.accent}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>📧</div>
                            <div>
                              <div style={{ fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, color:t.accent }}>OTP Sent</div>
                              <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted }}>Enter the 6-digit code sent to {emailNew}</div>
                            </div>
                          </div>
                          <input type="text" value={emailOtpCode} maxLength={6} autoFocus onChange={e => setEmailOtpCode(e.target.value.replace(/\D/g,""))} placeholder="000000" style={{ ...inputStyle, fontSize:22, letterSpacing:"0.35em", textAlign:"center" as const }} />
                          <button onClick={() => { setEmailTotpStep("idle"); setEmailOtpCode(""); setEditMsg(null); }} style={{ marginTop:8, background:"none", border:"none", color:t.textMuted, fontFamily:t.fontBody, fontSize:12, cursor:"pointer", padding:0 }}>← Cancel</button>
                        </div>
                      )}
                      <div style={{ display:"flex", gap:10 }}>
                        <button onClick={submitEmail} disabled={editLoading} style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s" }}>
                          {editLoading?"Saving…":emailTotpStep==="awaiting_otp"?"Confirm & Update Email":"Send OTP & Continue"}
                        </button>
                        <button onClick={() => closeEdit()} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>Cancel</button>
                      </div>
                    </>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}