"use client";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import CareerScreen from "@/components/CareerScreen";

/**
 * /career/{matchId} — deep link to a specific past match in the career history.
 * The CareerScreen auto-opens that match's round-browser overlay on load.
 */
export default function CareerMatchPage() {
  const { themeId, sfx } = useApp();
  const params = useParams();
  const matchId = typeof params.matchId === "string" ? params.matchId : "";

  return (
    <AuthGuard>
      <CareerScreen themeId={themeId} onHoverAction={sfx.hover} initialMatchId={matchId} />
    </AuthGuard>
  );
}
