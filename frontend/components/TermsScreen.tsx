"use client";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import type { Screen } from "@/lib/types";

interface Props {
  themeId: ThemeId;
  setScreenAction: (s: Screen) => void;
}

export default function TermsScreen({ themeId, setScreenAction }: Props) {
  const t = THEMES[themeId];
  const accent = themeId === "classic_light" || themeId === "classic_dark" ? "#CC0000" : t.accent;

  return (
    <div style={{
      minHeight: "100vh", background: t.bg, color: t.text,
      fontFamily: t.fontBody, paddingTop: 80, paddingBottom: 80,
      overflowY: "auto",
    }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <button onClick={() => setScreenAction("home")}
            style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 8, cursor: "pointer", letterSpacing: "0.08em", marginBottom: 32, display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
            ← BACK
          </button>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, color: accent, letterSpacing: "0.3em", marginBottom: 10 }}>LEGAL</div>
          <h1 style={{ fontFamily: t.fontDisplay, fontSize: "clamp(28px,5vw,42px)", fontWeight: 900, color: t.text, lineHeight: 1.1, marginBottom: 12 }}>Terms and Conditions</h1>
          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>Effective Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · pentaprotocol.com</div>
          <div style={{ height: 2, background: `linear-gradient(to right, ${accent}, transparent)`, marginTop: 24 }} />
        </div>

        <PolicySection title="1. Acceptance of Terms" accent={accent} t={t}>
          By accessing or using PentaProtocol ("the Platform"), available at pentaprotocol.com, you agree to be bound by these Terms and Conditions. If you do not agree to these Terms, you must not use the Platform. PentaProtocol reserves the right to update these Terms at any time — continued use after changes constitutes acceptance.
        </PolicySection>

        <PolicySection title="2. Description of Service" accent={accent} t={t}>
          PentaProtocol is a web-based multiplayer gaming platform providing competitive and casual gameplay modes, a virtual goods store (ProtoCredits, PentaShards, cosmetic bundles, boards, banners, and themed content), a ranked ladder system, and user profile and collection features.
        </PolicySection>

        <PolicySection title="3. Eligibility" accent={accent} t={t}>
          You must be at least 13 years of age to use the Platform. If you are under 18, you must have consent from a parent or legal guardian. Users in jurisdictions where online gaming platforms or virtual goods are prohibited by law are not permitted to use the Platform.
        </PolicySection>

        <PolicySection title="4. Account Registration" accent={accent} t={t}>
          To access certain features, you must register for an account. You agree to provide accurate and complete information, maintain your account details, keep login credentials confidential, accept responsibility for all activity under your account, and notify us immediately at support@pentaprotocol.com if you suspect unauthorised access. PentaProtocol reserves the right to suspend or terminate accounts that violate these Terms.
        </PolicySection>

        <PolicySection title="5. Virtual Currency and In-Game Items" accent={accent} t={t}>
          <strong style={{ color: t.text }}>ProtoCredits (PC)</strong> are purchased with real money and used to unlock cosmetics and premium content. <strong style={{ color: t.text }}>PentaShards (PS)</strong> may be purchased or earned through gameplay.
          <br /><br />
          All virtual currency and in-game items are <em>licensed to you, not sold</em>. Virtual goods have no real-world monetary value, are non-transferable, cannot be traded or sold to other users, and may be modified or removed by PentaProtocol at any time. All purchases are processed through Instamojo in Indian Rupees (INR).
        </PolicySection>

        <PolicySection title="6. Prohibited Conduct" accent={accent} t={t}>
          You agree not to use cheats, exploits, bots, or unauthorised software; harass or abuse other users; impersonate PentaProtocol staff; attempt unauthorised access to the Platform or its infrastructure; reverse engineer any component of the Platform; disrupt normal Platform operation; use the Platform for any unlawful purpose; or manipulate game outcomes through collusion, account sharing, or match-fixing. Violations may result in account suspension, forfeiture of virtual currency, and legal action.
        </PolicySection>

        <PolicySection title="7. Intellectual Property" accent={accent} t={t}>
          All content on PentaProtocol — including game assets, artwork, animations, music, board designs, banners, logos, and software — is the exclusive property of PentaProtocol. You are granted a limited, non-exclusive, revocable licence for personal, non-commercial use only. You may not reproduce, distribute, or commercially exploit any Platform content without prior written consent.
        </PolicySection>

        <PolicySection title="8. Disclaimers and Limitation of Liability" accent={accent} t={t}>
          The Platform is provided on an "as is" basis without warranties of any kind. PentaProtocol does not warrant uninterrupted or error-free service. To the fullest extent permitted by law, PentaProtocol shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform, including loss of data, virtual goods, or account access.
        </PolicySection>

        <PolicySection title="9. Termination" accent={accent} t={t}>
          PentaProtocol may suspend or terminate your account at any time for any reason, including violation of these Terms. Upon termination, your access ceases immediately, unused ProtoCredits and PentaShards are forfeited, and no refund obligation applies except as stated in our Refund Policy.
        </PolicySection>

        <PolicySection title="10. Governing Law" accent={accent} t={t}>
          These Terms shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of India.
        </PolicySection>

        <PolicySection title="11. Contact" accent={accent} t={t}>
          Questions about these Terms? Contact us at: <strong style={{ color: t.text }}>support@pentaprotocol.com</strong>
        </PolicySection>

        <FooterLinks setScreenAction={setScreenAction} t={t} accent={accent} current="terms" />
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

export function PolicySection({ title, children, accent, t }: { title: string; children: React.ReactNode; accent: string; t: any }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 800, color: accent, letterSpacing: "0.06em", marginBottom: 10, textTransform: "uppercase" as const }}>{title}</h2>
      <p style={{ fontFamily: t.fontBody, fontSize: 15, color: t.text, lineHeight: 1.8, opacity: 0.85 }}>{children}</p>
    </div>
  );
}

export function FooterLinks({ setScreenAction, t, accent, current }: { setScreenAction: (s: Screen) => void; t: any; accent: string; current: "terms" | "privacy" | "refund" }) {
  const links: { label: string; screen: Screen }[] = [
    { label: "Terms & Conditions", screen: "terms" },
    { label: "Privacy Policy", screen: "privacy" },
    { label: "Refund Policy", screen: "refund" },
  ];
  return (
    <div style={{ marginTop: 64, paddingTop: 24, borderTop: `1px solid ${t.border}`, display: "flex", gap: 20, flexWrap: "wrap" as const, justifyContent: "center" }}>
      {links.map(l => (
        <button key={l.screen} onClick={() => setScreenAction(l.screen)}
          style={{ background: "transparent", border: "none", fontFamily: t.fontMono, fontSize: 11, color: l.screen === current ? accent : t.textMuted, cursor: l.screen === current ? "default" : "pointer", letterSpacing: "0.1em", textDecoration: l.screen === current ? "underline" : "none", transition: "color 0.2s" }}
          onMouseEnter={e => { if (l.screen !== current) e.currentTarget.style.color = accent; }}
          onMouseLeave={e => { if (l.screen !== current) e.currentTarget.style.color = t.textMuted; }}>
          {l.label.toUpperCase()}
        </button>
      ))}
    </div>
  );
}