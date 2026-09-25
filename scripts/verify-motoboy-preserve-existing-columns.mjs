import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("apps-script/Controle-Motoboy-homologacao.gs", "utf8");

assert.ok(
  source.includes("function assertRequiredHeaders_(headers, requiredHeaders)"),
  "Motoboy script must validate required headers instead of creating new columns"
);

assert.ok(
  source.includes("throw new Error(\"Cabeçalho obrigatório ausente na planilha Motoboy: \" + missing.join(\", \"))"),
  "Motoboy script must fail clearly when required headers are missing"
);

assert.ok(
  !source.includes("headers.push(header)"),
  "Motoboy script must not append headers to existing sheets"
);

assert.ok(
  !source.includes("sheet.getRange(1, headers.length).setValue(header)"),
  "Motoboy script must not create new header columns on existing sheets"
);

console.log("motoboy existing columns preservation verified");
