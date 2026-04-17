"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /collection has no standalone view — it always redirects to /collection/themes.
 * All collection content lives under /collection/{themes|grids|banners|coins|badges}.
 */
export default function CollectionIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/collection/themes");
  }, [router]);
  return null;
}
