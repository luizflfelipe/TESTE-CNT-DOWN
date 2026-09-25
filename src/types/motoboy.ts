export type MotoboyRole = "suporte" | "recepcao" | "none";

export type TipoServicoMotoboy = "ENTREGA" | "Retirada";
export type RetornoMotoboy = "Sim" | "Não";
export type PrioridadeMotoboy = "Baixa" | "Normal" | "Alta" | "Urgente";

export type MotoboyStatus = "Pendente" | "Pendente de recebimento" | "Em andamento" | "Concluído" | "Excluído";

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
  centroCusto?: string;
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
}

export type MotoboyCreatePayload = Pick<
  MotoboyRequest,
  | "nomeSolicitante"
  | "dataSolicitacao"
  | "equipamento"
  | "funcionario"
  | "email"
  | "centroCusto"
  | "telefone"
  | "endereco"
  | "tipoServico"
  | "possuiRetorno"
  | "prioridade"
>;

export type MotoboyUpdatePayload = Pick<
  MotoboyRequest,
  | "maquinaRetirada"
  | "enviado"
  | "recebido"
  | "dataEnvioRecebimento"
  | "codigoRastreio"
  | "observacoes"
>;
