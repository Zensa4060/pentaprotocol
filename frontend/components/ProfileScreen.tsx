"use client";
import { useEffect, useState } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import API from "@/lib/api";
import { containsProfanity, validateUsername } from "@/lib/profanity";
import { SHARDS_LIGHT_SVG, SHARDS_DARK_SVG, PROTO_LIGHT_SVG, PROTO_DARK_SVG } from "@/lib/currencyIcons";
import { loadCustomTheme, saveCustomTheme } from "@/lib/customTheme";
import type { Screen } from "@/lib/types";
import { getUserKey, loadMissionState } from "@/lib/missionsClient";
import { computeLevelStatsFromTotalXp, totalXpToReachLevel } from "@/lib/xpLevel";
import { BannerRenderer } from "./BannerRenderer";
import { rankGlowVisualStrength, buildRankEmblemGlowFilter, rankHaloGradientForRank } from "./NavBar";
import VoidRiftBanner from "./VoidRiftBanner";
import BloodMoonBanner from "./BloodMoonBanner";
import PhantomStrikeBanner from "./PhantomStrikeBanner";
import SolarFlareBanner from "./SolarFlareBanner";
import CryoStormBanner from "./CryoStormBanner";
import NeonCircuitBanner from "./NeonCircuitBanner";
import StaticGlitchBanner from "./StaticGlitchBanner";
import GoldenNexusBanner from "./GoldenNexusBanner";
import PlasmaCoreBanner from "./PlasmaCoreBanner";
import ToxicSpillBanner from "./ToxicSpillBanner";
import StormProtocolBanner from "./StormProtocolBanner";
import ArcticVeilBanner from "./ArcticVeilBanner";
import StarfieldBanner from "./StarfieldBanner";
import DigitalRainBanner from "./DigitalRainBanner";
import InfernoBanner from "./InfernoBanner";
// ── Supabase storage client ───────────────────────────────────────────────────
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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

export const RANKS = [
  { name: "NOVICE",       min: 0,    max: 500,  color: "#9CA3AF", icon: null, img: "/novice.svg",       scale: 1.3 },
  { name: "ADVANCED",     min: 500,  max: 1000, color: "#60A5FA", icon: null, img: "/advanced.svg",     scale: 1.3 },
  { name: "PROFESSIONAL", min: 1000, max: 1500, color: "#A78BFA", icon: null, img: "/professional.png?v=8", scale: 0.741 },
  { name: "EMERALD",      min: 1500, max: 2000, color: "#10B981", icon: null, img: "/emerald.svg",      scale: 1.495 },
  { name: "MASTER",       min: 2000, max: 2500, color: "#FF3333", icon: null, img: "/master.png?v=3" },
  { name: "LEGEND",       min: 2500, max: 1000000, color: "#F59E0B", icon: null, img: "/legend.png?v=3" },
];

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

