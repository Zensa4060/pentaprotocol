// ── Profanity filter ──────────────────────────────────────────────────────────
// Basic list — extend as needed
const BAD_WORDS = [
  "fuck","shit","ass","bitch","cunt","dick","cock","pussy","bastard","damn",
  "crap","piss","slut","whore","nigger","nigga","faggot","fag","retard",
  "rape","kill","sex","porn","nude","naked","boob","penis","vagina","anal",
];

// Returns true if text contains profanity
export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  return BAD_WORDS.some(w => {
    const re = new RegExp(`\\b${w}\\b`, "i");
    return re.test(lower);
  });
}

// Censors bad words with asterisks: "fuck you" → "**** you"
export function censorText(text: string): string {
  let result = text;
  BAD_WORDS.forEach(w => {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    result = result.replace(re, "*".repeat(w.length));
  });
  return result;
}

// Validates username: 3–16 chars, only letters/numbers/@/_  no emoji no profanity
export function validateUsername(username: string): string | null {
  if (username.length < 3)  return "Username must be at least 3 characters";
  if (username.length > 16) return "Username must be at most 16 characters";
  if (/[^\w@]/.test(username) || /[!#$%^&*()+={}\[\]|\\:;"'<>,.?/~`-]/.test(username))
    return "Only letters, numbers, @ and _ are allowed";
  // Block emojis
  if (/\p{Emoji}/u.test(username)) return "Emojis are not allowed in usernames";
  if (containsProfanity(username)) return "Username contains inappropriate content";
  return null;
}