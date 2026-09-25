import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const codeGs = readFileSync("apps-script/Code.gs", "utf8");
const types = readFileSync("src/types/motoboy.ts", "utf8");
const ui = readFileSync("src/components/Motoboy.tsx", "utf8");

assert.ok(
  types.includes('"Pendente de recebimento"'),
  "frontend status type must include Pendente de recebimento"
);

assert.ok(
  codeGs.includes('rowObject["Status"] = "Pendente de recebimento";'),
  "Apps Script must set Pendente de recebimento"
);

assert.ok(
  codeGs.includes('data.enviado === "Sim"') && codeGs.includes('data.recebido === "Não"'),
  "Apps Script must detect sent but not received case explicitly"
);

assert.ok(
  !ui.includes('if (form.recebido === "Sim" && !shippingDates.dataRecebimento)'),
  "Recepcao must be allowed to save received status without receiving date"
);

assert.ok(
  ui.includes('const enviado = form.enviado || "Não";'),
  "empty sent select value must default to Não during validation"
);

assert.ok(
  ui.includes('enviado: updateForm.enviado || "Não"') && ui.includes('recebido: updateForm.recebido || "Não"'),
  "update payload must send default Não values"
);

console.log("motoboy pending receipt status verified");
