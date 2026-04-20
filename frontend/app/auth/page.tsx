import { redirect } from "next/navigation";

/**
 * Legacy alias — keep old `/auth` links working but serve auth UI at `/login`.
 */
export default function AuthAliasPage() {
  redirect("/login");
}
