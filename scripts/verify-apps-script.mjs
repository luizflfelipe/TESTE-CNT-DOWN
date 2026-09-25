import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("apps-script/Code.gs", "utf8");

for (const token of [
  "function doGet(e)",
  "function doPost(e)",
  "createMotoboyRequest",
  "listMotoboyRequests",
  "updateMotoboyRequest",
  "deleteMotoboyRequest",
  "getDashboardData",
  "fetchExternal",
  "DESLIGAMENTOS_SPREADSHEET_ID",
  "MOTOBOY_SPREADSHEET_ID",
  "MOTOBOY_HEADERS",
  "function createMotoboyRequest_",
  "function listMotoboyRequests_",
  "function updateMotoboyRequest_",
  "function deleteMotoboyRequest_",
  "Justificativa da Exclusão",
  "Excluído por",
  "Excluído em",
  "Excluído"
]) {
  assert.ok(source.includes(token), `missing ${token}`);
}

console.log("apps script contract verified");
