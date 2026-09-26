import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import cookieSession from "cookie-session";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { normalizeDashboardSummary } from "./src/utils/dashboardData";
import {
  getSessionCookieOptions,
  requireSessionSecret,
} from "./src/server/sessionSecurity";
import { createDashboardRefresh } from "./src/server/dashboardRefresh";
import { FILIAIS, isValidMonthString, resolveActiveBranchData } from "./src/utils/dashboardBranchResolver";
import { buildDashboardPdfDocument, sanitizeFileName } from "./src/utils/dashboardPdfExport";
import crypto from "crypto";

dotenv.config();

// Definição estrita do formato esperado para registrar desligamentos
const registerSchema = z.object({
  colaborador: z.string().min(1, "O nome do colaborador é obrigatório").max(200, "Nome muito longo"),
  desligamento: z.string().max(100).optional(),
  filial: z.enum(["Barra Funda", "Extrema", "Belo Horizonte"]).default("Barra Funda"),
  equipamentoQuantidade: z.string().max(1000).optional(),
  equipDevolvido: z.enum(["Devolvido", "Desligamento"]).optional(),
  controleMaju: z.string().max(100).optional()
}).strip(); // O '.strip()' remove automaticamente quaisquer campos maliciosos/não-mapeados que venham na requisição

const motoboyCreateSchema = z.object({
  nomeSolicitante: z.string().min(1, "O nome do solicitante é obrigatório").max(200, "Nome do solicitante muito longo"),
  dataSolicitacao: z.string().min(1, "A data da solicitação é obrigatória").max(30, "Data da solicitação inválida"),
  equipamento: z.string().min(1, "O equipamento é obrigatório").max(200, "Equipamento muito longo"),
  funcionario: z.string().min(1, "O funcionário é obrigatório").max(200, "Funcionário muito longo"),
  email: z.string().email("E-mail inválido").max(200, "E-mail muito longo"),
  centroCusto: z.string().max(100, "Centro de custo muito longo").optional().default(""),
  telefone: z.string().min(1, "O telefone é obrigatório").max(50, "Telefone muito longo"),
  endereco: z.string().min(1, "O endereço é obrigatório").max(500, "Endereço muito longo"),
  tipoServico: z.enum(["ENTREGA", "Retirada"], { message: "Tipo de serviço inválido" }),
  possuiRetorno: z.enum(["Sim", "Não"], { message: "Informe se possui retorno" }),
  prioridade: z.enum(["Baixa", "Normal", "Alta", "Urgente"], { message: "Prioridade inválida" })
}).strip();

const motoboyUpdateSchema = z.object({
  maquinaRetirada: z.string().max(100).optional(),
  enviado: z.string().max(100).optional(),
  recebido: z.string().max(100).optional(),
  dataEnvioRecebimento: z.string().max(120, "Datas de envio/recebimento muito longas").optional(),
  codigoRastreio: z.string().max(120).optional(),
  observacoes: z.string().max(1000).optional()
}).strip();

const motoboyDeleteSchema = z.object({
  justificativa: z.string().trim().min(1, "Justificativa da exclusão é obrigatória").max(1000, "Justificativa da exclusão muito longa")
}).strip();

// --- ESTÁGIO 2: Resiliência e Performance ---

// Cache do Dashboard desativado para consulta direta ao Google Sheets
const dashboardCache = {
  data: null as any,
  lastFetch: 0
};

function savePersistedDashboardCache(_data: any) {
  // Sem persistência em disco - consulta direta
}

function normalizeBranchKey(filial?: string): 'Barra Funda' | 'Extrema' | 'Belo Horizonte' | null {
  if (!filial) return null;
  const norm = String(filial)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (norm.includes("barra") || norm === "bf" || norm === "sp" || norm.includes("sao paulo")) {
    return "Barra Funda";
  }
  if (norm.includes("extrema") || norm.includes("cd extrema") || norm.includes("mg - extrema") || norm.includes("cd")) {
    return "Extrema";
  }
  if (norm.includes("belo") || norm.includes("horizonte") || norm === "bh" || norm.includes("mg - bh")) {
    return "Belo Horizonte";
  }
  return null;
}

