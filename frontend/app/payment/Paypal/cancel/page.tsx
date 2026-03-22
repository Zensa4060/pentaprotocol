"use client";
// app/payment/paypal/cancel/page.tsx

import { useRouter } from "next/navigation";

export default function PayPalCancelPage() {
  const router = useRouter();
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f", display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        background: "#111118", border: "1px solid #1e1e2a", borderRadius: 20,
        padding: "48px 40px", maxWidth: 420, width: "90vw", textAlign: "center",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>↩️</div>
        <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Payment Cancelled</h2>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 24 }}>You cancelled the payment. No charges were made.</p>
        <button onClick={() => router.push("/")}
          style={{ background: "#003087", border: "none", borderRadius: 10, padding: "12px 28px", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Back to Game
        </button>
      </div>
    </div>
  );
}
