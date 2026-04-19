"use client";

import React, { useState } from "react";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import API from "@/lib/api";
import {
  clearPolicyGatePending,
  getUserId,
  setLegalAccepted,
} from "@/lib/legalAcceptance";

type Props = {
  themeId: ThemeId;
  user: { _id?: string; id?: string; username?: string } | null;
  onAcceptedAction: () => void;
  onDeclinedAction: () => void;
};

export default function PolicyAcceptanceGate({
  themeId,
  user,
  onAcceptedAction,
  onDeclinedAction,
}: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [refund, setRefund] = useState(false);
  const uid = getUserId(user);

  const allChecked = terms && privacy && refund;
  const openDoc = (path: string) => {
    window.open(path, "_blank", "noopener,noreferrer");
  };

  const acceptAll = () => {
    setTerms(true);
    setPrivacy(true);
    setRefund(true);
  };

  const rejectAll = () => {
    setTerms(false);
    setPrivacy(false);
    setRefund(false);
  };

  const accept = () => {
    if (!allChecked || !uid) return;
    // Server-side consent record (fire-and-forget — non-blocking)
    API.post("/api/auth/accept-legal", { version: 2 }).catch(() => {});
    setLegalAccepted(uid);
    clearPolicyGatePending();
    onAcceptedAction();
  };

  const decline = () => {
    clearPolicyGatePending();
    onDeclinedAction();
  };

  const row = (
    checked: boolean,
    setChecked: (v: boolean) => void,
    label: React.ReactNode
  ) => (
    <button
      type="button"
      onClick={() => setChecked(!checked)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        width: "100%",
        textAlign: "left",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${checked ? t.accent : t.border}`,
        borderRadius: ip ? 2 : 10,
        padding: "12px 14px",
        cursor: "pointer",
        marginBottom: 10,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          borderRadius: 4,
          border: `2px solid ${checked ? t.accent : "rgba(255,255,255,0.25)"}`,
          background: checked ? `${t.accent}33` : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
          color: t.accent,
          fontWeight: 900,
          fontSize: 12,
        }}
      >
        {checked ? "✓" : ""}
      </span>
      <span style={{ fontFamily: t.fontBody, fontSize: ip ? 12 : 14, color: t.textSecondary, lineHeight: 1.55 }}>
        {label}
      </span>
    </button>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          maxHeight: "min(92vh, 720px)",
          overflowY: "auto",
          background: t.bgPanel,
          border: `${ip ? 3 : 1}px solid ${t.border}`,
          borderRadius: ip ? 2 : 18,
          padding: ip ? "20px 18px" : "28px 26px",
          boxShadow: `0 24px 80px rgba(0,0,0,0.75), 0 0 40px ${t.accent}18`,
        }}
      >
        <div
          style={{
            fontFamily: t.fontMono,
            fontSize: 10,
            letterSpacing: "0.2em",
            color: t.textMuted,
            marginBottom: 8,
          }}
        >
          NEW ACCOUNT
        </div>
        <h1
          style={{
            fontFamily: t.fontDisplay,
            fontSize: ip ? 16 : 22,
            fontWeight: 800,
            color: t.text,
            marginBottom: 10,
            lineHeight: 1.25,
          }}
        >
          Legal agreements
        </h1>
        <p
          style={{
            fontFamily: t.fontBody,
            fontSize: ip ? 12 : 14,
            color: t.textMuted,
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        >
          Before you continue, read and confirm each item. You can open the full documents in a new tab. You must accept all three to use your account.
        </p>

        {row(terms, setTerms, (
          <>
            I have read and agree to the{" "}
            <span
              role="link"
              tabIndex={0}
              onClick={e => {
                e.stopPropagation();
                openDoc("/terms");
              }}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  openDoc("/terms");
                }
              }}
              style={{ color: t.accent, textDecoration: "underline", cursor: "pointer" }}
            >
              Terms &amp; Conditions
            </span>
            .
          </>
        ))}

        {row(privacy, setPrivacy, (
          <>
            I have read and agree to the{" "}
            <span
              role="link"
              tabIndex={0}
              onClick={e => {
                e.stopPropagation();
                openDoc("/privacy");
              }}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  openDoc("/privacy");
                }
              }}
              style={{ color: t.accent, textDecoration: "underline", cursor: "pointer" }}
            >
              Privacy Policy
            </span>
            .
          </>
        ))}

        {row(refund, setRefund, (
          <>
            I have read and agree to the{" "}
            <span
              role="link"
              tabIndex={0}
              onClick={e => {
                e.stopPropagation();
                openDoc("/refund");
              }}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  openDoc("/refund");
                }
              }}
              style={{ color: t.accent, textDecoration: "underline", cursor: "pointer" }}
            >
              Refund &amp; Cancellation Policy
            </span>
            .
          </>
        ))}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              type="button"
              onClick={acceptAll}
              style={{
                flex: 1,
                padding: ip ? "11px" : "12px",
                borderRadius: ip ? 2 : 10,
                border: "none",
                background: `${t.accent}22`,
                color: t.accent,
                fontFamily: t.fontDisplay,
                fontSize: ip ? 11 : 13,
                fontWeight: 800,
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              ACCEPT ALL
            </button>
            <button
              type="button"
              onClick={rejectAll}
              style={{
                flex: 1,
                padding: ip ? "11px" : "12px",
                borderRadius: ip ? 2 : 10,
                border: `1px solid ${t.border}`,
                background: "transparent",
                color: t.textMuted,
                fontFamily: t.fontDisplay,
                fontSize: ip ? 11 : 13,
                fontWeight: 700,
                letterSpacing: "0.06em",
                cursor: "pointer",
              }}
            >
              REJECT ALL
            </button>
          </div>
          <button
            type="button"
            disabled={!allChecked}
            onClick={accept}
            style={{
              width: "100%",
              padding: ip ? "12px" : "14px",
              borderRadius: ip ? 2 : 10,
              border: "none",
              background: allChecked ? t.accent : "rgba(255,255,255,0.08)",
              color: allChecked ? "#0a0a0a" : t.textMuted,
              fontFamily: t.fontDisplay,
              fontSize: ip ? 12 : 14,
              fontWeight: 800,
              letterSpacing: "0.08em",
              cursor: allChecked ? "pointer" : "not-allowed",
            }}
          >
            ACCEPT AND CONTINUE
          </button>
          <button
            type="button"
            onClick={decline}
            style={{
              width: "100%",
              padding: ip ? "11px" : "12px",
              borderRadius: ip ? 2 : 10,
              border: `1px solid ${t.border}`,
              background: "transparent",
              color: t.textMuted,
              fontFamily: t.fontDisplay,
              fontSize: ip ? 11 : 13,
              fontWeight: 700,
              letterSpacing: "0.06em",
              cursor: "pointer",
            }}
          >
            I DO NOT AGREE — SIGN OUT
          </button>
        </div>
      </div>
    </div>
  );
}