const BANNERS: {
  id: string; label: string; gradient: string;
  component?: React.ComponentType<{ style?: React.CSSProperties }>;
  unlockDesc: string; condition: (p: any) => boolean;
}[] = [
  { id: "default",    label: "Default",         gradient: "linear-gradient(135deg,#1a1a2e,#16213e)",
    unlockDesc: "Default banner", condition: () => true },
  { id: "void_rift",  label: "Void Rift",       gradient: "linear-gradient(135deg,#0e0020,#020005)",
    component: VoidRiftBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("void_rift") },
  { id: "blood_moon",  label: "Blood Moon",       gradient: "linear-gradient(135deg,#000008,#180008)",
    component: BloodMoonBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("blood_moon") },
  { id: "phantom_strike", label: "Phantom Strike", gradient: "linear-gradient(135deg,#060010,#110028)",
    component: PhantomStrikeBanner,
    unlockDesc: "Purchase for 199 PC", condition: p => (p.purchased_items || []).includes("phantom_strike") },
  { id: "solar_flare", label: "Solar Flare", gradient: "linear-gradient(135deg,#060200,#f97316)",
    component: SolarFlareBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("solar_flare") },
  { id: "cryo_storm", label: "Cryo Storm", gradient: "linear-gradient(135deg,#030c20,#081840)",
    component: CryoStormBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("cryo_storm") },
  { id: "neon_circuit", label: "Neon Circuit", gradient: "linear-gradient(135deg,#020a04,#00ff66)",
    component: NeonCircuitBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("neon_circuit") },
  { id: "static_glitch", label: "Static Glitch", gradient: "linear-gradient(135deg,#050505,#a00038)",
    component: StaticGlitchBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("static_glitch") },
  { id: "golden_nexus", label: "Golden Nexus", gradient: "linear-gradient(135deg,#060200,#fbbf24)",
    component: GoldenNexusBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("golden_nexus") },
  { id: "plasma_core", label: "Plasma Core", gradient: "linear-gradient(135deg,#12082a,#6d28d9)",
    component: PlasmaCoreBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("plasma_core") },
  { id: "toxic_spill", label: "Toxic Spill", gradient: "linear-gradient(135deg,#010d03,#0a3d22)",
    component: ToxicSpillBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("toxic_spill") },
  { id: "storm_protocol", label: "Storm Protocol", gradient: "linear-gradient(135deg,#060810,#0b1a3b)",
    component: StormProtocolBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("storm_protocol") },
  { id: "arctic_veil", label: "Arctic Veil", gradient: "linear-gradient(135deg,#d8f0fc,#c5e8fb)",
    component: ArcticVeilBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("arctic_veil") },
  { id: "starfield", label: "Starfield", gradient: "linear-gradient(135deg,#050210,#312e81)",
    component: StarfieldBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("starfield") },
  { id: "digital_rain", label: "Digital Rain", gradient: "linear-gradient(135deg,#000702,#14532d)",
    component: DigitalRainBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("digital_rain") },
  { id: "inferno", label: "Inferno", gradient: "linear-gradient(135deg,#070100,#ea580c)",
    component: InfernoBanner,
    unlockDesc: "Purchase for 299 PC", condition: p => (p.purchased_items || []).includes("inferno") },
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

const getRank = (elo: number) => RANKS.find(r => elo >= r.min && elo < r.max) || RANKS[5];

export const RankIcon = ({ rank, size = 26 }: { rank: typeof RANKS[0]; size?: number }) => {
  const imgScale = (rank as any).scale ?? 1;
  const imgSize = size * 0.85 * imgScale;
  const strength = rankGlowVisualStrength(rank);
  const filt = buildRankEmblemGlowFilter(rank.color, strength);
  const hasHalo = strength >= 0.0012;
  const tGlow = strength;
  return (
    <div
      className="rank-badge-container"
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "transparent", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "visible", position: "relative",
        boxShadow: "none", transition: "transform 0.3s ease",
        "--rank-col": rank.color,
      } as React.CSSProperties}
    >
      {rank.img ? (
        <>
          {hasHalo && (
            <div aria-hidden style={{ position:"absolute", left:"50%", top:"50%", width:"135%", height:"135%", borderRadius:"50%", background:rankHaloGradientForRank(rank.color, rank), pointerEvents:"none", zIndex:0, animation:"rankHaloPulse 2.6s ease-in-out infinite" }} />
          )}
          <img src={rank.img} alt={rank.name} draggable={false} className="rank-emblem-img"
            style={{ width:imgSize, height:imgSize, objectFit:"contain", userSelect:"none", pointerEvents:"none", position:"relative", zIndex:1, filter:filt, backgroundColor:"transparent" }} />
        </>
      ) : (
        <span style={{ fontSize:size*0.6, color:rank.color, lineHeight:1, userSelect:"none", pointerEvents:"none", position:"relative", zIndex:1,
          textShadow: tGlow >= 0.002 ? `0 0 ${Math.max(1,Math.round(2+14*tGlow))}px ${rank.color}, 0 0 ${Math.max(2,Math.round(4+32*tGlow))}px ${rank.color}${Math.min(255,Math.round(0x99*tGlow)).toString(16).padStart(2,"0")}` : "none" }}>
          {rank.icon}
        </span>
      )}
    </div>
  );
};

