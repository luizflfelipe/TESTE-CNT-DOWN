const fs = require('fs');

let code = fs.readFileSync('src/types/motoboy.ts', 'utf8');

const target = `export interface MotoboyRequest {
  id: string;
  nomeSolicitante: string;
  dataSolicitacao: string;
  equipamento: string;
  funcionario: string;
  email: string;
  centroCusto: string;
  telefone: string;
  endereco: string;
  tipoServico: TipoServicoMotoboy;
  possuiRetorno: RetornoMotoboy;
  prioridade: PrioridadeMotoboy;
  maquinaRetirada?: string;
  enviado?: string;
  recebido?: string;
  dataEnvioRecebimento?: string;
  codigoRastreio?: string;
  observacoes?: string;
  status?: "Pendente" | "Pendente de recebimento" | "Em andamento" | "Concluído" | "Excluído";
  justificativaExclusao?: string;
  excluidoPor?: string;
  excluidoEm?: string;
}`;

const replacement = `export type MotoboyStatus = "Pendente" | "Pendente de recebimento" | "Em andamento" | "Concluído" | "Excluído";

export type MotoboyTab = "Pendentes" | "Concluídas" | "Excluídas";

export type MotoboyEventType = "created" | "updated" | "deleted" | string;

export interface MotoboyEvent {
  id: number | string;
  requestId: string;
  eventType: MotoboyEventType;
  actor: string;
  payload: any;
  createdAt: string;
}

export interface MotoboyRequest {
  id: string;
  nomeSolicitante: string;
  dataSolicitacao: string;
  equipamento: string;
  funcionario: string;
  email: string;
  centroCusto: string;
  telefone: string;
  endereco: string;
  tipoServico: TipoServicoMotoboy;
  possuiRetorno: RetornoMotoboy;
  prioridade: PrioridadeMotoboy;
  maquinaRetirada?: string;
  enviado?: string;
  recebido?: string;
  dataEnvioRecebimento?: string;
  codigoRastreio?: string;
  observacoes?: string;
  status?: MotoboyStatus;
  justificativaExclusao?: string;
  excluidoPor?: string;
  excluidoEm?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/types/motoboy.ts', code);
