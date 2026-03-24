import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy · PentaProtocol",
  description: "Refund and Cancellation Policy for PentaProtocol",
};

export default function RefundPage() {
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
              <a href="/privacy" style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", color: "#666", textDecoration: "none" }}>PRIVACY</a>
              <a href="/refund"  style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em", color: "#CC0000", textDecoration: "none" }}>REFUND</a>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 820, margin: "0 auto", padding: "56px 24px 96px" }}>
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#CC0000", letterSpacing: "0.3em", marginBottom: 12 }}>LEGAL</div>
            <h1 style={{ fontSize: 40, fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>Refund &amp; Cancellation Policy</h1>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
              Effective Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} &nbsp;·&nbsp; pentaprotocol.com
            </p>
            <div style={{ height: 2, background: "linear-gradient(to right, #CC0000, transparent)", marginTop: 24 }} />
          </div>

          <Section title="1. Overview">
            All purchases of virtual currency (ProtoCredits and PentaShards) and in-game items on PentaProtocol are generally <strong style={{ color: "#e8e8e8" }}>final and non-refundable</strong>, due to the immediate digital nature of delivery. We have a limited exception for accidental duplicate purchases only. Payments may be made via PayPal or by scanning the creator&apos;s personal payment QR (UPI or other method shown below). We do not use Instamojo. By completing a purchase, you agree to this policy.
          </Section>

          <Section title="2. Creator payment QR (direct payments)" id="creator-payment-qr">
            For direct payments (e.g. UPI in India), scan the <strong style={{ color: "#e8e8e8" }}>creator&apos;s personal QR code</strong> below. After payment, email{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>support@pentaprotocol.com</a>{" "}
            with your username, amount, and transaction reference (UPI ref or bank note) so we can verify and credit your account.
            <br /><br />
            <span style={{ display: "block", textAlign: "center", marginTop: 20 }}>
              <img
                src="/creator-payment-qr.svg"
                alt="Creator payment QR code for UPI or other direct payment"
                width={220}
                height={220}
                style={{ borderRadius: 12, border: "1px solid #2a2a38", maxWidth: "100%", height: "auto" }}
              />
            </span>
          </Section>

          <Section title="3. Non-Refundable Purchases">
            The following are strictly non-refundable under all circumstances:
            <br /><br />
            • ProtoCredits or PentaShards that have been used in whole or in part
            <br />
            • Cosmetic bundles, boards, banners, or theme packs that have been redeemed or applied to your account
            <br />
            • Purchases made more than 7 days prior to the refund request
            <br />
            • Purchases on accounts suspended or terminated for Terms violations
            <br /><br />
            We do not issue refunds for change of mind or dissatisfaction with gameplay outcomes.
          </Section>

          <Section title="4. Eligible Refund: Accidental Duplicate Purchases">
            PentaProtocol will consider a refund <strong style={{ color: "#e8e8e8" }}>solely</strong> where the same package has been purchased more than once within a single session due to a technical error, duplicate PayPal charge, inadvertent double payment to the creator&apos;s QR, or double-click — and the duplicate credits have <strong style={{ color: "#e8e8e8" }}>not been spent</strong>.
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>To qualify, all of the following must be true:</strong>
            <br />• The duplicate transaction occurred within the same session (within 30 minutes)
            <br />• The duplicate credits have not been used to purchase any in-game item
            <br />• The request is submitted within 48 hours of the transaction
            <br />• Payment confirmation details (transaction ID or receipt) are provided
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>How to request:</strong> Email{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>support@pentaprotocol.com</a>{" "}
            with your username, date and time of both transactions, PayPal transaction IDs or UPI / bank references, and a brief description. We aim to respond within 5 business days. Approved refunds for PayPal payments are processed back through PayPal where possible. For direct QR / UPI payments, approved refunds may be returned via UPI or bank transfer at the creator&apos;s discretion within a reasonable time — not guaranteed to be instant.
          </Section>

          <Section title="5. Cancellations">
            Orders cannot be cancelled once a transaction has been processed and virtual currency has been credited to your account, as delivery is immediate. If payment was processed but credits were not delivered due to a technical error, contact us at{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>support@pentaprotocol.com</a>{" "}
            within 48 hours with your transaction details.
          </Section>

          <Section title="6. Failed or Erroneous Transactions">
            If you were charged for a transaction that failed to deliver the corresponding credits, contact us at{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>support@pentaprotocol.com</a>{" "}
            within 48 hours with your transaction ID or UPI reference. We will verify with PayPal or your payment proof to the creator&apos;s account and credit your account or arrange a refund within 7 business days if confirmed.
          </Section>

          <Section title="7. Chargebacks">
            Initiating an unauthorised chargeback for a legitimate purchase violates our Terms and Conditions. Accounts with fraudulent chargebacks will be suspended and may face permanent termination with forfeiture of all virtual goods. If you have a genuine concern, please contact us before raising a dispute with your bank.
          </Section>

          <Section title="8. Contact">
            For refund, cancellation, or payment queries:{" "}
            <a href="mailto:support@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>support@pentaprotocol.com</a>
          </Section>

          <FooterLinks current="refund" />
        </div>
      </div>
    </>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <div style={{ marginBottom: 40 }} id={id}>
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
