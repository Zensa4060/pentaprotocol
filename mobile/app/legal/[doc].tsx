/**
 * Bundled legal pages — Terms & Conditions and Privacy Policy rendered
 * in-app (Phase 6), mirroring the web ``/terms`` and ``/privacy`` pages
 * (Version 3.0 — 20 April 2026). Settings links here instead of opening
 * the external site.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Body, Caption, Screen, Title } from "@/components/ui";
import { HudHeader } from "@/components/ui/hud";
import { usePalette } from "@/theme/ThemeProvider";
import { colors, space } from "@/theme/tokens";

interface LegalSection {
  title: string;
  body: string;
}

interface LegalDoc {
  title: string;
  effective: string;
  version: string;
  sections: LegalSection[];
}

const TERMS: LegalDoc = {
  title: "Terms and Conditions",
  effective: "Effective Date: 20 April 2026 · pentaprotocol.com",
  version:
    "Version 3.0 — 20 April 2026 · Social-features clause: friends, direct messages, match invites, in-match reports, and blocks, with acceptable-use and moderation commitments.",
  sections: [
    {
      title: "1. Acceptance of Terms",
      body: "By accessing or using PentaProtocol (\"the Platform\"), available at pentaprotocol.com, you agree to be bound by these Terms and Conditions. If you do not agree, you must not use the Platform. PentaProtocol reserves the right to update these Terms at any time. We will notify users of material changes via email or a prominent in-platform notice at least 14 days before changes take effect. Continued use of the Platform after such notice period constitutes acceptance of the updated Terms.\n\nOpen-beta clause: PentaProtocol is currently offered as an open beta. Features, game modes, economies, ranks, missions, stored progression, and virtual currency balances may be modified, reset, rebalanced, or removed at any time during the beta period. You understand and accept that beta access is provided on an experimental basis and that changes may occur without the 14-day notice otherwise required for material Terms changes.",
    },
    {
      title: "2. Description of Service",
      body: "PentaProtocol is a multiplayer gaming platform providing competitive (Ranked) and casual (Unranked) gameplay modes, including a \"Placement\" phase for new competitive players and a single-player AI ladder with difficulty tiers. Features include a virtual goods store (ProtoCredits, PentaShards, cosmetic bundles, boards, banners, themes), a ranked ladder system with seasonal progression, missions and rank-reward progression, and user profile and collection features.",
    },
    {
      title: "3. Eligibility",
      body: "You must be at least 13 years of age to use the Platform. If you are under 18, you must have consent from a parent or legal guardian. The age check presented during registration is a client-side eligibility confirmation; your date of birth is not transmitted to or stored on our servers. You are responsible for providing an accurate confirmation. Users in jurisdictions where online gaming platforms or virtual goods are prohibited by law are not permitted to use the Platform.",
    },
    {
      title: "4. Account Registration",
      body: "To access certain features, you must register for an account using an email address and a password (minimum 8 characters) or a supported third-party authentication method (e.g., Google). Email signup is verified with a one-time password (OTP) sent to your email. You agree to provide accurate and complete information, maintain your account details, keep login credentials confidential, and accept responsibility for all activity under your account. We strongly recommend enabling two-factor authentication (2FA) from Settings.\n\nNotify us immediately at support@pentaprotocol.com if you suspect unauthorised access. PentaProtocol reserves the right to suspend or terminate accounts that violate these Terms, that exhibit signs of fraud or multi-account abuse, or that fail our anti-cheat checks.",
    },
    {
      title: "5. Virtual Currency and In-Game Items",
      body: "ProtoCredits (PC) are purchased with real money and used to unlock cosmetics and premium content. PentaShards (PS) may be purchased or earned through gameplay.\n\nAll virtual currency and in-game items are licensed to you, not sold. Virtual goods have no real-world monetary value, are non-transferable, cannot be traded or sold to other users, and may be modified or removed by PentaProtocol at any time. Purchases are processed by operator-verified UPI / bank-QR transfer (INR): scan the QR published in the Store or on our Refund & Cancellation Policy page, pay with any UPI app, and submit the bank UTR in-app. Credits are added after manual verification against the bank statement.",
    },
    {
      title: "6. Prohibited Conduct",
      body: "You agree not to:\n\n• use unauthorised third-party automation — for example external bots, macro scripts, engine-assist overlays, or modified clients — to play the Platform on your behalf or to gain unfair advantage over other players. The official in-app AI ladder (single-player matches against our AI opponents) is not covered by this clause and remains permitted;\n• use cheats, exploits, glitches, or any technique that bypasses server validation or anti-cheat checks;\n• harass, threaten, defame, or abuse other users;\n• impersonate PentaProtocol staff, other users, or any third party;\n• attempt unauthorised access to the Platform, other users' accounts, or our infrastructure;\n• reverse engineer, decompile, or disassemble any component of the Platform except to the extent expressly permitted by applicable law;\n• disrupt normal Platform operation (including denial-of-service attacks, excessive automated requests, or abuse of rate limits);\n• use the Platform for any unlawful purpose;\n• manipulate game outcomes through collusion, account sharing, match-fixing, win-trading, or coordinated queueing designed to boost ratings;\n• create or operate more than one account to circumvent suspensions, evade anti-cheat detections, or farm rewards;\n• initiate fraudulent payment chargebacks for legitimate purchases.\n\nViolations may result in account suspension, shadow restrictions on matchmaking, forfeiture of virtual currency, termination of accounts, and legal action.",
    },
    {
      title: "6a. Social Features (Friends, Messages, Reports, Blocks)",
      body: "The Platform includes opt-in social features: a friends list (with an 8-character friend code you can share), direct messages (DMs) between friends, unranked match invitations, a block list, and an in-app report tool that notifies PentaProtocol staff about abusive opponents during multiplayer matches.\n\nAcceptable use: By sending friend requests, DMs, match invites, or reports you agree that the content you submit will not: contain hate speech, threats, sexual content involving minors, personal data of third parties, or spam; harass, impersonate, or dox another user; or be used to coordinate cheating, collusion, win-trading, account sharing, or any other Prohibited Conduct listed in Section 6. DMs and reports are not private channels for illegal activity and may be reviewed by PentaProtocol staff when a report is filed.\n\nReports: The in-match report tool is provided to help us moderate abuse. You agree to use it in good faith. Filing knowingly false reports, mass-reporting, or using reports to harass another user is itself a violation of these Terms and may result in sanctions against the reporter's account.\n\nInvites and rate limits: Friend match invites are rate-limited (currently five invites per rolling 24-hour window per sender). We may change or remove this limit at any time without notice.\n\nBlocks: Blocking another user is a self-service matchmaking and messaging exclusion. Once you block someone, you will not be matched against them in future queues, they will not appear in your friend search, and existing friendship/invites between you are removed. Blocking does not delete prior match history already recorded by the server.\n\nStaff action: Based on reports and automated abuse signals, PentaProtocol may issue warnings, mute social features, suspend matchmaking privileges, revoke virtual currency earned through abusive behaviour, or terminate accounts. We aim to be proportionate but reserve full discretion over moderation outcomes.",
    },
    {
      title: "7. Intellectual Property",
      body: "All content on PentaProtocol — including game assets, artwork, animations, music, board designs, banners, logos, and software — is the exclusive property of PentaProtocol. You are granted a limited, non-exclusive, revocable licence for personal, non-commercial use only. You may not reproduce, distribute, or commercially exploit any Platform content without prior written consent.",
    },
    {
      title: "8. User-Generated Content",
      body: "By submitting content to the Platform (including usernames, bios, and avatar images), you grant PentaProtocol a non-exclusive, worldwide, royalty-free, sublicensable licence to use, display, reproduce, and distribute such content solely for the purposes of operating and improving the Platform. You retain ownership of your original content. You represent that you have the right to grant this licence and that your content does not infringe any third-party intellectual property or other rights.\n\nPentaProtocol reserves the right to remove or disable access to any user-generated content that violates these Terms, applicable law, or community standards, without prior notice.",
    },
    {
      title: "9. Disclaimers and Limitation of Liability",
      body: "THE PLATFORM IS PROVIDED ON AN \"AS IS\" AND \"AS AVAILABLE\" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. PentaProtocol does not warrant uninterrupted or error-free service.\n\nTo the fullest extent permitted by applicable law, PentaProtocol shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of (or inability to use) the Platform, including but not limited to loss of data, virtual goods, account access, profits, or goodwill, even if PentaProtocol has been advised of the possibility of such damages. In no event shall PentaProtocol's total aggregate liability exceed the amount you have paid to PentaProtocol in the twelve (12) months preceding the claim.",
    },
    {
      title: "10. Indemnification",
      body: "You agree to indemnify, defend, and hold harmless PentaProtocol, its creator, affiliates, and their respective officers, directors, employees, and agents from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorney's fees) arising from or in connection with: your use of the Platform; your violation of these Terms; your infringement of any third-party rights; or any content you submit through the Platform.",
    },
    {
      title: "11. Termination",
      body: "PentaProtocol may suspend or terminate your account at any time for any reason, including violation of these Terms. Upon termination, your access ceases immediately, unused ProtoCredits and PentaShards are forfeited, and no refund obligation applies except as stated in our Refund Policy.",
    },
    {
      title: "12. Governing Law and Dispute Resolution",
      body: "These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from or relating to these Terms or the Platform shall be subject to the exclusive jurisdiction of the courts located in Faridabad, India.\n\nBefore filing any formal claim, both parties agree to attempt resolution through good-faith negotiation for a period of 30 days following written notice of the dispute. Disputes not resolved through negotiation may be submitted to the exclusive jurisdiction of the courts specified above.",
    },
    {
      title: "13. Contact",
      body: "Questions about these Terms? Contact us at: support@pentaprotocol.com",
    },
  ],
};

const PRIVACY: LegalDoc = {
  title: "Privacy Policy",
  effective: "Effective Date: 20 April 2026 · pentaprotocol.com",
  version:
    "Version 3.0 — 20 April 2026 · Social-feature disclosures: friends graph, friend codes, direct messages, player reports (reviewed by staff and emailed to operations), blocks, and match-invite budget. Retention updated to cover DMs and player reports.",
  sections: [
    {
      title: "1. Introduction",
      body: "PentaProtocol is committed to protecting your privacy. This Privacy Policy describes how we collect, use, store, and disclose information when you use our Platform at pentaprotocol.com. By using the Platform, you consent to the practices described here.\n\nBeta status: PentaProtocol is currently operating as an open beta. Features, game economy, rankings, stored data, and virtual currency may be adjusted, reset, or wiped during the beta period. Such changes will be communicated via patch notes and, where material, via email.",
    },
    {
      title: "2. Information We Collect",
      body: "Information you provide: Username and email address (required for account creation), profile preferences, collection data, avatar images you upload, and optional theme preferences. If you sign in via a third-party service (e.g., Google), we collect your name, email, and profile picture from that service. During email signup we send a one-time password (OTP) to verify your email address; the OTP is stored in encrypted cache (Redis) with a 10-minute time-to-live and is discarded thereafter.\n\nDate of birth: During registration we ask you to confirm that you meet our minimum age requirement. This eligibility check is validated on your device and is not transmitted to or stored on our servers.\n\nAuthentication factors: If you enable two-factor authentication (2FA), we store a server-side TOTP secret bound to your account; the secret itself is never displayed after initial enrolment. Trusted-device tokens let you skip the 2FA prompt for 30 days on devices you mark as trusted; we persist only a SHA-256 hash of each token on the server.\n\nAutomatically collected: Device information (browser/OS, timezone, language, screen dimensions), log data (IP address, pages visited, timestamps, User-Agent string), real-time WebSocket telemetry during matches (connection timestamps, disconnects, ping, move timings), and cookie/session data for authentication and preferences.\n\nDevice fingerprint: To prevent multi-account abuse, we compute a lightweight hash of your User-Agent, timezone, language, and screen dimensions the first time you authenticate on a given device. The hash is stored with your account (up to five most recent) and used only for fraud-prevention signals. We do not perform canvas, audio, or WebGL fingerprinting, and we do not track you across third-party sites.\n\nGameplay data: We store detailed match history including the game format, board mode (5×5, 6×6, 7×7, custom), the sequence of moves played, board states per round, surrender flags, quit events, timeouts, ranked vs unranked classification, and the resulting rating changes. Ranked matches additionally record your visible ranked rating and a hidden matchmaking rating (MMR) used for queue balancing.\n\nVirtual currency and rewards: We record purchases, grants, and balances of ProtoCredits (PC) and PentaShards (PS), including currency awarded for completing missions. Transaction records include the source (purchase, mission, rank reward) and the outcome.\n\nSecurity telemetry: We log authentication events, anti-cheat flags, abuse signals, and payment anomalies. Raw values such as IP and User-Agent in this security log are stored as salted SHA-256 hashes so they cannot be reversed to plaintext. Entries expire automatically after 90 days.\n\nPayment information: Payments are accepted only via operator-verified UPI / bank-QR transfer (INR). No third-party payment gateway processes your card or wallet on our behalf. When you submit a UPI transaction reference (UTR) in-app after paying, we store the UTR, the claimed amount, the selected package, and a timestamp. We do not store card numbers, bank-account details, or UPI PINs at any point.\n\nLegal-acceptance audit trail: When you accept our Terms, Privacy Policy, and Refund Policy via the in-app gate, we store the policy version, acceptance timestamp, the IP address, and the User-Agent string as an audit record.\n\nSocial graph and messages: If you use the in-app social features, we store: your 8-character friend code; the list of user IDs on your friends list and your block list; pending and historical friend requests, match invites, and their status; the text content of any direct messages (DMs) you send to friends, with sender ID, recipient ID, and timestamp; and a rolling counter of friend match invites sent per 24-hour window. DMs are stored in plaintext in our database so they can be displayed to the intended recipient; they are not end-to-end encrypted.\n\nPlayer reports: When you report another player, we store the reporter user ID, the reported user ID, the category you selected, the free-text reason you provided (up to 400 characters), the room code, and the timestamp. A copy of the report is also emailed to our operations alias so a human reviewer can act on it. Reports persist even after the reported account is deleted so that historical moderation decisions remain reviewable.",
    },
    {
      title: "3. How We Use Your Information",
      body: "We use collected information to: create and manage your account; process payments and deliver virtual goods; provide customer support; detect and prevent fraud, cheating, and security incidents; match you with opponents of similar skill; improve and personalise the Platform; send transactional emails (purchase confirmations, OTPs, password resets, security alerts); operate the in-app social features and act on player reports; and comply with legal obligations.\n\nWe do not send promotional or marketing emails, and we do not sell, rent, or trade your personal information to third parties.",
    },
    {
      title: "3a. Social Features — Visibility and Sharing of Your Data",
      body: "When you add another user as a friend or accept their request, a limited public slice of your profile becomes visible to that user: your username, avatar, banner, rank badge, ELO, level, placement status, current online/offline status, and your profile bio (if set). Friends can also open a read-only view of your public match history.\n\nDirect messages you send are visible only to you and the recipient inside the app. Staff may access the text of a DM when a related report is filed or when required by law. Do not use DMs to transmit payment details, passwords, government IDs, or other sensitive data.\n\nReports you file are visible to PentaProtocol staff only. The reported user is not notified that a specific user filed a report.\n\nBlocking a user stores that user's ID on your block list so matchmaking and social routes can exclude them. The blocked user is not notified. Unblocking removes the exclusion but does not automatically re-add the user as a friend.",
    },
    {
      title: "4. Cookies and Similar Technologies",
      body: "We use cookies and similar technologies (including local storage) to maintain your session, remember preferences, and analyse usage. You can control cookie settings through your browser on web, though disabling certain cookies may affect your ability to use the Platform.\n\nDo Not Track: We do not currently respond to \"Do Not Track\" browser signals — there is no uniform standard for DNT.",
    },
    {
      title: "5. Data Sharing",
      body: "We may share your information with the following third parties:\n\nPayment processors: None. Payments are made directly by you to our operating bank account via UPI. Your bank and UPI app are the only third parties that see your payment details; we receive only the UTR and the amount you voluntarily submit in-app.\n\nInfrastructure providers: Railway (backend hosting), MongoDB Atlas (database), Redis (session and rate-limit management), Vercel (web frontend hosting), and profile photo hosting (third-party file storage for user-uploaded avatars). These providers process data under their standard terms of service and privacy policies.\n\nCommunication providers: Resend (transactional email delivery — receives your email address for OTPs, password resets, and purchase confirmations).\n\nExternal resources: Google Fonts and Google Drive (your IP address and browser metadata may be transmitted when loading these resources).\n\nLaw enforcement: We may disclose information where required by law, court order, or governmental regulation.",
    },
    {
      title: "5a. Google Sign-In and Account Linking",
      body: "If you choose to sign in with Google, we receive your Google-verified email, display name, and profile picture URL from Google. If that email is already associated with an existing PentaProtocol account created with email-and-password, the system will ask you to confirm a one-time account-merge consent before linking the two. Until merge consent is granted, the accounts remain separate. You can disconnect Google at any time by contacting support.",
    },
    {
      title: "6. Data Retention",
      body: "We retain your personal data for as long as your account is active or as necessary to provide services. If you request account deletion, we will delete or anonymise your data within 30 days, except where retention is required by applicable law. Account deletion removes your user record, match history, rooms, unfulfilled mission claims, device-fingerprint hashes, 2FA secrets, trusted-device tokens, your friends list, your block list, your friend code, and the DMs you sent or received.\n\nRate-limiting data (including hashed IP addresses) is automatically purged after 15 minutes to 1 hour depending on the endpoint tier. One-time passwords (OTPs) expire after 10 minutes. Password-reset and 2FA-pending state expire after 15 and 5 minutes respectively. Security-event audit logs (hashed identifiers only) expire after 90 days. Player reports are retained for up to 3 years from the date of filing. Payment transaction records are retained for a minimum of 8 years to comply with financial and tax regulations; these records do not contain full card or bank-account numbers.",
    },
    {
      title: "7. Security",
      body: "We implement HTTPS encryption, hashed password storage, token-based authentication, and access controls to protect your data. However, no system is completely secure and we cannot guarantee absolute security.",
    },
    {
      title: "8. Data Breach Notification",
      body: "In the event of a personal data breach that poses a risk to your rights and freedoms, we will notify affected users via email and/or a prominent in-platform notification within 72 hours of becoming aware of the breach. The notification will describe the nature of the breach, the data affected, actions we have taken, and steps you can take to protect yourself. We will also notify relevant data protection authorities as required by applicable law.",
    },
    {
      title: "9. Children's Privacy",
      body: "The Platform is not directed at children under 13. We do not knowingly collect personal information from children under 13. If we become aware that such data has been collected, we will delete it promptly.",
    },
    {
      title: "10. Your Rights",
      body: "You have the right to access the personal data we hold about you; request correction of inaccurate data; request deletion of your account and associated data; and withdraw consent where processing is based on consent. For account or privacy queries, contact us at support@pentaprotocol.com.",
    },
    {
      title: "11. EEA / UK Users (GDPR / UK GDPR)",
      body: "If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland:\n\nLegal basis for processing: We process your personal data based on your consent (account creation and preferences); performance of a contract (providing the Platform and processing purchases); compliance with legal obligations; and our legitimate interests (fraud prevention, anti-cheat enforcement, service security, and service improvement).\n\nYour rights: In addition to the rights listed in Section 10, you have the right to restrict processing; object to processing based on legitimate interests; request data portability; and lodge a complaint with your local supervisory authority. An automated data export is available from the in-app Settings page. For anything not covered by that export, contact privacy@pentaprotocol.com.\n\nInternational data transfers: Your data may be transferred to and processed on servers outside the EEA/UK (including in the United States and India). We ensure that adequate safeguards are in place.\n\nWithdrawal of consent: Where processing is based on consent, you may withdraw it at any time by contacting us. Withdrawal does not affect the lawfulness of processing performed prior to withdrawal.",
    },
    {
      title: "12. California Residents (CCPA / CPRA)",
      body: "California residents have the right to know what personal information we have collected and how it is used; the right to delete personal information (subject to legal exceptions); the right to correct inaccurate personal information; and the right to opt out of sale — though we do not sell, rent, or trade your personal information. We will not discriminate against you for exercising any CCPA / CPRA rights. To exercise these rights, email support@pentaprotocol.com with the subject line \"California Privacy Request.\"",
    },
    {
      title: "13. Changes to This Policy",
      body: "We may update this Privacy Policy periodically. We will notify users of material changes via email or a prominent in-platform notice at least 14 days before changes take effect. An updated effective date will be posted at the top of this page. Continued use of the Platform after the notice period constitutes acceptance of the revised policy.",
    },
    {
      title: "14. Contact",
      body: "Questions about this Privacy Policy? Contact us at support@pentaprotocol.com. For privacy-specific inquiries: privacy@pentaprotocol.com.",
    },
  ],
};

const DOCS: Record<string, LegalDoc> = { terms: TERMS, privacy: PRIVACY };

export default function LegalDocScreen() {
  const params = useLocalSearchParams<{ doc?: string }>();
  const palette = usePalette();
  const doc = DOCS[(params.doc ?? "terms").toLowerCase()] ?? TERMS;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/settings");
  };

  return (
    <Screen padded background={palette.bg}>
      <Stack.Screen options={{ headerShown: false }} />
      <HudHeader title={doc.title} eyebrow="LEGAL" onBack={goBack} />
      <Caption tone="muted" style={{ marginTop: space[2] }}>
        {doc.effective}
      </Caption>
      <View style={[styles.rule, { backgroundColor: palette.accent }]} />

      <ScrollView
        style={{ marginTop: space[4] }}
        contentContainerStyle={{ paddingBottom: space[10] }}
        showsVerticalScrollIndicator={false}
      >
        {doc.sections.map((s) => (
          <View key={s.title} style={{ marginBottom: space[6] }}>
            <Text style={[styles.sectionTitle, { color: palette.accent }]}>{s.title}</Text>
            <Body tone="muted" style={{ lineHeight: 22 }}>
              {s.body}
            </Body>
          </View>
        ))}
        <View style={[styles.footerRule, { borderTopColor: palette.border }]}>
          <Caption tone="muted">{doc.version}</Caption>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rule: {
    height: 2,
    width: 120,
    marginTop: space[4],
    opacity: 0.7,
    borderRadius: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: space[2],
    color: colors.accent,
  },
  footerRule: {
    borderTopWidth: 1,
    paddingTop: space[4],
    marginTop: space[2],
  },
});
