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
              Effective Date: 20 April 2026 &nbsp;·&nbsp; pentaprotocol.com
            </p>
            <div style={{ height: 2, background: "linear-gradient(to right, #CC0000, transparent)", marginTop: 24 }} />
          </div>

          <Section title="1. Acceptance of Terms">
            By accessing or using PentaProtocol ("the Platform"), available at pentaprotocol.com, you agree to be bound by these Terms and Conditions. If you do not agree, you must not use the Platform. PentaProtocol reserves the right to update these Terms at any time. We will notify users of material changes via email or a prominent in-platform notice at least 14 days before changes take effect. Continued use of the Platform after such notice period constitutes acceptance of the updated Terms.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Open-beta clause:</strong> PentaProtocol is currently offered as an open beta. Features, game modes, economies, ranks, missions, stored progression, and virtual currency balances may be modified, reset, rebalanced, or removed at any time during the beta period. You understand and accept that beta access is provided on an experimental basis and that changes may occur without the 14-day notice otherwise required for material Terms changes.
          </Section>

          <Section title="2. Description of Service">
            PentaProtocol is a web-based multiplayer gaming platform providing competitive (Ranked) and casual (Unranked) gameplay modes, including a &quot;Placement&quot; phase for new competitive players and a single-player AI ladder with difficulty tiers. Features include a virtual goods store (ProtoCredits, PentaShards, cosmetic bundles, boards, banners, themes), a ranked ladder system with seasonal progression, missions and rank-reward progression, and user profile and collection features.
          </Section>

          <Section title="3. Eligibility">
            You must be at least 13 years of age to use the Platform. If you are under 18, you must have consent from a parent or legal guardian. The age check presented during registration is a client-side eligibility confirmation; your date of birth is <em>not</em> transmitted to or stored on our servers. You are responsible for providing an accurate confirmation. Users in jurisdictions where online gaming platforms or virtual goods are prohibited by law are not permitted to use the Platform.
          </Section>

          <Section title="4. Account Registration">
            To access certain features, you must register for an account using an email address and a password (minimum 8 characters) or a supported third-party authentication method (e.g., Google). Email signup is verified with a one-time password (OTP) sent to your email. You agree to provide accurate and complete information, maintain your account details, keep login credentials confidential, and accept responsibility for all activity under your account. We strongly recommend enabling two-factor authentication (2FA) from Settings.
            <br /><br />
            Notify us immediately at support@pentaprotocol.com if you suspect unauthorised access. PentaProtocol reserves the right to suspend or terminate accounts that violate these Terms, that exhibit signs of fraud or multi-account abuse, or that fail our anti-cheat checks.
          </Section>

          <Section title="5. Virtual Currency and In-Game Items">
            <strong style={{ color: "#e8e8e8" }}>ProtoCredits (PC)</strong> are purchased with real money and used to unlock cosmetics and premium content. <strong style={{ color: "#e8e8e8" }}>PentaShards (PS)</strong> may be purchased or earned through gameplay.
            <br /><br />
            All virtual currency and in-game items are <em>licensed to you, not sold</em>. Virtual goods have no real-world monetary value, are non-transferable, cannot be traded or sold to other users, and may be modified or removed by PentaProtocol at any time. Purchases are processed by <strong style={{ color: "#e8e8e8" }}>operator-verified UPI / bank-QR transfer</strong> (INR): scan the QR published in the Store or on our Refund &amp; Cancellation Policy page, pay with any UPI app, and submit the bank UTR in-app. Credits are added after manual verification against the bank statement.
          </Section>

          <Section title="6. Prohibited Conduct">
            You agree not to:
            <br /><br />
            • use <strong style={{ color: "#e8e8e8" }}>unauthorised third-party automation</strong> — for example external bots, macro scripts, engine-assist overlays, or modified clients — to play the Platform on your behalf or to gain unfair advantage over other players. The official in-app AI ladder (single-player matches against our AI opponents) is not covered by this clause and remains permitted;
            <br />
            • use cheats, exploits, glitches, or any technique that bypasses server validation or anti-cheat checks;
            <br />
            • harass, threaten, defame, or abuse other users;
            <br />
            • impersonate PentaProtocol staff, other users, or any third party;
            <br />
            • attempt unauthorised access to the Platform, other users&apos; accounts, or our infrastructure;
            <br />
            • reverse engineer, decompile, or disassemble any component of the Platform except to the extent expressly permitted by applicable law;
            <br />
            • disrupt normal Platform operation (including denial-of-service attacks, excessive automated requests, or abuse of rate limits);
            <br />
            • use the Platform for any unlawful purpose;
            <br />
            • manipulate game outcomes through collusion, account sharing, match-fixing, win-trading, or coordinated queueing designed to boost ratings;
            <br />
            • create or operate more than one account to circumvent suspensions, evade anti-cheat detections, or farm rewards;
            <br />
            • initiate fraudulent payment chargebacks for legitimate purchases.
            <br /><br />
            Violations may result in account suspension, shadow restrictions on matchmaking, forfeiture of virtual currency, termination of accounts, and legal action.
          </Section>

          <Section title="6a. Social Features (Friends, Messages, Reports, Blocks)">
            The Platform includes opt-in social features: a friends list (with an 8-character friend code you can share), direct messages (DMs) between friends, unranked match invitations, a block list, and an in-app report tool that notifies PentaProtocol staff about abusive opponents during multiplayer matches.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Acceptable use:</strong> By sending friend requests, DMs, match invites, or reports you agree that the content you submit will not: contain hate speech, threats, sexual content involving minors, personal data of third parties, or spam; harass, impersonate, or dox another user; or be used to coordinate cheating, collusion, win-trading, account sharing, or any other Prohibited Conduct listed in Section&nbsp;6. DMs and reports are not private channels for illegal activity and may be reviewed by PentaProtocol staff when a report is filed.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Reports:</strong> The in-match report tool is provided to help us moderate abuse. You agree to use it in good faith. Filing <em>knowingly false</em> reports, mass-reporting, or using reports to harass another user is itself a violation of these Terms and may result in sanctions against the reporter&apos;s account.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Invites and rate limits:</strong> Friend match invites are rate-limited (currently five invites per rolling 24-hour window per sender). We may change or remove this limit at any time without notice.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Blocks:</strong> Blocking another user is a self-service matchmaking and messaging exclusion. Once you block someone, you will not be matched against them in future queues, they will not appear in your friend search, and existing friendship/invites between you are removed. Blocking does <em>not</em> delete prior match history already recorded by the server.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Staff action:</strong> Based on reports and automated abuse signals, PentaProtocol may issue warnings, mute social features, suspend matchmaking privileges, revoke virtual currency earned through abusive behaviour, or terminate accounts. We aim to be proportionate but reserve full discretion over moderation outcomes.
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
              Version 3.0 — 20 April 2026 · Social-features clause: friends, direct messages, match invites, in-match reports, and blocks, with acceptable-use and moderation commitments.
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