function ensureDashboardFiliais(data: any) {
  if (!data || typeof data !== "object") return data;

  const rawFiliais = data.filiais;

  const pendencias: any[] = Array.isArray(data.pendencias) ? data.pendencias : [];
  const recentReturns: any[] = Array.isArray(data.recentReturns) ? data.recentReturns : [];

  const branchPendencias: Record<string, any[]> = {
    "Barra Funda": [],
    "Extrema": [],
    "Belo Horizonte": []
  };

  pendencias.forEach((p) => {
    const b = normalizeBranchKey(p.filial) || "Barra Funda";
    if (branchPendencias[b]) {
      branchPendencias[b].push({ ...p, filial: b });
    }
  });

  const branchReturns: Record<string, any[]> = {
    "Barra Funda": [],
    "Extrema": [],
    "Belo Horizonte": []
  };

  recentReturns.forEach((r) => {
    const b = normalizeBranchKey(r.filial) || "Barra Funda";
    if (branchReturns[b]) {
      branchReturns[b].push({ ...r, filial: b });
    }
  });

  const totalAll = Number(data.totalDesligamentos) || 0;
  const totalMesAll = Number(data.desligamentosMesAtual) || 0;
  const mensalDataAll: any[] = Array.isArray(data.mensalData) ? data.mensalData : [];
  const equipMensalAll: any[] = Array.isArray(data.equipamentosMensal) ? data.equipamentosMensal : [];
  const equipRankingAll: any[] = Array.isArray(data.equipamentosRanking) 
    ? data.equipamentosRanking.filter((e: any) => Number(e.count) > 0) 
    : [];

  const filiais: Record<string, any> = {
    "Todas": {
      porMes: rawFiliais?.Todas?.porMes,
      totalDesligamentos: totalAll,
      desligamentosMesAtual: totalMesAll,
      mensalData: mensalDataAll,
      equipamentosMensal: equipMensalAll,
      equipamentosRanking: equipRankingAll,
      pendencias: pendencias,
      recentReturns: recentReturns
    }
  };

  const branchKeys: ('Barra Funda' | 'Extrema' | 'Belo Horizonte')[] = ["Barra Funda", "Extrema", "Belo Horizonte"];

  branchKeys.forEach((k) => {
    if (rawFiliais && rawFiliais[k] && typeof rawFiliais[k] === "object") {
      filiais[k] = {
        porMes: rawFiliais[k].porMes,
        totalDesligamentos: Number(rawFiliais[k].totalDesligamentos) || 0,
        desligamentosMesAtual: Number(rawFiliais[k].desligamentosMesAtual) || 0,
        mensalData: Array.isArray(rawFiliais[k].mensalData) ? rawFiliais[k].mensalData : [],
        equipamentosMensal: Array.isArray(rawFiliais[k].equipamentosMensal) ? rawFiliais[k].equipamentosMensal : [],
        equipamentosRanking: Array.isArray(rawFiliais[k].equipamentosRanking) 
          ? rawFiliais[k].equipamentosRanking.filter((e: any) => Number(e.count) > 0)
          : [],
        pendencias: Array.isArray(rawFiliais[k].pendencias) ? rawFiliais[k].pendencias : branchPendencias[k],
        recentReturns: Array.isArray(rawFiliais[k].recentReturns) ? rawFiliais[k].recentReturns : branchReturns[k]
      };
      return;
    }

    // Sem regra de distribuição parcial ou estimativa proporcional:
    // Apenas dados estritos e reais são repassados
    filiais[k] = {
      porMes: undefined,
      totalDesligamentos: 0,
      desligamentosMesAtual: 0,
      mensalData: mensalDataAll.map((m) => ({ month: m.month, count: 0 })),
      equipamentosMensal: equipMensalAll.map((m) => ({ month: m.month, count: 0 })),
      equipamentosRanking: [],
      pendencias: branchPendencias[k],
      recentReturns: branchReturns[k]
    };
  });

  return {
    ...data,
    available: data.available !== false,
    filiais: filiais,
    totalDesligamentos: filiais["Todas"].totalDesligamentos,
    desligamentosMesAtual: filiais["Todas"].desligamentosMesAtual,
    mensalData: filiais["Todas"].mensalData,
    equipamentosMensal: filiais["Todas"].equipamentosMensal,
    equipamentosRanking: filiais["Todas"].equipamentosRanking,
    pendencias: filiais["Todas"].pendencias,
    recentReturns: filiais["Todas"].recentReturns
  };
}

// Cache específico para Motoboy
interface MotoboyCacheData {
  requests: any[];
  timestamp: number;
}
let motoboyCache: Record<string, MotoboyCacheData> = {};
const MOTOBOY_CACHE_TTL = 60 * 1000; // 60 segundos

function clearMotoboyCache() {
  console.log("[Motoboy Cache] Invalidating cache for all roles");
  motoboyCache = {};
}

const AUTH_DEBUG = process.env.AUTH_DEBUG === "true";

type MotoboyRole = "suporte" | "recepcao" | "none";

function isManualDashboardRefresh(req: express.Request): boolean {
  return req.query.refresh === "1" || req.query.refresh === "true";
}

function getMotoboyRole(userEmail: string): MotoboyRole {
  const normalizedEmail = userEmail.toLowerCase();
  if (normalizedEmail === "suporte.dafiti@dafiti.com.br") return "suporte";
  if (normalizedEmail === "recepcao@dafiti.com.br") return "recepcao";
  if (normalizedEmail === "maria.sousa@dafiti.com.br") return "recepcao";
  return "none";
}

