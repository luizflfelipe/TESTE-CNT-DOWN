import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("apps-script/Controle-Motoboy-homologacao.gs", "utf8");

for (const token of [
  "function setupMotoboySheet_()",
  "sheet.getRange(1, 1, 1, MOTOBOY_HEADERS.length).setValues([MOTOBOY_HEADERS])",
  "sheet.deleteColumns(MOTOBOY_HEADERS.length + 1, extraColumns)",
  "columns: MOTOBOY_HEADERS.length"
]) {
  assert.ok(source.includes(token), `missing token: ${token}`);
}

assert.ok(
  !source.includes("action === \"setupMotoboySheet\""),
  "setupMotoboySheet must remain an editor-only maintenance function",
);

console.log("motoboy setup sheet is not exposed through the Web App");
