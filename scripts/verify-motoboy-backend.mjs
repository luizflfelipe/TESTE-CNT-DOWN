import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const envExample = readFileSync(".env.example", "utf8");

assert.match(server, /const motoboyCreateSchema = z\.object\(/, "motoboyCreateSchema must exist");
assert.match(server, /const motoboyUpdateSchema = z\.object\(/, "motoboyUpdateSchema must exist");
assert.match(server, /const motoboyDeleteSchema = z\.object\(/, "motoboyDeleteSchema must exist");
assert.match(server, /function getMotoboyRole\(userEmail: string\)/, "getMotoboyRole helper must exist");
assert.match(server, /function generateMotoboyId\(date = new Date\(\)\)/, "generateMotoboyId helper must exist");
assert.match(server, /app\.post\("\/api\/motoboy\/requests", requireAuth, async \(req, res\) => \{/, "create route must exist");
assert.match(server, /app\.get\("\/api\/motoboy\/requests", requireAuth, async \(req, res\) => \{/, "list route must exist");
assert.match(server, /app\.patch\("\/api\/motoboy\/requests\/:id", requireAuth, async \(req, res\) => \{/, "update route must exist");
assert.match(server, /app\.delete\("\/api\/motoboy\/requests\/:id", requireAuth, async \(req, res\) => \{/, "delete route must exist");
assert.match(server, /action: "createMotoboyRequest"/, "create route must forward createMotoboyRequest action");
assert.match(server, /action: "listMotoboyRequests"/, "list route must call listMotoboyRequests action");
assert.match(server, /action: "updateMotoboyRequest"/, "update route must forward updateMotoboyRequest action");
assert.match(server, /action: "deleteMotoboyRequest"/, "delete route must forward deleteMotoboyRequest action");
assert.match(server, /Justificativa da exclusão é obrigatória/, "delete route must require a deletion justification");
assert.match(server, /Apps Script de Motoboy desatualizado/, "delete route must detect an outdated Apps Script deployment");
assert.match(envExample, /Motoboy actions/, ".env.example must document Motoboy Apps Script actions");

console.log("motoboy backend contract verified");
