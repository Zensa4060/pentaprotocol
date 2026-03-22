"use client";
// app/payment/paypal/callback/page.tsx
// PayPal redirects here after buyer approves with:
// ?token=ORDER_ID&PayerID=PAYER_ID

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import API from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type Status = "verifying" | "success" | "failed" | "error";

export default function PayPalCallbackPage() {
  const router = useRouter();
  const { token, updateUser } = useAuthStore();
  const [status, setStatus]   = useState<Status>("verifying");
  const [detail, setDetail]   = useState("");

  useEffect(() => {
    async function capture() {
      const params    = new URLSearchParams(window.location.search);
      const orderId   = params.get("token"); // PayPal sends order ID as "token"
      const payerId   = params.get("PayerID");

      // Retrieve package info stored in sessionStorage before redirect
      const packageId    = sessionStorage.getItem("pp_paypal_package_id") || "";
      const currencyType = sessionStorage.getItem("pp_paypal_currency_type") || "protocredits";

      if (!orderId || !payerId) {
        setStatus("error");
        setDetail("Missing payment parameters.");
        return;
      }

      try {
        const res = await API.post(
          "/api/paypal/capture-order",
          { order_id: orderId, package_id: packageId, currency_type: currencyType },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 },
        );

        if (res.data.success) {
          // Clean up sessionStorage
          sessionStorage.removeItem("pp_paypal_package_id");
          sessionStorage.removeItem("pp_paypal_currency_type");

          // Refresh user balance
          try {
            const me = await API.get("/api/profile/me", {
              headers: { Authorization: `Bearer ${token}` }, timeout: 15000
            });
            updateUser(me.data);
          } catch {}

          const added = res.data.credits_added ?? res.data.shards_added ?? 0;
          const type  = res.data.shards_added ? "PentaShards" : "ProtoCredits";
          setStatus("success");
          setDetail(`${added.toLocaleString()} ${type} added to your account!`);
          setTimeout(() => router.push("/"), 3000);
        } else {
          setStatus("failed");
          setDetail("Payment capture failed.");
        }
      } catch (e: any) {
        setStatus("error");
        setDetail(e?.response?.data?.detail || "Capture failed. Contact support if you were charged.");
      }
    }

    capture();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f", display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        background: "#111118", border: "1px solid #1e1e2a", borderRadius: 20,
        padding: "48px 40px", maxWidth: 420, width: "90vw", textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}>
        {status === "verifying" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Processing payment…</h2>
            <p style={{ color: "#555", fontSize: 14 }}>Please wait, do not close this tab.</p>
          </>
        )}
        {status === "success" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
            <h2 style={{ color: "#4CAF50", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Payment Successful!</h2>
            <p style={{ color: "#ccc", fontSize: 15, marginBottom: 8 }}>{detail}</p>
            <p style={{ color: "#555", fontSize: 13 }}>Redirecting to game…</p>
          </>
        )}
        {(status === "failed" || status === "error") && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ color: "#EF4444", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              {status === "failed" ? "Payment Failed" : "Something went wrong"}
            </h2>
            <p style={{ color: "#ccc", fontSize: 14, marginBottom: 24 }}>{detail}</p>
            <button onClick={() => router.push("/")}
              style={{ background: "#003087", border: "none", borderRadius: 10, padding: "12px 28px", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              Back to Game
            </button>
          </>
        )}
      </div>
    </div>
  );
}
