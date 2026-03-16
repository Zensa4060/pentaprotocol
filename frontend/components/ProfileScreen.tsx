"use client";
import { useEffect, useState } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import API from "@/lib/api";
import { containsProfanity, validateUsername } from "@/lib/profanity";
import { SHARDS_LIGHT_SVG, SHARDS_DARK_SVG, PROTO_LIGHT_SVG, PROTO_DARK_SVG } from "@/lib/currencyIcons";
import type { Screen } from "@/lib/types";
import VoidRiftBanner from "./VoidRiftBanner";

const RANKS = [
  { name: "NOVICE",       min: 0,    max: 500,  color: "#9CA3AF", icon: null, img: "/novice.svg",       scale: 1.3 },
  { name: "ADVANCED",     min: 500,  max: 1000, color: "#60A5FA", icon: null, img: "/advanced.svg",     scale: 1.3 },
  { name: "PROFESSIONAL", min: 1000, max: 1500, color: "#34D399", icon: null, img: "/professional.svg", scale: 1.3 },
  { name: "EMERALD",      min: 1500, max: 2000, color: "#10B981", icon: null, img: "/emerald.svg",      scale: 1.495 },
  { name: "MASTER",       min: 2000, max: 2500, color: "#FF3333", icon: null, img: "/master.png" },
  { name: "LEGEND",       min: 2500, max: 9999, color: "#F59E0B", icon: null, img: "/legend.png" },
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

const RankIcon = ({ rank, size = 26 }: { rank: typeof RANKS[0]; size?: number }) => {
  const imgScale = (rank as any).scale ?? 1;
  const imgSize = size * 0.85 * imgScale;
  return rank.img ? (
    <div style={{ width:size, height:size, borderRadius:"50%", background:"#000000", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
      <img src={rank.img} alt={rank.name} style={{ width:imgSize, height:imgSize, objectFit:"contain" }} />
    </div>
  ) : (
    <div style={{ width:size, height:size, borderRadius:"50%", background:"#000000", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontSize:size*0.6, color:rank.color, lineHeight:1 }}>{rank.icon}</span>
    </div>
  );
};

// ── Title badge with animations ───────────────────────────────────────────────
function TitleBadge({ title, onClick }: { title: typeof TITLES[0]; onClick?: () => void }) {
  const animClass = `title-anim-${title.animation}`;
  return (
    <div onClick={onClick}
      className={animClass}
      style={{
        padding: "2px 10px", borderRadius: 20,
        border: `1px solid ${title.color}44`,
        background: `${title.color}12`,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s",
        display: "inline-flex", alignItems: "center",
      }}>
      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, fontWeight: 700, color: title.color, letterSpacing: "0.08em" }}>
        {title.label}
      </span>
    </div>
  );
}

function BannerRenderer({ banner, style = {} }: { banner: typeof BANNERS[0]; style?: React.CSSProperties }) {
  if (banner.component) {
    const BannerComp = banner.component;
    return <BannerComp style={{ width: "100%", height: "100%", ...style }} />;
  }
  return <div style={{ width: "100%", height: "100%", background: banner.gradient, ...style }} />;
}

// ── Avatar with animated border ───────────────────────────────────────────────
function AvatarWithBorder({
  profile, size = 68, borderDef, accentColor, bgColor,
  p1, p2,
}: {
  profile: any; size?: number; borderDef: typeof PROFILE_BORDERS[0];
  accentColor: string; bgColor: string; p1: string; p2: string;
}) {
  const isRainbow   = borderDef.id === "rainbow_halo";
  const isNoBorder  = borderDef.id === "none";
  const animClass   = isNoBorder ? "" : `border-anim-${borderDef.animation}`;

  // Build base boxShadow
  let shadow = "none";
  if (!isNoBorder) {
    if (isRainbow) {
      shadow = "0 0 0 3px #FF6B6B, 0 0 0 6px #FFD700, 0 0 20px #FF6B6BAA";
    } else {
      shadow = borderDef.css;
    }
  }

  return (
    <div
      className={animClass}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg,${p1},${p2})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.41,
        border: `3px solid ${bgColor}`,
        overflow: "hidden",
        boxShadow: shadow,
        position: "relative",
        flexShrink: 0,
      }}>
      {profile.avatar
        ? <img src={profile.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : "👤"}
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
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [twoFASection, setTwoFASection] = useState<"idle"|"setup"|"disable">("idle");
  const [qrCode, setQrCode]       = useState("");
  const [secret, setSecret]       = useState("");
  const [totpInput, setTotpInput] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAMsg, setTwoFAMsg]   = useState<{text:string;ok:boolean}|null>(null);
  const [twoFAReady, setTwoFAReady] = useState(false);

  const [showEdit, setShowEdit]       = useState(false);
  const [editTab, setEditTab]         = useState<EditTab>("profile");
  const [editMsg, setEditMsg]         = useState<{text:string;ok:boolean}|null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [editBio, setEditBio]           = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editAvatar, setEditAvatar]     = useState<string|null>(null);
  const [editBanner, setEditBanner]     = useState<string>("default");
  const [editBorder, setEditBorder]     = useState<string>("none");
  const [editTitle, setEditTitle]       = useState<string>("newcomer");

  const [pwCurrent, setPwCurrent]   = useState("");
  const [pwNew, setPwNew]           = useState("");
  const [pwConfirm, setPwConfirm]   = useState("");
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew]         = useState(false);
  const [pwTotpStep, setPwTotpStep]   = useState<"idle"|"awaiting_totp">("idle");
  const [pwTotpCode, setPwTotpCode]   = useState("");

  const [emailNew, setEmailNew]     = useState("");
  const [emailPw, setEmailPw]       = useState("");
  const [showEmailPw, setShowEmailPw] = useState(false);
  const [emailTotpStep, setEmailTotpStep] = useState<"idle"|"awaiting_totp">("idle");
  const [emailTotpCode, setEmailTotpCode] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetchProfile = async () => {
  try {
    const res = await API.get("/api/profile/me");
    setProfile(res.data);
    updateUser(res.data);
    setTwoFAReady(true);
  } catch {
    setProfile({ ...user, totp_enabled: false });
    setTwoFAReady(true);
  } finally { setLoading(false); }
};
    fetchProfile();
  }, [user]);

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:t.bg }}>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted }}>Loading…</div>
    </div>
  );
  if (!user) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:t.bg }}>
      <div style={{ fontFamily:t.fontDisplay, fontSize:24, color:t.textMuted }}>Sign in to view your profile</div>
    </div>
  );

  const elo      = profile.elo || 500;
  const rank     = getRank(elo);
  const nextRank = RANKS[RANKS.indexOf(rank) + 1];
  const progress = nextRank ? ((elo - rank.min) / (rank.max - rank.min)) * 100 : 100;
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const activeTitle  = TITLES.find(ti => ti.id === (profile.title || "newcomer")) || TITLES[0];
  const activeBanner = BANNERS.find(b => b.id === (profile.banner || "default")) || BANNERS[0];
  const activeBorderDef = PROFILE_BORDERS.find(b => b.id === (profile.border_style || "none")) || PROFILE_BORDERS[0];

  // ── 2FA helpers ───────────────────────────────────────────────────────────
  const start2FASetup = async () => {
    setTwoFALoading(true); setTwoFAMsg(null);
    try {
      const r = await API.post("/api/auth/2fa/setup", {}, authHeader);
      setQrCode(r.data.qr_code); setSecret(r.data.secret);
      setTwoFASection("setup");
    } catch (e: any) {
      setTwoFAMsg({ text: e.response?.data?.detail || "Failed to start setup", ok: false });
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
    } catch (e: any) {
      setTwoFAMsg({ text: e.response?.data?.detail || "Invalid code", ok:false });
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
    } catch (e: any) {
      setTwoFAMsg({ text: e.response?.data?.detail || "Invalid code", ok:false });
    } finally { setTwoFALoading(false); }
  };

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const openEdit = (tab: EditTab = "profile") => {
    setEditBio(profile.bio || "");
    setEditUsername(profile.username || "");
    setEditAvatar(null);
    setEditBanner(profile.banner || "default");
    setEditBorder(profile.border_style || "none");
    setEditTitle(profile.title || "newcomer");
    setPwCurrent(""); setPwNew(""); setPwConfirm("");
    setPwTotpStep("idle"); setPwTotpCode("");
    setEmailNew(""); setEmailPw("");
    setEmailTotpStep("idle"); setEmailTotpCode("");
    setEditMsg(null);
    setEditTab(tab);
    setShowEdit(true);
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
      setEditMsg({ text:"Only JPEG, PNG or WebP allowed", ok:false }); return;
    }
    if (file.size > 2*1024*1024) {
      setEditMsg({ text:"Image must be under 2MB", ok:false }); return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

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
      const payload: any = {};
      if (editUsername !== profile.username) payload.username = editUsername;
      if (editBio !== (profile.bio||""))     payload.bio      = editBio;
      if (editAvatar)                        payload.avatar   = editAvatar;
      if (!Object.keys(payload).length) { setShowEdit(false); return; }
      const res = await API.put("/api/profile/me", payload, authHeader);
      setProfile(res.data);
      setEditMsg({ text:"Profile updated!", ok:true });
      setTimeout(() => setShowEdit(false), 900);
    } catch(e:any) {
      setEditMsg({ text: e.response?.data?.detail || "Update failed", ok:false });
    } finally { setEditLoading(false); }
  };

  const submitBanner = async () => {
    setEditMsg(null); setEditLoading(true);
    try {
      const res = await API.put("/api/profile/me", { banner: editBanner }, authHeader);
      setProfile(res.data);
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
      setEditMsg({ text:"Title equipped!", ok:true });
      setTimeout(() => setShowEdit(false), 900);
    } catch(e:any) {
      setEditMsg({ text: e.response?.data?.detail || "Update failed", ok:false });
    } finally { setEditLoading(false); }
  };

  const submitPassword = async () => {
    setEditMsg(null);
    if (!pwCurrent) { setEditMsg({ text:"Enter your current password", ok:false }); return; }
    if (pwNew.length < 8) { setEditMsg({ text:"New password must be at least 8 characters", ok:false }); return; }
    if (pwNew !== pwConfirm) { setEditMsg({ text:"New passwords do not match", ok:false }); return; }
    if (profile.totp_enabled && pwTotpStep === "idle") {
      setPwTotpStep("awaiting_totp");
      setEditMsg({ text:"Enter your authenticator code to confirm.", ok:true });
      return;
    }
    if (profile.totp_enabled && pwTotpStep === "awaiting_totp") {
      if (pwTotpCode.trim().length !== 6) { setEditMsg({ text:"Enter the 6-digit authenticator code", ok:false }); return; }
    }
    setEditLoading(true);
    try {
      await API.post("/api/auth/change-password", {
        current_password: pwCurrent,
        new_password: pwNew,
        ...(profile.totp_enabled ? { totp_code: pwTotpCode.trim() } : {}),
      }, authHeader);
      setEditMsg({ text:"Password changed successfully!", ok:true });
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setPwTotpStep("idle"); setPwTotpCode("");
    } catch(e:any) {
      setEditMsg({ text: e.response?.data?.detail || "Failed to change password", ok:false });
      setPwTotpStep("idle"); setPwTotpCode("");
    } finally { setEditLoading(false); }
  };

  const submitEmail = async () => {
    setEditMsg(null);
    if (!emailNew || !emailNew.includes("@")) { setEditMsg({ text:"Enter a valid email address", ok:false }); return; }
    if (!emailPw) { setEditMsg({ text:"Enter your password to confirm", ok:false }); return; }
    if (profile.totp_enabled && emailTotpStep === "idle") {
      setEmailTotpStep("awaiting_totp");
      setEditMsg({ text:"Enter your authenticator code to confirm.", ok:true });
      return;
    }
    if (profile.totp_enabled && emailTotpStep === "awaiting_totp") {
      if (emailTotpCode.trim().length !== 6) { setEditMsg({ text:"Enter the 6-digit authenticator code", ok:false }); return; }
    }
    setEditLoading(true);
    try {
      await API.post("/api/auth/change-email", {
        new_email: emailNew,
        password: emailPw,
        ...(profile.totp_enabled ? { totp_code: emailTotpCode.trim() } : {}),
      }, authHeader);
      setEditMsg({ text:"Email updated! Check your inbox to verify.", ok:true });
      setEmailNew(""); setEmailPw("");
      setEmailTotpStep("idle"); setEmailTotpCode("");
    } catch(e:any) {
      setEditMsg({ text: e.response?.data?.detail || "Failed to update email", ok:false });
      setEmailTotpStep("idle"); setEmailTotpCode("");
    } finally { setEditLoading(false); }
  };

  const enabled = profile.totp_enabled;

 const rankedW   = profile.wins        || 0;
