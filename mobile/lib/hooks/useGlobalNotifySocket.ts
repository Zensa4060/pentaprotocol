/**
 * Keep ``/api/room/ws/global/notify`` open while signed in (web parity).
 */

import { useEffect, useRef } from "react";

import { openGlobalNotifySocket } from "@/lib/multiplayer/globalNotify";
import { useAuthStore } from "@/lib/store";

export function useGlobalNotifySocket(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const socketRef = useRef<ReturnType<typeof openGlobalNotifySocket> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }
    socketRef.current = openGlobalNotifySocket();
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [isAuthenticated]);
}
