"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { SYROS_PFP_URL } from "@/lib/unrankedBots";
import API from "@/lib/api";

type ChatRole = "user" | "syros" | "system";

interface ChatLine {
  id: string;
  role: ChatRole;
  text: string;
}

function extractApiError(err: unknown): string {
  const ax = err as { response?: { data?: { detail?: unknown } }; message?: string };
  const d = ax?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x))).join(" ");
  if (d && typeof d === "object" && "message" in d) return String((d as { message: string }).message);
  return ax?.message || "Request failed.";
}

/**
 * Syros surface at `/syros` — oracle chat (navbar). Messages call
 * `POST /api/syros/ask` when the backend and Gemini key are configured.
 */
export default function SyrosChat({ themeId }: { themeId: ThemeId }) {
  const t = THEMES[themeId] ?? THEMES.classic_dark;
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, pending]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || pending) return;
    setInput("");
    const userId = `u-${Date.now()}`;
    setLines((prev) => [...prev, { id: userId, role: "user", text: q }]);
    setPending(true);
    try {
      const res = await API.post<{ answer: string }>("/api/syros/ask", { question: q });
      const answer = (res.data?.answer || "").trim() || "…";
      setLines((prev) => [
        ...prev,
        { id: `m-${Date.now()}`, role: "syros", text: answer },
      ]);
    } catch (e) {
      setLines((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "system",
          text: extractApiError(e),
        },
      ]);
    } finally {
      setPending(false);
    }
  }, [input, pending]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: t.bg,
        color: t.text,
        fontFamily: t.fontBody,
        padding: "clamp(72px, 12vh, 120px) 20px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          border: "1px solid rgba(192,132,252,0.35)",
          background: `linear-gradient(165deg, rgba(76,29,149,0.22), ${t.bgCard})`,
          boxShadow: "0 0 40px rgba(124,58,237,0.25), inset 0 0 60px rgba(15,5,30,0.4)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px 22px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid rgba(192,132,252,0.85)",
                flexShrink: 0,
                background: "#0B0514",
              }}
            >
              <img
                src={SYROS_PFP_URL}
                alt="SYROS"
                width={56}
                height={56}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            <div>
              <div
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: "clamp(22px, 4vw, 32px)",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  color: "#E9D5FE",
                  textTransform: "uppercase",
                  textShadow: "0 0 18px rgba(192,132,252,0.6)",
                }}
              >
                SYROS
              </div>
              <div style={{ marginTop: 4, fontSize: 14, color: t.textSecondary, letterSpacing: "0.05em" }}>
                Ask about rules, patterns, or the ladder — Enter sends, Shift+Enter newline.
              </div>
            </div>
          </div>
        </div>

        <div
          ref={listRef}
          style={{
            flex: 1,
            minHeight: "min(360px, 42vh)",
            maxHeight: "min(520px, 52vh)",
            overflowY: "auto",
            padding: "12px 20px 16px",
            borderTop: `1px solid ${t.border}33`,
            borderBottom: `1px solid ${t.border}33`,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {lines.length === 0 && !pending ? (
            <p
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.6,
                color: t.textMuted,
                fontStyle: "italic",
              }}
            >
              No messages yet. Type below and press Send — the observer answers only PentaProtocol.
            </p>
          ) : null}
          {lines.map((row) => (
            <div
              key={row.id}
              style={{
                alignSelf: row.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
                padding: "10px 14px",
                borderRadius: row.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background:
                  row.role === "user"
                    ? "rgba(124,58,237,0.35)"
                    : row.role === "system"
                      ? "rgba(220,38,38,0.12)"
                      : "rgba(30,10,50,0.55)",
                border: `1px solid ${
                  row.role === "user"
                    ? "rgba(192,132,252,0.45)"
                    : row.role === "system"
                      ? "rgba(220,38,38,0.35)"
                      : "rgba(192,132,252,0.25)"
                }`,
                color: row.role === "system" ? t.danger : t.text,
                fontSize: row.role === "syros" ? 16 : 15,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {row.role === "syros" ? (
                <span style={{ fontStyle: "italic", color: "rgba(237,233,254,0.95)" }}>{row.text}</span>
              ) : (
                row.text
              )}
            </div>
          ))}
          {pending ? (
            <div
              style={{
                alignSelf: "flex-start",
                fontSize: 14,
                color: t.textMuted,
                fontStyle: "italic",
                paddingLeft: 4,
              }}
            >
              Listening…
            </div>
          ) : null}
        </div>

        <div style={{ padding: "14px 16px 18px", flexShrink: 0, background: `linear-gradient(180deg, transparent, ${t.bg}33)` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message SYROS…"
              disabled={pending}
              rows={2}
              maxLength={8000}
              style={{
                flex: 1,
                minHeight: 52,
                maxHeight: 140,
                resize: "vertical",
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid rgba(192,132,252,0.35)`,
                background: t.inputBg,
                color: t.text,
                fontFamily: t.fontBody,
                fontSize: 16,
                lineHeight: 1.45,
                outline: "none",
              }}
            />
            <button
              type="button"
              disabled={pending || !input.trim()}
              onClick={() => void send()}
              style={{
                padding: "12px 20px",
                borderRadius: 10,
                border: "1px solid rgba(192,132,252,0.55)",
                background: pending || !input.trim() ? t.bgPanel : "rgba(124,58,237,0.45)",
                color: pending || !input.trim() ? t.textMuted : "#E9D5FE",
                fontFamily: t.fontMono,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.14em",
                cursor: pending || !input.trim() ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
