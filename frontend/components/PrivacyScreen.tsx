"use client";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import type { Screen } from "@/lib/types";
import { PolicySection, FooterLinks } from "./TermsScreen";

interface Props {
  themeId: ThemeId;
  setScreenAction: (s: Screen) => void;
}

export default function PrivacyScreen({ themeId, setScreenAction }: Props) {
  const t = THEMES[themeId];
  const accent = themeId === "classic_light" || themeId === "classic_dark" ? "#CC0000" : t.accent;

  return (
    <div style={{
      minHeight: "100vh", background: t.bg, color: t.text,
      fontFamily: t.fontBody, paddingTop: 80, paddingBottom: 80,
      overflowY: "auto",
    }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 24px" }}>

        <div style={{ marginBottom: 48 }}>
          <button onClick={() => setScreenAction("home")}
            style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 8, cursor: "pointer", letterSpacing: "0.08em", marginBottom: 32, display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
            ← BACK
          </button>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, color: accent, letterSpacing: "0.3em", marginBottom: 10 }}>LEGAL</div>
          <h1 style={{ fontFamily: t.fontDisplay, fontSize: "clamp(28px,5vw,42px)", fontWeight: 900, color: t.text, lineHeight: 1.1, marginBottom: 12 }}>Privacy Policy</h1>
          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>Effective Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · pentaprotocol.com</div>
          <div style={{ height: 2, background: `linear-gradient(to right, ${accent}, transparent)`, marginTop: 24 }} />
        </div>

        <PolicySection title="1. Introduction" accent={accent} t={t}>
          PentaProtocol is committed to protecting your privacy. This Privacy Policy describes how we collect, use, store, and disclose information when you use our Platform at pentaprotocol.com. By using the Platform, you consent to the practices described here.
        </PolicySection>

        <PolicySection title="2. Information We Collect" accent={accent} t={t}>
          <strong style={{ color: t.text }}>Information you provide:</strong> Username, email address (required for account creation), phone number (required for payment processing via Instamojo), profile preferences and collection data, and communications sent to our support team.
          <br /><br />
          <strong style={{ color: t.text }}>Automatically collected:</strong> Device information (browser, OS, identifiers), log data (IP address, pages visited, timestamps), gameplay data (match history, rankings, activity), and cookie/session data for authentication and preferences.
          <br /><br />
          <strong style={{ color: t.text }}>Payment information:</strong> Payments are processed by Instamojo. We do not store card or banking details — only transaction confirmation metadata (amount, transaction ID, item purchased).
        </PolicySection>

        <PolicySection title="3. How We Use Your Information" accent={accent} t={t}>
          We use collected information to create and manage your account; process payments and deliver virtual goods; provide customer support; detect and prevent fraud, cheating, and security incidents; improve and personalise the Platform; send transactional emails (purchase confirmations, OTPs, password resets); and comply with legal obligations. We do not sell, rent, or trade your personal information to third parties for marketing purposes.
        </PolicySection>

        <PolicySection title="4. Cookies" accent={accent} t={t}>
          We use cookies and similar technologies to maintain your session, remember preferences, and analyse usage. You can control cookie settings through your browser, though disabling certain cookies may affect your ability to use the Platform.
        </PolicySection>

        <PolicySection title="5. Data Sharing" accent={accent} t={t}>
          We may share your information with: <strong style={{ color: t.text }}>Instamojo</strong> for payment processing; <strong style={{ color: t.text }}>infrastructure providers</strong> (Railway for hosting, MongoDB Atlas for database, Redis for session management) who process data under data processing agreements; and <strong style={{ color: t.text }}>law enforcement</strong> where required by law or court order. All third-party providers are contractually obligated to handle your data securely.
        </PolicySection>

        <PolicySection title="6. Data Retention" accent={accent} t={t}>
          We retain your personal data for as long as your account is active or as necessary to provide services. If you request account deletion, we will delete or anonymise your data within 30 days, except where retention is required by applicable law.
        </PolicySection>

        <PolicySection title="7. Security" accent={accent} t={t}>
          We implement HTTPS encryption, hashed password storage, token-based authentication, and access controls to protect your data. However, no system is completely secure and we cannot guarantee absolute security.
        </PolicySection>

        <PolicySection title="8. Children's Privacy" accent={accent} t={t}>
          The Platform is not directed at children under 13. We do not knowingly collect personal information from children under 13. If we become aware that such data has been collected, we will delete it promptly.
        </PolicySection>

        <PolicySection title="9. Your Rights" accent={accent} t={t}>
          You have the right to access the personal data we hold about you; request correction of inaccurate data; request deletion of your account and associated data; and withdraw consent where processing is based on consent. To exercise any of these rights, contact us at <strong style={{ color: t.text }}>support@pentaprotocol.com</strong>.
        </PolicySection>

        <PolicySection title="10. Changes to This Policy" accent={accent} t={t}>
          We may update this Privacy Policy periodically. Significant changes will be posted on the Platform. Continued use after changes constitutes acceptance.
        </PolicySection>

        <PolicySection title="11. Contact" accent={accent} t={t}>
          Questions about this Privacy Policy? Contact us at: <strong style={{ color: t.text }}>support@pentaprotocol.com</strong>
        </PolicySection>

        <FooterLinks setScreenAction={setScreenAction} t={t} accent={accent} current="privacy" />
      </div>
    </div>
  );
}