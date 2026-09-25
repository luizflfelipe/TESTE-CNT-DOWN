import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const server = readFileSync("server.ts", "utf8");
const clientFiles = [
  "src/App.tsx",
  "src/components/Dashboard.tsx",
  "src/components/Motoboy.tsx",
].map((path) => readFileSync(path, "utf8"));

assert.doesNotMatch(server, /req\.headers\[['"]x-user-email['"]\]/);
assert.doesNotMatch(server, /headerEmail\.endsWith/);
assert.match(server, /if \(req\.session\?\.user\)/);
assert.doesNotMatch(server, /currentAuthUser|defaultAuthUser/);
assert.doesNotMatch(server, /default_session_secret|\.padEnd\(32/);
assert.match(server, /res\.status\(401\)\.json/);

for (const source of clientFiles) {
  assert.doesNotMatch(source, /x-user-email/i);
  assert.doesNotMatch(source, /dafiti_user/);
}

let trackedCodeFiles = [];
try {
  trackedCodeFiles = execFileSync("git", ["ls-files", "-z"])
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((path) => /\.(?:cjs|js|mjs|ts|tsx)$/.test(path))
    .filter((path) => !path.startsWith("scripts/verify-auth"));
} catch {
  function getFiles(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getFiles(full));
      } else if (/\.(?:cjs|js|mjs|ts|tsx)$/.test(entry.name)) {
        files.push(full);
      }
    }
    return files;
  }
  trackedCodeFiles = getFiles(".").filter((path) => !path.includes("scripts/verify-auth"));
}

for (const path of trackedCodeFiles) {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(source, /x-user-email/i, `${path} must not contain header-based identity`);
  assert.doesNotMatch(source, /dafiti_user/i, `${path} must not persist client-side identity`);
}

const app = clientFiles[0];
assert.match(app, /fetch\(['"]\/api\/auth\/status['"]/);
assert.doesNotMatch(app, /localStorage\.getItem\(['"]dafiti_user['"]\)/);
const logoutBlock = app.match(
  /const handleLogout = async \(\) => \{[\s\S]*?\n  \};/,
)?.[0];
assert.ok(logoutBlock, "App must define handleLogout");
assert.match(logoutBlock, /fetch\(['"]\/api\/auth\/logout['"]/);
assert.match(logoutBlock, /method:\s*['"]POST['"]/);
assert.match(logoutBlock, /credentials:\s*['"]same-origin['"]/);
assert.match(logoutBlock, /catch\s*\{/);
assert.match(logoutBlock, /finally\s*\{/);
assert.match(logoutBlock, /setUser\(null\)/);

const inactivityLogoutBlock = app.match(
  /const logoutDueToInactivity = \(\) => \{[\s\S]*?\n    \};/,
)?.[0];
assert.ok(inactivityLogoutBlock, "App must define inactivity logout");
assert.match(
  inactivityLogoutBlock,
  /handleLogout\(\)/,
  "inactivity timeout must reuse backend logout flow",
);

console.log("auth security contract verified");
