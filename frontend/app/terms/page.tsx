import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions · PentaProtocol",
  description: "Terms and Conditions for PentaProtocol",
};

export default function TermsPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; color: #e8e8e8; font-family: 'Georgia', serif; }
        ::-webkit-scrollbar { width: 6px; background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#e8e8e8",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}>
        {/* Top bar */}
        <div style={{
          borderBottom: "1px solid #1e1e2a",
          padding: "16px 0",
          background: "#08080e",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 18, letterSpacing: "0.1em" }}>
                <span style={{ color: "#fff" }}>PENTA</span><span style={{ color: "#CC0000" }}>PROTOCOL</span>
              </span>
            </a>
            <div style={{ display: "flex", gap: 24 }}>
              <a href="/terms"   style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", color: "#CC0000", textDecoration: "none" }}>TERMS</a>
              <a href="/privacy" style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", color: "#666", textDecoration: "none" }}>PRIVACY</a>
              <a href="/refund"  style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", color: "#666", textDecoration: "none" }}>REFUND</a>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "56px 24px 96px" }}>

          {/* Header */}
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#CC0000", letterSpacing: "0.3em", marginBottom: 12 }}>LEGAL</div>
            <h1 style={{ fontSize: 40, fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>Terms and Conditions</h1>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
              Effective Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} &nbsp;·&nbsp; pentaprotocol.com
            </p>
            <div style={{ height: 2, background: "linear-gradient(to right, #CC0000, transparent)", marginTop: 24 }} />
          </div>

          <Section title="1. Acceptance of Terms">
            By accessing or using PentaProtocol ("the Platform"), available at pentaprotocol.com, you agree to be bound by these Terms and Conditions. If you do not agree, you must not use the Platform. PentaProtocol reserves the right to update these Terms at any time — continued use after changes constitutes acceptance.
          </Section>

          <Section title="2. Description of Service">
            PentaProtocol is a web-based multiplayer gaming platform providing competitive and casual gameplay modes, a virtual goods store (ProtoCredits, PentaShards, cosmetic bundles, boards, banners, and themed content), a ranked ladder system with seasonal progression, and user profile and collection features.
          </Section>

          <Section title="3. Eligibility">
            You must be at least 13 years of age to use the Platform. If you are under 18, you must have consent from a parent or legal guardian. Users in jurisdictions where online gaming platforms or virtual goods are prohibited by law are not permitted to use the Platform.
          </Section>

          <Section title="4. Account Registration">
            To access certain features, you must register for an account. You agree to provide accurate and complete information, maintain your account details, keep login credentials confidential, and accept responsibility for all activity under your account. Notify us immediately at support@pentaprotocol.com if you suspect unauthorised access. PentaProtocol reserves the right to suspend or terminate accounts that violate these Terms.
          </Section>

          <Section title="5. Virtual Currency and In-Game Items">
            <strong style={{ color: "#e8e8e8" }}>ProtoCredits (PC)</strong> are purchased with real money and used to unlock cosmetics and premium content. <strong style={{ color: "#e8e8e8" }}>PentaShards (PS)</strong> may be purchased or earned through gameplay.
            <br /><br />
            All virtual currency and in-game items are <em>licensed to you, not sold</em>. Virtual goods have no real-world monetary value, are non-transferable, cannot be traded or sold to other users, and may be modified or removed by PentaProtocol at any time. Purchases are processed by our payment partners: <strong style={{ color: "#e8e8e8" }}>PayPal</strong> (USD and international methods) and <strong style={{ color: "#e8e8e8" }}>Instamojo</strong> (INR, India).
          </Section>

          <Section title="6. Prohibited Conduct">
            You agree not to: use cheats, exploits, bots, or unauthorised software; harass or abuse other users; impersonate PentaProtocol staff; attempt unauthorised access to the Platform; reverse engineer any component of the Platform; disrupt normal Platform operation; use the Platform for any unlawful purpose; or manipulate game outcomes through collusion, account sharing, or match-fixing.
            <br /><br />
            Violations may result in account suspension, forfeiture of virtual currency, and legal action.
          </Section>

          <Section title="7. Intellectual Property">
            All content on PentaProtocol — including game assets, artwork, animations, music, board designs, banners, logos, and software — is the exclusive property of PentaProtocol. You are granted a limited, non-exclusive, revocable licence for personal, non-commercial use only. You may not reproduce, distribute, or commercially exploit any Platform content without prior written consent.
          </Section>

          <Section title="8. Disclaimers and Limitation of Liability">
            The Platform is provided on an "as is" basis without warranties of any kind. PentaProtocol does not warrant uninterrupted or error-free service. To the fullest extent permitted by law, PentaProtocol shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform, including loss of data, virtual goods, or account access.
          </Section>

          <Section title="9. Termination">
            PentaProtocol may suspend or terminate your account at any time for any reason, including violation of these Terms. Upon termination, your access ceases immediately, unused ProtoCredits and PentaShards are forfeited, and no refund obligation applies except as stated in our Refund Policy.
          </Section>

          <Section title="10. Governing Law">
            These Terms shall be governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of India.
          </Section>

          <Section title="11. Contact">
            Questions about these Terms? Contact us at:{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>
              support@pentaprotocol.com
            </a>
          </Section>

          <FooterLinks current="terms" />
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#CC0000", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, fontFamily: "monospace" }}>
        {title}
      </h2>
      <p style={{ fontSize: 15, color: "#b0b0b8", lineHeight: 1.85 }}>{children}</p>
    </div>
  );
}

function FooterLinks({ current }: { current: "terms" | "privacy" | "refund" }) {
  const links = [
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Privacy Policy",     href: "/privacy" },
    { label: "Refund Policy",      href: "/refund" },
  ];
  return (
    <div style={{ marginTop: 72, paddingTop: 24, borderTop: "1px solid #1e1e2a", display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
      {links.map(l => (
        <a key={l.href} href={l.href} style={{
          fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em",
          color: l.href === `/${current}` ? "#CC0000" : "#444",
          textDecoration: l.href === `/${current}` ? "underline" : "none",
          textTransform: "uppercase",
          transition: "color 0.2s",
        }}>
          {l.label}
        </a>
      ))}
    </div>
  );
}
