import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const app = readFileSync("src/App.tsx", "utf8");
const dashboard = readFileSync("src/components/Dashboard.tsx", "utf8");
const motoboy = readFileSync("src/components/Motoboy.tsx", "utf8");
const server = readFileSync("server.ts", "utf8");

assert.ok(app.includes("/api/auth/status"), "frontend must restore identity from backend session");
assert.ok(!app.includes("x-user-email"), "frontend must not assert identity through a header");

assert.ok(
  dashboard.includes("const isFetchingRef = useRef(false)") &&
  dashboard.includes("if (isFetchingRef.current) return;"),
  "dashboard fetch must avoid overlapping authenticated requests"
);

assert.ok(
  motoboy.includes("const isFetchingRef = useRef(false)") &&
  motoboy.includes("if (isFetchingRef.current) return;"),
  "motoboy fetch must avoid overlapping authenticated requests"
);

assert.ok(
  server.includes("const AUTH_DEBUG = process.env.AUTH_DEBUG === \"true\"") &&
  server.includes("if (AUTH_DEBUG) {\n      const proto = req.headers['x-forwarded-proto'];\n      console.log(`[AUTH] Rota:"),
  "auth middleware must not log every successful validation by default"
);

console.log("auth responsive fetching verified");
