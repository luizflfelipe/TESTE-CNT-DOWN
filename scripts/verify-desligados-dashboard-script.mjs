import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("apps-script/Code.gs", "utf8");

for (const token of [
  "function getDashboardData_()",
  "SpreadsheetApp.openById(spreadsheetId)",
  "spreadsheet.getSheets()",
  "isDesligadosMonthSheet_",
  "isFilialPermitida_",
  "parseEquipments_",
  "recentReturns",
  "pendencias",
  "equipamentosMensal",
  "equipamentosRanking",
]) {
  assert.ok(source.includes(token), `missing dashboard token: ${token}`);
}

assert.ok(
  !source.includes("equipamentosMensal: mensalData"),
  "equipamentosMensal must count returned equipment quantities, not mirror desligamentos mensalData"
);

assert.ok(
  !source.includes("pendencias: []"),
  "pendencias must be calculated from pending equipment rows"
);

assert.ok(
  !source.includes("recentReturns: []"),
  "recentReturns must be calculated from returned equipment rows"
);

console.log("desligados dashboard script contract verified");
