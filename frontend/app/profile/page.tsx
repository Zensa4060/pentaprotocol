"use client";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import ProfileScreen from "@/components/ProfileScreen";

export default function ProfilePage() {
  const { navigate, themeId, sfx } = useApp();
  return (
    <AuthGuard>
      <ProfileScreen
        setScreenAction={navigate}
        themeId={themeId}
        onHoverAction={sfx.hover}
        onClickAction={sfx.click}
      />
    </AuthGuard>
  );
}
