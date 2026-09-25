import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const app = readFileSync("src/App.tsx", "utf8");
const server = readFileSync("server.ts", "utf8");
const desligadosScript = readFileSync("apps-script/Desligados-prod.gs", "utf8");

for (const token of [
  "const [statusRegistro, setStatusRegistro] = useState<'Devolução' | 'Desligamento'>('Devolução')",
  '<Label htmlFor="statusRegistro"',
  '<option value="Devolução">Devolução</option>',
  '<option value="Desligamento">Desligamento</option>',
  "const equipDevolvido = statusRegistro === 'Devolução' ? 'Devolvido' : 'Desligamento'",
  "equipDevolvido: equipDevolvido",
  "setStatusRegistro('Devolução')",
]) {
  assert.ok(app.includes(token), `missing App token: ${token}`);
}

const newRegisterIndex = app.indexOf('<CardTitle className="text-2xl font-bold text-white">Novo Registro</CardTitle>');
const statusIndex = app.indexOf('<Label htmlFor="statusRegistro"');
const basicInfoIndex = app.indexOf("{/* Basic Info */}");
const loginTitleIndex = app.indexOf('ACESSO <span className="text-cyan-400 italic">DESLIGADOS</span>');

assert.ok(newRegisterIndex >= 0, "Novo Registro title must exist");
assert.ok(statusIndex > newRegisterIndex, "status select must appear inside Novo Registro card, after the title");
assert.ok(statusIndex < basicInfoIndex, "status select must appear before Basic Info/Colaborador");
assert.ok(statusIndex > loginTitleIndex, "status select must not be rendered in the login card");

for (const token of [
  "function parsePostBody_(e)",
  "if (e.parameter && e.parameter.payload)",
  "return JSON.parse(e.parameter.payload)",
]) {
  assert.ok(desligadosScript.includes(token), `missing Apps Script token: ${token}`);
}

assert.ok(
  server.includes('equipDevolvido: z.enum(["Devolvido", "Desligamento"]).optional()'),
  "backend must restrict equipDevolvido to Devolvido or Desligamento"
);

assert.ok(
  desligadosScript.includes('if (normalizarTexto(novoStatusDev) === "devolvido" || normalizarTexto(novoStatusDev) === "desligamento")'),
  "Apps Script must treat Desligamento as a receivable registration status"
);

assert.ok(
  desligadosScript.includes("existing[idxEquipDev] = novoStatusDev;"),
  "Apps Script must write the received status value to Equip. Devolvido column"
);

assert.ok(
  !desligadosScript.includes('existing[idxEquipDev] = "Devolvido";'),
  "Apps Script must not hard-code Devolvido when status can be Desligamento"
);

console.log("new register return status verified");
