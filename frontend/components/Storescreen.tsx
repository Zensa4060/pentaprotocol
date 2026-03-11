"use client";
import { useState } from "react";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import API from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface Props {
  setScreen: (s: Screen) => void;
  themeId: ThemeId;
}

const PACKAGES = [
  { id: "starter", credits: 100, price: 49,  bonus: 0,   label: "STARTER", popular: false, desc: "Try it out" },
  { id: "plus",    credits: 500, price: 199, bonus: 50,  label: "PLUS",    popular: true,  desc: "Most popular" },
  { id: "pro",     credits: 1200,price: 399, bonus: 200, label: "PRO",     popular: false, desc: "Best value" },
  { id: "elite",   credits: 3000,price: 799, bonus: 600, label: "ELITE",   popular: false, desc: "Power user" },
];

declare global { interface Window { Razorpay: any; } }

const STORE_THEMES = [
  { id: "classic_light", label: "Classic Light", desc: "The original light aesthetic", preview: "linear-gradient(135deg,#f5f0e8,#e8e0d0)", unlock: "Free" },
  { id: "classic_dark",  label: "Classic Dark",  desc: "Dark mode classic",            preview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)", unlock: "Free" },
  { id: "space",         label: "Space",         desc: "Deep space atmosphere",         preview: "linear-gradient(135deg,#020410,#0d1b4b)", unlock: "Free" },
  { id: "pixel",         label: "Pixel",         desc: "Retro pixel art style",         preview: "linear-gradient(135deg,#0d1007,#1a2e0a)", unlock: "Free" },
];

// Only purchasable board skins in store (not free/earn-based ones)
const STORE_BOARD_SKINS: { id: string; label: string; desc: string; preview: string; border?: string; unlock: string; price: number }[] = [
  { id: "default",  label: "Normal",   desc: "Clean default board",                 preview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)",  unlock: "Free",    price: 0    },
  { id: "red_grid", label: "Red Grid", desc: "A glowing grid of pure energy",       preview: "linear-gradient(135deg,#220803,#1a0400)",   border: "#992200", unlock: "1500 PC", price: 1500 },
  { id: "ice_grid", label: "Ice Grid", desc: "A crystalline grid of frozen energy", preview: "linear-gradient(135deg,#01040e,#01081c)",   border: "#50a0dc", unlock: "2000 PC", price: 2000 },
];

// Only default banner in store
const STORE_BANNERS = [
  { id: "default", label: "Default", gradient: "linear-gradient(135deg,#1a1a2e,#16213e)", unlock: "Free" },
];

function SectionHeader({ label, icon, accent }: { label: string; icon: React.ReactNode; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: "0.04em" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)", marginLeft: 8 }} />
    </div>
  );
}

function UnlockBadge({ text, accent }: { text: string; accent: string }) {
  const isFree = text === "Free" || text === "FREE";
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
      color: isFree ? "#4CAF50" : accent,
      background: isFree ? "#4CAF5018" : `${accent}18`,
      border: `1px solid ${isFree ? "#4CAF5044" : accent + "44"}`,
      padding: "2px 8px", borderRadius: 6, letterSpacing: "0.06em", whiteSpace: "nowrap" as const,
    }}>{isFree ? "FREE" : text.toUpperCase()}</span>
  );
}

