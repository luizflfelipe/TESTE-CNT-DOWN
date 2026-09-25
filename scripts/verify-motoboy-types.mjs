import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("src/types/motoboy.ts", "utf8");

for (const token of [
  "export type MotoboyRole",
  "export interface MotoboyRequest",
  "export type MotoboyCreatePayload",
  "export type MotoboyUpdatePayload",
  "nomeSolicitante",
  "dataSolicitacao",
  "tipoServico",
  "possuiRetorno",
  "codigoRastreio",
  "justificativaExclusao",
  "excluidoPor",
  "excluidoEm"
]) {
  assert.ok(source.includes(token), `missing ${token}`);
}

console.log("motoboy frontend types verified");
