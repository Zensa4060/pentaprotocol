# Mobile ↔ Web ↔ Backend Parity Plan

Mobile uses the **same FastAPI backend** as web (`EXPO_PUBLIC_API_URL`). Game rules are **server-authoritative** for multiplayer; local training/bot uses a **separate BO3** ruleset (matches web `isLocalShortSeries`).

## Phase 1 — Board mode & local series (this PR)
- [x] `effectivePlayBoardMode()` / `startingLegFromBoardMode()` — compound `5x5_6x6_7x7` no longer maps to 7×7
- [x] `useMatchSeries` → BO3: G1–G3, first to **2 wins**, draws = **0**
- [x] Training/bot UI copy updated

## Phase 2 — Multiplayer socket sync
- [x] Merge `rulebreaker_start` / `toss_action` RB fields into `room`
- [x] Richer `game_reset` patch
- [ ] `limitbreaker_start` UI (G10)
- [ ] `ready_update` opponent-ready display
- [ ] Match clocks + `timeout` WS

## Phase 3 — Protocol Breakers
- [x] Rulebreaker payload keys aligned with web (`c3`, `first`, `timer_half`)
- [ ] 6×6 trap cell picker UI
- [ ] 7×7 full pattern list + extra-turn token

## Phase 4 — Multiplayer UX copy
- [x] Pregame explains triple-leg + first-to-3 for online
- [ ] Ruleshow gates per leg (`awaiting_*_rules_ready`)

## Scoring reference

| Mode | Target | Draw points | Max games |
|------|--------|-------------|-----------|
| Ranked / unranked MP | First to **3 wins** | **0** | 9 (+ G10 Limitbreaker) |
| Training / pass-and-play / bot | First to **2 wins** (BO3) | **0** | 3 |
