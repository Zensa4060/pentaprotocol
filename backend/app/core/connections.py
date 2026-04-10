"""
Global WebSocket connection registry.

Tracks every authenticated WebSocket connection by user_id so that
when a new login occurs, the previous screen can be notified immediately.
"""
from __future__ import annotations
from typing import TYPE_CHECKING
import asyncio

if TYPE_CHECKING:
    from starlette.websockets import WebSocket


class ConnectionManager:
    """
    Maps user_id -> set of active WebSocket objects.
    A user can have at most 1 session at a time in normal flow; the set
    is kept for safety (e.g. brief reconnect overlap).
    """

    def __init__(self) -> None:
        # user_id -> set of WebSocket
        self._connections: dict[str, set] = {}

    # ── Registration ──────────────────────────────────────────────────────────

    def register(self, user_id: str, ws: "WebSocket") -> None:
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(ws)

    def unregister(self, user_id: str, ws: "WebSocket") -> None:
        sockets = self._connections.get(user_id)
        if sockets:
            sockets.discard(ws)
            if not sockets:
                del self._connections[user_id]

    # ── Session-kick ──────────────────────────────────────────────────────────

    async def kick_user(self, user_id: str, *, reason: str = "duplicate_session") -> None:
        """
        Send a `{type: 'duplicate_session'}` message to every WebSocket
        currently associated with *user_id*, then close them.
        Called right before issuing a new token for that user.
        """
        sockets = list(self._connections.get(user_id, set()))
        for ws in sockets:
            try:
                await ws.send_json({"type": "duplicate_session", "reason": reason})
            except Exception:
                pass
            try:
                await ws.close(code=4001)
            except Exception:
                pass
        # Clear the registry entry — room.py will re-register when reconnecting
        self._connections.pop(user_id, None)

    def has_active_connections(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))


# ── Singleton ─────────────────────────────────────────────────────────────────
manager = ConnectionManager()
