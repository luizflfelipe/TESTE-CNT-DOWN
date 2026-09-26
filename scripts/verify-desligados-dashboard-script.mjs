import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("apps-script/Desligados-prod.gs", "utf8");

for (const token of [
  "function getDashboardSummary()",
  "SpreadsheetApp.openById(requireScriptProperty_",
  "ss.getSheets()",
  "isFilialPermitida",
  "parseEquipments",
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
  source.includes("acc.pendenciasList.push(") &&
    source.includes("pendencias: acc.pendenciasList.reverse().slice(0, 15)"),
  "pendencias must be calculated from pending equipment rows"
);

assert.ok(
  source.includes("acc.recentReturnsList.push(") &&
    source.includes("recentReturns: acc.recentReturnsList.slice(0, 50)"),
  "recentReturns must be calculated from returned equipment rows"
);

console.log("desligados dashboard script contract verified");
