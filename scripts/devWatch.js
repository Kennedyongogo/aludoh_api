// Development runner: restarts the API only when a watched file's contents change.
// Editors and tools that re-save files without changing them (same bytes, new timestamp)
// no longer cause restarts. Settings are read from nodemon.json (watch, ext, delay, env).
// Type "rs" + Enter to restart by hand.

const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ENTRY = path.join(ROOT, "src", "server.js");

const readConfig = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "nodemon.json"), "utf8"));
  } catch {
    return {};
  }
};

const config = readConfig();
const WATCH_DIRS = (config.watch || ["src"]).map((dir) => path.resolve(ROOT, dir));
const EXTENSIONS = new Set(String(config.ext || "js,json").split(",").map((e) => `.${e.trim()}`));
const DELAY = Number(config.delay) || 1000;
const IGNORED_SEGMENTS = ["node_modules", ".git", "uploads"];

const log = (message) => console.log(`\x1b[36m[watch]\x1b[0m ${message}`);

const isWatched = (file) =>
  EXTENSIONS.has(path.extname(file)) &&
  !file.split(path.sep).some((segment) => IGNORED_SEGMENTS.includes(segment));

const hashFile = (file) => {
  try {
    return crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
  } catch {
    return null; // deleted or unreadable
  }
};

const hashes = new Map();
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_SEGMENTS.includes(entry.name)) walk(full);
    } else if (isWatched(full)) {
      hashes.set(full, hashFile(full));
    }
  }
};
WATCH_DIRS.forEach((dir) => fs.existsSync(dir) && walk(dir));

let child = null;
let restarting = false;

const start = () => {
  log(`starting node ${path.relative(ROOT, ENTRY)}`);
  child = spawn(process.execPath, [ENTRY], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...(config.env || {}) },
  });
  child.on("exit", (code, signal) => {
    child = null;
    if (restarting) return;
    if (code !== 0 && code !== null) log(`app crashed (exit code ${code}) - waiting for file changes`);
    else if (signal) log(`app stopped (${signal}) - waiting for file changes`);
    else log("app exited - waiting for file changes");
  });
};

const restart = (reason) => {
  log(`restarting: ${reason}`);
  if (!child) {
    start();
    return;
  }
  restarting = true;
  const old = child;
  const force = setTimeout(() => old.kill("SIGKILL"), 5000);
  old.once("exit", () => {
    clearTimeout(force);
    restarting = false;
    start();
  });
  old.kill("SIGTERM");
};

const pending = new Set();
let timer = null;

const flush = () => {
  timer = null;
  const changed = [];
  for (const file of pending) {
    const next = hashFile(file);
    const previous = hashes.has(file) ? hashes.get(file) : undefined;
    if (next === previous) continue;
    if (next === null) hashes.delete(file);
    else hashes.set(file, next);
    changed.push(path.relative(ROOT, file));
  }
  pending.clear();
  if (changed.length) {
    const shown = changed.slice(0, 5).join(", ");
    restart(changed.length > 5 ? `${shown} and ${changed.length - 5} more` : shown);
  }
};

WATCH_DIRS.forEach((dir) => {
  if (!fs.existsSync(dir)) return;
  fs.watch(dir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const full = path.join(dir, filename.toString());
    if (!isWatched(full)) return;
    pending.add(full);
    clearTimeout(timer);
    timer = setTimeout(flush, DELAY);
  });
});

process.stdin.on("data", (data) => {
  if (data.toString().trim() === "rs") restart("manual restart");
});

const shutdown = () => {
  if (!child) process.exit(0);
  child.once("exit", () => process.exit(0));
  child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 5000);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

log(`watching ${WATCH_DIRS.map((d) => path.relative(ROOT, d)).join(", ")} (${[...EXTENSIONS].join(", ")}) - restarts only on real content changes`);
start();
