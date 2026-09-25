import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("src/components/Motoboy.tsx", "utf8");

for (const token of [
  "const selectedRequest = requests.find((request) => request.id === selectedRequestId)",
  "function RequesterInfoPanel",
  "Dados do Solicitante",
  "Telefone/Celular",
  "selectedRequest.telefone",
  "selectedRequest.endereco",
]) {
  assert.ok(source.includes(token), `missing ${token}`);
}

console.log("motoboy reception requester info verified");