function generateMotoboyId(date = new Date()) {
  const timestamp = date.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MOTO-${timestamp}-${random}`;
}

function filterValidMotoboyRequests(requests: any[]) {
  return requests.filter((request) => typeof request?.id === "string" && request.id.trim());
}

// Detector de páginas de erro HTML retornadas pelo Google Apps Script / Google Drive
function isHtmlResponse(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  
  // Detecção precoce de HTML antes do JSON.parse
  if (
    trimmed.startsWith("<") || 
    lower.startsWith("<!doctype") || 
    lower.startsWith("<html") ||
    lower.startsWith("<script") ||
    lower.startsWith("<?xml")
  ) {
    return true;
  }
  
  return (
    lower.includes("<title>page not found</title>") ||
    lower.includes("sorry, unable to open the file at this time") ||
    lower.includes("accounts.google.com") ||
    lower.includes("<html") ||
    lower.includes("service login") ||
    lower.includes("google drive - error")
  );
}

// 2. Fetch Helper com Auto-Retry inteligente e Timeout via AbortController
async function fetchGoogleScriptJson<T = any>(
  request: string | (() => { url: string; options?: RequestInit }),
  options: RequestInit & { timeoutMs?: number; maxRetries?: number } = {},
  defaultMaxRetries = 3,
  defaultTimeoutMs = 30000
): Promise<any> {
  const { timeoutMs: customTimeout, maxRetries: customRetries, ...fetchOptions } = options;
  const maxRetries = customRetries ?? defaultMaxRetries;
  const timeoutMs = customTimeout ?? defaultTimeoutMs;
  let lastError: Error | null = null;
  let lastText = "";

  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error(`Timeout de ${timeoutMs}ms excedido na requisição ao Google Apps Script.`));
    }, timeoutMs);

    try {
      const resolvedRequest = typeof request === "function"
        ? request()
        : { url: request, options: fetchOptions };
      const response = await fetch(resolvedRequest.url, {
        redirect: "follow",
        ...resolvedRequest.options,
        signal: controller.signal,
      });

      // Qualquer status HTTP não-ok (404 temporário de redirect, 429 rate limit, 5xx instabilidade)
      if (!response.ok) {
        throw new Error(`Google API retornou status HTTP ${response.status}`);
      }

      const text = await response.text();
      lastText = text;

      // Se a resposta for HTML (ex.: página de sobrecarga/redirecionamento do Google Drive)
      if (isHtmlResponse(text)) {
        throw new Error("Google Drive/Apps Script retornou página HTML temporária de instabilidade.");
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (parseErr: any) {
        // Se falhou o parse e o texto parece HTML mesmo sem ter sido detectado antes
        if (text.includes("<") || parseErr.message.includes("Unexpected token '<'")) {
          throw new Error("Google Drive/Apps Script retornou página HTML em vez de JSON.");
        }
        throw new Error(`Resposta não é JSON válido: ${parseErr.message}`);
      }

      return parsed;
    } catch (err: any) {
      const isTimeout = controller.signal.aborted || err?.name === "AbortError" || err?.message?.includes("Timeout");
      const normalizedError = isTimeout
        ? new Error(`Timeout de ${timeoutMs}ms excedido na comunicação com o Google Apps Script.`)
        : err;
      lastError = normalizedError;
      if (i === maxRetries - 1) {
        break;
      }
      const delay = Math.round(1000 * Math.pow(1.5, i));
      console.warn(`[GoogleScript Retry] Tentativa ${i + 1}/${maxRetries} falhou: ${normalizedError.message}. Retentando em ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
    } finally {
      clearTimeout(timer);
    }
  }

  console.warn(`[GoogleScript Warning] Falha final ao comunicar com Google Script após retries. Motivo: ${lastError?.message || "resposta inválida"}`);

  const is404 = lastError?.message?.includes("404") ||
                lastText?.includes("Page Not Found") ||
                lastText?.includes("Sorry, unable to open the file at this time");

  if (is404) {
    throw new Error("A URL do Google Apps Script (GOOGLE_SCRIPT_URL) retornou Erro 404 no Google Drive. Verifique se a implantação está ativa e configurada com acesso para 'Qualquer pessoa'.");
  }

  throw new Error(
    lastError?.message?.includes("HTML") || lastError?.message?.includes("Unexpected token '<'")
      ? "O Google Drive está temporariamente instável. Por favor, tente novamente em instantes."
      : (lastError?.message || "Falha de comunicação com o Google Apps Script.")
  );
}

const refreshDashboardData = createDashboardRefresh<any>({
  fetchData: () =>
    fetchGoogleScriptJson(
      () => createSignedAppsScriptGetRequest(process.env.GOOGLE_SCRIPT_URL!, "desligados", "getDashboardData"),
      { timeoutMs: 25000, maxRetries: 2 },
      2,
      25000
    ),
  normalize: (data) => {
    const processedData = normalizeDashboardSummary(ensureDashboardFiliais(data));
    const equipCount = processedData?.equipamentosMensal?.length || 0;
    console.log(`[DASHBOARD] Dados recebidos com sucesso do Google Sheets. EquipamentosMensal: ${equipCount} itens.`);
    return processedData;
  },
  cache: dashboardCache,
  persist: savePersistedDashboardCache,
});

