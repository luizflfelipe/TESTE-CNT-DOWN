import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("src/components/Motoboy.tsx", "utf8");

for (const token of [
  "function parseShipmentDates",
  "match(/Envio: ([^|]+)/)",
  "match(/Recebimento: ([^|]+)/)",
  "function buildUpdateForm",
  "selectedRequestForUpdate",
  "setUpdateForm(buildUpdateForm(selectedRequestForUpdate))",
  "setShippingDates(parseShipmentDates(selectedRequestForUpdate.dataEnvioRecebimento || \"\"))",
  "setUpdateForm(buildUpdateForm(result.request))",
  "setShippingDates(parseShipmentDates(result.request.dataEnvioRecebimento || \"\"))",
  "setRequests((currentRequests) => currentRequests.map((request) => (",
]) {
  assert.ok(source.includes(token), `missing ${token}`);
}

assert.ok(
  !source.includes("setSelectedRequestId(\"\");\n      setMessage({ type: \"success\", text: \"Solicitação atualizada com sucesso.\" });"),
  "update flow must not clear selected request after saving a pending receipt update"
);

console.log("motoboy reception form hydration verified");
