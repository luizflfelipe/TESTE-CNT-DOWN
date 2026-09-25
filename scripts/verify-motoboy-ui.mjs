import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("src/components/Motoboy.tsx", "utf8");

for (const token of [
  "export default function Motoboy",
  "onPendingCountChange",
  "POST",
  "/api/motoboy/requests",
  "PATCH",
  "Nome do Solicitante",
  "Data da Solicitação",
  "ENTREGA/Retirada",
  "Se possui Retorno",
  "Maquina Retirada",
  "Cod. Rastreio",
  "Solicitações Pendentes",
  "EQUIPMENT_OPTIONS",
  "Fone de Ouvido",
  "toggleEquipment",
  "Selecione ao menos um equipamento",
  "Data do Envio",
  "Data do Recebimento",
  "composeShipmentDates",
  "validateReceptionUpdate",
  "Informe a data do envio.",
  "SelectField label=\"Recebido\"",
  "options={[\"Não\", \"Sim\"]}",
  "handleDeleteRequest",
  "deleteTarget",
  "deleteJustification",
  "Justificativa da exclusão",
  "Informe a justificativa da exclusão.",
  "method: \"DELETE\"",
  "Excluir Solicitação",
  "Lista de Solicitações"
]) {
  assert.ok(source.includes(token), `missing ${token}`);
}

console.log("motoboy UI contract verified");
