import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const desligados = readFileSync("apps-script/Desligados-prod.gs", "utf8");
const motoboy = readFileSync("apps-script/Controle-Motoboy-homologacao.gs", "utf8");

for (const token of [
  "function doGet(e)",
  "function doPost(e)",
  "getDashboardData",
  "DESLIGADOS_SPREADSHEET_ID",
  "verifyWebRequestAuth_",
  "sanitizeSpreadsheetText_",
]) {
  assert.ok(desligados.includes(token), `missing Desligados token: ${token}`);
}

for (const token of [
  "function doGet(e)",
  "function doPost(e)",
  "createMotoboyRequest",
  "listMotoboyRequests",
  "updateMotoboyRequest",
  "deleteMotoboyRequest",
  "MOTOBOY_SPREADSHEET_ID",
  "MOTOBOY_HEADERS",
  "verifyWebRequestAuth_",
  "sanitizeSpreadsheetValue_",
  "function createMotoboyRequest_",
  "function listMotoboyRequests_",
  "function updateMotoboyRequest_",
  "function deleteMotoboyRequest_",
  "Justificativa da Exclusão",
  "Excluído por",
  "Excluído em",
  "Excluído"
]) {
  assert.ok(motoboy.includes(token), `missing Motoboy token: ${token}`);
}

assert.ok(!desligados.includes("fetchExternal"), "Desligados must not expose fetchExternal");
assert.ok(
  desligados.includes("sanitizeSpreadsheetText_(novoStatusMaju)"),
  "controleMaju must be neutralized before reaching Google Sheets",
);

console.log("apps script contract verified");
