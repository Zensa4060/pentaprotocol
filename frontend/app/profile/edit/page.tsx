"use client";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import ProfileScreen from "@/components/ProfileScreen";

/**
 * /profile/edit — opens the profile editor directly.
 */
export default function EditProfilePage() {
  const { navigate, themeId, sfx } = useApp();
  return (
    <AuthGuard>
      <ProfileScreen
        setScreenAction={navigate}
        themeId={themeId}
        onHoverAction={sfx.hover}
        onClickAction={sfx.click}
        initialEditMode
      />
    </AuthGuard>
  );
}
