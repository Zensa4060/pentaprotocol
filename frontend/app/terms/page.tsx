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
              Effective Date: 9 April 2026 &nbsp;·&nbsp; pentaprotocol.com
            </p>
            <div style={{ height: 2, background: "linear-gradient(to right, #CC0000, transparent)", marginTop: 24 }} />
          </div>

          <Section title="1. Acceptance of Terms">
            By accessing or using PentaProtocol ("the Platform"), available at pentaprotocol.com, you agree to be bound by these Terms and Conditions. If you do not agree, you must not use the Platform. PentaProtocol reserves the right to update these Terms at any time. We will notify users of material changes via email or a prominent in-platform notice at least 14 days before changes take effect. Continued use of the Platform after such notice period constitutes acceptance of the updated Terms.
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
            All virtual currency and in-game items are <em>licensed to you, not sold</em>. Virtual goods have no real-world monetary value, are non-transferable, cannot be traded or sold to other users, and may be modified or removed by PentaProtocol at any time. Purchases are processed via <strong style={{ color: "#e8e8e8" }}>PayPal</strong> (USD and international cards/wallets where available), <strong style={{ color: "#e8e8e8" }}>Instamojo</strong> (INR payments for Indian users where available), and, where offered, <strong style={{ color: "#e8e8e8" }}>direct payment to the creator</strong> using the personal UPI / QR code published in our Refund &amp; Cancellation Policy.
          </Section>

          <Section title="6. Prohibited Conduct">
            You agree not to: use cheats, exploits, bots, or unauthorised software; harass or abuse other users; impersonate PentaProtocol staff; attempt unauthorised access to the Platform; reverse engineer any component of the Platform; disrupt normal Platform operation; use the Platform for any unlawful purpose; or manipulate game outcomes through collusion, account sharing, or match-fixing.
            <br /><br />
            Violations may result in account suspension, forfeiture of virtual currency, and legal action.
          </Section>

          <Section title="7. Intellectual Property">
            All content on PentaProtocol — including game assets, artwork, animations, music, board designs, banners, logos, and software — is the exclusive property of PentaProtocol. You are granted a limited, non-exclusive, revocable licence for personal, non-commercial use only. You may not reproduce, distribute, or commercially exploit any Platform content without prior written consent.
          </Section>

          <Section title="8. User-Generated Content">
            By submitting content to the Platform (including usernames, bios, and avatar images), you grant PentaProtocol a non-exclusive, worldwide, royalty-free, sublicensable licence to use, display, reproduce, and distribute such content solely for the purposes of operating and improving the Platform. You retain ownership of your original content. You represent that you have the right to grant this licence and that your content does not infringe any third-party intellectual property or other rights.
            <br /><br />
            PentaProtocol reserves the right to remove or disable access to any user-generated content that violates these Terms, applicable law, or community standards, without prior notice.
          </Section>

          <Section title="9. Disclaimers and Limitation of Liability">
            THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. PentaProtocol does not warrant uninterrupted or error-free service.
            <br /><br />
            To the fullest extent permitted by applicable law, PentaProtocol shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of (or inability to use) the Platform, including but not limited to loss of data, virtual goods, account access, profits, or goodwill, even if PentaProtocol has been advised of the possibility of such damages. In no event shall PentaProtocol’s total aggregate liability exceed the amount you have paid to PentaProtocol in the twelve (12) months preceding the claim.
          </Section>

          <Section title="10. Indemnification">
            You agree to indemnify, defend, and hold harmless PentaProtocol, its creator, affiliates, and their respective officers, directors, employees, and agents from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorney&apos;s fees) arising from or in connection with: your use of the Platform; your violation of these Terms; your infringement of any third-party rights; or any content you submit through the Platform.
          </Section>

          <Section title="11. Termination">
            PentaProtocol may suspend or terminate your account at any time for any reason, including violation of these Terms. Upon termination, your access ceases immediately, unused ProtoCredits and PentaShards are forfeited, and no refund obligation applies except as stated in our Refund Policy.
          </Section>

          <Section title="12. Governing Law and Dispute Resolution">
            These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from or relating to these Terms or the Platform shall be subject to the exclusive jurisdiction of the courts located in Faridabad, India.
            <br /><br />
            Before filing any formal claim, both parties agree to attempt resolution through good-faith negotiation for a period of 30 days following written notice of the dispute. Disputes not resolved through negotiation may be submitted to the exclusive jurisdiction of the courts specified above.
          </Section>

          <Section title="13. Contact">
            Questions about these Terms? Contact us at:{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>
              support@pentaprotocol.com
            </a>
          </Section>

          <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #1e1e2a" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#444", lineHeight: 1.8 }}>
              Version 1.0 — 9 April 2026 · Initial release
            </div>
          </div>

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

function FooterLinks({ current }: { current: "terms" | "privacy" | "refund" | "cookies" }) {
  const links = [
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Privacy Policy",     href: "/privacy" },
    { label: "Refund Policy",      href: "/refund" },
    { label: "Cookie Policy",      href: "/cookies" },
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
