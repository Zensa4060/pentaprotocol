/** Generate a 15-digit random numeric ID (chess.com-style game identifier). */
export function generateGameId(): string {
  const digits = new Array(15);
  digits[0] = String(Math.floor(Math.random() * 9) + 1);
  for (let i = 1; i < 15; i++) {
    digits[i] = String(Math.floor(Math.random() * 10));
  }
  return digits.join("");
}
