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
              Effective Date: 20 April 2026 &nbsp;·&nbsp; pentaprotocol.com
            </p>
            <div style={{ height: 2, background: "linear-gradient(to right, #CC0000, transparent)", marginTop: 24 }} />
          </div>

          <Section title="1. Introduction">
            PentaProtocol is committed to protecting your privacy. This Privacy Policy describes how we collect, use, store, and disclose information when you use our Platform at pentaprotocol.com. By using the Platform, you consent to the practices described here.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Beta status:</strong> PentaProtocol is currently operating as an open beta. Features, game economy, rankings, stored data, and virtual currency may be adjusted, reset, or wiped during the beta period. Such changes will be communicated via patch notes and, where material, via email.
          </Section>

          <Section title="2. Information We Collect">
            <strong style={{ color: "#e8e8e8" }}>Information you provide:</strong> Username and email address (required for account creation), profile preferences, collection data, avatar images you upload, and optional theme preferences. If you sign in via a third-party service (e.g., Google), we collect your name, email, and profile picture from that service. During email signup we send a one-time password (OTP) to verify your email address; the OTP is stored in encrypted cache (Redis) with a 10-minute time-to-live and is discarded thereafter.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Date of birth:</strong> During registration we ask you to confirm that you meet our minimum age requirement. This eligibility check is validated in your browser and is <em>not</em> transmitted to or stored on our servers.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Authentication factors:</strong> If you enable two-factor authentication (2FA), we store a server-side TOTP secret bound to your account; the secret itself is never displayed after initial enrolment. Trusted-device tokens (short random strings stored in a cookie named <code style={{ color: "#e8e8e8" }}>pp_device_token</code>) let you skip the 2FA prompt for 30 days on devices you mark as trusted.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Automatically collected:</strong> Device information (browser, operating system, timezone, language, screen dimensions), log data (IP address, pages visited, timestamps, User-Agent string), real-time WebSocket telemetry during matches (connection timestamps, disconnects, ping, move timings), and cookie/session data for authentication and preferences.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Device fingerprint:</strong> To prevent multi-account abuse, we compute a lightweight hash of your browser User-Agent, timezone, language, and screen dimensions the first time you authenticate on a given device. The hash is stored with your account (up to five most recent) and used only for fraud-prevention signals. We do <em>not</em> perform canvas, audio, or WebGL fingerprinting, and we do not track you across third-party sites.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Gameplay data:</strong> We store detailed match history including the game format, board mode (5×5, 6×6, 7×7, custom), the sequence of moves played, board states per round, surrender flags, quit events, timeouts, ranked vs unranked classification, and the resulting rating changes. Ranked matches additionally record your visible ranked rating and a hidden matchmaking rating (MMR) used for queue balancing.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Virtual currency and rewards:</strong> We record purchases, grants, and balances of ProtoCredits (PC) and PentaShards (PS), including currency awarded for completing missions (for example, reaching the CHRONICLE rank grants 200,000 XP and a free theme reward). Transaction records include the source (purchase, mission, rank reward) and the outcome.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Security telemetry:</strong> We log authentication events (login success/failure, password reset, 2FA enable/disable, account deletion), anti-cheat flags (move-rate anomalies, disconnect patterns), abuse signals (repeated failed logins from one IP, duplicate device fingerprints), and payment anomalies. Raw values such as IP and User-Agent in this security log are stored as salted SHA-256 hashes so they cannot be reversed to plaintext. Entries expire automatically after 90 days.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Payment information:</strong> Payments are accepted only via <strong style={{ color: "#e8e8e8" }}>operator-verified UPI / bank-QR transfer</strong> (INR). No third-party payment gateway processes your card or wallet on our behalf. When you submit a UPI transaction reference (UTR) in-app after paying, we store the UTR, the claimed amount, the selected package, and a timestamp so we can reconcile against the bank statement and credit your account. We do not store card numbers, bank-account details, or UPI PINs at any point.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Legal-acceptance audit trail:</strong> When you accept our Terms, Privacy Policy, and Refund Policy via the in-app gate, we store the policy version, acceptance timestamp, the IP address, and the User-Agent string as an audit record.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Social graph and messages:</strong> If you use the in-app social features, we store: your 8-character friend code; the list of user IDs on your friends list and your block list; pending and historical friend requests, match invites, and their status (pending / accepted / declined / expired); the text content of any direct messages (DMs) you send to friends, with sender ID, recipient ID, and timestamp; and a rolling counter of friend match invites sent per 24-hour window used to enforce the invite rate limit. DMs are stored in plaintext in our database so they can be displayed to the intended recipient; they are <em>not</em> end-to-end encrypted.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Player reports:</strong> When you report another player via the in-match report tool, we store the reporter user ID, the reported user ID, the category you selected (abuse / harassment / cheating / other), the free-text reason you provided (up to 400 characters), the room code, and the timestamp. A copy of the report is also emailed to our operations alias so a human reviewer can act on it. Reports persist even after the reported account is deleted so that historical moderation decisions remain reviewable.
          </Section>

          <Section title="3. How We Use Your Information">
            We use collected information to: create and manage your account; process payments and deliver virtual goods; provide customer support; detect and prevent fraud, cheating, and security incidents (including anti-cheat heuristics such as move-timing analysis and duplicate-fingerprint detection); match you with opponents of similar skill; improve and personalise the Platform; send transactional emails (purchase confirmations, OTPs, password resets, security alerts); operate the in-app social features (friends, direct messages, match invites, blocks, and reports) and act on player reports; and comply with legal obligations.
            <br /><br />
            We do <strong style={{ color: "#e8e8e8" }}>not</strong> send promotional or marketing emails, and we do <strong style={{ color: "#e8e8e8" }}>not</strong> sell, rent, or trade your personal information to third parties.
          </Section>

          <Section title="3a. Social Features — Visibility and Sharing of Your Data">
            When you add another user as a friend or accept their request, a limited public slice of your profile becomes visible to that user inside the in-app Friends screen: your username, avatar, banner, rank badge, ELO, level, placement status, current online/offline status, and your profile bio (if set). Friends can also open a read-only view of your public match history (the same data already visible on your own Career page).
            <br /><br />
            Direct messages you send are visible only to you and the recipient inside the app. Staff may access the text of a DM when a related report is filed or when required by law. Do not use DMs to transmit payment details, passwords, government IDs, or other sensitive data.
            <br /><br />
            Reports you file are visible to PentaProtocol staff only. The reported user is <em>not</em> notified that a specific user filed a report; we may aggregate signals across reports when taking action.
            <br /><br />
            Blocking a user stores that user&apos;s ID on your block list so the matchmaking and social routes can exclude them from your queue, friend search, and incoming DMs/invites. The blocked user is not notified that they were blocked; they simply stop appearing in your queue and social surfaces. Unblocking removes the exclusion but does <em>not</em> automatically re-add the user as a friend.
          </Section>

          <Section title="4. Cookies and Similar Technologies">
            We use cookies and similar technologies (including localStorage and sessionStorage) to maintain your session, remember preferences, and analyse usage. You can control cookie settings through your browser, though disabling certain cookies may affect your ability to use the Platform. For a full list of stored data, see our <a href="/cookies" style={{ color: "#CC0000", textDecoration: "none" }}>Cookie Policy</a>.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Do Not Track:</strong> We do not currently respond to &quot;Do Not Track&quot; browser signals. There is no uniform standard for DNT, so the Platform does not alter its data collection practices when it detects a DNT signal.
          </Section>

          <Section title="5. Data Sharing">
            We may share your information with the following third parties:
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Payment processors:</strong> None. Payments are made directly by you to our operating bank account via UPI. Your bank and UPI app are the only third parties that see your payment details; we receive only the UTR and the amount you voluntarily submit in-app for reconciliation.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Infrastructure providers:</strong> <strong style={{ color: "#e8e8e8" }}>Railway</strong> (backend hosting), <strong style={{ color: "#e8e8e8" }}>MongoDB Atlas</strong> (database), <strong style={{ color: "#e8e8e8" }}>Redis</strong> (session and rate-limit management), <strong style={{ color: "#e8e8e8" }}>Vercel</strong> (frontend hosting — receives your IP address, browser headers, and page requests), and <strong style={{ color: "#e8e8e8" }}>profile photo hosting</strong> (third-party file storage for user-uploaded avatars; loading your avatar may transmit your IP address and browser metadata to that provider). These providers process data under their standard terms of service and privacy policies.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Communication providers:</strong> <strong style={{ color: "#e8e8e8" }}>Resend</strong> (transactional email delivery — receives your email address for OTPs, password resets, and purchase confirmations).
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>External resources:</strong> <strong style={{ color: "#e8e8e8" }}>Google Fonts</strong> (typography loaded from Google servers — your IP address and browser metadata may be transmitted to Google) and <strong style={{ color: "#e8e8e8" }}>Google Drive</strong> (image hosting — your IP address may be transmitted when loading thumbnails).
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Law enforcement:</strong> We may disclose information where required by law, court order, or governmental regulation.
          </Section>

          <Section title="5a. Google Sign-In and Account Linking">
            If you choose to sign in with Google, we receive your Google-verified email, display name, and profile picture URL from Google. If that email is already associated with an existing PentaProtocol account created with email-and-password, the system will ask you to confirm a one-time <strong style={{ color: "#e8e8e8" }}>account-merge consent</strong> before linking the two. Until merge consent is granted, the accounts remain separate. You can disconnect Google at any time by contacting support.
          </Section>

          <Section title="6. Data Retention">
            We retain your personal data for as long as your account is active or as necessary to provide services. If you request account deletion, we will delete or anonymise your data within 30 days, except where retention is required by applicable law. Account deletion removes your user record, match history, rooms, unfulfilled mission claims, device-fingerprint hashes, 2FA secrets, trusted-device tokens, your friends list, your block list, your friend-code, and the DMs you sent or received (recipients will see the conversation disappear from their view).
            <br /><br />
            Rate-limiting data (including hashed IP addresses) is automatically purged after 15 minutes to 1 hour depending on the endpoint tier. One-time passwords (OTPs) expire after 10 minutes. Password-reset and 2FA-pending state expire after 15 and 5 minutes respectively. Security-event audit logs (hashed identifiers only) expire after 90 days. Unranked match invites auto-expire after their stated TTL (currently 60 seconds). Player reports are retained for up to 3 years from the date of filing so that repeat-abuse patterns can be evaluated, even if the reporter or the reported user later deletes their account (the report record in that case retains only the account ID, not additional profile data). Payment transaction records are retained for a minimum of 8 years to comply with financial and tax regulations; these records do not contain full card or bank-account numbers.
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

          <Section title="11. Users in the European Economic Area and the United Kingdom (GDPR / UK GDPR)">
            If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland, the following additional provisions apply:
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Legal basis for processing:</strong> We process your personal data based on: your consent (account creation and cookie-based preferences); performance of a contract (providing the Platform and processing purchases); compliance with legal obligations (tax records, law-enforcement requests); and our legitimate interests (fraud prevention, anti-cheat enforcement, service security, and service improvement).
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Your rights under GDPR / UK GDPR:</strong> In addition to the rights listed in Section 10, you have the right to: restrict processing of your personal data; object to processing based on legitimate interests; request data portability; and lodge a complaint with your local EU/EEA data protection supervisory authority (or the UK Information Commissioner&apos;s Office for UK residents). An <strong style={{ color: "#e8e8e8" }}>automated data export</strong> of your account and related records is available from the in-app Settings page or directly via the endpoint <code style={{ color: "#e8e8e8" }}>GET /api/auth/export-data</code>; for anything not covered by that export, contact{" "}
            <a href="mailto:privacy@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>privacy@pentaprotocol.com</a>.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>International data transfers:</strong> Your data may be transferred to and processed on servers outside the EEA/UK (including in the United States and India). We ensure that adequate safeguards are in place, including the use of service providers that maintain appropriate data protection standards.
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
              Version 3.0 — 20 April 2026 · Social-feature disclosures: friends graph, friend codes, direct messages, player reports (reviewed by staff and emailed to operations), blocks, and match-invite budget. Retention updated to cover DMs and player reports.
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
