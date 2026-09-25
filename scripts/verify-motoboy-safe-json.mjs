import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const motoboy = readFileSync("src/components/Motoboy.tsx", "utf8");

assert.ok(
  motoboy.includes("async function readJsonResponse"),
  "Motoboy must parse responses with readJsonResponse"
);

assert.ok(
  !motoboy.includes("await response.json()"),
  "Motoboy must not call response.json() directly"
);

for (const token of [
  "return {}",
  "Unexpected end of JSON input",
  "Erro ao excluir solicitação.",
  "Erro ao carregar solicitações de Motoboy."
]) {
  assert.ok(motoboy.includes(token), `missing ${token}`);
}

console.log("motoboy safe JSON parsing verified");
