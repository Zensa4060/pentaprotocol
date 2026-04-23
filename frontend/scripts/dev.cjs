/**
 * Always `next dev --webpack` so static assets like bundled `.mp3` BGM resolve
 * the same as production (`next build --webpack`). Turbopack does not yet
 * treat `.mp3` as file assets without extra rules.
 *
 * Use `npm run dev:turbo` when you explicitly want Turbopack.
 *
 * Implementation note: we intentionally avoid `shell: true` here. Passing an
 * args array together with `shell: true` triggers Node's DEP0190 warning
 * because the array is concatenated into the shell command string without
 * escaping. Resolving the platform-appropriate `npx` binary directly lets
 * us skip the shell entirely and pass args safely as argv entries.
 */
const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const child = spawn(npx, ["next", "dev", "--webpack"], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
