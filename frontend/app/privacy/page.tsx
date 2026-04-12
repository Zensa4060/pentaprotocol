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
              Effective Date: 12 April 2026 &nbsp;·&nbsp; pentaprotocol.com
            </p>
            <div style={{ height: 2, background: "linear-gradient(to right, #CC0000, transparent)", marginTop: 24 }} />
          </div>

          <Section title="1. Introduction">
            PentaProtocol is committed to protecting your privacy. This Privacy Policy describes how we collect, use, store, and disclose information when you use our Platform at pentaprotocol.com. By using the Platform, you consent to the practices described here.
          </Section>

          <Section title="2. Information We Collect">
            <strong style={{ color: "#e8e8e8" }}>Information you provide:</strong> Username and email address (required for account creation), profile preferences, and collection data. If you sign in via a third-party service (e.g., Google), we collect your name, email, and profile picture from that service.
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

          <Section title="4. Cookies and Similar Technologies">
            We use cookies and similar technologies (including localStorage and sessionStorage) to maintain your session, remember preferences, and analyse usage. You can control cookie settings through your browser, though disabling certain cookies may affect your ability to use the Platform. For a full list of stored data, see our <a href="/cookies" style={{ color: "#CC0000", textDecoration: "none" }}>Cookie Policy</a>.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Do Not Track:</strong> We do not currently respond to &quot;Do Not Track&quot; browser signals. There is no uniform standard for DNT, so the Platform does not alter its data collection practices when it detects a DNT signal.
          </Section>

          <Section title="5. Data Sharing">
            We may share your information with the following third parties:
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Payment processors:</strong> <strong style={{ color: "#e8e8e8" }}>PayPal</strong> (when you pay via PayPal) and <strong style={{ color: "#e8e8e8" }}>Instamojo</strong> (when you pay via Instamojo for INR transactions). Direct payments to the creator are between you and the creator&apos;s payment account; we only receive what you choose to send us for verification (e.g. screenshot, UPI reference, email).
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Infrastructure providers:</strong> <strong style={{ color: "#e8e8e8" }}>Railway</strong> (backend hosting), <strong style={{ color: "#e8e8e8" }}>MongoDB Atlas</strong> (database), <strong style={{ color: "#e8e8e8" }}>Redis</strong> (session and rate-limit management), <strong style={{ color: "#e8e8e8" }}>Vercel</strong> (frontend hosting — receives your IP address, browser headers, and page requests), and <strong style={{ color: "#e8e8e8" }}>Supabase</strong> (file storage for user-uploaded avatars). These providers process data under their standard terms of service and privacy policies.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Communication providers:</strong> <strong style={{ color: "#e8e8e8" }}>Resend</strong> (transactional email delivery — receives your email address for OTPs, password resets, and purchase confirmations).
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>External resources:</strong> <strong style={{ color: "#e8e8e8" }}>Google Fonts</strong> (typography loaded from Google servers — your IP address and browser metadata may be transmitted to Google) and <strong style={{ color: "#e8e8e8" }}>Google Drive</strong> (image hosting — your IP address may be transmitted when loading thumbnails).
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Law enforcement:</strong> We may disclose information where required by law, court order, or governmental regulation.
          </Section>

          <Section title="6. Data Retention">
            We retain your personal data for as long as your account is active or as necessary to provide services. If you request account deletion, we will delete or anonymise your data within 30 days, except where retention is required by applicable law.
            <br /><br />
            Rate-limiting data (including hashed IP addresses) is automatically purged after 15 minutes. Payment transaction records are retained for a minimum of 8 years to comply with financial and tax regulations.
          </Section>

          <Section title="7. Security">
            We implement HTTPS encryption, hashed password storage, token-based authentication, and access controls to protect your data. However, no system is completely secure and we cannot guarantee absolute security.
          </Section>

          <Section title="8. Data Breach Notification">
            In the event of a personal data breach that poses a risk to your rights and freedoms, we will notify affected users via email and/or a prominent in-platform notification within 72 hours of becoming aware of the breach. The notification will describe the nature of the breach, the data affected, actions we have taken, and steps you can take to protect yourself. We will also notify relevant data protection authorities as required by applicable law.
          </Section>

          <Section title="9. Children's Privacy">
            The Platform is not directed at children under 13. We do not knowingly collect personal information from children under 13. If we become aware that such data has been collected, we will delete it promptly.
          </Section>

          <Section title="10. Your Rights">
            You have the right to access the personal data we hold about you; request correction of inaccurate data; request deletion of your account and associated data; and withdraw consent where processing is based on consent. For account or privacy queries, contact us at{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>support@pentaprotocol.com</a>.
          </Section>

          <Section title="11. Users in the European Economic Area (GDPR)">
            If you are located in the European Economic Area (EEA), the following additional provisions apply:
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Legal basis for processing:</strong> We process your personal data based on: your consent (account creation, marketing communications); performance of a contract (providing the Platform and processing purchases); and our legitimate interests (fraud prevention, security, and service improvement).
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Your rights under GDPR:</strong> In addition to the rights listed in Section 10, you have the right to: restrict processing of your personal data; object to processing based on legitimate interests; and lodge a complaint with your local EU/EEA data protection supervisory authority. Please note that automated direct data export is not provided; contact support for any specific profile data clarifications.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>International data transfers:</strong> Your data may be transferred to and processed on servers outside the EEA (including in the United States and India). We ensure that adequate safeguards are in place, including the use of service providers that maintain appropriate data protection standards.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Withdrawal of consent:</strong> Where processing is based on consent, you may withdraw your consent at any time by contacting us. Withdrawal does not affect the lawfulness of processing performed prior to withdrawal.
          </Section>

          <Section title="12. California Residents (CCPA / CPRA)">
            If you are a California resident, the following rights apply under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA):
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Right to know:</strong> You have the right to request information about the categories and specific pieces of personal information we have collected about you, as well as the purposes for which it is used.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Right to delete:</strong> You may request deletion of your personal information, subject to certain exceptions required by law.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Right to correct:</strong> You may request correction of inaccurate personal information.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Right to opt out of sale:</strong> We do <strong style={{ color: "#e8e8e8" }}>not</strong> sell, rent, or trade your personal information to third parties.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Non-discrimination:</strong> We will not discriminate against you for exercising any of your CCPA / CPRA rights.
            <br /><br />
            To exercise these rights, email us at{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>support@pentaprotocol.com</a>{" "}
            with the subject line &quot;California Privacy Request.&quot;
          </Section>

          <Section title="13. Changes to This Policy">
            We may update this Privacy Policy periodically. We will notify users of material changes via email or a prominent in-platform notice at least 14 days before changes take effect. An updated effective date will be posted at the top of this page. Continued use of the Platform after the notice period constitutes acceptance of the revised policy. We encourage you to review this page regularly.
          </Section>

          <Section title="14. Contact">
            Questions about this Privacy Policy? Contact us at:{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>support@pentaprotocol.com</a>
            <br />
            For privacy-specific inquiries:{" "}
            <a href="mailto:privacy@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>privacy@pentaprotocol.com</a>
          </Section>

          <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #1e1e2a" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#444", lineHeight: 1.8 }}>
              Version 1.1 — 10 April 2026 · Updated authentication data and portability procedures
            </div>
          </div>

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
        }}>
          {l.label}
        </a>
      ))}
    </div>
  );
}
