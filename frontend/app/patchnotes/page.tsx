"use client";
import PatchNotesScreen from "@/components/PatchNotesScreen";
import { useApp } from "@/components/AppShell";

export default function PatchNotesPage() {
  const { themeId } = useApp();
  return <PatchNotesScreen themeId={themeId} />;
}
