import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const path = "apps-script/Desligados-prod.gs";

assert.ok(existsSync(path), "Desligados production Apps Script file must exist");

const source = readFileSync(path, "utf8");

for (const token of [
  "var CFG = {",
  "function isFilialPermitida(filial)",
  "function buscarColaboradorGlobal(ss, nome)",
  "function registrarNaPlanilha(contents)",
  "function processarEmailsRecebidos()",
  "function enviarAlertasPrioridadeAlta()",
  "recentReturns",
  "equipamentosMensal",
]) {
  assert.ok(source.includes(token), `missing token: ${token}`);
}

console.log("desligados production script file verified");
