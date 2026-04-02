/** Lobby taunt lines — pools keyed by last multiplayer series outcome for the local player. */

const TAUNT_QUOTES_NEUTRAL = [
  "Queueing again? Confidence is doing heavy lifting today.",
  "You call that a rank or a suggestion?",
  "Your MMR has trust issues.",
  "Statistically, you are the problem.",
  "Win rate lower than your expectations.",
  "You didn't lose. You consistently failed.",
  "Even matchmaking gave up trying to balance you.",
  "You play like the tutorial beat you.",
  "Ranked isn't for self-discovery.",
  "Your peak was accidental.",
  "You're not stuck. You belong there.",
  "That wasn't bad luck. That was you.",
  "Your strategy is 'hope they're worse.'",
  "Impressive. Losing with commitment.",
  "You make average look ambitious.",
  "You don't tilt. You start tilted.",
  "Consistency matters. You consistently lose.",
  "That wasn't a misplay. That's your play.",
  "You bring chaos. Unfortunately, not the useful kind.",
  "Every match is a learning experience. You just don't learn.",
  "Your decision-making is… brave.",
  "You're not unlucky. You're predictable.",
  "Your game sense took a day off.",
  "You don't need pressure. You collapse naturally.",
  "You're speedrunning disappointment.",
  "Rank blind?",
  "Loss streak enthusiast?",
  "Still queueing?",
  "This again?",
  "Win allergic?",
  "Hope or habit?",
  "Confidence > skill?",
  "Boosted in other games before?",
  "Try uninstalling.",
  "Main character syndrome?",
  "Queue responsibly.",
  "Still coping?",
  "Skill issue.",
  "Delusion level: ranked",
  "Some people grind rank. You grind excuses.",
  "If effort matched outcome, you'd still be here.",
  "You're not improving. You're rehearsing mistakes.",
  "Every loss is a lesson. You're repeating the course.",
  "Your opponent isn't special. You're just easier.",
  "Matchmaking tried. You insisted.",
  "You confuse persistence with progress.",
];

const TAUNT_QUOTES_WIN = [
  "That wasn't a win. That was a correction.",
  "You didn't play well. You played inevitable.",
  "Blink and you'd still miss it.",
  "Rank adjusted itself to you.",
  "That felt illegal.",
  "You made it look scripted.",
  "Effortless. Almost insulting.",
  "They queued. You ended them.",
  "Precision bordering on arrogance.",
  "You didn't win. You demonstrated.",
  "That wasn't close. It wasn't supposed to be.",
  "You made confidence look justified.",
  "Clean. Ruthless. Repetitive.",
  "That's what control looks like.",
  "You played like you already knew the outcome.",
  "No hesitation. No mercy. No debate.",
  "You reduced them to a statistic.",
  "That wasn't skill. That was authority.",
  "Dominance, quietly executed.",
  "You didn't outplay. You outclassed.",
  "That win will age badly for them.",
  "You moved like mistakes don't apply to you.",
  "That wasn't pressure. That was ownership.",
  "You made ranked look casual.",
  "You don't chase wins. Wins follow.",
];

const TAUNT_QUOTES_LOSS = [
  "That wasn't close. Let's not pretend.",
  "You lost before it started.",
  "Nothing worked. Including you.",
  "That was avoidable. Entirely.",
  "You didn't adapt. You repeated.",
  "Your plan collapsed on contact.",
  "You made it easy for them.",
  "That wasn't pressure. That was exposure.",
  "You played like the outcome didn't matter.",
  "Every move had consequences. You chose all of them.",
  "You weren't unlucky. You were expected.",
  "That wasn't a mistake. That's your pattern.",
  "You gave them confidence.",
  "You didn't lose fast enough.",
  "That was decided long ago.",
  "You kept going. That's the only credit.",
  "You weren't outplayed. You were understood.",
  "Your decisions aged poorly. Instantly.",
  "You made losing look structured.",
  "That wasn't resistance. That was delay.",
  "You brought effort. They brought results.",
  "You didn't fall short. You stayed there.",
  "That game explained your rank.",
  "You weren't competing. You were participating.",
  "You made it predictable.",
];

export const LOBBY_QUOTE_STORAGE_KEY = "penta_lobby_quote";

export const LOBBY_QUOTE_REFRESH_EVENT = "pp:lobby-quote-refresh";

export type LobbyQuoteResult = "win" | "loss" | null;

export function getLobbyQuote(result?: LobbyQuoteResult): string {
  const pool =
    result === "win" ? TAUNT_QUOTES_WIN : result === "loss" ? TAUNT_QUOTES_LOSS : TAUNT_QUOTES_NEUTRAL;
  return pool[Math.floor(Math.random() * pool.length)];
}

export type LobbyQuoteRefreshDetail = { text: string; result: LobbyQuoteResult };

/** Persist taunt for next Lobby visit and notify any mounted listeners. */
export function persistLobbyTauntQuote(result: LobbyQuoteResult): void {
  if (typeof window === "undefined") return;
  const text = getLobbyQuote(result);
  try {
    window.localStorage.setItem(LOBBY_QUOTE_STORAGE_KEY, text);
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(
    new CustomEvent<LobbyQuoteRefreshDetail>(LOBBY_QUOTE_REFRESH_EVENT, {
      detail: { text, result },
    })
  );
}
