/**
 * Windows: `next dev --webpack` — avoids Turbopack's persistent dev cache
 * (.sst / compaction errors with Defender / OneDrive / dual dev servers).
 * Other platforms: default `next dev` (Turbopack).
 *
 * Use `npm run dev:turbo` to force Turbopack on Windows when needed.
 */
const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const args = ["next", "dev", ...(isWin ? ["--webpack"] : [])];

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