// Compatibilidade para chamadas diretas com retry
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, { redirect: "follow", ...options });
      if (!response.ok && [429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(`Google API retornou Erro HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = 500 * Math.pow(2, i);
      console.warn(`[Retry] Falha na comunicação com o script. Tentativa ${i + 1}/${maxRetries} falhou. Tentando novamente em ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error("Falha Crítica no Fetch");
}

function createAppsScriptPostOptions(payload: unknown): RequestInit {
  const body = new URLSearchParams();
  body.set("payload", JSON.stringify(payload));

  return {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
  };
}

function requireAppsScriptSharedSecret(env: NodeJS.ProcessEnv): string {
  const secret = env.APPS_SCRIPT_SHARED_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("APPS_SCRIPT_SHARED_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function requirePassword(env: NodeJS.ProcessEnv, name: "TI_PASSWORD" | "RECEPTION_PASSWORD" | "MARIA_PASSWORD"): string {
  const password = env[name]?.trim();
  if (!password || password.length < 12) {
    throw new Error(`${name} must be configured with at least 12 characters.`);
  }
  return password;
}

function getTrustedProxyHops(env: NodeJS.ProcessEnv): false | number {
  const rawValue = env.TRUST_PROXY_HOPS?.trim();
  if (!rawValue) return false;

  const hops = Number(rawValue);
  if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 1 and 10.");
  }
  return hops;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function createAppsScriptAuth(method: string, audience: string, action: string, payload: unknown) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString("hex");
  const payloadDigest = crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
  const canonical = [method.toUpperCase(), audience, action, timestamp, nonce, payloadDigest].join("\n");
  const signature = crypto
    .createHmac("sha256", requireAppsScriptSharedSecret(process.env))
    .update(canonical)
    .digest("hex");

  return { timestamp, nonce, signature };
}

function createSignedAppsScriptGetRequest(
  scriptUrl: string,
  audience: string,
  action: string,
  payload: Record<string, string> = {}
) {
  const auth = createAppsScriptAuth("GET", audience, action, payload);
  const url = new URL(scriptUrl);
  url.searchParams.set("action", action);
  Object.keys(payload).sort().forEach((key) => url.searchParams.set(key, payload[key]));
  url.searchParams.set("authTimestamp", auth.timestamp);
  url.searchParams.set("authNonce", auth.nonce);
  url.searchParams.set("authSignature", auth.signature);
  return { url: url.toString() };
}

function createSignedAppsScriptPostRequest(
  scriptUrl: string,
  audience: string,
  action: string,
  payload: Record<string, unknown>
) {
  const effectivePayload = { ...payload, action };
  const auth = createAppsScriptAuth("POST", audience, action, effectivePayload);
  return {
    url: scriptUrl,
    options: createAppsScriptPostOptions({ ...effectivePayload, auth }),
  };
}

function getMotoboyScriptUrl() {
  const scriptUrl = process.env.MOTOBOY_GOOGLE_SCRIPT_URL || process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    throw new Error("MOTOBOY_GOOGLE_SCRIPT_URL or GOOGLE_SCRIPT_URL not configured in environment variables.");
  }
  return scriptUrl;
}


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
  const supabase = getSupabaseClient() as any;
  await supabase.from("motoboy_request_events").insert({
    request_id: requestId,
    event_type: eventType,
    actor: actor,
    payload: payload,
  } as any);
}
// ------------------------------------

