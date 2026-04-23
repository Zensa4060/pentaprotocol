/**
 * Always `next dev --webpack` so static assets like bundled `.mp3` BGM resolve
 * the same as production (`next build --webpack`). Turbopack does not yet
 * treat `.mp3` as file assets without extra rules.
 *
 * Use `npm run dev:turbo` when you explicitly want Turbopack.
 *
 * Implementation note: we resolve Next's JS entry (`next/dist/bin/next`) via
 * require.resolve and execute it with the current Node binary directly. That
 * avoids two Windows gotchas at once:
 *
 *   1. Node 20+ rejects spawning `.cmd` / `.bat` shims (like `npx.cmd`)
 *      without `shell: true` — the CVE-2024-27980 hardening surfaces as
 *      `Error: spawn EINVAL`.
 *   2. Using `shell: true` together with an args array triggers the DEP0190
 *      deprecation warning because the array is concatenated into the
 *      shell command string without escaping.
 *
 * Going straight to the JS entry with `process.execPath` sidesteps both.
 */
const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

let nextBinJs;
try {
  nextBinJs = require.resolve("next/dist/bin/next", { paths: [root] });
} catch (err) {
  console.error(
    "[dev] Unable to locate the Next.js CLI. Did `npm install` complete?",
    err && err.message ? err.message : err,
  );
  process.exit(1);
}

const child = spawn(process.execPath, [nextBinJs, "dev", "--webpack"], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
