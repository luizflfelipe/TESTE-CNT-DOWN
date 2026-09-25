import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("apps-script/Controle-Motoboy-homologacao.gs", "utf8");

for (const token of [
  "var MOTOBOY_COLUMN_MAP =",
  "id: 1",
  "nomeSolicitante: 2",
  "dataSolicitacao: 3",
  "equipamento: 4",
  "funcionario: 5",
  "email: 6",
  "centroCusto: 7",
  "telefone: 8",
  "endereco: 9",
  "tipoServico: 10",
  "prioridade: 11",
  "possuiRetorno: 12",
  "maquinaRetirada: 13",
  "enviado: 14",
  "recebido: 15",
  "dataEnvioRecebimento: 16",
  "codigoRastreio: 17",
  "observacoes: 18",
  "status: 19",
  "justificativaExclusao: 20",
  "excluidoPor: 21",
  "excluidoEm: 22",
  "criadoEm: 23",
  "atualizadoEm: 24",
  "function rowObjectToValues_",
  "function valuesToRowObject_",
  "MOTOBOY_FIELD_TO_HEADER[field]",
  "MOTOBOY_COLUMN_MAP[field]"
]) {
  assert.ok(source.includes(token), `missing token: ${token}`);
}

assert.ok(
  !source.includes("headers.map(function (header)"),
  "Motoboy writes must not depend on header order"
);

console.log("motoboy fixed column map verified");
