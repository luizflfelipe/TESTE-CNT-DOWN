import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const motoboy = readFileSync("src/components/Motoboy.tsx", "utf8");
const codeGs = readFileSync("apps-script/Code.gs", "utf8");

assert.ok(
  server.includes("filterValidMotoboyRequests"),
  "backend must filter Motoboy rows without ID"
);
assert.ok(
  motoboy.includes("request.id && request.status !== \"Excluído\""),
  "frontend must hide Motoboy rows without ID"
);
assert.ok(
  codeGs.includes("if (!request.id) return false;"),
  "Apps Script list must ignore rows without ID"
);

console.log("motoboy empty ID filtering verified");
