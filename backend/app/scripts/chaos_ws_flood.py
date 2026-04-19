"""Chaos drill — WebSocket flood.

Opens many concurrent WebSocket connections to the target URL,
optionally requesting a fresh single-use ticket for each one, and
reports how the server responds. Used in staging drills (see
``docs/CHAOS.md`` section 3) to verify:

  * Ticket issuance rate-limits kick in.
  * The server stays healthy under connection pressure.
  * 429 / 503 responses are emitted cleanly instead of 5xx crashes.

This is NOT for prod. The CLI intentionally has no "point at prod"
safety net — if you supply a prod URL you will DoS your own users.
Run it against staging.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import time
from collections import Counter
from typing import Optional

try:
    import aiohttp
    import websockets
except ImportError:  # pragma: no cover
    raise SystemExit(
        "chaos_ws_flood requires `aiohttp` and `websockets`. "
        "Install them in the chaos venv only — they are not part of "
        "the production requirements."
    )

logger = logging.getLogger("pentaprotocol.chaos.ws")


async def _get_ticket(session: aiohttp.ClientSession, endpoint: str, jwt: str,
                      room_code: Optional[str], slot: Optional[str]) -> Optional[str]:
    payload = {}
    if room_code:
        payload["room_code"] = room_code
    if slot:
        payload["slot"] = slot
    try:
        async with session.post(
            endpoint,
            json=payload,
            headers={"Authorization": f"Bearer {jwt}"},
            timeout=aiohttp.ClientTimeout(total=5),
        ) as resp:
            if resp.status != 200:
                return f"http_{resp.status}"
            data = await resp.json()
            return data.get("ticket")
    except Exception as e:
        return f"err_{type(e).__name__}"


async def _one_flood(
    idx: int,
    ws_url: str,
    ticket_endpoint: Optional[str],
    jwt: Optional[str],
    room_code: Optional[str],
    slot: Optional[str],
    results: Counter,
    session: aiohttp.ClientSession,
) -> None:
    ticket: Optional[str] = None
    if ticket_endpoint and jwt:
        ticket = await _get_ticket(session, ticket_endpoint, jwt, room_code, slot)
        if ticket and ticket.startswith(("http_", "err_")):
            results[ticket] += 1
            return

    url = ws_url
    if ticket:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}ticket={ticket}"

    try:
        async with websockets.connect(url, open_timeout=5, ping_interval=None) as ws:
            results["connected"] += 1
            # Hold for a beat so we actually observe server behaviour.
            await asyncio.sleep(0.5)
            await ws.close()
    except Exception as e:  # noqa: BLE001
        results[f"ws_{type(e).__name__}"] += 1


async def _run(args: argparse.Namespace) -> None:
    sem = asyncio.Semaphore(args.concurrency)
    results: Counter = Counter()
    started = time.monotonic()

    async with aiohttp.ClientSession() as session:
        async def _task(i: int) -> None:
            async with sem:
                await _one_flood(
                    i,
                    args.url,
                    args.ticket_endpoint,
                    args.jwt,
                    args.room,
                    args.slot,
                    results,
                    session,
                )

        await asyncio.gather(*[_task(i) for i in range(args.count)])

    elapsed = time.monotonic() - started
    logger.info("flood finished in %.1fs: %s", elapsed, dict(results))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser(description="Flood a WebSocket endpoint for chaos drills.")
    p.add_argument("--url", required=True, help="WebSocket URL, e.g. wss://staging.example/api/room/ws/ABC/P1")
    p.add_argument("--count", type=int, default=200)
    p.add_argument("--concurrency", type=int, default=50)
    p.add_argument("--ticket-endpoint", default=None, help="POST /api/room/ws-ticket URL")
    p.add_argument("--jwt", default=None, help="JWT for ticket requests.")
    p.add_argument("--room", default=None)
    p.add_argument("--slot", default=None, choices=["P1", "P2"])
    args = p.parse_args()

    if "api.pentaprotocol.com" in args.url and "staging" not in args.url:
        raise SystemExit(
            "chaos_ws_flood refuses to target a non-staging URL. "
            "Run only against a staging environment."
        )

    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
