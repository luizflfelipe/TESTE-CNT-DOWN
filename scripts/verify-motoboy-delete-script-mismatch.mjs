import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");

for (const token of [
  "result.action === \"registerDesligamento\"",
  "Apps Script publicado não recebeu a ação deleteMotoboyRequest.",
  "Atualize Code.gs, crie Nova versão da implantação e reinicie o backend.",
]) {
  assert.ok(server.includes(token), `missing ${token}`);
}

console.log("motoboy delete script mismatch verified");
