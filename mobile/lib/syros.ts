/**
 * Syros — the in-universe AI oracle. ``POST /api/syros/ask``.
 */

import API from "@/lib/api";
import { ApiError } from "@/lib/profile";
import { isAxiosError } from "axios";

export async function askSyros(question: string): Promise<string> {
  try {
    const res = await API.post<{ answer: string }>(
      "/api/syros/ask",
      { question },
      { timeout: 40_000 },
    );
    return res.data.answer;
  } catch (err) {
    if (isAxiosError(err)) {
      const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
      throw new ApiError(typeof detail === "string" ? detail : "Syros is unreachable.", err.response?.status);
    }
    throw new ApiError("Syros is unreachable.");
  }
}
