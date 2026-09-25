import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const path = "apps-script/Controle-Motoboy-homologacao.gs";

assert.ok(existsSync(path), "standalone Motoboy Apps Script file must exist");

const source = readFileSync(path, "utf8");

for (const token of [
  "var MOTOBOY_CFG =",
  "function doGet(e)",
  "function doPost(e)",
  "function createMotoboyRequest_(data)",
  "function listMotoboyRequests_(role)",
  "function updateMotoboyRequest_(id, data)",
  "function deleteMotoboyRequest_(id, data)",
  "function parsePostBody_(e)",
  "if (e.parameter && e.parameter.payload)",
  "return JSON.parse(e.parameter.payload)",
  "ID técnico da solicitação Motoboy é obrigatório.",
  "Justificativa da Exclusão",
  "Excluído por",
  "Excluído em"
]) {
  assert.ok(source.includes(token), `missing token: ${token}`);
}

assert.ok(!source.includes("DESLIGAMENTOS_SPREADSHEET_ID"), "Motoboy standalone script must not depend on Desligados spreadsheet");
assert.ok(!source.includes("registerDesligamento_"), "Motoboy standalone script must not register Desligados rows");

console.log("standalone motoboy apps script contract verified");
