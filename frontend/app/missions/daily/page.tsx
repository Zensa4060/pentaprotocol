"use client";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import MissionsScreen from "@/components/MissionsScreen";

export default function MissionsDailyPage() {
  const { themeId } = useApp();
  return (
    <AuthGuard>
      <MissionsScreen themeId={themeId} initialTab="daily" />
    </AuthGuard>
  );
}
