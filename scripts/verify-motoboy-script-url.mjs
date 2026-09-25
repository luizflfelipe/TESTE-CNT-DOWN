import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");

assert.ok(
  server.includes("function getMotoboyScriptUrl()"),
  "backend must resolve a dedicated Motoboy Apps Script URL"
);

assert.ok(
  server.includes("process.env.MOTOBOY_GOOGLE_SCRIPT_URL || process.env.GOOGLE_SCRIPT_URL"),
  "Motoboy URL must fall back to GOOGLE_SCRIPT_URL"
);

for (const routeToken of [
  "const scriptUrl = getMotoboyScriptUrl();",
  "fetchWithRetry(scriptUrl,",
  "fetchWithRetry(`${scriptUrl}?action=${query.action}&role=${query.role}`)"
]) {
  assert.ok(server.includes(routeToken), `missing Motoboy route token: ${routeToken}`);
}

assert.ok(
  envExample.includes("MOTOBOY_GOOGLE_SCRIPT_URL="),
  ".env.example must document MOTOBOY_GOOGLE_SCRIPT_URL"
);

console.log("motoboy script URL contract verified");
