"use client";

import { useState, useEffect } from "react";

const COOKIE_CONSENT_KEY = "pp_cookie_consent_v1";

type ConsentRecord = { accepted: boolean; at: number };

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!raw) {
        // Small delay so the banner doesn't flash before the page renders
        const t = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const respond = (accepted: boolean) => {
    const payload: ConsentRecord = { accepted, at: Date.now() };
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(payload));
    } catch {
      /* quota exceeded — still dismiss */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        background: "rgba(10, 10, 15, 0.97)",
        borderTop: "1px solid #1e1e2a",
        backdropFilter: "blur(16px)",
        padding: "18px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        flexWrap: "wrap",
        animation: "cookieFadeIn 0.4s ease-out",
      }}
    >
      <style>{`
        @keyframes cookieFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <p
        style={{
          margin: 0,
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          fontSize: 13,
          color: "#b0b0b8",
          lineHeight: 1.55,
          maxWidth: 680,
        }}
      >
        We use cookies and similar technologies (including localStorage) to maintain your session,
        remember preferences, and improve the Platform. Some data may be transmitted to third-party
        services (see our{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#CC0000", textDecoration: "underline" }}
        >
          Privacy Policy
        </a>
        ). You can accept all or reject non-essential technologies.
      </p>

      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => respond(true)}
          style={{
            padding: "10px 22px",
            borderRadius: 8,
            border: "none",
            background: "#CC0000",
            color: "#fff",
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#aa0000")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#CC0000")}
        >
          ACCEPT ALL
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          style={{
            padding: "10px 22px",
            borderRadius: 8,
            border: "1px solid #333",
            background: "transparent",
            color: "#888",
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.06em",
            cursor: "pointer",
            transition: "border-color 0.2s, color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#666";
            e.currentTarget.style.color = "#bbb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#333";
            e.currentTarget.style.color = "#888";
          }}
        >
          REJECT NON-ESSENTIAL
        </button>
      </div>
    </div>
  );
}
