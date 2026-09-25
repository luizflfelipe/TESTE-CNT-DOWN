const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const imports = `import { createClient } from "@supabase/supabase-js";\n`;
code = code.replace('import { z } from "zod";', 'import { z } from "zod";\n' + imports);

const supabaseHelpers = `
// --- Supabase Motoboy Integration ---
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  supabaseClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return supabaseClient;
}

function toCamelCase(row: any) {
  if (!row) return row;
  return {
    id: row.id,
    nomeSolicitante: row.nome_solicitante,
    dataSolicitacao: row.data_solicitacao,
    equipamento: row.equipamento,
    funcionario: row.funcionario,
    email: row.email,
    centroCusto: row.centro_custo,
    telefone: row.telefone,
    endereco: row.endereco,
    tipoServico: row.tipo_servico,
    possuiRetorno: row.possui_retorno,
    prioridade: row.prioridade,
    maquinaRetirada: row.maquina_retirada,
    enviado: row.enviado,
    recebido: row.recebido,
    dataEnvioRecebimento: row.data_envio_recebimento,
    codigoRastreio: row.codigo_rastreio,
    observacoes: row.observacoes,
    status: row.status,
    justificativaExclusao: row.justificativa_exclusao,
    excluidoPor: row.excluido_por,
    excluidoEm: row.excluido_em,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function toSnakeCase(data: any) {
  if (!data) return data;
  const result: any = {};
  if (data.id !== undefined) result.id = data.id;
  if (data.nomeSolicitante !== undefined) result.nome_solicitante = data.nomeSolicitante;
  if (data.dataSolicitacao !== undefined) result.data_solicitacao = data.dataSolicitacao;
  if (data.equipamento !== undefined) result.equipamento = data.equipamento;
  if (data.funcionario !== undefined) result.funcionario = data.funcionario;
  if (data.email !== undefined) result.email = data.email;
  if (data.centroCusto !== undefined) result.centro_custo = data.centroCusto;
  if (data.telefone !== undefined) result.telefone = data.telefone;
  if (data.endereco !== undefined) result.endereco = data.endereco;
  if (data.tipoServico !== undefined) result.tipo_servico = data.tipoServico;
  if (data.possuiRetorno !== undefined) result.possui_retorno = data.possuiRetorno;
  if (data.prioridade !== undefined) result.prioridade = data.prioridade;
  if (data.maquinaRetirada !== undefined) result.maquina_retirada = data.maquinaRetirada;
  if (data.enviado !== undefined) result.enviado = data.enviado;
  if (data.recebido !== undefined) result.recebido = data.recebido;
  if (data.dataEnvioRecebimento !== undefined) result.data_envio_recebimento = data.dataEnvioRecebimento;
  if (data.codigoRastreio !== undefined) result.codigo_rastreio = data.codigoRastreio;
  if (data.observacoes !== undefined) result.observacoes = data.observacoes;
  if (data.status !== undefined) result.status = data.status;
  if (data.justificativaExclusao !== undefined) result.justificativa_exclusao = data.justificativaExclusao;
  if (data.excluidoPor !== undefined) result.excluido_por = data.excluidoPor;
  if (data.excluidoEm !== undefined) result.excluido_em = data.excluidoEm;
  return result;
}

function calculateMotoboyStatus(data: any) {
  if (data.recebido === "Sim") return "Concluído";
  if (data.enviado === "Sim" && data.recebido === "Não") return "Pendente de recebimento";
  if (data.enviado === "Sim" || data.maquinaRetirada || data.codigoRastreio) return "Em andamento";
  return data.status || "Pendente";
}

async function logMotoboyEvent(requestId: string, eventType: string, actor: string, payload: any) {
  const supabase = getSupabaseClient();
  await supabase.from("motoboy_request_events").insert({
    request_id: requestId,
    event_type: eventType,
    actor: actor,
    payload: payload,
  });
}
// ------------------------------------

async function startServer() {`;

code = code.replace('async function startServer() {', supabaseHelpers);

fs.writeFileSync('server.ts', code);
