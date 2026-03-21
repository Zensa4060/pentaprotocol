"use client";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import type { Screen } from "@/lib/types";
import { PolicySection, FooterLinks } from "./TermsScreen";

interface Props {
  themeId: ThemeId;
  setScreenAction: (s: Screen) => void;
}

export default function RefundScreen({ themeId, setScreenAction }: Props) {
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
          <h1 style={{ fontFamily: t.fontDisplay, fontSize: "clamp(28px,5vw,42px)", fontWeight: 900, color: t.text, lineHeight: 1.1, marginBottom: 12 }}>Refund & Cancellation Policy</h1>
          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>Effective Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · pentaprotocol.com</div>
          <div style={{ height: 2, background: `linear-gradient(to right, ${accent}, transparent)`, marginTop: 24 }} />
        </div>

        <PolicySection title="1. Overview" accent={accent} t={t}>
          All purchases of virtual currency (ProtoCredits and PentaShards) and in-game items on PentaProtocol are generally <strong style={{ color: t.text }}>final and non-refundable</strong>, due to the immediate digital nature of delivery. We have a limited exception policy for accidental duplicate purchases only. By completing a purchase, you agree to this policy.
        </PolicySection>

        <PolicySection title="2. Non-Refundable Purchases" accent={accent} t={t}>
          The following are strictly non-refundable under all circumstances: ProtoCredits or PentaShards that have been used in whole or in part; cosmetic bundles, boards, banners, or theme packs that have been redeemed or applied to your account; purchases made more than 7 days prior to the refund request; and purchases on accounts suspended or terminated for Terms violations. We do not issue refunds for change of mind or dissatisfaction with gameplay outcomes.
        </PolicySection>

        <PolicySection title="3. Eligible Refund: Accidental Duplicate Purchases" accent={accent} t={t}>
          PentaProtocol will consider a refund <strong style={{ color: t.text }}>solely</strong> where the same package has been purchased more than once within a single session due to a technical error, payment gateway glitch, or inadvertent double-click — and the duplicate credits have <strong style={{ color: t.text }}>not been spent</strong>.
          <br /><br />
          <strong style={{ color: t.text }}>To qualify, all of the following must be true:</strong>
          <br />• The duplicate transaction occurred within the same session (within 30 minutes)
          <br />• The duplicate credits have not been used to purchase any in-game item
          <br />• The request is submitted within 48 hours of the transaction
          <br />• Payment confirmation details (transaction ID or receipt) are provided
          <br /><br />
          <strong style={{ color: t.text }}>How to request:</strong> Email <strong style={{ color: t.text }}>support@pentaprotocol.com</strong> with your username, date/time of both transactions, transaction IDs for both purchases, and a brief description of what happened. We aim to respond within 5 business days. Approved refunds are processed to the original payment method within 7–10 business days.
        </PolicySection>

        <PolicySection title="4. Cancellations" accent={accent} t={t}>
          Orders cannot be cancelled once a transaction has been processed and virtual currency has been credited to your account, as delivery is immediate. If payment was processed but credits were not delivered due to a technical error, contact us at support@pentaprotocol.com within 48 hours with your transaction details — we will credit the correct amount or issue a refund.
        </PolicySection>

        <PolicySection title="5. Failed or Erroneous Transactions" accent={accent} t={t}>
          If you were charged for a transaction that failed to deliver the corresponding credits, contact us at support@pentaprotocol.com within 48 hours with your transaction ID. We will verify with our payment provider and credit your account or issue a refund within 7 business days if confirmed.
        </PolicySection>

        <PolicySection title="6. Chargebacks" accent={accent} t={t}>
          Initiating an unauthorised chargeback or payment dispute for a legitimate purchase violates our Terms and Conditions. Accounts with fraudulent chargebacks will be suspended pending investigation and may face permanent termination with forfeiture of all virtual goods. If you have a genuine concern, please contact us before raising a dispute with your bank or payment provider.
        </PolicySection>

        <PolicySection title="7. Contact" accent={accent} t={t}>
          For refund, cancellation, or payment queries: <strong style={{ color: t.text }}>support@pentaprotocol.com</strong>
        </PolicySection>

        <FooterLinks setScreenAction={setScreenAction} t={t} accent={accent} current="refund" />
      </div>
    </div>
  );
}