import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("src/components/Motoboy.tsx", "utf8");

assert.ok(
  source.includes('<SelectField label="Maquina Retirada"'),
  "Maquina Retirada must render as SelectField in Atualizar Pedido"
);

assert.ok(
  source.includes('options={["Não", "Sim"]}') || source.includes('options={["Sim", "Não"]}'),
  "Maquina Retirada select must offer Sim and Não"
);

assert.ok(
  !source.includes('<Field label="Maquina Retirada"'),
  "Maquina Retirada must no longer render as free text Field"
);

console.log("motoboy update machine select verified");
