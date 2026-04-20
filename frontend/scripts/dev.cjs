/**
 * Always `next dev --webpack` so static assets like bundled `.mp3` BGM resolve
 * the same as production (`next build --webpack`). Turbopack does not yet
 * treat `.mp3` as file assets without extra rules.
 *
 * Use `npm run dev:turbo` when you explicitly want Turbopack.
 */
const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const args = ["next", "dev", "--webpack"];

const child = spawn("npx", args, {
  cwd: root,
  stdio: "inherit",
  shell: true,
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
