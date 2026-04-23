import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy – PentaProtocol",
  description: "How PentaProtocol uses cookies, localStorage, and similar technologies.",
};

export default function CookiePolicyPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { margin: 0; background: #0a0a0f; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", justifyContent: "center", padding: "60px 20px 80px" }}>
        <div style={{ width: "100%", maxWidth: 720, fontFamily: "'Inter', sans-serif" }}>

          <div style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#CC0000", letterSpacing: "0.3em", marginBottom: 12 }}>LEGAL</div>
            <h1 style={{ fontSize: 40, fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>Cookie Policy</h1>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
              Effective Date: 9 April 2026 &nbsp;·&nbsp; pentaprotocol.com
            </p>
            <div style={{ height: 2, background: "linear-gradient(to right, #CC0000, transparent)", marginTop: 24 }} />
          </div>

          <Section title="1. What Are Cookies?">
            Cookies are small text files stored on your device. &quot;Similar technologies&quot; includes localStorage, sessionStorage, and other browser-based storage mechanisms. We use these to make the Platform functional and to remember your preferences.
          </Section>

          <Section title="2. Essential Storage (Required)">
            These are necessary for the Platform to function. Blocking them may prevent you from using PentaProtocol.
          </Section>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 40, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #222" }}>
                <th style={{ textAlign: "left", color: "#CC0000", fontWeight: 700, padding: "8px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em" }}>KEY</th>
                <th style={{ textAlign: "left", color: "#CC0000", fontWeight: 700, padding: "8px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em" }}>TYPE</th>
                <th style={{ textAlign: "left", color: "#CC0000", fontWeight: 700, padding: "8px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em" }}>PURPOSE</th>
                <th style={{ textAlign: "left", color: "#CC0000", fontWeight: 700, padding: "8px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em" }}>DURATION</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["pp_token", "HttpOnly cookie", "Authentication JWT token — unreadable from JavaScript", "12 hrs from issue"],
                ["pp_device_token", "HttpOnly cookie", "Trusted-device token for 2FA bypass — unreadable from JavaScript", "30 days"],
                ["pp_auth", "Cookie (readable)", "Session expiry timestamp for synchronous logged-in check", "12 hrs from issue"],
                ["pp_user", "localStorage", "Cached user profile data (non-secret)", "Until logout"],
                ["pp_legal_accept_v1", "localStorage", "Legal policy acceptance record", "Persistent"],
                ["pp_cookie_consent_v1", "localStorage", "Cookie consent choice", "Persistent"],
              ].map(([key, type, purpose, duration], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1a1a22" }}>
                  <td style={{ padding: "10px", color: "#e8e8e8", fontFamily: "monospace", fontSize: 12 }}>{key}</td>
                  <td style={{ padding: "10px", color: "#888" }}>{type}</td>
                  <td style={{ padding: "10px", color: "#b0b0b8" }}>{purpose}</td>
                  <td style={{ padding: "10px", color: "#888" }}>{duration}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Section title="3. Preference Storage (Functional)">
            These remember your settings and gameplay preferences. They are not shared with third parties.
          </Section>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 40, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #222" }}>
                <th style={{ textAlign: "left", color: "#CC0000", fontWeight: 700, padding: "8px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em" }}>KEY</th>
                <th style={{ textAlign: "left", color: "#CC0000", fontWeight: 700, padding: "8px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em" }}>PURPOSE</th>
                <th style={{ textAlign: "left", color: "#CC0000", fontWeight: 700, padding: "8px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em" }}>DURATION</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["pp_theme", "Selected visual theme", "Persistent"],
                ["pp_boardMode", "Last selected board size (5x5, 6x6, 7x7)", "Persistent"],
                ["pp_selectedPatterns", "Selected game patterns", "Persistent"],
                ["pp_ai_difficulty", "AI difficulty preference", "Persistent"],
                ["pp_music_vol", "Music volume level", "Persistent"],
                ["pp_sfx_vol", "Sound effects volume level", "Persistent"],
                ["pp_muted", "Mute audio preference", "Persistent"],
              ].map(([key, purpose, duration], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1a1a22" }}>
                  <td style={{ padding: "10px", color: "#e8e8e8", fontFamily: "monospace", fontSize: 12 }}>{key}</td>
                  <td style={{ padding: "10px", color: "#b0b0b8" }}>{purpose}</td>
                  <td style={{ padding: "10px", color: "#888" }}>{duration}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Section title="4. Session Storage">
            We use sessionStorage (cleared when you close your browser tab) for temporary flow state such as policy gate tracking and post-game navigation. Session storage is never shared with third parties.
          </Section>

          <Section title="5. Third-Party Technologies">
            The following third-party services may set their own cookies or receive data when you use the Platform:
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Google Fonts</strong> — Loaded from fonts.googleapis.com. Your IP address and browser metadata are transmitted to Google when fonts are fetched.<br />
            <strong style={{ color: "#e8e8e8" }}>Google Drive</strong> — Image thumbnails may be loaded from Google Drive, transmitting your IP to Google.<br />
            <strong style={{ color: "#e8e8e8" }}>Profile avatars</strong> — Uploaded profile pictures are served from third-party file storage; your IP address may be transmitted when those images load.
          </Section>

          <Section title="6. Managing Your Preferences">
            You can manage or delete stored data at any time:
            <br /><br />
            <strong style={{ color: "#e8e8e8" }}>Browser settings:</strong> Clear cookies and site data in your browser settings.<br />
            <strong style={{ color: "#e8e8e8" }}>DevTools:</strong> Open your browser&apos;s Developer Tools → Application → Local Storage to view and delete individual keys.<br />
            <strong style={{ color: "#e8e8e8" }}>Cookie banner:</strong> You can reset your cookie consent by clearing localStorage and reloading the page.
            <br /><br />
            Note: Clearing the pp_token / pp_auth cookies or the pp_user localStorage entry will sign you out.
          </Section>

          <Section title="7. Contact">
            Questions about our cookie practices? Contact us at:{" "}
            <a href="mailto:privacy@pentaprotocol.com" style={{ color: "#CC0000", textDecoration: "none" }}>privacy@pentaprotocol.com</a>
          </Section>

          <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #1e1e2a" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#444", lineHeight: 1.8 }}>
              Version 1.0 — 9 April 2026 · Initial release
            </div>
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 28 }}>
            {[
              { label: "Terms & Conditions", href: "/terms" },
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Refund Policy", href: "/refund" },
              { label: "Cookie Policy", href: "/cookies" },
            ].map(l => (
              <a key={l.href} href={l.href} style={{
                fontFamily: "monospace", fontSize: 11, letterSpacing: "0.1em",
                color: l.href === "/cookies" ? "#CC0000" : "#444",
                textDecoration: l.href === "/cookies" ? "underline" : "none",
                textTransform: "uppercase",
              }}>
                {l.label}
              </a>
            ))}
          </div>

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