export default function StoreScreen({ setScreen, themeId }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const { user, token, updateUser } = useAuthStore();

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selected, setSelected] = useState("plus");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [hovPkg, setHovPkg] = useState<string | null>(null);
  const [hovCard, setHovCard] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const pkg = PACKAGES.find(p => p.id === selected)!;
  const isClassic = themeId === "classic_light" || themeId === "classic_dark";
  const accent = isClassic ? "#CC0000" : t.accent;

  const cssVars = {
    "--font-display": t.fontDisplay,
    "--font-mono":    t.fontMono,
    "--font-body":    t.fontBody,
    "--text":         t.text,
    "--text-muted":   t.textMuted,
    "--border":       t.border,
    "--accent":       accent,
  } as React.CSSProperties;

  const purchasedItems: string[] = (user as any)?.purchased_items ?? [];

  const loadRazorpay = () =>
    new Promise<boolean>(resolve => {
      if (window.Razorpay) { resolve(true); return; }
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handleBuy = async () => {
    if (!user) { setMsg({ text: "Please sign in to purchase.", ok: false }); return; }
    setLoading(true); setMsg(null);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Failed to load payment gateway.");
      const { data } = await API.post("/api/store/create-order", { package_id: selected }, { headers: { Authorization: `Bearer ${token}` } });
      await new Promise<void>((resolve, reject) => {
        const rz = new window.Razorpay({
          key: data.key_id, amount: data.amount, currency: data.currency,
          name: "PentaProtocol", description: `${pkg.credits + pkg.bonus} ProtoCredits`,
          order_id: data.order_id,
          prefill: { name: user.username, email: user.email || "" },
          theme: { color: accent },
          modal: { ondismiss: () => reject(new Error("dismissed")) },
          handler: async (response: any) => {
            try {
              const verifyRes = await API.post("/api/store/verify-payment", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                package_id: selected,
              }, { headers: { Authorization: `Bearer ${token}` } });
              const newCredits = (user?.protocredits ?? 0) + verifyRes.data.credits_added;
              updateUser({ protocredits: newCredits });
              resolve();
            } catch (e) { reject(e); }
          },
        });
        rz.open();
      });
      setMsg({ text: `✓ Payment successful! ${pkg.credits + pkg.bonus} ProtoCredits added.`, ok: true });
    } catch (e: any) {
      if (e?.message === "dismissed") setMsg({ text: "Payment cancelled.", ok: false });
      else setMsg({ text: e?.response?.data?.detail || e?.message || "Payment failed. Please try again.", ok: false });
    } finally { setLoading(false); }
  };

  // Buy a cosmetic with ProtoCredits — hides the card after purchase (item moves to Collection)
  const handleBuyCosmetic = async (id: string, price: number, label: string) => {
    if (!user) { setMsg({ text: "Please sign in to purchase cosmetics.", ok: false }); return; }
    const balance = (user as any).protocredits ?? 0;
    if (balance < price) { setMsg({ text: `Not enough ProtoCredits. Balance: ${balance} ⬡`, ok: false }); return; }
    if (!window.confirm(`Buy ${label} for ${price.toLocaleString()} ⬡?`)) return;
    setBuyingId(id);
    try {
      await API.post("/api/store/purchase-item", { item_id: id, price }, { headers: { Authorization: `Bearer ${token}` } });
      const existing = (user as any).purchased_items ?? [];
      updateUser({ protocredits: balance - price, purchased_items: [...existing, id] });
      setMsg({ text: `✓ ${label} unlocked! Equip it in your Collection.`, ok: true });
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.detail || "Purchase failed. Try again.", ok: false });
    } finally { setBuyingId(null); }
  };

  return (
    <div style={{ ...cssVars, minHeight: "100vh", background: t.bg, transition: "background 0.4s", paddingTop: 84, overflowY: "auto" }}>
      <style>{`
        .store-card { transition: transform 0.22s cubic-bezier(.22,.68,0,1.2), box-shadow 0.22s ease, border-color 0.18s ease; cursor: pointer; }
        .store-card:hover { transform: translateY(-4px) scale(1.02); }
        .store-buy-btn:hover { filter: brightness(1.12); transform: scale(1.01); }
        .store-buy-btn { transition: all 0.18s ease; }
        .store-pkg:hover { filter: brightness(1.08); }
        .store-pkg { transition: all 0.18s ease; cursor: pointer; }
        .modal-backdrop { animation: fadeIn 0.18s ease; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .modal-panel { animation: slideUp 0.22s cubic-bezier(.22,.68,0,1.2); }
        * { -webkit-font-smoothing: antialiased; }
      `}</style>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px 72px" }}>

        {/* ── Page header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 48, gap: 24, flexWrap: "wrap" as const }}>
          <div>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: accent, letterSpacing: "0.3em", marginBottom: 10 }}>PROTOCOL STORE</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(28px,5vw,52px)", fontWeight: 900, color: t.text, lineHeight: 1.05, marginBottom: 10 }}>
              UNLOCK YOUR<br /><span style={{ color: accent }}>ARSENAL</span>
            </div>
            <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, maxWidth: 420 }}>
              Earn rewards through ranked play and achievements — or top up ProtoCredits to unlock exclusive cosmetics instantly.
            </div>
          </div>

          {/* ProtoCredits buy panel */}
          <div className="store-card" onClick={() => setShowBuyModal(true)}
            style={{ flexShrink: 0, minWidth: 260, maxWidth: 320, background: `linear-gradient(135deg, ${accent}18, ${accent}08)`, border: `2px solid ${accent}55`, borderRadius: 18, padding: "22px 24px", boxShadow: `0 0 40px ${accent}22`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: `${accent}22`, filter: "blur(40px)", pointerEvents: "none" }} />
            <div style={{ fontFamily: t.fontMono, fontSize: 10, color: accent, letterSpacing: "0.25em", marginBottom: 10 }}>PROTOCREDITS</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 26, fontWeight: 900, color: t.text, marginBottom: 6, lineHeight: 1.1 }}>Buy<br /><span style={{ color: accent }}>ProtoCredits</span></div>
            <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginBottom: 16 }}>Starting from ₹49 · Instant delivery</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 18 }}>
              {PACKAGES.map(p => (
                <div key={p.id} style={{ fontFamily: t.fontMono, fontSize: 10, color: accent, background: `${accent}14`, border: `1px solid ${accent}33`, borderRadius: 6, padding: "3px 8px" }}>{p.credits + p.bonus}</div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 800, color: "#000", background: accent, borderRadius: 8, padding: "9px 16px", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 10h4.5a1.5 1.5 0 010 3H9" /></svg>
              OPEN STORE
            </div>
            {user && (
              <div style={{ marginTop: 12, textAlign: "center" as const, fontFamily: t.fontMono, fontSize: 11, color: t.textMuted }}>
                Balance: <span style={{ color: accent }}>{(user as any).protocredits ?? 0} ⬡</span>
              </div>
            )}
          </div>
        </div>

        {/* ── THEMES ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Themes" accent={accent} icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
            </svg>
          }/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
            {STORE_THEMES.map(item => (
              <div key={item.id} className="store-card"
                onMouseEnter={() => setHovCard(item.id)} onMouseLeave={() => setHovCard(null)}
                style={{ borderRadius: 14, overflow: "hidden", border: `1.5px solid ${hovCard === item.id ? accent + "88" : t.border}`, background: t.bgCard, boxShadow: hovCard === item.id ? `0 8px 32px ${accent}22` : "none" }}>
                <div style={{ height: 90, background: item.preview }} />
                <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700, color: t.text }}>{item.label}</div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <UnlockBadge text={item.unlock} accent={accent} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOARD SKINS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Board Skins" accent={accent} icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
          }/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
            {STORE_BOARD_SKINS.filter(item => {
              // Hide from store once purchased — player can equip from Collection
              if (item.price > 0 && purchasedItems.includes(item.id)) return false;
              return true;
            }).map(item => {
              const hov = hovCard === `board_${item.id}`;
              const isPurchasable = item.price > 0;
              const isBuying = buyingId === item.id;
              return (
                <div key={item.id} className="store-card"
                  onMouseEnter={() => setHovCard(`board_${item.id}`)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, overflow: "hidden", border: `1.5px solid ${hov ? accent + "88" : isPurchasable ? accent + "33" : t.border}`, background: t.bgCard, boxShadow: hov ? `0 8px 28px ${accent}22` : "none" }}>
                  <div style={{ height: 90, background: item.preview, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,16px)", gap: 3, opacity: 0.65 }}>
                      {Array.from({ length: 16 }).map((_, i) => <div key={i} style={{ width: 16, height: 16, background: item.border ?? "#555", borderRadius: 2 }} />)}
                    </div>
                    {isPurchasable && (
                      <div style={{ position: "absolute", top: 8, left: 8, background: `${accent}22`, border: `1px solid ${accent}55`, borderRadius: 6, padding: "2px 8px", fontFamily: t.fontMono, fontSize: 9, color: accent, fontWeight: 700, letterSpacing: "0.08em" }}>FOR SALE</div>
                    )}
                  </div>
                  <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700, color: t.text }}>{item.label}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 2 }}>{item.desc}</div>
                    </div>
                    {isPurchasable ? (
                      <button disabled={isBuying} onClick={() => handleBuyCosmetic(item.id, item.price, item.label)}
                        style={{ flexShrink: 0, background: isBuying ? `${accent}33` : `${accent}18`, border: `1.5px solid ${accent}${isBuying ? "33" : "66"}`, borderRadius: 8, padding: "6px 11px", fontFamily: t.fontMono, fontSize: 10, fontWeight: 800, color: isBuying ? t.textMuted : accent, cursor: isBuying ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, transition: "all 0.18s" }}>
                        {isBuying ? "..." : `${item.price.toLocaleString()} ⬡`}
                      </button>
                    ) : (
                      <UnlockBadge text={item.unlock} accent={accent} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── PIECE SKINS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Piece Skins" accent={accent} icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          }/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
            {[
              { id: "default",               label: "Classic",       desc: "Default pieces",        p1: "X",  p2: "Y",  p1c: "#FFFFFF", p2c: "#CC0000", price: 0,   isFlameSkull: false },
              { id: "piece_flame_skull",      label: "Flame & Skull", desc: "Animated flame + skull SVG pieces. Equip on Red Grid board.",        p1: "🔥", p2: "💀", p1c: "#FF4400", p2c: "#AAAAAA", price: 500, isFlameSkull: true },
              { id: "piece_snowflake_shard",  label: "Snow & Shard",  desc: "Crystalline snowflake + ice shard SVG pieces. Pairs with Ice Grid.", p1: "❄",  p2: "◆",  p1c: "#C8EEFF", p2c: "#64C8FF", price: 500, isFlameSkull: false },
            ].filter(item => {
              // Hide from store once purchased
              if (item.price > 0 && purchasedItems.includes(item.id)) return false;
              return true;
            }).map(item => {
              const hov = hovCard === item.id;
              const isPurchasable = item.price > 0;
              const isBuying = buyingId === item.id;
              return (
                <div key={item.id} className="store-card"
                  onMouseEnter={() => setHovCard(item.id)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, padding: "20px 16px", border: `1.5px solid ${hov ? accent + "88" : isPurchasable ? accent + "33" : t.border}`, background: t.bgCard, boxShadow: hov ? `0 8px 28px ${accent}22` : "none", position: "relative" }}>
                  {isPurchasable && <div style={{ position: "absolute", top: 8, left: 8, background: `${accent}22`, border: `1px solid ${accent}55`, borderRadius: 6, padding: "2px 8px", fontFamily: t.fontMono, fontSize: 9, color: accent, fontWeight: 700, letterSpacing: "0.08em" }}>FOR SALE</div>}
                  <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 14, marginTop: isPurchasable ? 18 : 0 }}>
                    {item.isFlameSkull ? (
                      <>
                        <div style={{ width: 52, height: 52, borderRadius: 8, background: "rgba(255,68,0,0.12)", border: "2px solid #FF4400", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="30" height="30" viewBox="0 0 100 120" fill="none">
                            <path d="M50 10 C30 30 15 50 25 70 C20 60 35 55 30 70 C25 85 35 100 50 110 C65 100 75 85 70 70 C65 55 80 60 75 70 C85 50 70 30 50 10Z" fill="#FF4400" opacity="0.9"/>
                            <path d="M50 40 C40 55 38 65 45 75 C43 68 50 65 48 75 C46 85 50 95 50 100 C55 90 58 80 55 70 C53 62 60 58 58 68 C65 55 58 42 50 40Z" fill="#FFB300" opacity="0.85"/>
                          </svg>
                        </div>
                        <div style={{ width: 52, height: 52, borderRadius: 8, background: "rgba(170,170,170,0.08)", border: "2px solid #AAAAAA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="30" height="30" viewBox="0 0 100 110" fill="none" stroke="#CCCCCC" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 65 C20 35 80 35 80 65 C80 80 72 88 72 95 L28 95 C28 88 20 80 20 65Z"/>
                            <rect x="30" y="95" width="40" height="10" rx="3"/>
                            <circle cx="37" cy="62" r="9" fill="#CCCCCC"/>
                            <circle cx="63" cy="62" r="9" fill="#CCCCCC"/>
                            <line x1="50" y1="95" x2="50" y2="105"/>
                            <line x1="37" y1="95" x2="37" y2="105"/>
                            <line x1="63" y1="95" x2="63" y2="105"/>
                          </svg>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ width: 52, height: 52, borderRadius: 8, background: `${item.p1c}18`, border: `2px solid ${item.p1c}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 28, fontWeight: 900, color: item.p1c }}>{item.p1}</div>
                        <div style={{ width: 52, height: 52, borderRadius: 8, background: `${item.p2c}18`, border: `2px solid ${item.p2c}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 28, fontWeight: 900, color: item.p2c }}>{item.p2}</div>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700, color: t.text }}>{item.label}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 2 }}>{item.desc}</div>
                    </div>
                    {isPurchasable ? (
                      <button disabled={isBuying} onClick={() => handleBuyCosmetic(item.id, item.price, item.label)}
                        style={{ flexShrink: 0, background: isBuying ? `${accent}33` : `${accent}18`, border: `1.5px solid ${accent}${isBuying ? "33" : "66"}`, borderRadius: 8, padding: "6px 11px", fontFamily: t.fontMono, fontSize: 10, fontWeight: 800, color: isBuying ? t.textMuted : accent, cursor: isBuying ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                        {isBuying ? "..." : `${item.price.toLocaleString()} ⬡`}
                      </button>
                    ) : (
                      <UnlockBadge text="Free" accent={accent} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COIN SKINS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Coin Skins" accent={accent} icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 010 3H9"/>
            </svg>
          }/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {[{ id: "default", label: "Standard", desc: "Default coin skins", c1: "#F59E0B", c2: "#4FC3F7", unlock: "Free" }].map(item => {
              const hov = hovCard === `coin_${item.id}`;
              return (
                <div key={item.id} className="store-card"
                  onMouseEnter={() => setHovCard(`coin_${item.id}`)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, padding: "20px 22px", border: `1.5px solid ${hov ? accent + "88" : t.border}`, background: t.bgCard, display: "flex", alignItems: "center", gap: 20, boxShadow: hov ? `0 8px 28px ${accent}22` : "none" }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%,${item.c1}FF,${item.c1}88)`, boxShadow: `0 0 16px ${item.c1}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src="/penta-coin.png" alt="penta" style={{ width: 34, height: 34, objectFit: "contain" }} />
                    </div>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%,${item.c2}FF,${item.c2}88)`, boxShadow: `0 0 16px ${item.c2}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src="/proto-coin.png" alt="proto" style={{ width: 34, height: 34, objectFit: "contain" }} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: t.text }}>{item.label}</span>
                      <UnlockBadge text={item.unlock} accent={accent} />
                    </div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted }}>{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── TOSS ANIMATIONS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Toss Animations" accent={accent} icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          }/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {[{ id: "default", label: "Classic Flip", desc: "The standard coin toss", color: accent, price: 0 }].map(item => {
              const hov = hovCard === item.id;
              return (
                <div key={item.id} className="store-card"
                  onMouseEnter={() => setHovCard(item.id)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, padding: "20px 22px", border: `1.5px solid ${hov ? item.color + "88" : t.border}`, background: t.bgCard, display: "flex", alignItems: "center", gap: 18, boxShadow: hov ? `0 8px 28px ${item.color}22` : "none" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg,${item.color},${item.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 16px ${item.color}44` }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: t.text }}>{item.label}</span>
                    </div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted }}>{item.desc}</div>
                  </div>
                  <UnlockBadge text="Free" accent={accent} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── PROFILE BANNERS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Profile Banners" accent={accent} icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="13" rx="2"/><path d="M3 18h18"/><path d="M3 21h18"/>
            </svg>
          }/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
            {STORE_BANNERS.map(item => {
              const hov = hovCard === `banner_${item.id}`;
              return (
                <div key={item.id} className="store-card"
                  onMouseEnter={() => setHovCard(`banner_${item.id}`)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, overflow: "hidden", border: `1.5px solid ${hov ? accent + "88" : t.border}`, background: t.bgCard, boxShadow: hov ? `0 8px 28px ${accent}22` : "none" }}>
                  <div style={{ height: 70, background: item.gradient }} />
                  <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700, color: t.text }}>{item.label}</div>
                    </div>
                    <UnlockBadge text={item.unlock} accent={accent} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Back button ── */}
        <div style={{ textAlign: "center" as const }}>
          <button onClick={() => setScreen("home")}
            style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, padding: "10px 28px", borderRadius: 8, cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
            ← GO BACK
          </button>
        </div>

        {/* ── Status message ── */}
        {msg && (
          <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: msg.ok ? "#1a2e1a" : "#2e1a1a", border: `1px solid ${msg.ok ? "#4CAF50" : "#EF4444"}`, borderRadius: 10, padding: "10px 22px", fontFamily: t.fontMono, fontSize: 13, color: msg.ok ? "#4CAF50" : "#EF4444", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", pointerEvents: "none", letterSpacing: "0.06em" }}>
            {msg.ok ? "✓" : "⚠"} {msg.text}
          </div>
        )}
      </div>

      {/* ── ProtoCredits buy modal ── */}
      {showBuyModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowBuyModal(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="modal-panel" style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setShowBuyModal(false)} style={{ position: "absolute", top: 16, right: 16, background: `${t.border}44`, border: "none", borderRadius: 8, color: t.textMuted, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>

            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: accent, letterSpacing: "0.25em", marginBottom: 8 }}>PROTOCOL STORE</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: t.text, marginBottom: 4 }}>BUY PROTO<span style={{ color: accent }}>CREDITS</span></div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 24 }}>Use ProtoCredits to unlock cosmetics and exclusive content.</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              {PACKAGES.map(p => {
                const isSel = selected === p.id;
                const isHov = hovPkg === p.id;
                return (
                  <div key={p.id} className="store-pkg" onClick={() => setSelected(p.id)}
                    onMouseEnter={() => setHovPkg(p.id)} onMouseLeave={() => setHovPkg(null)}
                    style={{ position: "relative", background: isSel ? `${accent}14` : isHov ? `${accent}08` : t.bgCard, border: `2px solid ${isSel ? accent : isHov ? accent + "55" : t.border}`, borderRadius: 12, padding: "16px 14px", boxShadow: isSel ? `0 0 20px ${accent}22` : "none" }}>
                    {p.popular && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: accent, color: "#000", fontFamily: t.fontMono, fontSize: 9, fontWeight: 800, padding: "2px 10px", borderRadius: 20, letterSpacing: "0.12em", whiteSpace: "nowrap" as const }}>POPULAR</div>}
                    <div style={{ fontFamily: t.fontMono, fontSize: 10, color: isSel ? accent : t.textMuted, letterSpacing: "0.18em", marginBottom: 6 }}>{p.label}</div>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: isSel ? accent : t.text, lineHeight: 1, marginBottom: 2 }}>{p.credits.toLocaleString()}</div>
                    {p.bonus > 0 && <div style={{ fontFamily: t.fontBody, fontSize: 11, color: "#4CAF50", marginBottom: 6 }}>+{p.bonus} bonus</div>}
                    {p.bonus === 0 && <div style={{ marginBottom: 14 }} />}
                    <div style={{ height: 1, background: isSel ? `${accent}33` : t.border, marginBottom: 10 }} />
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 800, color: isSel ? accent : t.text }}>₹{p.price}</div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted }}>{p.desc}</div>
                    {isSel && <div style={{ position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 900 }}>✓</div>}
                  </div>
                );
              })}
            </div>

            <div style={{ background: t.bgPanel || t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 12 }}>ORDER SUMMARY</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>{pkg.label} Package</span>
                <span style={{ fontFamily: t.fontMono, fontSize: 13, color: t.text }}>₹{pkg.price}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: pkg.bonus > 0 ? 8 : 0 }}>
                <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>ProtoCredits</span>
                <span style={{ fontFamily: t.fontMono, fontSize: 13, color: accent }}>{pkg.credits.toLocaleString()}</span>
              </div>
              {pkg.bonus > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: t.fontBody, fontSize: 13, color: "#4CAF50" }}>Bonus Credits</span>
                  <span style={{ fontFamily: t.fontMono, fontSize: 13, color: "#4CAF50" }}>+{pkg.bonus}</span>
                </div>
              )}
              <div style={{ height: 1, background: t.border, margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: t.text }}>Total</span>
                <div style={{ textAlign: "right" as const }}>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 900, color: accent }}>₹{pkg.price}</div>
                  <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted }}>{pkg.credits + pkg.bonus} credits</div>
                </div>
              </div>
            </div>

            {msg && (
              <div style={{ background: msg.ok ? "#4CAF5014" : `${t.danger}14`, border: `1px solid ${msg.ok ? "#4CAF50" : t.danger}`, borderRadius: 8, padding: "9px 14px", marginBottom: 12, fontFamily: t.fontBody, fontSize: 13, color: msg.ok ? "#4CAF50" : t.danger }}>
                {msg.text}
              </div>
            )}

            <button onClick={handleBuy} disabled={loading} className="store-buy-btn"
              style={{ width: "100%", padding: "14px", background: loading ? `${accent}55` : accent, border: "none", borderRadius: 10, color: "#000", fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.06em", boxShadow: loading ? "none" : `0 0 24px ${accent}44` }}>
              {loading ? "Processing…" : `PAY ₹${pkg.price} WITH RAZORPAY`}
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 12 }}>
              {["Card", "UPI", "Net Banking", "Wallet"].map(m => (
                <span key={m} style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted }}>{m}</span>
              ))}
            </div>

            <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted, textAlign: "center" as const, marginTop: 14, lineHeight: 1.6 }}>
              Secure payments via Razorpay. ProtoCredits are non-refundable.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}