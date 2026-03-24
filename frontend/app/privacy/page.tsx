import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · PentaProtocol",
  description: "Privacy Policy for PentaProtocol",
};

export default function PrivacyPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; color: #e8e8e8; }
        ::-webkit-scrollbar { width: 6px; background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e8e8", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
        {/* Top bar */}
        <div style={{ borderBottom: "1px solid #1e1e2a", padding: "16px 0", background: "#08080e", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <a href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 18, letterSpacing: "0.1em" }}>
                <span style={{ color: "#fff" }}>PENTA</span><span style={{ color: "#CC0000" }}>PROTOCOL</span>
              </span>
            </a>
            <div style={{ display: "flex", gap: 24 }}>
              <a href="/terms"   style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", color: "#666", textDecoration: "none" }}>TERMS</a>
              <a href="/privacy" style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", color: "#CC0000", textDecoration: "none" }}>PRIVACY</a>
              <a href="/refund"  style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", color: "#666", textDecoration: "none" }}>REFUND</a>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 820, margin: "0 auto", padding: "56px 24px 96px" }}>
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#CC0000", letterSpacing: "0.3em", marginBottom: 12 }}>LEGAL</div>
            <h1 style={{ fontSize: 40, fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>Privacy Policy</h1>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
              Effective Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} &nbsp;·&nbsp; pentaprotocol.com
            </p>
            <div style={{ height: 2, background: "linear-gradient(to right, #CC0000, transparent)", marginTop: 24 }} />
          </div>

          <Section title="1. Introduction">
            PentaProtocol is committed to protecting your privacy. This Privacy Policy describes how we collect, use, store, and disclose information when you use our Platform at pentaprotocol.com. By using the Platform, you consent to the practices described here.
          </Section>

          <Section title="2. Information We Collect">
            <strong style={{ color: "#e8e8e8" }}>Information you provide:</strong> Username and email address (required for account creation), profile preferences and collection data, and communications sent to our support team. If you pay via direct UPI or bank transfer to the creator, your payment app or bank may share limited transaction metadata with us when you send proof of payment.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Automatically collected:</strong> Device information (browser, OS, identifiers), log data (IP address, pages visited, timestamps), gameplay data (match history, rankings, activity), and cookie/session data for authentication and preferences.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Payment information:</strong> Payments may be processed by <strong style={{ color: "#e8e8e8" }}>PayPal</strong> or completed via <strong style={{ color: "#e8e8e8" }}>direct transfer to the creator</strong> (e.g. UPI using the QR code on our Refund Policy page). We do not store full card or net-banking credentials on our servers — we may store transaction confirmation metadata you or PayPal provide (amount, reference ID, item purchased).
          </Section>

          <Section title="3. How We Use Your Information">
            We use collected information to: create and manage your account; process payments and deliver virtual goods; provide customer support; detect and prevent fraud, cheating, and security incidents; improve and personalise the Platform; send transactional emails (purchase confirmations, OTPs, password resets); and comply with legal obligations.
            <br /><br />
            We do <strong style={{ color: "#e8e8e8" }}>not</strong> sell, rent, or trade your personal information to third parties for marketing purposes.
          </Section>

          <Section title="4. Cookies">
            We use cookies and similar technologies to maintain your session, remember preferences, and analyse usage. You can control cookie settings through your browser, though disabling certain cookies may affect your ability to use the Platform.
          </Section>

          <Section title="5. Data Sharing">
            We may share your information with: <strong style={{ color: "#e8e8e8" }}>PayPal</strong> when you pay through PayPal; <strong style={{ color: "#e8e8e8" }}>infrastructure providers</strong> (Railway for hosting, MongoDB Atlas for database, Redis for session management) who process data under data processing agreements; and <strong style={{ color: "#e8e8e8" }}>law enforcement</strong> where required by law or court order. Direct payments to the creator are between you and the creator&apos;s payment account; we only receive what you choose to send us for verification (e.g. screenshot, UPI reference, email).
          </Section>

          <Section title="6. Data Retention">
            We retain your personal data for as long as your account is active or as necessary to provide services. If you request account deletion, we will delete or anonymise your data within 30 days, except where retention is required by applicable law.
          </Section>

          <Section title="7. Security">
            We implement HTTPS encryption, hashed password storage, token-based authentication, and access controls to protect your data. However, no system is completely secure and we cannot guarantee absolute security.
          </Section>

          <Section title="8. Children's Privacy">
            The Platform is not directed at children under 13. We do not knowingly collect personal information from children under 13. If we become aware that such data has been collected, we will delete it promptly.
          </Section>

          <Section title="9. Your Rights">
            You have the right to access the personal data we hold about you; request correction of inaccurate data; request deletion of your account and associated data; and withdraw consent where processing is based on consent. To exercise any of these rights, contact us at{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>support@pentaprotocol.com</a>.
          </Section>

          <Section title="10. Changes to This Policy">
            We may update this Privacy Policy periodically. Significant changes will be posted on the Platform with an updated effective date. Continued use after changes constitutes acceptance.
          </Section>

          <Section title="11. Contact">
            Questions about this Privacy Policy? Contact us at:{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>support@pentaprotocol.com</a>
          </Section>

          <FooterLinks current="privacy" />
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
        }}>
          {l.label}
        </a>
      ))}
    </div>
  );
}
