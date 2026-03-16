"use client";
import { useEffect, useState } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import API from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { TITLES } from "@/components/ProfileScreen";

// Profile borders — only default for now, more coming later
const PROFILE_BORDERS = [
  { id: "none", label: "No Border", tier: "basic", css: "none", unlockDesc: "Default — always unlocked", condition: (_p: any) => true },
];
import type { CustomThemeConfig, SfxPack, BoardSkin, CoinSkin, TossAnim, PieceSkin, BgSource } from "@/lib/customTheme";
import { DEFAULT_CUSTOM_THEME, loadCustomTheme, saveCustomTheme } from "@/lib/customTheme";

// ── Icon helpers ──────────────────────────────────────────────────────────────
const LockIcon = ({ size = 14, color = "#666" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const CheckIcon = ({ size = 14, color = "#000" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const CatIcon = ({ id, size = 16, color }: { id: string; size?: number; color: string }) => {
  const s = { width: size, height: size };
  if (id === "palette") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
  if (id === "board") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>;
  if (id === "banner") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M3 18h18"/><path d="M3 21h18"/></svg>;
  if (id === "border") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>;
  if (id === "coin") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H9"/></svg>;
  if (id === "toss") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>;
  if (id === "title") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>;
  if (id === "piece") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
  if (id === "custom") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
  return null;
};

// ── Collection data ───────────────────────────────────────────────────────────
const COLLECTION_THEMES = [
  { id: "classic_light", label: "Classic Light", desc: "The original light aesthetic", owned: true,  comingSoon: false, preview: "linear-gradient(135deg,#f5f0e8,#e8e0d0)" },
  { id: "classic_dark",  label: "Classic Dark",  desc: "Dark mode classic",            owned: true,  comingSoon: false, preview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)" },
  { id: "space",         label: "Space",         desc: "Coming Soon",                  owned: false, comingSoon: true,  preview: "linear-gradient(135deg,#020410,#0d1b4b)" },
  { id: "pixel",         label: "Pixel",         desc: "Coming Soon",                  owned: false, comingSoon: true,  preview: "linear-gradient(135deg,#0d1007,#1a2e0a)" },
];

const BOARD_SKINS: { id: string; label: string; desc: string; condition: (p: any) => boolean; preview: string; border: string; price?: number }[] = [
  { id: "default",  label: "Standard", desc: "Clean default board",                       condition: (_p: any) => true,                                                   preview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)", border: "#333" },
  { id: "red_grid", label: "Inferno", desc: "A glowing grid of pure energy",             condition: (p: any) => (p?.purchased_items ?? []).includes("red_grid"),         preview: "linear-gradient(135deg,#220803,#1a0400)",  border: "#992200", price: 1599 },
  { id: "ice_grid", label: "Glacier", desc: "A frozen board sealed in eternal frost",    condition: (p: any) => (p?.purchased_items ?? []).includes("ice_grid"),         preview: "linear-gradient(135deg,#010610,#021428)",  border: "#1a4a6a", price: 1599 },
];

const COIN_SKINS = [
  { id: "default", label: "Standard", desc: "Default", owned: true, c1: "#F59E0B", c2: "#4FC3F7", img1: "/penta-coin.png", img2: "/proto-coin.png" },
];

const COIN_TOSS_ANIMS: { id: string; label: string; desc: string; condition: (p: any) => boolean; price?: number }[] = [
  { id: "default", label: "Classic Flip", desc: "Default animation", condition: (_p: any) => true },
];

const PIECE_SKINS: { id: string; label: string; desc: string; condition: (p: any) => boolean; p1: string; p2: string; p1c: string; p2c: string; price?: number; isFlameSkull?: boolean; isSnowShard?: boolean }[] = [
  { id: "default",          label: "Classic",      desc: "Default pieces",     condition: (_p: any) => true,                                                             p1: "X",  p2: "Y",  p1c: "#FFFFFF", p2c: "#CC0000" },
  { id: "flame_skull",      label: "Flame & Skull", desc: "Purchase for 599 ⬡", condition: (p: any) => (p?.purchased_items ?? []).includes("piece_flame_skull"),       p1: "🔥", p2: "💀", p1c: "#FF4400", p2c: "#AAAAAA", price: 599, isFlameSkull: true },
  { id: "snowflake_shard",  label: "Snow & Shard",  desc: "Purchase for 599 ⬡", condition: (p: any) => (p?.purchased_items ?? []).includes("piece_snowflake_shard"),   p1: "❄",  p2: "◆",  p1c: "#C8EEFF", p2c: "#64C8FF", price: 599, isSnowShard: true },
];

const BANNERS = [
  { id: "default", label: "Default", gradient: "linear-gradient(135deg,#1a1a2e,#16213e)", owned: true },
];

// Sound pack options
const SFX_PACKS: { id: SfxPack; label: string; desc: string; owned: boolean; color: string }[] = [
  { id: "classic", label: "Classic", desc: "Refined, minimal clicks",  owned: true, color: "#CCCCCC" },
  { id: "space",   label: "Space",   desc: "Atmospheric space sounds",  owned: true, color: "#3A78D4" },
  { id: "pixel",   label: "Pixel",   desc: "Retro 8-bit sound effects", owned: true, color: "#879A77" },
];

// Background sources
const BG_SOURCES: { id: BgSource; label: string; preview: string; owned: boolean }[] = [
  { id: "classic_light", label: "Classic Light", preview: "linear-gradient(135deg,#f5f0e8,#e8e0d0)", owned: true },
  { id: "classic_dark",  label: "Classic Dark",  preview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)", owned: true },
  { id: "space",         label: "Space",         preview: "linear-gradient(135deg,#020410,#0d1b4b)", owned: true },
  { id: "pixel",         label: "Pixel",         preview: "linear-gradient(135deg,#0d1007,#1a2e0a)", owned: true },
];

// ── Category definitions ──────────────────────────────────────────────────────
type CatId = "themes" | "board" | "banners" | "borders" | "coins" | "toss" | "titles" | "pieces";

const CATEGORIES: { id: CatId; label: string; icon: string; count: (p: any) => number }[] = [
  { id: "themes",  label: "Themes",           icon: "palette", count: () => COLLECTION_THEMES.filter(x => x.owned).length },
  { id: "board",   label: "Board Skins",      icon: "board",   count: (p) => BOARD_SKINS.filter(x => x.condition(p)).length },
  { id: "banners", label: "Profile Banners",  icon: "banner",  count: () => BANNERS.filter(x => x.owned).length },
  { id: "borders", label: "Profile Borders",  icon: "border",  count: (p) => PROFILE_BORDERS.filter(x => x.condition(p)).length },
  { id: "coins",   label: "Coin Skins",       icon: "coin",    count: () => COIN_SKINS.filter(x => x.owned).length },
  { id: "toss",    label: "Toss Animations",  icon: "toss",    count: (p) => COIN_TOSS_ANIMS.filter(x => x.condition(p)).length },
  { id: "titles",  label: "Titles",           icon: "title",   count: (p) => TITLES.filter(ti => ti.condition(p)).length },
  { id: "pieces",  label: "Piece Skins",      icon: "piece",   count: (p) => PIECE_SKINS.filter(x => x.condition(p)).length },
];

function getSlotOptions(key: keyof CustomThemeConfig, profile?: any) {
  if (key === "sfxPack")    return SFX_PACKS.map(x => ({ id: x.id, label: x.label, desc: x.desc, owned: x.owned, preview: null, color: x.color }));
  if (key === "background") return BG_SOURCES.map(x => ({ id: x.id, label: x.label, desc: "", owned: x.owned, preview: x.preview, color: null }));
  if (key === "boardSkin")  return BOARD_SKINS.map(x => ({ id: x.id, label: x.label, desc: x.desc, owned: x.condition(profile ?? {}), preview: x.preview, color: x.border }));
  if (key === "coinSkin")   return COIN_SKINS.map(x => ({ id: x.id, label: x.label, desc: x.desc, owned: x.owned, preview: null, color: x.c1 }));
  if (key === "tossSkin")   return COIN_TOSS_ANIMS.map(x => ({ id: x.id, label: x.label, desc: x.desc, owned: x.condition(profile ?? {}), preview: null, color: null }));
  if (key === "pieceSkin")  return PIECE_SKINS.map(x => ({ id: x.id, label: x.label, desc: x.desc, owned: x.condition(profile ?? {}), preview: null, color: x.p1c }));
  return [];
}

function getSlotLabel(key: keyof CustomThemeConfig, value: string, profile?: any): string {
  const opts = getSlotOptions(key, profile);
  return opts.find(o => o.id === value)?.label ?? value;
}

type CustomSlot = { key: keyof CustomThemeConfig; label: string; icon: string };
const CUSTOM_SLOTS: CustomSlot[] = [
  { key: "sfxPack",    label: "Sound Pack",     icon: "🔊" },
  { key: "background", label: "Background",     icon: "🖼" },
  { key: "boardSkin",  label: "Board Skin",     icon: "⬛" },
  { key: "coinSkin",   label: "Coin Skin",      icon: "🪙" },
  { key: "tossSkin",   label: "Toss Animation", icon: "🌀" },
  { key: "pieceSkin",  label: "Piece Skin",     icon: "✖" },
];

// ── CustomThemeSection ────────────────────────────────────────────────────────
interface CustomThemeSectionProps {
  t: typeof THEMES[ThemeId];
  ip: boolean;
  themeId: ThemeId;
  setThemeIdAction?: (id: ThemeId) => void;
  profile?: any;
  onHoverAction?: () => void;
  onClickAction?: () => void;
}

function CustomThemeSection({ t, ip, themeId, profile, setThemeIdAction, onHoverAction, onClickAction }: CustomThemeSectionProps) {
  const [cfg, setCfg] = useState<CustomThemeConfig>(() => loadCustomTheme());
  const [activeSlot, setActiveSlot] = useState<keyof CustomThemeConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const isActive = themeId === "custom" as ThemeId;

  const update = (key: keyof CustomThemeConfig, value: string) => {
    const next = { ...cfg, [key]: value };
    setCfg(next);
    saveCustomTheme(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const reset = () => {
    setCfg({ ...DEFAULT_CUSTOM_THEME });
    saveCustomTheme({ ...DEFAULT_CUSTOM_THEME });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const bgPreview = BG_SOURCES.find(b => b.id === cfg.background)?.preview ?? "linear-gradient(135deg,#1a1a1a,#2a2a2a)";
  const accentHex = t.accent;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ borderRadius: ip ? 2 : 16, overflow: "hidden", border: `2px solid ${isActive ? accentHex : t.border}`, background: t.bgCard, boxShadow: isActive ? `0 0 24px ${accentHex}33` : "none" }}>
        <div style={{ height: 80, background: bgPreview, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,12px)", gap: 2, opacity: 0.85 }}>
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} style={{ width: 12, height: 12, background: BOARD_SKINS.find(b => b.id === cfg.boardSkin)?.border ?? "#333", borderRadius: 1 }} />
            ))}
          </div>
          {isActive && (
            <div style={{ position: "absolute", top: 8, right: 10, background: accentHex, borderRadius: 10, padding: "2px 10px", fontFamily: t.fontMono, fontSize: 9, color: "#000", fontWeight: 800, letterSpacing: "0.1em" }}>ACTIVE</div>
          )}
        </div>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 17, fontWeight: 700, color: t.text }}>Custom Theme</div>
            <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 2 }}>Mix and match assets from any owned theme</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {saved && <span style={{ fontFamily: t.fontMono, fontSize: 10, color: accentHex, letterSpacing: "0.08em" }}>✓ SAVED</span>}
            <button onClick={() => { onClickAction?.(); reset(); }} onMouseEnter={() => onHoverAction?.()}
              style={{ background: "transparent", border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 8, color: t.textMuted, fontFamily: t.fontMono, fontSize: 10, padding: "7px 14px", cursor: "pointer", letterSpacing: "0.08em" }}>RESET</button>
            {setThemeIdAction && (
              <button onClick={() => { onClickAction?.(); setThemeIdAction("custom" as ThemeId); }} onMouseEnter={() => onHoverAction?.()}
                style={{ background: isActive ? accentHex : `${accentHex}18`, border: `2px solid ${accentHex}`, borderRadius: ip ? 2 : 8, color: isActive ? "#000" : accentHex, fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 700, padding: "8px 20px", cursor: "pointer", letterSpacing: "0.08em", transition: "all 0.2s" }}>
                {isActive ? "ACTIVE" : "APPLY"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CUSTOM_SLOTS.map(slot => {
          const isOpen = activeSlot === slot.key;
          const options = getSlotOptions(slot.key, profile);
          const currentLabel = getSlotLabel(slot.key, cfg[slot.key] as string, profile);
          return (
            <div key={slot.key} style={{ borderRadius: ip ? 2 : 12, border: `1px solid ${isOpen ? accentHex : t.border}`, background: isOpen ? `${accentHex}08` : t.bgCard, overflow: "hidden", transition: "border-color 0.2s, background 0.2s" }}>
              <button onClick={() => { onClickAction?.(); setActiveSlot(isOpen ? null : slot.key); }} onMouseEnter={() => onHoverAction?.()}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" as const }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{slot.icon}</span>
                <span style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, flex: 1 }}>{slot.label}</span>
                <span style={{ fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, color: isOpen ? accentHex : t.text, background: `${isOpen ? accentHex : t.border}18`, padding: "3px 10px", borderRadius: 8 }}>{currentLabel}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isOpen ? accentHex : t.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {isOpen && (
                <div style={{ padding: "4px 14px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, borderTop: `1px solid ${t.border}44` }}>
                  {options.map((opt, optIdx) => {
                    const isSelected = cfg[slot.key] === opt.id;
                    const locked = !opt.owned;
                    return (
                      <div key={String(opt.id) + optIdx}
                        onClick={() => { if (!locked) { onClickAction?.(); update(slot.key, opt.id); } }}
                        onMouseEnter={() => { if (!locked) onHoverAction?.(); }}
                        style={{ borderRadius: ip ? 2 : 8, border: `2px solid ${isSelected ? accentHex : locked ? t.border + "33" : t.border}`, background: isSelected ? `${accentHex}14` : locked ? t.bgCard + "88" : t.bgCard, padding: "10px 12px", cursor: locked ? "default" : "pointer", opacity: locked ? 0.45 : 1, position: "relative" as const, transition: "border-color 0.15s, background 0.15s", display: "flex", flexDirection: "column" as const, gap: 6 }}>
                        {opt.preview && <div style={{ height: 28, borderRadius: ip ? 1 : 4, background: opt.preview, marginBottom: 2 }} />}
                        {!opt.preview && opt.color && <div style={{ width: 20, height: 20, borderRadius: "50%", background: opt.color, boxShadow: isSelected ? `0 0 8px ${opt.color}88` : "none" }} />}
                        <div style={{ fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, color: locked ? t.textMuted : (isSelected ? accentHex : t.text) }}>{opt.label}</div>
                        {opt.desc && <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted, lineHeight: 1.3 }}>{locked ? opt.desc : "Owned"}</div>}
                        {isSelected && !locked && (
                          <div style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: "50%", background: accentHex, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CheckIcon size={9} color="#000" />
                          </div>
                        )}
                        {locked && <div style={{ position: "absolute", top: 6, right: 6 }}><LockIcon size={11} color="#555" /></div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ThemesWithCustomize ───────────────────────────────────────────────────────
interface ThemesWithCustomizeProps {
  t: typeof THEMES[ThemeId];
  ip: boolean;
  themeId: ThemeId;
  setThemeIdAction?: (id: ThemeId) => void;
  profile?: any;
  activeTheme: string;
  setActiveTheme: (id: string) => void;
  showAll: boolean;
  onHoverAction?: () => void;
  onClickAction?: () => void;
}

function ThemesWithCustomize({ t, ip, themeId, setThemeIdAction, profile, activeTheme, setActiveTheme, showAll, onHoverAction, onClickAction }: ThemesWithCustomizeProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const accentHex = t.accent;
  const themes = showAll ? COLLECTION_THEMES : COLLECTION_THEMES.filter(x => x.owned || x.comingSoon);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
        {themes.map(item => (
          <div key={item.id} className={`coll-item${item.comingSoon ? " coll-locked" : (!item.owned ? " coll-locked" : "")}`}
            onClick={() => { if (item.owned && !item.comingSoon && setThemeIdAction) { onClickAction?.(); setThemeIdAction(item.id as ThemeId); setActiveTheme(item.id); } }}
            onMouseEnter={() => { if (item.owned && !item.comingSoon) onHoverAction?.(); }}
            style={{ borderRadius: 12, overflow: "hidden", border: `2px solid ${activeTheme === item.id ? accentHex : item.owned && !item.comingSoon ? t.border : t.border + "44"}`, background: t.bgCard, boxShadow: activeTheme === item.id ? `0 0 18px ${accentHex}44` : "none", cursor: item.owned && !item.comingSoon ? "pointer" : "default" }}>
            <div style={{ height: 70, background: item.preview, position: "relative" }}>
              {item.comingSoon && (
                <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "2px 8px", fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 700, letterSpacing: "0.1em", zIndex: 2 }}>COMING SOON</div>
              )}
              {!item.comingSoon && !item.owned && <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}><LockIcon size={13} color="#777" /></div>}
              {item.owned && !item.comingSoon && activeTheme === item.id && (
                <div style={{ position: "absolute", top: 8, right: 8, background: accentHex, borderRadius: 10, padding: "2px 8px", fontFamily: t.fontMono, fontSize: 9, color: "#000", fontWeight: 800, letterSpacing: "0.1em", zIndex: 2 }}>ACTIVE</div>
              )}
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: item.comingSoon ? t.textMuted : (item.owned ? t.text : t.textMuted) }}>{item.label}</div>
              <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 3 }}>
                {item.comingSoon ? "Coming Soon" : item.owned ? (activeTheme === item.id ? "Active" : "Click to apply") : item.desc}
              </div>
            </div>
          </div>
        ))}

        {/* Customize card */}
        <div className="coll-item"
          onClick={() => { onClickAction?.(); setCustomizeOpen(v => !v); }}
          onMouseEnter={() => onHoverAction?.()}
          style={{ borderRadius: 12, overflow: "hidden", border: `2px solid ${customizeOpen ? accentHex : accentHex + "44"}`, background: customizeOpen ? `${accentHex}0d` : t.bgCard, boxShadow: customizeOpen ? `0 0 18px ${accentHex}33` : "none", cursor: "pointer" }}>
          <div style={{ height: 70, background: `linear-gradient(135deg, ${accentHex}22, ${accentHex}08)`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, position: "relative" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accentHex} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <div style={{ position: "absolute", top: 8, right: 8, background: `${accentHex}22`, border: `1px solid ${accentHex}55`, borderRadius: 8, padding: "2px 8px", fontFamily: t.fontMono, fontSize: 9, color: accentHex, fontWeight: 800, letterSpacing: "0.08em" }}>
              {customizeOpen ? "CLOSE" : "OPEN"}
            </div>
          </div>
          <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: accentHex }}>Customize</div>
              <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 3 }}>Mix & match owned assets</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accentHex} strokeWidth="2.5" strokeLinecap="round" style={{ transform: customizeOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      </div>

      {customizeOpen && (
        <div style={{ borderRadius: ip ? 2 : 14, border: `1px solid ${accentHex}44`, background: `${accentHex}06`, padding: "20px 18px" }}>
          <CustomThemeSection t={t} ip={ip} themeId={themeId} profile={profile} setThemeIdAction={setThemeIdAction} onHoverAction={onHoverAction} onClickAction={onClickAction} />
        </div>
      )}
    </div>
  );
}

// ── Main CollectionScreen ─────────────────────────────────────────────────────
interface Props { themeId: ThemeId; setThemeIdAction?: (id: ThemeId) => void; onHoverAction?: () => void; onClickAction?: () => void; }

export default function CollectionScreen({ themeId, setThemeIdAction, onHoverAction, onClickAction }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const { user, token, updateUser } = useAuthStore();
  const [activeCat, setActiveCat] = useState<CatId>("themes");
  const [showAll, setShowAll] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>(themeId);
  const [activeBoard,  setActiveBoard]  = useState<string>(() => loadCustomTheme().boardSkin  ?? (user as any)?.board_style ?? "default");
  const [activePiece,  setActivePiece]  = useState<string>(() => loadCustomTheme().pieceSkin  ?? "default");
  const [activeToss,   setActiveToss]   = useState<string>(() => loadCustomTheme().tossSkin   ?? "default");
  const [equipping, setEquipping] = useState<string | null>(null);
  const [equipMsg, setEquipMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<{ id: string; label: string; price: number } | null>(null);
  const [insufficientModal, setInsufficientModal] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);

  const profile = user || {};
  const ip = themeId === "pixel";
  const isClassic = themeId === "classic_light" || themeId === "classic_dark";
  const hoverColor = isClassic ? "#CC0000" : t.accent;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
  if (!token) return;
  API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` } })
    .then(res => updateUser(res.data))
    .catch(() => {});
}, [token]);
  const equipBoard = async (id: string) => {
    if (!token) return;
    
    // Optimistic UI Update
    const prevBoard = activeBoard;
    setActiveBoard(id);
    const current = loadCustomTheme();
    saveCustomTheme({ ...current, boardSkin: id as any });
    
    setEquipMsg({ text: "Board skin equipped!", ok: true });
    setTimeout(() => setEquipMsg(null), 1800);

    // Background API call
    try {
      await API.put("/api/profile/me", { board_style: id }, { headers: { Authorization: `Bearer ${token}` } });
      updateUser({ board_style: id });
    } catch (e: any) {
      // Revert on failure
      setActiveBoard(prevBoard);
      saveCustomTheme({ ...current, boardSkin: prevBoard as any });
      setEquipMsg({ text: e?.response?.data?.detail || "Failed to equip server-side", ok: false });
      setTimeout(() => setEquipMsg(null), 2500);
    }
  };

  const equipPiece = (id: string) => {
    const current = loadCustomTheme();
    saveCustomTheme({ ...current, pieceSkin: id as any });
    setActivePiece(id);
    setEquipMsg({ text: "Piece skin equipped!", ok: true });
    setTimeout(() => setEquipMsg(null), 1800);
  };

  const equipToss = (id: string) => {
    const current = loadCustomTheme();
    saveCustomTheme({ ...current, tossSkin: id as any });
    setActiveToss(id);
    setEquipMsg({ text: "Toss animation equipped!", ok: true });
    setTimeout(() => setEquipMsg(null), 1800);
  };

  const handleBuyItem = (id: string, label: string, price: number) => {
    if (!user) { setEquipMsg({ text: "Sign in to purchase", ok: false }); return; }
    const bal = (user as any).protocredits ?? 0;
    if (bal < price) { setInsufficientModal(true); return; }
    setPurchaseModal({ id, label, price });
  };

  const confirmPurchase = async () => {
    if (!purchaseModal || !token) return;
    setBuyLoading(true);
    try {
      await API.post("/api/store/purchase-item", { item_id: purchaseModal.id, price: purchaseModal.price }, { headers: { Authorization: `Bearer ${token}` } });
      const bal = (user as any).protocredits ?? 0;
      const existing = (user as any).purchased_items ?? [];
      updateUser({ protocredits: bal - purchaseModal.price, purchased_items: [...existing, purchaseModal.id] });
      setPurchaseModal(null);
      const id = purchaseModal.id;
      const cur = loadCustomTheme();
      if (BOARD_SKINS.some(b => b.id === id)) {
        saveCustomTheme({ ...cur, boardSkin: id as any });
        setActiveBoard(id);
      } else if (id.startsWith("piece_")) {
        const skinId = id.replace("piece_", "");
        saveCustomTheme({ ...cur, pieceSkin: skinId as any });
        setActivePiece(skinId);
      }
      setEquipMsg({ text: `✓ ${purchaseModal.label} unlocked & equipped!`, ok: true });
      setTimeout(() => setEquipMsg(null), 2200);
    } catch (e: any) {
      setEquipMsg({ text: e?.response?.data?.detail || "Purchase failed", ok: false });
      setTimeout(() => setEquipMsg(null), 2500);
    } finally { setBuyLoading(false); }
  };

  const catData = CATEGORIES.find(c => c.id === activeCat)!;

  const TIER_COLOR: Record<string, string> = {
    basic: "#9CA3AF", rare: "#60A5FA", epic: "#A78BFA", legendary: "#F59E0B",
  };

  const totalForCat = (id: CatId) => {
    if (id === "titles")  return TITLES.length;
    if (id === "borders") return PROFILE_BORDERS.length;
    if (id === "themes")  return COLLECTION_THEMES.length;
    if (id === "board")   return BOARD_SKINS.length;
    if (id === "banners") return BANNERS.length;
    if (id === "coins")   return COIN_SKINS.length;
    if (id === "toss")    return COIN_TOSS_ANIMS.length;
    return PIECE_SKINS.length;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2, background: t.bg, paddingTop: 84, overflowY: "auto", transition: "background 0.4s" }}>

      {equipMsg && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: equipMsg.ok ? "#1a2e1a" : "#2e1a1a", border: `1px solid ${equipMsg.ok ? "#4CAF50" : "#EF4444"}`, borderRadius: 10, padding: "9px 20px", fontFamily: t.fontMono, fontSize: 12, color: equipMsg.ok ? "#4CAF50" : "#EF4444", boxShadow: "0 8px 28px rgba(0,0,0,0.5)", pointerEvents: "none", letterSpacing: "0.06em" }}>
          {equipMsg.ok ? "✓" : ""} {equipMsg.text}
        </div>
      )}

      {insufficientModal && (
        <div onClick={() => setInsufficientModal(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 16, padding: "28px 24px", maxWidth: 340, width: "90%", textAlign: "center" as const }}>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 8 }}>Not Enough Credits</div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 18 }}>Balance: <span style={{ color: hoverColor }}>{(user as any)?.protocredits ?? 0} ⬡</span></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setInsufficientModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontFamily: t.fontMono, fontSize: 12, cursor: "pointer" }}>CANCEL</button>
              <button onClick={() => { setInsufficientModal(false); window.dispatchEvent(new Event("pp_goto_store")); }} style={{ flex: 1, padding: "10px", background: hoverColor, border: "none", borderRadius: 8, color: "#000", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>GET CREDITS →</button>
            </div>
          </div>
        </div>
      )}

      {purchaseModal && (
        <div onClick={() => !buyLoading && setPurchaseModal(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 16, padding: "28px 24px", maxWidth: 340, width: "90%" }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 10, color: hoverColor, letterSpacing: "0.2em", marginBottom: 8 }}>CONFIRM PURCHASE</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 6 }}>{purchaseModal.label}</div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 6 }}>Cost: <span style={{ color: hoverColor, fontWeight: 700 }}>{purchaseModal.price.toLocaleString()} ⬡</span></div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 18 }}>Balance after: <span style={{ color: t.text }}>{((user as any)?.protocredits ?? 0) - purchaseModal.price} ⬡</span></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPurchaseModal(null)} disabled={buyLoading} style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontFamily: t.fontMono, fontSize: 12, cursor: "pointer" }}>CANCEL</button>
              <button onClick={confirmPurchase} disabled={buyLoading} style={{ flex: 1, padding: "10px", background: buyLoading ? `${hoverColor}55` : hoverColor, border: "none", borderRadius: 8, color: "#000", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, cursor: buyLoading ? "not-allowed" : "pointer" }}>
                {buyLoading ? "..." : "CONFIRM"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .coll-cat-btn { transition: all 0.2s cubic-bezier(.22,.68,0,1.2); }
        .coll-cat-btn:hover { transform: translateX(4px); }
        .coll-item { transition: transform 0.22s cubic-bezier(.22,.68,0,1.2), box-shadow 0.22s cubic-bezier(.22,.68,0,1.2), border-color 0.18s ease, background 0.18s ease; cursor: pointer; }
        .coll-item:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 12px 32px rgba(0,0,0,0.35) !important; }
        .coll-item:active { transform: translateY(-1px) scale(1.005); }
        .coll-locked { position: relative; overflow: hidden; }
        .coll-locked::after { content:''; position:absolute; inset:0; background:rgba(0,0,0,0.5); border-radius:inherit; pointer-events:none; }
        * { -webkit-font-smoothing: antialiased; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "0 16px 48px" : "0 24px 48px", display: "flex", gap: 24 }}>

        {/* ── Sidebar ── */}
        {!isMobile && (
          <div style={{ width: 220, flexShrink: 0 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 14, paddingTop: 4 }}>COLLECTION</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {CATEGORIES.map(cat => {
              const isActive = activeCat === cat.id;
              const owned = cat.count(profile);
              const total = totalForCat(cat.id);
              return (
                <button key={cat.id} className="coll-cat-btn"
                  onClick={() => { onClickAction?.(); setActiveCat(cat.id); setShowAll(false); }}
                  onMouseEnter={() => onHoverAction?.()}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: ip ? 2 : 10, background: isActive ? `${t.accent}16` : "transparent", border: `1px solid ${isActive ? t.accent : t.border + "44"}`, color: isActive ? t.accent : t.textMuted, fontFamily: t.fontBody, fontSize: 15, fontWeight: (isActive ? 800 : 500) as React.CSSProperties["fontWeight"], cursor: "pointer", textAlign: "left" as const, boxShadow: isActive ? `0 0 12px ${t.accent}22` : "none" }}>
                  <CatIcon id={cat.icon} size={16} color={isActive ? t.accent : t.textMuted} />
                  <span style={{ flex: 1 }}>{cat.label}</span>
                  <span style={{ fontFamily: t.fontMono, fontSize: 11, color: isActive ? t.accent : t.textMuted, background: `${isActive ? t.accent : t.border}18`, padding: "3px 9px", borderRadius: 10, fontWeight: 700 }}>
                    {owned}/{total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* ── Main content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 800, color: t.text }}>COLLECTION</div>
              <div onClick={() => { onClickAction?.(); setShowAll(v => !v); }} style={{ fontFamily: t.fontMono, fontSize: 11, color: t.accent, cursor: "pointer", fontWeight: 700 }}>
                {showAll ? "SHOW OWNED" : "SHOW ALL"}
              </div>
            </div>
          )}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingTop: 4 }}>
              <div>
                <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 700, color: t.text }}>{catData.label}</div>
                <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 2 }}>
                  {`${catData.count(profile)} owned · ${totalForCat(activeCat)} total`}
                </div>
              </div>
              <div onClick={() => { onClickAction?.(); setShowAll(v => !v); }} onMouseEnter={() => onHoverAction?.()}
                style={{ fontFamily: t.fontMono, fontSize: 11, color: t.accent, cursor: "pointer", letterSpacing: "0.08em", userSelect: "none" as const }}>
                {showAll ? "SHOW OWNED ONLY" : "SHOW ALL"}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 32 : 0 }}>
            {(isMobile ? CATEGORIES : [{ id: activeCat, icon: catData.icon, label: catData.label } as any]).map(renderCat => {
              const cat = renderCat.id;
              return (
                <div key={cat} style={{ width: "100%" }}>
                  {isMobile && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${t.accent}14`, border: `1px solid ${t.accent}33`, display: "flex", alignItems: "center", justifyContent: "center" }}><CatIcon id={renderCat.icon} size={18} color={t.accent} /></div>
                      <span style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: "0.04em" }}>{renderCat.label}</span>
                      <div style={{ flex: 1, height: 1, background: t.border, marginLeft: 8 }} />
                    </div>
                  )}

                  {/* ── THEMES ── */}
                  {cat === "themes" && (
            <ThemesWithCustomize t={t} ip={ip} themeId={themeId} profile={profile} setThemeIdAction={setThemeIdAction} activeTheme={activeTheme} setActiveTheme={setActiveTheme} showAll={showAll} onHoverAction={onHoverAction} onClickAction={onClickAction} />
          )}

          {/* ── BOARD SKINS ── */}
          {cat === "board" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
              {BOARD_SKINS.filter(x => showAll || x.condition(profile)).map(item => {
                const owned = item.condition(profile);
                const isPurchasable = !!item.price && !owned;
                return (
                  <div key={item.id} className={`coll-item${!owned ? " coll-locked" : ""}`}
                    onClick={() => { if (owned && activeBoard !== item.id && equipping !== item.id) { onClickAction?.(); equipBoard(item.id); } }}
                    onMouseEnter={() => { if (owned) onHoverAction?.(); }}
                    style={{ borderRadius: 12, overflow: "hidden", border: `1.5px solid ${owned ? (activeBoard === item.id ? hoverColor : t.border) : isPurchasable ? hoverColor + "33" : t.border + "44"}`, background: t.bgCard, boxShadow: activeBoard === item.id ? `0 0 16px ${hoverColor}33` : "none", cursor: owned && activeBoard !== item.id ? "pointer" : "default" }}>
                    <div style={{ height: 70, background: item.preview, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,14px)", gap: 2, opacity: 0.7 }}>
                        {Array.from({ length: 16 }).map((_, i) => <div key={i} style={{ width: 14, height: 14, background: item.border, borderRadius: 1 }} />)}
                      </div>
                      {!owned && !isPurchasable && <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}><LockIcon size={13} color="#777" /></div>}
                      {isPurchasable && <div style={{ position: "absolute", top: 8, left: 8, background: `${hoverColor}22`, border: `1px solid ${hoverColor}55`, borderRadius: 6, padding: "2px 7px", fontFamily: t.fontMono, fontSize: 9, color: hoverColor, fontWeight: 700, letterSpacing: "0.08em" }}>FOR SALE</div>}
                      {owned && activeBoard === item.id && <div style={{ position: "absolute", top: 8, right: 8, background: hoverColor, borderRadius: 8, padding: "2px 9px", fontFamily: t.fontMono, fontSize: 9, color: "#fff", fontWeight: 800 }}>ACTIVE</div>}
                    </div>
                    <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: owned ? t.text : t.textMuted }}>{item.label}</div>
                        <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 3 }}>
                          {equipping === item.id ? "Equipping…" : owned ? (activeBoard === item.id ? "Equipped" : "Click to equip") : item.desc}
                        </div>
                      </div>
                      {isPurchasable && (
                        <button onClick={e => { e.stopPropagation(); handleBuyItem(item.id, item.label, item.price!); }}
                          style={{ flexShrink: 0, background: `${hoverColor}18`, border: `1.5px solid ${hoverColor}55`, borderRadius: 8, padding: "5px 10px", fontFamily: t.fontMono, fontSize: 10, fontWeight: 800, color: hoverColor, cursor: "pointer", whiteSpace: "nowrap" }}>
                          {item.price!.toLocaleString()} ⬡
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── BANNERS ── */}
          {cat === "banners" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
              {BANNERS.filter(x => showAll || x.owned).map(item => (
                <div key={item.id} className={`coll-item${!item.owned ? " coll-locked" : ""}`}
                  style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${item.owned ? t.border : t.border + "44"}`, background: t.bgCard }}>
                  <div style={{ height: 60, background: item.gradient, position: "relative" }}>
                    {!item.owned && <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}><LockIcon size={13} color="#777" /></div>}
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: item.owned ? t.text : t.textMuted }}>{item.label}</div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 3 }}>{item.owned ? "Owned" : "Locked"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── BORDERS ── */}
          {cat === "borders" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
              {PROFILE_BORDERS.filter(x => showAll || x.condition(profile)).map(item => {
                const owned = item.condition(profile);
                const tc = TIER_COLOR[item.tier];
                const isRainbow = item.id === "rainbow_halo";
                return (
                  <div key={item.id} className={`coll-item${!owned ? " coll-locked" : ""}`}
                    style={{ borderRadius: 12, padding: "16px", border: `1px solid ${owned ? tc + "44" : t.border + "33"}`, background: t.bgCard, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 60, height: 60, borderRadius: "50%", background: `linear-gradient(135deg,${t.p1},${t.p2})`, boxShadow: owned && item.id !== "none" ? (isRainbow ? "0 0 0 3px #FF6B6B, 0 0 0 6px #FFD700, 0 0 20px #FF6B6BAA" : item.css) : "none" }} />
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: owned ? t.text : t.textMuted }}>{item.label}</span>
                        <span style={{ fontFamily: t.fontMono, fontSize: 9, color: tc, background: `${tc}18`, padding: "1px 6px", borderRadius: 4 }}>{item.tier.toUpperCase()}</span>
                      </div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted }}>{owned ? "Unlocked" : item.unlockDesc}</div>
                    </div>
                    {!owned && <div style={{ fontSize: 14 }}><LockIcon size={13} color="#777" /></div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── COIN SKINS ── */}
          {cat === "coins" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
              {COIN_SKINS.filter(x => showAll || x.owned).map(item => (
                <div key={item.id} className={`coll-item${!item.owned ? " coll-locked" : ""}`}
                  style={{ borderRadius: 12, padding: "22px 16px", border: `1px solid ${item.owned ? item.c1 + "44" : t.border + "33"}`, background: t.bgCard, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: item.owned ? `radial-gradient(circle at 35% 35%, ${item.c1}FF, ${item.c1}88)` : "#2a2a2a", boxShadow: item.owned ? `0 0 18px ${item.c1}55` : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src={item.img1} alt="penta" style={{ width: 28, height: 28, objectFit: "contain", opacity: item.owned ? 1 : 0.2 }} />
                      </div>
                      <span style={{ fontFamily: t.fontMono, fontSize: 9, color: item.owned ? item.c1 : t.textMuted, letterSpacing: "0.08em" }}>PENTA</span>
                    </div>
                    <div style={{ width: 1, height: 36, background: `${t.border}44`, flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: item.owned ? `radial-gradient(circle at 35% 35%, ${item.c2}FF, ${item.c2}88)` : "#2a2a2a", boxShadow: item.owned ? `0 0 18px ${item.c2}55` : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src={item.img2} alt="proto" style={{ width: 28, height: 28, objectFit: "contain", opacity: item.owned ? 1 : 0.2 }} />
                      </div>
                      <span style={{ fontFamily: t.fontMono, fontSize: 9, color: item.owned ? item.c2 : t.textMuted, letterSpacing: "0.08em" }}>PROTO</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "center" as const }}>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700, color: item.owned ? t.text : t.textMuted }}>{item.label}</div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 3 }}>{item.owned ? "Owned" : item.desc}</div>
                  </div>
                  {!item.owned && <div style={{ position: "absolute", top: 8, right: 8 }}><LockIcon size={13} color="#777" /></div>}
                </div>
              ))}
            </div>
          )}

          {/* ── TOSS ANIMATIONS ── */}
          {cat === "toss" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
              {COIN_TOSS_ANIMS.filter(x => showAll || x.condition(profile)).map(item => {
                const owned = item.condition(profile);
                const isPurchasable = !!item.price && !owned;
                const ac = t.accent;
                return (
                  <div key={item.id} className={`coll-item${!owned ? " coll-locked" : ""}`}
                    onClick={() => { if (owned && activeToss !== item.id) { onClickAction?.(); equipToss(item.id); } }}
                    onMouseEnter={() => { if (owned) onHoverAction?.(); }}
                    style={{ borderRadius: 12, padding: "18px 16px", border: `1.5px solid ${owned ? (activeToss === item.id ? ac : t.border) : isPurchasable ? hoverColor + "33" : t.border + "33"}`, background: t.bgCard, display: "flex", alignItems: "center", gap: 14, position: "relative", boxShadow: activeToss === item.id ? `0 0 16px ${ac}33` : "none", cursor: owned && activeToss !== item.id ? "pointer" : "default" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: owned ? `linear-gradient(135deg,${ac},${ac}88)` : "#333", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {owned
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/></svg>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: owned ? t.text : t.textMuted }}>{item.label}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 3 }}>{owned ? (activeToss === item.id ? "Equipped" : "Click to equip") : item.desc}</div>
                    </div>
                    {owned && activeToss === item.id && <div style={{ position: "absolute", top: 8, right: 8, background: ac, borderRadius: 8, padding: "2px 9px", fontFamily: t.fontMono, fontSize: 9, color: "#fff", fontWeight: 800 }}>ACTIVE</div>}
                    {!owned && !isPurchasable && <div style={{ position: "absolute", top: 8, right: 8 }}><LockIcon size={13} color="#777" /></div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── TITLES ── */}
          {cat === "titles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TITLES.filter(ti => showAll || ti.condition(profile)).map(ti => {
                const owned = ti.condition(profile);
                return (
                  <div key={ti.id} className="coll-item"
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderRadius: 10, border: `1px solid ${owned ? ti.color + "44" : t.border + "33"}`, background: owned ? `${ti.color}06` : t.bgCard, opacity: owned ? 1 : 0.5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: owned ? ti.color : "#555", boxShadow: owned ? `0 0 8px ${ti.glow}` : "none", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: t.fontMono, fontSize: 15, fontWeight: 700, color: owned ? ti.color : t.textMuted, letterSpacing: "0.04em" }}>{ti.label}</span>
                      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 3 }}>{ti.unlockDesc}</div>
                    </div>
                    {owned
                      ? <span style={{ fontFamily: t.fontMono, fontSize: 10, color: ti.color, background: `${ti.color}18`, padding: "3px 10px", borderRadius: 10 }}>UNLOCKED</span>
                      : <span style={{ fontSize: 13 }}><LockIcon size={13} color="#777" /></span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── PIECE SKINS ── */}
          {cat === "pieces" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
              {PIECE_SKINS.filter(x => showAll || x.condition(profile)).map(item => {
                const owned = item.condition(profile);
                const isPurchasable = !!item.price && !owned;
                return (
                  <div key={item.id} className={`coll-item${!owned ? " coll-locked" : ""}`}
                    onClick={() => { if (owned && activePiece !== item.id) { onClickAction?.(); equipPiece(item.id); } }}
                    onMouseEnter={() => { if (owned) onHoverAction?.(); }}
                    style={{ borderRadius: 12, padding: "16px", border: `1.5px solid ${owned ? (activePiece === item.id ? hoverColor : t.border) : isPurchasable ? hoverColor + "33" : t.border + "44"}`, background: t.bgCard, position: "relative", boxShadow: activePiece === item.id ? `0 0 16px ${hoverColor}33` : "none", cursor: owned && activePiece !== item.id ? "pointer" : "default" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 18, marginBottom: 12, marginTop: isPurchasable ? 18 : 0 }}>
                      {item.isFlameSkull ? (
                        <>
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: owned ? "rgba(255,68,0,0.12)" : "#222", border: `2px solid ${owned ? "#FF4400" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="22" height="22" viewBox="0 0 100 120" fill="none">
                              <path d="M50 10 C30 30 15 50 25 70 C20 60 35 55 30 70 C25 85 35 100 50 110 C65 100 75 85 70 70 C65 55 80 60 75 70 C85 50 70 30 50 10Z" fill={owned ? "#FF4400" : "#555"} opacity={owned ? 0.9 : 0.4}/>
                              <path d="M50 40 C40 55 38 65 45 75 C43 68 50 65 48 75 C46 85 50 95 50 100 C55 90 58 80 55 70 C53 62 60 58 58 68 C65 55 58 42 50 40Z" fill={owned ? "#FFB300" : "#444"} opacity={owned ? 0.85 : 0.3}/>
                            </svg>
                          </div>
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: owned ? "rgba(170,170,170,0.1)" : "#222", border: `2px solid ${owned ? "#AAAAAA" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="22" height="22" viewBox="0 0 100 110" fill="none" stroke={owned ? "#CCCCCC" : "#555"} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity={owned ? 1 : 0.4}>
                              <path d="M20 65 C20 35 80 35 80 65 C80 80 72 88 72 95 L28 95 C28 88 20 80 20 65Z"/>
                              <rect x="30" y="95" width="40" height="10" rx="3"/>
                              <circle cx="37" cy="62" r="9" fill={owned ? "#CCCCCC" : "#555"}/>
                              <circle cx="63" cy="62" r="9" fill={owned ? "#CCCCCC" : "#555"}/>
                              <line x1="50" y1="95" x2="50" y2="105"/>
                              <line x1="37" y1="95" x2="37" y2="105"/>
                              <line x1="63" y1="95" x2="63" y2="105"/>
                            </svg>
                          </div>
                        </>
                      ) : item.isSnowShard ? (
                        <>
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: owned ? "#C8EEFF14" : "#222", border: `2px solid ${owned ? "#C8EEFF" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, opacity: owned ? 1 : 0.4 }}>❄</div>
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: owned ? "#64C8FF14" : "#222", border: `2px solid ${owned ? "#64C8FF" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: owned ? "#64C8FF" : "#555", opacity: owned ? 1 : 0.4 }}>◆</div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: owned ? `${item.p1c}18` : "#222", border: `2px solid ${owned ? (activePiece === item.id ? hoverColor : item.p1c) : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 26, fontWeight: 900, color: owned ? item.p1c : "#555" }}>{item.p1}</div>
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: owned ? `${item.p2c}18` : "#222", border: `2px solid ${owned ? (activePiece === item.id ? hoverColor : item.p2c) : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 26, fontWeight: 900, color: owned ? item.p2c : "#555" }}>{item.p2}</div>
                        </>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: owned ? t.text : t.textMuted }}>{item.label}</div>
                        <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 3 }}>
                          {owned ? (activePiece === item.id ? "Equipped" : "Click to equip") : item.desc}
                        </div>
                      </div>
                      {isPurchasable && (
                        <button onClick={e => { e.stopPropagation(); handleBuyItem(`piece_${item.id}`, item.label, item.price!); }}
                          style={{ flexShrink: 0, background: `${hoverColor}18`, border: `1.5px solid ${hoverColor}55`, borderRadius: 8, padding: "5px 10px", fontFamily: t.fontMono, fontSize: 10, fontWeight: 800, color: hoverColor, cursor: "pointer", whiteSpace: "nowrap" }}>
                          {item.price!.toLocaleString()} ⬡
                        </button>
                      )}
                    </div>
                    {isPurchasable && <div style={{ position: "absolute", top: 8, left: 8, background: `${hoverColor}22`, border: `1px solid ${hoverColor}55`, borderRadius: 6, padding: "2px 7px", fontFamily: t.fontMono, fontSize: 9, color: hoverColor, fontWeight: 700, letterSpacing: "0.08em" }}>FOR SALE</div>}
                    {owned && activePiece === item.id && <div style={{ position: "absolute", top: 8, right: 8, background: hoverColor, borderRadius: 8, padding: "2px 9px", fontFamily: t.fontMono, fontSize: 9, color: "#fff", fontWeight: 800 }}>ACTIVE</div>}
                    {!owned && !isPurchasable && <div style={{ position: "absolute", top: 8, right: 8 }}><LockIcon size={13} color="#777" /></div>}
                  </div>
                );
              })}
            </div>
          )}

                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