function TitleBadge({ title, onClick }: { title: typeof TITLES[0]; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`title-anim-${title.animation}`}
      style={{ padding:"2px 10px", borderRadius:20, border:`1px solid ${title.color}44`, background:`${title.color}12`, cursor:onClick?"pointer":"default", transition:"all 0.15s", display:"inline-flex", alignItems:"center" }}>
      <span style={{ fontFamily:"var(--font-mono, monospace)", fontSize:11, fontWeight:700, color:title.color, letterSpacing:"0.08em" }}>{title.label}</span>
    </div>
  );
}

// Resolve avatar URL across possible backend key names.
function resolveAvatar(p: any): string | null {
  return p?.avatar || p?.avatar_url || p?.profile_avatar || null;
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
interface Props { themeId: ThemeId; onHoverAction?: () => void; onClickAction?: () => void; setScreenAction: (s: Screen) => void; }

const LockSVG = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export default function ProfileScreen({ themeId, onHoverAction, onClickAction, setScreenAction }: Props) {
  const t = THEMES[themeId];
  const { user, token, updateUser } = useAuthStore();
  const [profile, setProfile]             = useState<any>(null);
  const [missionShardBonus, setMissionShardBonus] = useState(0);
  const [loading, setLoading]             = useState(true);
  const [profileError, setProfileError]   = useState<string | null>(null);
  const [profileFetchKey, setProfileFetchKey] = useState(0);

  const [twoFASection, setTwoFASection]   = useState<"idle"|"setup"|"disable">("idle");
  const [qrCode, setQrCode]               = useState("");
  const [secret, setSecret]               = useState("");
  const [totpInput, setTotpInput]         = useState("");
  const [twoFALoading, setTwoFALoading]   = useState(false);
  const [twoFAMsg, setTwoFAMsg]           = useState<{text:string;ok:boolean}|null>(null);
  const [twoFAReady, setTwoFAReady]       = useState(false);

  const [showEdit, setShowEdit]           = useState(false);
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
  const resolveAvatar = (p: any): string | null =>
    p?.avatar || p?.avatar_url || p?.profile_avatar || null;

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
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.code === "ECONNABORTED" ? "Request timed out." : e?.message || "Could not load profile.";
        if (!user) setProfileError(msg);
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, [user, profileFetchKey]);

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
  const rank     = getRank(elo);
  const nextRank = RANKS[RANKS.indexOf(rank) + 1];
  const progress = nextRank ? ((elo - rank.min) / (rank.max - rank.min)) * 100 : 100;
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const activeTitle     = TITLES.find(ti => ti.id === (profile.title || "newcomer")) || TITLES[0];
  const activeBanner    = BANNERS.find(b => b.id === (profile.banner || "default")) || BANNERS[0];
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
    setEditUsername(profile.username || "");
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
    setShowEdit(true);
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

      if (avatarFile) {
        if (!isSupabaseConfigured) {
          throw new Error("Supabase is not configured in frontend env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
        }
        // Use user ID as filename so each user always overwrites their own avatar
        const userId = (user as any)?.id ?? (user as any)?._id ?? Date.now().toString();
        const ext    = avatarFile.name.split(".").pop() || "jpg";
        const path   = `${userId}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, {
            upsert: true,           // overwrite existing avatar
            contentType: avatarFile.type,
          });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        // Get permanent public URL — just a short string, not base64
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(uploadData.path);

        // Add cache-busting so the browser picks up the new image immediately
        avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const payload: any = {};
      if (editUsername !== profile.username)  payload.username = editUsername;
      if (editBio !== (profile.bio || ""))    payload.bio      = editBio;
      if (avatarUrl)                          payload.avatar   = avatarUrl; // short URL ✅

      if (!Object.keys(payload).length) { setShowEdit(false); return; }

      const res = await API.put("/api/profile/me", payload, authHeader);
      setProfile(res.data);
      updateUser(res.data);
      setEditMsg({ text:"Profile updated!", ok:true });
      // Clean up local preview
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview(null);
      setTimeout(() => setShowEdit(false), 900);
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
      setTimeout(() => setShowEdit(false), 900);
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
      setTimeout(() => setShowEdit(false), 900);
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
      setTimeout(() => setShowEdit(false), 900);
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
  const totalXP = Number(profile.xp || 0);
  const { level: computedLevelFromXp } = computeLevelStatsFromTotalXp(totalXP);

  const stats = [
    { l:"Ranked W",    v: rankedW,   c:"#5BE888" },
    { l:"Ranked L",    v: rankedL,   c: t.danger },
    { l:"Win Rate",    v: rankedW + rankedL > 0 ? `${Math.round((rankedW/(rankedW+rankedL))*100)}%` : "0%", c: t.accent },
    { l:"Total Games", v: totalGames, c: t.text },
    { l:"Draws",       v: draws,     c: t.gold },
    { l:"ELO",         v: elo,       c: rank.color },
    { l:"XP",          v: profile.xp, c: t.p1 },
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
      <button onClick={() => setShowEdit(false)} style={{ padding:"9px 16px", background:`${t.accent}18`, border:`1px solid ${t.accent}`, borderRadius:8, color:t.accent, fontFamily:t.fontDisplay, fontSize:12, fontWeight:700, cursor:"pointer", alignSelf:"flex-start" }}>
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
          <div style={{ position:"absolute", top:0, left:"-150%", width:"200%", height:"100%", background:"linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.1) 38%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.1) 42%, rgba(255,255,255,0) 50%)", zIndex:1, animation:"shineSweep 4s infinite linear" }} />
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
              <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.text, textShadow:"0 1px 4px rgba(0,0,0,0.5)" }}>LVL <span style={{ color:t.accent, fontWeight:700, fontSize:15 }}>{computedLevelFromXp}</span></div>
              <div style={{ display:"flex", alignItems:"center", gap:5, "--rank-col":rank.color } as any}>
                <RankIcon rank={rank} size={33} />
                <span style={{ fontFamily:t.fontBody, fontSize:14, color:rank.color, fontWeight:600, textShadow:"0 1px 4px rgba(0,0,0,0.5)" }}>{rank.name}</span>
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

      {/* ── ELO Progress bar ──────────────────────────────────────────────── */}
      <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px", marginBottom:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:9, flexWrap:"wrap", gap:6, alignItems:"center" }}>
          <span style={{ display:"flex", alignItems:"center", gap:8, fontFamily:t.fontDisplay, fontSize:17, color:rank.color, fontWeight:800, letterSpacing:"0.05em", "--rank-col":rank.color } as any}>
            <RankIcon rank={rank} size={42} />{rank.name}
          </span>
          {nextRank && (
            <span style={{ display:"flex", alignItems:"center", gap:7, fontFamily:t.fontDisplay, fontSize:15, color:t.text, fontWeight:700, "--rank-col":nextRank.color } as any}>
              <RankIcon rank={nextRank} size={36} />{nextRank.name}
              {rank.name === nextRank.name
                ? <span style={{ color:t.accent }}>&nbsp;· MAX RANK</span>
                : <span style={{ color:t.accent }}>&nbsp;· {rank.max - elo} ELO away</span>}
            </span>
          )}
        </div>
        <div style={{ height:10, background:t.bgCard, borderRadius:5, overflow:"hidden", border:`1px solid ${t.border}` }}>
          <div style={{ height:"100%", width:`${progress}%`, background:`linear-gradient(90deg,${rank.color},${t.accent})`, borderRadius:5, boxShadow:`0 0 10px ${rank.color}55`, transition:"width 1s ease" }} />
        </div>
        <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, marginTop:5, textAlign:"right" }}>{elo} / {nextRank ? rank.max : "MAX"}</div>
      </div>

      {/* ── XP / Level bar ───────────────────────────────────────────────── */}
      {(() => {
        const { level: lvl, rem: xpIntoLevel, nextXp: xpNeeded, progress } = computeLevelStatsFromTotalXp(totalXP);
        const nextLevelTotalXp = totalXpToReachLevel(lvl + 1);
        const pct = Math.min(progress, 100);
        return (
          <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px", marginBottom:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:"50%", background:`${t.accent}18`, border:`2px solid ${t.accent}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:t.fontDisplay, fontSize:14, fontWeight:900, color:t.accent }}>{lvl}</div>
                <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.text, fontWeight:600, letterSpacing:"0.1em" }}>LEVEL {lvl}</div>
              </div>
              <div style={{ fontFamily:t.fontMono, fontSize:12, color:t.textMuted }}>
                <span style={{ color:t.accent, fontWeight:700 }}>{xpIntoLevel.toLocaleString()}</span>{" / "}{xpNeeded.toLocaleString()} XP
              </div>
            </div>
            <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, marginBottom:8 }}>
              Total XP: <span style={{ color:t.text, fontWeight:700 }}>{totalXP.toLocaleString()}</span>{" / "}{nextLevelTotalXp.toLocaleString()}
            </div>
            <div style={{ height:10, background:t.bgCard, borderRadius:5, overflow:"hidden", border:`1px solid ${t.border}` }}>
              <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${t.accent},${t.p1})`, borderRadius:5, boxShadow:`0 0 10px ${t.accentGlow}55`, transition:"width 1s ease" }} />
            </div>
            <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, marginTop:5, textAlign:"right" }}>
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
              const isCurrent = r.name === rank.name;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:11, padding:"9px 13px", background:isCurrent?`${r.color}12`:"transparent", border:`1px solid ${isCurrent?r.color:t.border+"44"}`, borderRadius:7 }}>
                  <RankIcon rank={r} size={45} />
                  <div style={{ flex:1, fontFamily:t.fontDisplay, fontSize:16, fontWeight:isCurrent?800:600, color:isCurrent?r.color:t.textSecondary, letterSpacing:"0.05em" }}>{r.name}</div>
                  <div style={{ fontFamily:t.fontMono, fontSize:16, color:isCurrent?t.accent:t.text, fontWeight:isCurrent?800:600 }}>
                    {r.min >= 2500 ? `${r.min} and greater` : `${r.min} to ${r.max>=1000000?"∞":r.max}`}
                  </div>
                  {isCurrent && <div style={{ background:`${r.color}18`, border:`1px solid ${r.color}`, color:r.color, fontFamily:t.fontMono, fontSize:11, padding:"3px 10px", borderRadius:10, fontWeight:700 }}>YOU</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px" }}>
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

      {/* ══════════════════════════════════════════════════════════════════════
          EDIT PROFILE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showEdit && (
        <div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:18, width:"min(560px,100%)", maxHeight:"88vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:`0 32px 80px rgba(0,0,0,0.6)` }}>

            <div style={{ padding:"20px 26px 0", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:t.text }}>Edit Profile</div>
              <button onClick={() => setShowEdit(false)} style={{ background:"transparent", border:"none", color:t.textMuted, fontSize:20, cursor:"pointer", lineHeight:1, padding:"0 4px" }}>✕</button>
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
                            ✓ {avatarFile.name} ({(avatarFile.size/1024).toFixed(0)}KB) — ready to upload
                          </div>
                        )}
                      </div>
                      <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted }}>Max 2MB · JPEG/PNG/WebP<br/>Stored on Supabase CDN</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>USERNAME</div>
                    <input value={editUsername} maxLength={16} onChange={e => setEditUsername(e.target.value)} style={inputStyle} />
                    <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted, marginTop:4 }}>3–16 chars · letters, numbers, @ and _ only</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>BIO</div>
                    <textarea value={editBio} maxLength={200} onChange={e => setEditBio(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily:t.fontBody, fontSize:13, resize:"vertical" }} />
                    <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted, marginTop:2 }}>{editBio.length}/200</div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={submitProfile} disabled={editLoading} style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s", boxShadow:`0 0 12px ${t.accentGlow}33` }}>
                      {editLoading ? (avatarFile ? "Uploading to Supabase…" : "Saving…") : "Save Changes"}
                    </button>
                    <button onClick={() => setShowEdit(false)} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>Cancel</button>
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
                    <button onClick={() => setShowEdit(false)} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>Cancel</button>
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
                    <button onClick={() => setShowEdit(false)} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>Cancel</button>
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
                        <button onClick={() => setShowEdit(false)} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>Cancel</button>
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
                        <button onClick={() => setShowEdit(false)} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>Cancel</button>
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