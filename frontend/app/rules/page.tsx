import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** Long-form rules page removed — tutorial & training cover gameplay. */
export default function RulesPage() {
  redirect(ROUTES.TRAINING);
}
