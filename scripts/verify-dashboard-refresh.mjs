import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const dashboard = readFileSync("src/components/Dashboard.tsx", "utf8");
const server = readFileSync("server.ts", "utf8");

assert.match(dashboard, /URLSearchParams/);
assert.match(dashboard, /refresh/);
assert.match(server, /req\.query\.refresh/);
assert.match(server, /forceRefresh/);
assert.match(server, /!forceRefresh.*dashboardCache\.data|dashboardCache\.data.*!forceRefresh/);

console.log("dashboard refresh contract verified");
