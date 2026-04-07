"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getRank, NavRankBadge } from "./NavBar";

type Props = {
  beforeElo: number;
  afterElo: number;
  onDone: () => void;
  t: {
    fontDisplay: string;
    fontMono: string;
    accent: string;
    gold: string;
    text: string;
    textMuted: string;
  };
};

export default function RankUpScreen({ beforeElo, afterElo, onDone, t }: Props) {
  const [ready, setReady] = useState(false);
  const beforeRank = useMemo(() => getRank(beforeElo), [beforeElo]);
  const afterRank = useMemo(() => getRank(afterElo), [afterElo]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120000, background: "radial-gradient(circle at center, #090b15 0%, #020205 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        onAnimationComplete={() => setReady(true)}
        style={{ width: "min(760px, 92vw)", borderRadius: 22, border: `1px solid ${t.accent}88`, background: "rgba(10,12,24,0.92)", padding: "32px 26px", textAlign: "center", boxShadow: `0 0 60px ${t.accent}44` }}
      >
        <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted, letterSpacing: "0.18em" }}>RANK ADVANCEMENT</div>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(30px, 6vw, 56px)", fontWeight: 900, color: t.gold, letterSpacing: "0.1em", margin: "10px 0 22px" }}>RANK UP</div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20 }}>
          <NavRankBadge rank={beforeRank} size={80} />
          <span style={{ color: t.accent, fontFamily: t.fontDisplay, fontSize: 32, fontWeight: 900 }}>→</span>
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <NavRankBadge rank={afterRank} size={108} />
          </motion.div>
        </div>
        <div style={{ marginTop: 16, fontFamily: t.fontMono, color: t.text, letterSpacing: "0.08em" }}>
          {beforeRank.name.toUpperCase()} → {afterRank.name.toUpperCase()}
        </div>
        <button
          type="button"
          disabled={!ready}
          onClick={onDone}
          style={{ marginTop: 26, padding: "14px 28px", borderRadius: 12, border: `1px solid ${t.gold}99`, background: `${t.gold}22`, color: t.gold, fontFamily: t.fontDisplay, fontWeight: 900, letterSpacing: "0.14em", cursor: ready ? "pointer" : "default", opacity: ready ? 1 : 0.65 }}
        >
          CONTINUE
        </button>
      </motion.div>
    </div>
  );
}