async function startServer() {
  const app = express();
  const PORT = 3000;
  const sessionSecret = requireSessionSecret(process.env);
  requireAppsScriptSharedSecret(process.env);
  const authPasswords = {
    ti: requirePassword(process.env, "TI_PASSWORD"),
    reception: requirePassword(process.env, "RECEPTION_PASSWORD"),
    maria: requirePassword(process.env, "MARIA_PASSWORD"),
  };

  // Confia somente na quantidade explicitamente configurada de proxies reversos.
  app.set("trust proxy", getTrustedProxyHops(process.env));

  app.use(express.json({ limit: "50kb" })); // Trava global de tamanho de requisição para evitar ataques de estouro de payload
  app.use(cookieSession({
    name: 'session',
    keys: [sessionSecret],
    ...getSessionCookieOptions(process.env),
    maxAge: 24 * 60 * 60 * 1000,
  }));

  // Bloqueio de Brute Force Limitando a Rota de Login (max 10 tentavias / 15 min)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10,
    validate: { trustProxy: false, xForwardedForHeader: false },
    message: { success: false, message: 'Muitas tentativas de login. Por questões de segurança, aguarde alguns minutos e tente novamente.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Auth Endpoint
  app.post('/api/auth/login', loginLimiter, (req, res) => {
    const { password } = req.body;
    
    // As credenciais são validadas uma única vez durante a inicialização.
    const validLogins = [
      {
        password: authPasswords.ti,
        user: { name: 'Administrador TI', email: 'suporte.dafiti@dafiti.com.br', picture: '' }
      },
      {
        password: authPasswords.reception,
        user: { name: 'Recepção', email: 'recepcao@dafiti.com.br', picture: '' }
      },
      {
        password: authPasswords.maria,
        user: { name: 'Maria Julia Sousa', email: 'maria.sousa@dafiti.com.br', picture: '' }
      }
    ];

    const inputPassword = typeof password === 'string' ? password.trim() : '';
    const matchedLogin = validLogins.find(login => login.password === inputPassword);

    if (matchedLogin) {
      console.log(`[AUTH] Login bem-sucedido para: ${matchedLogin.user.name}`);
      // @ts-ignore
      req.session.user = matchedLogin.user; 
      console.log(`[AUTH] Cookie de sessão definido: ${!!req.session.user}`);
      res.json({
        success: true,
        user: matchedLogin.user
      });
    } else {
      console.warn(`[AUTH] Tentativa de login falhou - Senha incorreta.`);
      res.status(401).json({ success: false, message: 'Senha incorreta' });
    }
  });

  // Middleware de autenticação: somente uma sessão assinada e válida concede acesso.
  const requireAuth = (req: any, res: any, next: any) => {
    if (AUTH_DEBUG) {
      const proto = req.headers['x-forwarded-proto'];
      console.log(`[AUTH] Rota: ${req.url} | Protocolo: ${proto || 'local'} | IP: ${req.ip}`);
    }
    
    if (req.session?.user) {
      if (AUTH_DEBUG) {
        console.log(`[AUTH] Acesso autorizado via cookie para: ${req.session.user.name}`);
      }
      return next();
    }

    return res.status(401).json({
      success: false,
      error: "Não autenticado. Faça login para continuar.",
    });
  };

  // Autenticação estrita para endpoint de relatórios e automações externas (ex: n8n)
  const requireReportAuth = (req: any, res: any, next: any) => {
    const configuredToken = process.env.REPORT_API_TOKEN?.trim();

    // 1. Verifica autenticação via Bearer token (padrão M2M para n8n)
    const authHeader = req.headers.authorization;
    if (authHeader && typeof authHeader === "string") {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        const providedToken = match[1].trim();
        if (!configuredToken) {
          console.warn("[REPORT_AUTH] REPORT_API_TOKEN não está configurado no ambiente do servidor.");
          return res.status(500).json({
            error: "Configuração do servidor incompleta. REPORT_API_TOKEN não definido.",
          });
        }

        // Comparação segura de comprimento e hash timing-safe para evitar vazamento por tempo
        const providedBuf = Buffer.from(providedToken, "utf8");
        const configuredBuf = Buffer.from(configuredToken, "utf8");

        if (
          providedBuf.length === configuredBuf.length &&
          crypto.timingSafeEqual(providedBuf, configuredBuf)
        ) {
          req.reportUser = "n8n-automation@dafiti.com.br";
          return next();
        }

        return res.status(403).json({ error: "Token de autorização inválido." });
      }
    }

    // 2. Fallback: Usuário autenticado na sessão do navegador (cookie)
    if (req.session?.user?.email) {
      req.reportUser = req.session.user.email;
      return next();
    }

    return res.status(401).json({
      error: "Não autenticado. Forneça o header 'Authorization: Bearer <token>' ou uma sessão ativa.",
    });
  };

  // Endpoint de geração e exportação de PDF do Dashboard para n8n e automações
  app.get("/api/reports/pdf", requireReportAuth, async (req, res) => {
    try {
      const { filial: rawFilial, month: rawMonth } = req.query;

      // 1. Validação e normalização de Filial
      const filial = (typeof rawFilial === "string" && rawFilial.trim()) ? rawFilial.trim() : "Todas";
      if (!FILIAIS.includes(filial as any)) {
        return res.status(400).json({
          error: `Filial inválida '${filial}'. Opções permitidas: ${FILIAIS.join(", ")}`,
        });
      }

      // 2. Validação e normalização de Mês
      const month = (typeof rawMonth === "string" && rawMonth.trim()) ? rawMonth.trim() : "Todos os meses";
      if (!isValidMonthString(month)) {
        return res.status(400).json({
          error: `Formato de mês inválido '${month}'. Use 'Todos os meses' ou formato 'Mês AAAA' (ex: 'Fevereiro 2026').`,
        });
      }

      // 3. Obtenção dos dados consolidados do Dashboard
      let summaryData: any;
      try {
        summaryData = await refreshDashboardData();
      } catch (err: any) {
        console.warn("[REPORTS_PDF] Erro ao obter dados do Google Sheets:", err.message);
        return res.status(503).json({
          error: "Dados do Dashboard temporariamente indisponíveis para geração do PDF.",
        });
      }

      // 4. Resolução dos dados filtrados por filial e mês
      const activeBranchData = resolveActiveBranchData(summaryData, filial as any, month);

      // 5. Construção do documento PDF com os mesmos parâmetros do frontend
      const userEmail = (req as any).reportUser || "n8n-automation@dafiti.com.br";
      const doc = buildDashboardPdfDocument({
        activeBranchData,
        selectedFilial: filial as any,
        selectedMonth: month,
        userEmail,
        generatedAt: new Date(),
      });

      // 6. Conversão do jsPDF para Buffer binário
      const arrayBuffer = doc.output("arraybuffer");
      const pdfBuffer = Buffer.from(arrayBuffer);

      // 7. Envio com headers padronizados
      const fileName = sanitizeFileName(filial, month);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Length", pdfBuffer.length);

      return res.status(200).send(pdfBuffer);
    } catch (error: any) {
      console.error("[REPORTS_PDF] Falha na geração do relatório em PDF:", error);
      return res.status(500).json({
        error: "Falha interna durante a geração do relatório em PDF.",
      });
    }
  });

  // Endpoint Extra: Para o frontend saber se a sessão expirou e forçar logout
  app.get('/api/auth/status', (req, res) => {
    // @ts-ignore
    if (req.session?.user) {
      // @ts-ignore
      res.json({ authenticated: true, user: req.session.user });
    } else {
      res.json({ authenticated: false });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    // @ts-ignore
    req.session = null; // Destrói o cookie no Backend
    res.json({ success: true });
  });

  const dashboardRefreshLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    skip: (req) => !isManualDashboardRefresh(req),
    keyGenerator: (req: any) => {
      if (req.session?.user?.email) {
        return String(req.session.user.email).toLowerCase();
      }
      return ipKeyGenerator(req.ip || "127.0.0.1");
    },
    validate: { trustProxy: false, keyGeneratorIpFallback: false, xForwardedForHeader: false },
    message: {
      success: false,
      error: "Limite de atualizações manuais atingido. Aguarde alguns instantes.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // API routes protegidas pelo Middleware (requireAuth)
  // Consulta direta ao Google Sheets sem cache
  app.get("/api/dashboard-data", requireAuth, dashboardRefreshLimiter, async (req, res) => {
    try {
      if (!process.env.GOOGLE_SCRIPT_URL) {
        throw new Error("Google Script URL not configured.");
      }

      const forceRefresh = isManualDashboardRefresh(req);
      console.log(`[DASHBOARD] Consulta direta ao Google Sheets iniciada (forceRefresh=${forceRefresh})...`);

      try {
        const processedData = await refreshDashboardData();

        return res.json({
          ...processedData,
          isCached: false,
          isStale: false,
        });
      } catch (fetchErr: any) {
        console.warn("[DASHBOARD] Instabilidade ao consultar Google Apps Script diretamente:", fetchErr.message);

        const is404 = fetchErr.message?.includes("404") || fetchErr.message?.includes("GOOGLE_SCRIPT_URL");
        return res.status(503).json({
          success: false,
          available: false,
          error: is404
            ? "URL do Google Apps Script não encontrada (Erro 404 no Google Drive)."
            : "Dados do Dashboard temporariamente indisponíveis no Google Sheets.",
          message: is404
            ? "A URL do Google Apps Script retornou Erro 404 (Página não encontrada no Google Drive). Verifique em 'Gerenciar Implantações' na planilha se a URL mudou ou se o acesso está configurado como 'Qualquer pessoa'."
            : "O Google Drive está temporariamente instável. Clique em 'Verificar Novamente' para tentar outra vez."
        });
      }
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ error: "Não foi possível consultar os dados do dashboard." });
    }
  });

  app.post("/api/register", requireAuth, async (req, res) => {
    try {
      // 1. Validação estrita e higienização (zod)
      const data = registerSchema.parse(req.body);
      
      if (!process.env.GOOGLE_SCRIPT_URL) {
        throw new Error("Google Script URL not configured in environment variables.");
      }

      // 2. Fetch com os dados higienizados E proteção de Repetição (Retry)
      const result = await fetchGoogleScriptJson(
        () => createSignedAppsScriptPostRequest(
          process.env.GOOGLE_SCRIPT_URL!,
          "desligados",
          "registerDesligamento",
          data
        ),
        { maxRetries: 1 }
      );

      if (!result.success) {
        throw new Error(result.error || "Erro ao processar no Google Apps Script.");
      }

      // Se um novo registro for inserido com sucesso, invalidamos o cache na mesma hora para que o Dashboard puxe do zero atualizado.
      dashboardCache.lastFetch = 0; 
      
      res.json({ success: true, action: result.action, sheet: result.sheet });
    } catch (error: any) {
      console.error("Error/Validation writing to Google Sheets:", error);
      
      // Tratativa de erro clara para expor erros do Zod no frontend
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      
      res.status(500).json({ error: "Não foi possível registrar o desligamento." });
    }
  });

  app.post("/api/motoboy/requests", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role !== "suporte") {
        return res.status(403).json({ error: "Apenas Suporte TI pode criar solicitações de Motoboy." });
      }

      const data = motoboyCreateSchema.parse(req.body);
      const payloadData = {
        id: generateMotoboyId(),
        ...data,
        status: "Pendente"
      };

      let finalRequest;

      if (process.env.MOTOBOY_STORAGE === "supabase") {
        const supabase = getSupabaseClient() as any;
        const snakeData = toSnakeCase(payloadData);
        const { data: inserted, error } = await supabase.from("motoboy_requests").insert(snakeData as any).select().single();
        if (!inserted) throw new Error("Failed to insert record.");
        
        if (error) throw new Error(error.message);
        
        await logMotoboyEvent(inserted.id, "created", (req as any).session.user.email, inserted);
        
        finalRequest = toCamelCase(inserted);
      } else {
        const scriptUrl = getMotoboyScriptUrl();
        const payload = {
          action: "createMotoboyRequest",
          data: payloadData
        };

        const result = await fetchGoogleScriptJson(
          () => createSignedAppsScriptPostRequest(scriptUrl, "motoboy", payload.action, payload),
          { maxRetries: 1 }
        );

        if (!result.success) {
          throw new Error(result.error || "Erro ao criar solicitação de Motoboy.");
        }
        
        finalRequest = result.data || payload.data;
      }

      clearMotoboyCache();
      res.json({ success: true, request: finalRequest });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      console.error("[MOTOBOY_CREATE] Falha ao criar solicitação:", error?.message || "erro desconhecido");
      res.status(500).json({ error: "Não foi possível criar a solicitação de Motoboy." });
    }
  });

  app.get("/api/motoboy/requests", requireAuth, async (req, res) => {
    const userEmail = ((req as any).session?.user?.email || "") as string;
    const role = getMotoboyRole(userEmail);

    if (role === "none") {
      return res.status(403).json({ success: false, role: "none", message: "Usuário sem acesso à área Motoboy." });
    }

    try {
      const rawView = typeof req.query.view === "string" ? req.query.view.toLowerCase().trim() : "";
      const validViews = ["pendentes", "concluidas", "excluidas"];
      const view = validViews.includes(rawView) ? rawView : "pendentes";

      // Recepção acessa somente solicitações ainda pendentes.
      if (role === "recepcao" && view !== "pendentes") {
        return res.status(403).json({
          success: false,
          role,
          message: "Perfil Recepção não tem permissão para consultar esta visualização."
        });
      }

      const cacheKey = `${role}_${view}`;

      const cached = motoboyCache[cacheKey];
      if (cached && (Date.now() - cached.timestamp < MOTOBOY_CACHE_TTL)) {
        console.log(`[Motoboy Cache] Servindo requests para a cacheKey: ${cacheKey}`);
        return res.json({ success: true, role, requests: cached.requests });
      }

      let allRequests: any[] = [];

      if (process.env.MOTOBOY_STORAGE === "supabase") {
        const supabase = getSupabaseClient() as any;
        
        let query = supabase.from("motoboy_requests").select("*");
        if (view === "excluidas") {
          query = query.eq("status", "Excluído");
        } else if (view === "concluidas") {
          query = query.eq("status", "Concluído");
        } else {
          // view === "pendentes"
          query = query.neq("status", "Excluído").neq("status", "Concluído");
        }
        
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        
        allRequests = filterValidMotoboyRequests(data.map(toCamelCase));
      } else {
        const scriptUrl = getMotoboyScriptUrl();
        const query = { action: "listMotoboyRequests", role, view };
        try {
          const result = await fetchGoogleScriptJson(() =>
            createSignedAppsScriptGetRequest(scriptUrl, "motoboy", query.action, {
              role: query.role,
              view: query.view,
            })
          );

          if (!result.success) {
            throw new Error(result.error || "Erro ao listar solicitações de Motoboy.");
          }
          
          allRequests = filterValidMotoboyRequests(result.data || []);
        } catch (fetchErr: any) {
          if (cached && cached.requests) {
            console.warn(`[Motoboy Cache] Google Script inacessível. Usando cache de contingência para ${cacheKey}:`, fetchErr.message);
            return res.json({ success: true, role, requests: cached.requests, isCached: true });
          }
          throw fetchErr;
        }
      }

      // Aplica a filtragem por view garantindo que qualquer status null/vazio/undefined seja tratado como "Pendente"
      const filteredRequests = allRequests.filter((request) => {
        const status = request.status || "Pendente";
        if (view === "pendentes") {
          return status === "Pendente" || status === "Em andamento" || status === "Pendente de recebimento";
        }
        if (view === "concluidas") {
          return status === "Concluído";
        }
        if (view === "excluidas") {
          return status === "Excluído";
        }
        return false;
      });
      
      console.log(`[Motoboy Cache] Atualizando cache para a cacheKey: ${cacheKey}`);
      motoboyCache[cacheKey] = { requests: filteredRequests, timestamp: Date.now() };

      res.json({ success: true, role, requests: filteredRequests });
    } catch (error: any) {
      console.error("[MOTOBOY_LIST] Falha ao listar solicitações:", error?.message || "erro desconhecido");
      res.status(500).json({ success: false, role, message: "Não foi possível listar as solicitações de Motoboy." });
    }
  });

  app.get("/api/motoboy/requests/:id/events", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role === "none") {
        return res.status(403).json({ error: "Usuário sem acesso à área Motoboy." });
      }

      if (process.env.MOTOBOY_STORAGE !== "supabase") {
        return res.json({ success: true, events: [] });
      }

      const id = z.string().min(1, "ID da solicitação é obrigatório").parse(req.params.id);
      const supabase = getSupabaseClient() as any;

      const { data: request, error: requestError } = await supabase
        .from("motoboy_requests")
        .select("id,status")
        .eq("id", id)
        .single();

      if (requestError || !request) {
        return res.status(404).json({ error: "Solicitação de Motoboy não encontrada." });
      }
      if (role === "recepcao" && ["Concluído", "Excluído"].includes(request.status)) {
        return res.status(403).json({ error: "Perfil Recepção não tem permissão para consultar este histórico." });
      }
      
      const { data, error } = await supabase
        .from("motoboy_request_events")
        .select("id,request_id,event_type,actor,created_at")
        .eq("request_id", id)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const events = data.map((row: any) => ({
        id: row.id,
        requestId: row.request_id,
        eventType: row.event_type,
        actor: row.actor,
        createdAt: row.created_at
      }));

      res.json({ success: true, events });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      console.error("[MOTOBOY_EVENTS] Falha ao consultar histórico:", error?.message || "erro desconhecido");
      res.status(500).json({ error: "Não foi possível consultar o histórico de Motoboy." });
    }
  });

  app.patch("/api/motoboy/requests/:id", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role !== "recepcao") {
        return res.status(403).json({ error: "Apenas Recepção pode atualizar solicitações de Motoboy." });
      }

      const id = z.string().min(1, "ID da solicitação é obrigatório").parse(req.params.id);
      const data = motoboyUpdateSchema.parse(req.body);
      
      let finalRequest;

      if (process.env.MOTOBOY_STORAGE === "supabase") {
        const supabase = getSupabaseClient() as any;
        
        const { data: existing, error: existingErr } = await supabase.from("motoboy_requests").select("*").eq("id", id).single();
        if (existingErr) throw new Error(existingErr.message);
        
        const snakeData = toSnakeCase(data);
        const updatedStatus = calculateMotoboyStatus({ ...toCamelCase(existing), ...data });
        snakeData.status = updatedStatus;
        snakeData.atualizado_em = new Date().toISOString();
        
        const { data: updated, error } = await supabase.from("motoboy_requests").update(snakeData as any).eq("id", id).select().single();
        if (!updated) throw new Error("Failed to update record.");
        if (error) throw new Error(error.message);
        
        await logMotoboyEvent(updated.id, "updated", (req as any).session.user.email, { changes: snakeData, snapshot: updated });
        
        finalRequest = toCamelCase(updated);
      } else {
        const scriptUrl = getMotoboyScriptUrl();
        const result = await fetchGoogleScriptJson(
          () => createSignedAppsScriptPostRequest(
            scriptUrl,
            "motoboy",
            "updateMotoboyRequest",
            { id, data }
          ),
          { maxRetries: 1 }
        );

        if (!result.success) {
          throw new Error(result.error || "Erro ao atualizar solicitação de Motoboy.");
        }
        
        finalRequest = result.data;
      }

      clearMotoboyCache();
      res.json({ success: true, request: finalRequest });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      console.error("[MOTOBOY_UPDATE] Falha ao atualizar solicitação:", error?.message || "erro desconhecido");
      res.status(500).json({ error: "Não foi possível atualizar a solicitação de Motoboy." });
    }
  });

  app.delete("/api/motoboy/requests/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).session.user;
      const role = getMotoboyRole(user.email || "");
      if (role !== "suporte" && role !== "recepcao") {
        return res.status(403).json({ error: "Apenas Suporte TI ou Recepção podem excluir solicitações de Motoboy." });
      }

      const id = z.string().min(1, "ID da solicitação é obrigatório").parse(req.params.id);
      const data = motoboyDeleteSchema.parse(req.body);
      const excluidoPor = `${user.name || "Usuário"} <${user.email || "sem-email"}>`;
      
      let finalRequest;

      if (process.env.MOTOBOY_STORAGE === "supabase") {
        const supabase = getSupabaseClient() as any;
        
        const updateData = {
           status: "Excluído",
           justificativa_exclusao: data.justificativa,
           excluido_por: excluidoPor,
           excluido_em: new Date().toISOString()
        };
        
        const { data: updated, error } = await supabase.from("motoboy_requests").update(updateData as any).eq("id", id).select().single();
        if (!updated) throw new Error("Failed to delete record.");
        if (error) throw new Error(error.message);
        
        await logMotoboyEvent(updated.id, "deleted", user.email, { snapshot: updated });
        
        finalRequest = toCamelCase(updated);
      } else {
        const scriptUrl = getMotoboyScriptUrl();
        const result = await fetchGoogleScriptJson(
          () => createSignedAppsScriptPostRequest(
            scriptUrl,
            "motoboy",
            "deleteMotoboyRequest",
            {
              id,
              data: {
                justificativa: data.justificativa,
                excluidoPor
              }
            }
          ),
          { maxRetries: 1 }
        );

        if (!result.success) {
          throw new Error(result.error || "Erro ao excluir solicitação de Motoboy.");
        }

        if (result.action === "registerDesligamento") {
          throw new Error("Apps Script publicado não recebeu a ação deleteMotoboyRequest. Atualize Code.gs, crie Nova versão da implantação e reinicie o backend.");
        }
        if (result.data?.status !== "Excluído") {
          throw new Error("Apps Script de Motoboy desatualizado. Atualize o Code.gs e reimplante o Web App.");
        }
        
        finalRequest = result.data;
      }

      clearMotoboyCache();
      res.json({ success: true, request: finalRequest });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      console.error("[MOTOBOY_DELETE] Falha ao excluir solicitação:", error?.message || "erro desconhecido");
      res.status(500).json({ error: "Não foi possível excluir a solicitação de Motoboy." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
