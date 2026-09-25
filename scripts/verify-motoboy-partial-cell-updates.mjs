import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("apps-script/Controle-Motoboy-homologacao.gs", "utf8");

for (const token of [
  "function setMappedField_(sheet, rowNumber, field, value)",
  "setMappedField_(sheet, targetRow, field, data[field])",
  "setMappedField_(sheet, targetRow, \"atualizadoEm\", new Date())",
  "setMappedField_(sheet, targetRow, \"status\",",
  "setMappedField_(sheet, targetRow, \"justificativaExclusao\", data.justificativa)",
  "setMappedField_(sheet, targetRow, \"excluidoPor\", data.excluidoPor || \"\")",
  "setMappedField_(sheet, targetRow, \"excluidoEm\", now)"
]) {
  assert.ok(source.includes(token), `missing token: ${token}`);
}

assert.ok(
  !source.includes("setRowObject_(sheet, headers, targetRow, rowObject);"),
  "update/delete must not rewrite the full row"
);

console.log("motoboy partial cell updates verified");