const rankedL   = profile.losses      || 0;
const unrankedW = profile.unranked_wins   || 0;
const unrankedL = profile.unranked_losses || 0;
const draws     = profile.draws       || 0;
const totalGames = rankedW + rankedL + unrankedW + unrankedL + draws;

const stats = [
  { l:"Ranked W",    v: rankedW,   c:"#5BE888" },
  { l:"Ranked L",    v: rankedL,   c: t.danger },
  { l:"Unranked W",  v: unrankedW, c:"#34D399" },
  { l:"Unranked L",  v: unrankedL, c:"#F97316" },
  { l:"Win Rate",    v: rankedW + rankedL > 0 ? `${Math.round((rankedW/(rankedW+rankedL))*100)}%` : "0%", c: t.accent },
  { l:"Total Games", v: totalGames, c: t.text },
  { l:"Draws",       v: draws,     c: t.gold },
  { l:"XP",          v: profile.xp, c: t.p1 },
  { l:"Penta Shards",   v: profile.pentashards ?? profile.shards ?? 0, c:"#4FC3F7" },
  { l:"Proto Credits",  v: profile.protocredits || 0, c:"#FFD700" },
];

  const TABS: { id: EditTab; label: string }[] = [
    { id: "profile",  label: "Profile"  },
    { id: "banner",   label: "Banner"   },
    { id: "border",   label: "Border"   },
    { id: "title",    label: "Title"    },
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

  // Border preview helper for edit modal
  const previewBorderDef = PROFILE_BORDERS.find(b => b.id === editBorder) || PROFILE_BORDERS[0];
  const previewIsRainbow = previewBorderDef.id === "rainbow_halo";
  const previewShadow = previewBorderDef.id === "none" ? "none"
    : previewIsRainbow ? "0 0 0 3px #FF6B6B, 0 0 0 6px #FFD700, 0 0 20px #FF6B6BAA"
    : previewBorderDef.css;

  return (
    <>
    <style>{`
      /* ── Title animations ─────────────────────────────────────────────── */
      .title-anim-none { }

      .title-anim-pulse {
        animation: titlePulse 2s ease-in-out infinite;
      }
      @keyframes titlePulse {
        0%, 100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
        50%       { box-shadow: 0 0 10px 2px var(--tc, #60A5FA); opacity: 0.85; }
      }

      .title-anim-shimmer {
        position: relative; overflow: hidden;
      }
      .title-anim-shimmer::after {
        content: '';
        position: absolute; top: 0; left: -100%;
        width: 60%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
        animation: titleShimmer 2.4s ease-in-out infinite;
      }
      @keyframes titleShimmer {
        0%   { left: -100%; }
        100% { left: 160%; }
      }

      .title-anim-flicker {
        animation: titleFlicker 3s linear infinite;
      }
      @keyframes titleFlicker {
        0%,19%,21%,23%,25%,54%,56%,100% { opacity: 1; }
        20%,22%,24%,55% { opacity: 0.4; }
      }

      .title-anim-fire {
        animation: titleFire 1.5s ease-in-out infinite alternate;
      }
      @keyframes titleFire {
        0%   { box-shadow: 0 0 4px #FF3333, 0 0 8px #FF6600; text-shadow: 0 0 6px #FF3333; }
        100% { box-shadow: 0 0 10px #FF6600, 0 0 20px #FF3333AA; text-shadow: 0 0 12px #FF6600; }
      }

      .title-anim-rainbow {
        animation: titleRainbow 3s linear infinite;
        background-clip: text;
      }
      @keyframes titleRainbow {
        0%   { border-color: #FF6B6B44; box-shadow: 0 0 8px #FF6B6B55; }
        16%  { border-color: #FFD70044; box-shadow: 0 0 8px #FFD70055; }
        33%  { border-color: #5BE88844; box-shadow: 0 0 8px #5BE88855; }
        50%  { border-color: #60A5FA44; box-shadow: 0 0 8px #60A5FA55; }
        66%  { border-color: #A78BFA44; box-shadow: 0 0 8px #A78BFA55; }
        83%  { border-color: #FB718544; box-shadow: 0 0 8px #FB718555; }
        100% { border-color: #FF6B6B44; box-shadow: 0 0 8px #FF6B6B55; }
      }

      .title-anim-electric {
        animation: titleElectric 0.8s steps(1) infinite;
      }
      @keyframes titleElectric {
        0%,100% { box-shadow: 0 0 6px #38BDF8, 0 0 12px #A78BFA; opacity: 1; }
        25%      { box-shadow: 0 0 2px #38BDF8; opacity: 0.9; }
        50%      { box-shadow: 0 0 10px #A78BFA, 0 0 20px #38BDF8AA; opacity: 1; }
        75%      { box-shadow: 0 0 4px #38BDF8; opacity: 0.85; }
      }

      /* ── Border animations ─────────────────────────────────────────────── */
      .border-anim-none   { }

      .border-anim-pulse {
        animation: borderPulse 2s ease-in-out infinite;
      }
      @keyframes borderPulse {
        0%,100% { filter: brightness(1); }
        50%     { filter: brightness(1.5) saturate(1.4); }
      }

      .border-anim-spin {
        position: relative;
      }
      .border-anim-spin::before {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        background: conic-gradient(#F59E0B, #FCD34D, #F59E0B, #B45309, #F59E0B);
        animation: borderSpin 2s linear infinite;
        z-index: -1;
      }
      @keyframes borderSpin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }

      .border-anim-fire {
        animation: borderFire 1.5s ease-in-out infinite alternate;
      }
      @keyframes borderFire {
        0%   { filter: drop-shadow(0 0 4px #FF3333) drop-shadow(0 0 8px #FF6600); }
        100% { filter: drop-shadow(0 0 10px #FF6600) drop-shadow(0 0 18px #FF3333); }
      }

      .border-anim-electric {
        animation: borderElectric 0.6s steps(1) infinite;
      }
      @keyframes borderElectric {
        0%,100% { filter: drop-shadow(0 0 5px #A78BFA) drop-shadow(0 0 10px #7C3AED); }
        33%      { filter: drop-shadow(0 0 2px #7C3AED); }
        66%      { filter: drop-shadow(0 0 8px #A78BFA) drop-shadow(0 0 14px #38BDF8); }
      }

      .border-anim-rainbow {
        animation: borderRainbow 3s linear infinite;
      }
      @keyframes borderRainbow {
        0%   { filter: drop-shadow(0 0 6px #FF6B6B); }
        16%  { filter: drop-shadow(0 0 6px #FFD700); }
        33%  { filter: drop-shadow(0 0 6px #5BE888); }
        50%  { filter: drop-shadow(0 0 6px #60A5FA); }
        66%  { filter: drop-shadow(0 0 6px #A78BFA); }
        83%  { filter: drop-shadow(0 0 6px #FB7185); }
        100% { filter: drop-shadow(0 0 6px #FF6B6B); }
      }

      /* ── Misc ─────────────────────────────────────────────────────────── */
      .edit-tab-btn { transition: all 0.18s ease; }
      .edit-tab-btn:hover { opacity: 0.85; }
      .banner-card { transition: transform 0.15s ease, box-shadow 0.15s ease; cursor:pointer; }
      .banner-card:hover { transform: translateY(-2px); }
      .title-pill { transition: all 0.15s ease; cursor:pointer; }
      .title-pill:hover { transform: translateY(-1px); }
      .pw-eye { cursor:pointer; user-select:none; opacity:0.5; transition:opacity 0.15s; }
      .pw-eye:hover { opacity:1; }
    `}</style>

    <div style={{ position:"fixed", inset:0, zIndex:2, padding:"84px 24px 48px", overflowY:"auto", background:t.bg, transition:"background 0.4s" }}>

      {/* ── Banner + Avatar + Name ─────────────────────────────────────────── */}
      <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:16, marginBottom:18, overflow:"hidden", position: "relative" }}>
        
        {/* Banner background (Full Panel) */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.8 }}>
          <BannerRenderer banner={activeBanner} />
        </div>

        {/* Change Banner overlay (Top strip hit area) */}
        <div
          onClick={() => { onClickAction?.(); openEdit("banner"); }}
          style={{ height: 100, cursor:"pointer", position:"relative", transition:"filter 0.2s", overflow: "hidden", zIndex: 1 }}
          title="Change banner"
        >
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"flex-end", padding:"0 16px", opacity:0, transition:"opacity 0.2s" }}
            onMouseEnter={e => { onHoverAction?.(); (e.currentTarget as HTMLElement).style.opacity="1"; }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity="0"}>
            <div style={{ background:"rgba(0,0,0,0.6)", border:`1px solid ${t.border}`, borderRadius:6, padding:"4px 12px", fontFamily:t.fontMono, fontSize:11, color:"#fff", letterSpacing:"0.1em" }}>
              CHANGE BANNER
            </div>
          </div>
        </div>

        {/* Content Overlay */}
        <div style={{ position: "relative", zIndex: 2, display:"flex", alignItems:"flex-end", gap:22, padding:"0 26px 26px", flexWrap:"wrap", background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)" }}>
          
          {/* Avatar with live border */}
          <div style={{ position:"relative", flexShrink:0 }}>
            <AvatarWithBorder
              profile={profile}
              size={72}
              borderDef={activeBorderDef}
              accentColor={t.accent}
              bgColor={t.bg}
              p1={t.p1}
              p2={t.p2}
            />
            <div onClick={() => { onClickAction?.(); openEdit("profile"); }}
              style={{ position:"absolute", bottom:0, right:0, width:24, height:24, borderRadius:"50%", background:t.accent, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:11, border:`2px solid ${t.bg}`, boxShadow: "0 0 10px rgba(0,0,0,0.5)" }}>✏</div>
          </div>

          {/* Name + rank + title */}
          <div style={{ flex:1, minWidth:150 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:4 }}>
              <div style={{ fontFamily:t.fontDisplay, fontSize:26, fontWeight:700, color:t.text, textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>{profile.username}</div>
              {/* Active title badge with animation */}
              <TitleBadge title={activeTitle} onClick={() => { onClickAction?.(); openEdit("title"); }} />
            </div>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap", alignItems:"center" }}>
              <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.text, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>LVL <span style={{ color:t.accent, fontWeight:700, fontSize:15 }}>{profile.level}</span></div>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <RankIcon rank={rank} size={22} />
                <span style={{ fontFamily:t.fontBody, fontSize:14, color:rank.color, fontWeight:600, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{rank.name}</span>
              </div>
            </div>
            {profile.bio && (
              <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted, marginTop:6, fontStyle:"italic", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>"{profile.bio}"</div>
            )}
          </div>

          {/* ELO + edit button */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:12, flexShrink:0 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:t.fontDisplay, fontSize:54, fontWeight:900, color:t.accent, lineHeight:1, textShadow:`0 0 28px ${t.accentGlow}50, 0 2px 12px rgba(0,0,0,0.8)` }}>{elo}</div>
              <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.text, letterSpacing:"0.2em", marginTop:4, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>ELO</div>
            </div>
            <button onClick={() => { onClickAction?.(); openEdit("profile"); }} style={{ padding:"8px 18px", background:`rgba(0,0,0,0.6)`, border:`1px solid ${t.accent}`, borderRadius:8, color:t.accent, fontFamily:t.fontDisplay, fontSize:12, fontWeight:700, cursor:"pointer", backdropFilter: "blur(4px)", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.6)"; e.currentTarget.style.color = t.accent; }}>
              ✏ Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* ── ELO Progress bar ──────────────────────────────────────────────── */}
      <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px", marginBottom:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:9, flexWrap:"wrap", gap:6, alignItems:"center" }}>
          <span style={{ display:"flex", alignItems:"center", gap:8, fontFamily:t.fontDisplay, fontSize:17, color:rank.color, fontWeight:800, letterSpacing:"0.05em" }}>
            <RankIcon rank={rank} size={28} />{rank.name}
          </span>
          {nextRank && (
            <span style={{ display:"flex", alignItems:"center", gap:7, fontFamily:t.fontDisplay, fontSize:15, color:t.text, fontWeight:700 }}>
              <RankIcon rank={nextRank} size={24} />{nextRank.name} <span style={{ color:t.accent }}>&nbsp;· {rank.max - elo} ELO away</span>
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
        const totalXP: number = profile.xp || 0;
        const lvl: number     = profile.level || 1;
        const xpForLvl = (l: number) => 5000 + (l - 1) * 1000;
        let rem = totalXP;
        for (let l = 1; l < lvl; l++) rem -= xpForLvl(l);
        const xpIntoLevel = Math.max(0, rem);
        const xpNeeded    = xpForLvl(lvl);
        const pct         = Math.min((xpIntoLevel / xpNeeded) * 100, 100);
        return (
          <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px", marginBottom:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:"50%", background:`${t.accent}18`, border:`2px solid ${t.accent}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:t.fontDisplay, fontSize:14, fontWeight:900, color:t.accent }}>
                  {lvl}
                </div>
                <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.text, fontWeight:600, letterSpacing:"0.1em" }}>
                  LEVEL {lvl}
                </div>
              </div>
              <div style={{ fontFamily:t.fontMono, fontSize:12, color:t.textMuted }}>
                <span style={{ color:t.accent, fontWeight:700 }}>{xpIntoLevel.toLocaleString()}</span>
                {" / "}{xpNeeded.toLocaleString()} XP
              </div>
            </div>
            <div style={{ height:10, background:t.bgCard, borderRadius:5, overflow:"hidden", border:`1px solid ${t.border}` }}>
              <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${t.accent},${t.p1})`, borderRadius:5, boxShadow:`0 0 10px ${t.accentGlow}55`, transition:"width 1s ease" }} />
            </div>
            <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, marginTop:5, textAlign:"right" }}>
              {(xpNeeded - xpIntoLevel).toLocaleString()} XP to level {lvl + 1}
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ fontFamily:t.fontDisplay, fontSize:24, fontWeight:700, color:s.c }}>{s.v}</div>
                {isPenta && (
                  <div style={{ width:24, height:24, flexShrink:0 }} dangerouslySetInnerHTML={{ __html: (themeId==="classic_light"?SHARDS_LIGHT_SVG:SHARDS_DARK_SVG).replace('<svg ','<svg width="24" height="24" ') }} />
                )}
                {isProto && (
                  <div style={{ width:24, height:24, flexShrink:0 }} dangerouslySetInnerHTML={{ __html: (themeId==="classic_light"?PROTO_LIGHT_SVG:PROTO_DARK_SVG).replace('<svg ','<svg width="24" height="24" ') }} />
                )}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.text, letterSpacing:"0.08em", fontWeight:600 }}>{s.l.toUpperCase()}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom row: Rank Ladder + Security ────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:14, alignItems:"start" }}>
        {/* Rank Ladder */}
        <div style={{ background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:12, padding:"16px 22px" }}>
          <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.text, letterSpacing:"0.15em", marginBottom:12, fontWeight:600 }}>RANK LADDER · SEASON II</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {RANKS.map((r, i) => {
              const isCurrent = r.name === rank.name;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:11, padding:"9px 13px", background:isCurrent?`${r.color}12`:"transparent", border:`1px solid ${isCurrent?r.color:t.border+"44"}`, borderRadius:7 }}>
                  <RankIcon rank={r} size={30} />
                  <div style={{ flex:1, fontFamily:t.fontDisplay, fontSize:16, fontWeight:isCurrent?800:600, color:isCurrent?r.color:t.textSecondary, letterSpacing:"0.05em" }}>{r.name}</div>
                  <div style={{ fontFamily:t.fontMono, fontSize:16, color:isCurrent?t.accent:t.text, fontWeight:isCurrent?800:600 }}>{r.min}–{r.max===9999?"∞":r.max}</div>
                  {isCurrent && <div style={{ background:`${r.color}18`, border:`1px solid ${r.color}`, color:r.color, fontFamily:t.fontMono, fontSize:11, padding:"3px 10px", borderRadius:10, fontWeight:700 }}>YOU</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Security / 2FA */}
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
                <button onClick={() => { onClickAction?.(); confirm2FA(); }} disabled={twoFALoading} className="pp-primary-btn" style={{ flex:1, padding:"10px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:12, fontWeight:800, cursor:"pointer", transition:"all 0.18s", boxShadow:`0 0 10px ${t.accentGlow}22` }}>{twoFALoading?"Verifying…":"Confirm"}</button>
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

            {/* Modal header */}
            <div style={{ padding:"20px 26px 0", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:t.text }}>Edit Profile</div>
              <button onClick={() => setShowEdit(false)} style={{ background:"transparent", border:"none", color:t.textMuted, fontSize:20, cursor:"pointer", lineHeight:1, padding:"0 4px" }}>✕</button>
            </div>

            {/* Tab bar */}
            <div style={{ display:"flex", gap:4, padding:"14px 26px 0", flexShrink:0, overflowX:"auto" }}>
              {TABS.map(tab => (
                <button key={tab.id} className="edit-tab-btn"
                  onClick={() => { onClickAction?.(); setEditTab(tab.id); setEditMsg(null); }}
                  style={{
                    padding: "8px 16px", borderRadius: "8px 8px 0 0",
                    background: editTab===tab.id ? t.bgCard : "transparent",
                    border: `1px solid ${editTab===tab.id ? t.border : "transparent"}`,
                    borderBottom: editTab===tab.id ? `1px solid ${t.bgCard}` : `1px solid ${t.border}44`,
                    color: editTab===tab.id ? t.accent : t.textSecondary,
                    fontFamily: t.fontMono, fontSize: 13,
                    fontWeight: (editTab===tab.id ? 800 : 600) as React.CSSProperties["fontWeight"],
                    letterSpacing: "0.08em" as React.CSSProperties["letterSpacing"],
                    cursor: "pointer" as React.CSSProperties["cursor"],
                    whiteSpace: "nowrap" as const,
                    display: "flex", alignItems: "center", gap: 5,
                    transition: "color 0.15s, background 0.15s",
                  }}>
                  {tab.label.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ height:1, background:t.border+"44", flexShrink:0, marginTop:-1 }} />

            {/* Scrollable content area */}
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
                      <div style={{ width:56, height:56, borderRadius:"50%", background:`linear-gradient(135deg,${t.p1},${t.p2})`, overflow:"hidden", border:`2px solid ${t.border}`, flexShrink:0 }}>
                        {(editAvatar||profile.avatar) ? <img src={editAvatar||profile.avatar} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>👤</div>}
                      </div>
                      <label style={{ padding:"8px 16px", background:`${t.accent}18`, border:`1px solid ${t.accent}`, borderRadius:8, color:t.accent, fontFamily:t.fontDisplay, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        Choose Image
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarFile} style={{ display:"none" }} />
                      </label>
                      <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted }}>Max 2MB · JPEG/PNG/WebP</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>USERNAME</div>
                    <input value={editUsername} maxLength={16} onChange={e => setEditUsername(e.target.value)} style={inputStyle} />
                    <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted, marginTop:4 }}>3–16 chars · letters, numbers, @ and _ only</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>BIO</div>
                    <textarea value={editBio} maxLength={200} onChange={e => setEditBio(e.target.value)} rows={3}
                      style={{ ...inputStyle, fontFamily:t.fontBody, fontSize:13, resize:"vertical" }} />
                    <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted, marginTop:2 }}>{editBio.length}/200</div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={submitProfile} disabled={editLoading}
                      className="pp-primary-btn" style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s", boxShadow:`0 0 12px ${t.accentGlow}33` }}>
                      {editLoading?"Saving…":"Save Changes"}
                    </button>
                    <button onClick={() => setShowEdit(false)}
                      style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {/* ── TAB: BANNER ──────────────────────────────────────────── */}
              {editTab==="banner" && (
                <>
                  <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>
                    Choose a profile banner. Locked banners are earned by playing.
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {BANNERS.map(b => {
                      const unlocked = b.condition(profile);
                      const selected = editBanner === b.id;
                      return (
                        <div key={b.id} className="banner-card"
                          onClick={() => unlocked && setEditBanner(b.id)}
                          style={{
                            borderRadius:10, overflow:"hidden",
                            border:`2px solid ${selected?t.accent:unlocked?t.border:t.border+"44"}`,
                            opacity: unlocked ? 1 : 0.45,
                            cursor: unlocked ? "pointer" : "not-allowed",
                            position:"relative",
                            boxShadow: selected ? `0 0 16px ${t.accent}44` : "none",
                          }}>
                          <div style={{ height:52, overflow: "hidden" }}>
                            <BannerRenderer banner={b} />
                          </div>
                          <div style={{ padding:"8px 12px", background:t.bgCard, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                            <div>
                              <div style={{ fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, color:unlocked?t.text:t.textMuted }}>{b.label}</div>
                              <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, marginTop:2 }}>{unlocked?"Unlocked":b.unlockDesc}</div>
                            </div>
                            {selected && <div style={{ width:18, height:18, borderRadius:"50%", background:t.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#000", fontWeight:700 }}>✓</div>}
                            {!unlocked && <LockSVG />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={submitBanner} disabled={editLoading}
                      className="pp-primary-btn" style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s", boxShadow:`0 0 12px ${t.accentGlow}33` }}>
                      {editLoading?"Saving…":"Apply Banner"}
                    </button>
                    <button onClick={() => setShowEdit(false)}
                      style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {/* ── TAB: BORDER ──────────────────────────────────────────── */}
              {editTab==="border" && (
                <>
                  <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>
                    Profile borders appear around your avatar. Higher-tier borders have special animations.
                  </div>
                  {/* Tier legend */}
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" as const }}>
                    {(["basic","rare","epic","legendary"] as const).map(tier => (
                      <div key={tier} style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:TIER_COLOR[tier] }} />
                        <span style={{ fontFamily:t.fontMono, fontSize:10, color:TIER_COLOR[tier], letterSpacing:"0.08em", textTransform:"uppercase" as const }}>{tier}</span>
                      </div>
                    ))}
                  </div>

                  {/* Live preview of selected border */}
                  <div style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 16px", background:t.bgCard, borderRadius:12, border:`1px solid ${t.border}` }}>
                    <div
                      className={previewBorderDef.id !== "none" ? `border-anim-${previewBorderDef.animation}` : ""}
                      style={{
                        width:52, height:52, borderRadius:"50%",
                        background:`linear-gradient(135deg,${t.p1},${t.p2})`,
                        border:`3px solid ${t.bg}`,
                        boxShadow: previewShadow,
                        display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0,
                      }}>
                      {profile.avatar ? <img src={profile.avatar} style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"50%" }} /> : "👤"}
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
                      const itemShadow = b.id === "none" ? "none"
                        : isRainbow ? "0 0 0 3px #FF6B6B, 0 0 0 6px #FFD700, 0 0 20px #FF6B6BAA"
                        : b.css;
                      return (
                        <div key={b.id}
                          onClick={() => unlocked && setEditBorder(b.id)}
                          style={{
                            borderRadius:12, padding:"14px 14px 12px",
                            background: selected ? `${tc}10` : t.bgCard,
                            border:`2px solid ${selected?tc:unlocked?tc+"33":t.border+"33"}`,
                            opacity: unlocked ? 1 : 0.42,
                            cursor: unlocked ? "pointer" : "not-allowed",
                            boxShadow: selected ? `0 0 18px ${tc}44` : "none",
                            transition:"all 0.18s",
                            display:"flex", alignItems:"center", gap:12,
                          }}>
                          <div
                            className={unlocked && b.id !== "none" ? `border-anim-${b.animation}` : ""}
                            style={{
                              width:42, height:42, borderRadius:"50%", flexShrink:0,
                              background:`linear-gradient(135deg,${t.p1},${t.p2})`,
                              border:`2px solid ${t.bg}`,
                              boxShadow: unlocked && b.id !== "none" ? itemShadow : "none",
                            }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                              <span style={{ fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, color:unlocked?t.text:t.textMuted }}>{b.label}</span>
                              <span style={{ fontFamily:t.fontMono, fontSize:9, fontWeight:700, color:tc, letterSpacing:"0.1em", background:`${tc}18`, padding:"1px 6px", borderRadius:4 }}>{b.tier.toUpperCase()}</span>
                            </div>
                            <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted }}>{unlocked ? "Unlocked" : b.unlockDesc}</div>
                          </div>
                          {!unlocked && <LockSVG />}
                          {unlocked && selected && <div style={{ width:18, height:18, borderRadius:"50%", background:tc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#000", fontWeight:700, flexShrink:0 }}>✓</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={submitBorder} disabled={editLoading}
                      className="pp-primary-btn" style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s", boxShadow:`0 0 12px ${t.accentGlow}33` }}>
                      {editLoading?"Saving…":"Equip Border"}
                    </button>
                    <button onClick={() => setShowEdit(false)}
                      style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {/* ── TAB: TITLE ───────────────────────────────────────────── */}
              {editTab==="title" && (
                <>
                  <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>
                    Your title appears below your username. Earn titles by ranking up, winning matches, and reaching milestones.
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {TITLES.map(ti => {
                      const unlocked = ti.condition(profile);
                      const selected = editTitle === ti.id;
                      return (
                        <div key={ti.id} className="title-pill"
                          onClick={() => unlocked && setEditTitle(ti.id)}
                          style={{
                            display:"flex", alignItems:"center", justifyContent:"space-between",
                            padding:"11px 16px", borderRadius:10,
                            border:`1px solid ${selected?ti.color:unlocked?ti.color+"44":t.border+"33"}`,
                            background: selected?`${ti.color}14`:unlocked?`${ti.color}06`:"transparent",
                            opacity: unlocked ? 1 : 0.4,
                            cursor: unlocked ? "pointer" : "not-allowed",
                            boxShadow: selected ? `0 0 12px ${ti.glow}` : "none",
                            transition:"all 0.15s",
                          }}>
                          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                            <div style={{ width:10, height:10, borderRadius:"50%", background:ti.color, boxShadow:`0 0 6px ${ti.glow}`, flexShrink:0 }} />
                            <div>
                              {/* Show animated title preview inline */}
                              <div className={unlocked ? `title-anim-${ti.animation}` : ""}
                                style={{ display:"inline-block", padding:"1px 8px", borderRadius:10, border:`1px solid ${ti.color}44`, background:`${ti.color}12`, marginBottom:4 }}>
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
                    <button onClick={submitTitle} disabled={editLoading}
                      className="pp-primary-btn" style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s", boxShadow:`0 0 12px ${t.accentGlow}33` }}>
                      {editLoading?"Saving…":"Equip Title"}
                    </button>
                    <button onClick={() => setShowEdit(false)}
                      style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {/* ── TAB: PASSWORD ────────────────────────────────────────── */}
              {editTab==="password" && (
                <>
                  <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>
                    Choose a strong password with at least 8 characters, mixing letters, numbers and symbols.
                  </div>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>CURRENT PASSWORD</div>
                    <div style={{ position:"relative" }}>
                      <input type={showPwCurrent?"text":"password"} value={pwCurrent} onChange={e => setPwCurrent(e.target.value)}
                        placeholder="Enter current password" style={{ ...inputStyle, paddingRight:42 }} />
                      <span className="pw-eye" onClick={() => setShowPwCurrent(v=>!v)}
                        style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center" }}>
                        {showPwCurrent
                          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>NEW PASSWORD</div>
                    <div style={{ position:"relative" }}>
                      <input type={showPwNew?"text":"password"} value={pwNew} onChange={e => setPwNew(e.target.value)}
                        placeholder="Enter new password" style={{ ...inputStyle, paddingRight:42 }} />
                      <span className="pw-eye" onClick={() => setShowPwNew(v=>!v)}
                        style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center" }}>
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
                    <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                      placeholder="Re-enter new password"
                      style={{ ...inputStyle, borderColor: pwConfirm && pwNew && pwConfirm !== pwNew ? t.danger : t.border }} />
                    {pwConfirm && pwNew && pwConfirm !== pwNew && (
                      <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.danger, marginTop:3 }}>Passwords do not match</div>
                    )}
                  </div>
                  {pwTotpStep === "awaiting_totp" && profile.totp_enabled && (
                    <div style={{ background:`${t.accent}08`, border:`1px solid ${t.accent}33`, borderRadius:10, padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:`${t.accent}18`, border:`1px solid ${t.accent}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🔐</div>
                        <div>
                          <div style={{ fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, color:t.accent }}>Authenticator Required</div>
                          <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted }}>Enter the 6-digit code from your authenticator app</div>
                        </div>
                      </div>
                      <input type="text" value={pwTotpCode} maxLength={6} autoFocus
                        onChange={e => setPwTotpCode(e.target.value.replace(/\D/g,""))}
                        placeholder="000000"
                        style={{ ...inputStyle, fontSize:22, letterSpacing:"0.35em", textAlign:"center" as const }} />
                      <button onClick={() => { setPwTotpStep("idle"); setPwTotpCode(""); setEditMsg(null); }}
                        style={{ marginTop:8, background:"none", border:"none", color:t.textMuted, fontFamily:t.fontBody, fontSize:12, cursor:"pointer", padding:0 }}>
                        ← Cancel
                      </button>
                    </div>
                  )}
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={submitPassword} disabled={editLoading}
                      className="pp-primary-btn" style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s", boxShadow:`0 0 12px ${t.accentGlow}33` }}>
                      {editLoading ? "Saving…" : pwTotpStep === "awaiting_totp" ? "Confirm & Change Password" : "Change Password"}
                    </button>
                    <button onClick={() => setShowEdit(false)}
                      style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {/* ── TAB: EMAIL ───────────────────────────────────────────── */}
              {editTab==="email" && (
                <>
                  <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>
                    Current email: <span style={{ color:t.text, fontWeight:600 }}>{profile.email || "not set"}</span>
                  </div>
                  <div style={{ background:`${t.accent}0A`, border:`1px solid ${t.accent}22`, borderRadius:8, padding:"10px 14px", fontFamily:t.fontBody, fontSize:12, color:t.textMuted }}>
                    ℹ A verification link will be sent to your new email. Your email won't change until you verify it.
                  </div>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>NEW EMAIL ADDRESS</div>
                    <input type="email" value={emailNew} onChange={e => setEmailNew(e.target.value)}
                      placeholder="you@example.com" style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>CONFIRM WITH PASSWORD</div>
                    <div style={{ position:"relative" }}>
                      <input type={showEmailPw?"text":"password"} value={emailPw} onChange={e => setEmailPw(e.target.value)}
                        placeholder="Your current password" style={{ ...inputStyle, paddingRight:42 }} />
                      <span className="pw-eye" onClick={() => setShowEmailPw(v=>!v)}
                        style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", display:"flex", alignItems:"center" }}>
                        {showEmailPw
                          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                      </span>
                    </div>
                  </div>
                  {emailTotpStep === "awaiting_totp" && profile.totp_enabled && (
                    <div style={{ background:`${t.accent}08`, border:`1px solid ${t.accent}33`, borderRadius:10, padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:`${t.accent}18`, border:`1px solid ${t.accent}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🔐</div>
                        <div>
                          <div style={{ fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, color:t.accent }}>Authenticator Required</div>
                          <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted }}>Enter the 6-digit code from your authenticator app</div>
                        </div>
                      </div>
                      <input type="text" value={emailTotpCode} maxLength={6} autoFocus
                        onChange={e => setEmailTotpCode(e.target.value.replace(/\D/g,""))}
                        placeholder="000000"
                        style={{ ...inputStyle, fontSize:22, letterSpacing:"0.35em", textAlign:"center" as const }} />
                      <button onClick={() => { setEmailTotpStep("idle"); setEmailTotpCode(""); setEditMsg(null); }}
                        style={{ marginTop:8, background:"none", border:"none", color:t.textMuted, fontFamily:t.fontBody, fontSize:12, cursor:"pointer", padding:0 }}>
                        ← Cancel
                      </button>
                    </div>
                  )}
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={submitEmail} disabled={editLoading}
                      className="pp-primary-btn" style={{ flex:1, padding:"13px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:8, color:"#fff", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.18s", boxShadow:`0 0 12px ${t.accentGlow}33` }}>
                      {editLoading ? "Saving…" : emailTotpStep === "awaiting_totp" ? "Confirm & Update Email" : "Update Email"}
                    </button>
                    <button onClick={() => setShowEdit(false)}
                      style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}

            </div>{/* end scroll area */}
          </div>
        </div>
      )}

    </div>
    </>
  );
}
