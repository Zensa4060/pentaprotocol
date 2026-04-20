import { redirect } from "next/navigation";

/**
 * Root `/` — dedicated redirect endpoint.
 * We keep auth UI on `/login` only to avoid mounting heavy auth visuals on `/`.
 */
export default function RootPage() {
  redirect("/login");
}
