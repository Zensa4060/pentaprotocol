"use client";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import CareerScreen from "@/components/CareerScreen";

export default function CareerPage() {
  const { themeId, sfx } = useApp();
  return (
    <AuthGuard>
      <CareerScreen themeId={themeId} onHoverAction={sfx.hover} />
    </AuthGuard>
  );
}
