/** Username rules aligned with web ``frontend/lib/profanity.ts``. */

const BAD_WORDS = [
  "fuck", "shit", "ass", "bitch", "cunt", "dick", "cock", "pussy", "bastard", "damn",
  "crap", "piss", "slut", "whore", "nigger", "nigga", "faggot", "fag", "retard",
  "rape", "kill", "sex", "porn", "nude", "naked", "boob", "penis", "vagina", "anal",
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  return BAD_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lower));
}

export function validateUsername(username: string): string | null {
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 16) return "Username must be at most 16 characters";
  if (/[^\w@]/.test(username) || /[!#$%^&*()+={}\[\]|\\:;"'<>,.?/~`-]/.test(username)) {
    return "Only letters, numbers, @ and _ are allowed";
  }
  if (/\p{Emoji}/u.test(username)) return "Emojis are not allowed in usernames";
  if (containsProfanity(username)) return "Username contains inappropriate content";
  return null;
}
