"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /missions has no standalone view — it always redirects to /missions/daily.
 * All mission content lives under /missions/{daily|weekly|permanent}.
 */
export default function MissionsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/missions/daily");
  }, [router]);
  return null;
}
