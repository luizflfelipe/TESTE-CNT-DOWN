const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

const DESLIGAMENTOS_SPREADSHEET_ID = "DESLIGAMENTOS_SPREADSHEET_ID";
const MOTOBOY_SPREADSHEET_ID = "MOTOBOY_SPREADSHEET_ID";

const DESLIGAMENTOS_SHEET_NAME = SCRIPT_PROPERTIES.getProperty("DESLIGAMENTOS_SHEET_NAME") || "Desligamentos";
const MOTOBOY_SHEET_NAME = SCRIPT_PROPERTIES.getProperty("MOTOBOY_SHEET_NAME") || "Motoboy";
const RESUMO_DASHBOARD_SHEET_NAME = SCRIPT_PROPERTIES.getProperty("RESUMO_DASHBOARD_SHEET_NAME") || "Resumo_Dashboard";

const DESLIGAMENTOS_HEADERS = [
  "Data Registro",
  "Colaborador",
  "Filial",
  "Desligamento",
  "Equipamento/Quantidade",
  "Equip Devolvido",
  "Controle Maju"
];

const MOTOBOY_HEADERS = [
  "ID",
  "Nome do Solicitante",
  "Data da Solicitação",
  "Equipamento",
  "Funcionário",
  "email",
  "Centro de Custo",
  "Telefone",
  "Endereço",
  "ENTREGA/Retirada",
  "Se possui Retorno",
  "Prioridade",
  "Maquina Retirada",
  "Enviado",
  "Recebido",
  "Data do Envio/ Recebimento",
  "Cod. Rastreio",
  "Observações",
  "Status",
  "Justificativa da Exclusão",
  "Excluído por",
  "Excluído em",
  "Criado em",
  "Atualizado em"
];

const MOTOBOY_FIELD_TO_HEADER = {
  id: "ID",
  nomeSolicitante: "Nome do Solicitante",
  dataSolicitacao: "Data da Solicitação",
  equipamento: "Equipamento",
  funcionario: "Funcionário",
  email: "email",
  centroCusto: "Centro de Custo",
  telefone: "Telefone",
  endereco: "Endereço",
  tipoServico: "ENTREGA/Retirada",
  possuiRetorno: "Se possui Retorno",
  prioridade: "Prioridade",
  maquinaRetirada: "Maquina Retirada",
  enviado: "Enviado",
  recebido: "Recebido",
  dataEnvioRecebimento: "Data do Envio/ Recebimento",
  codigoRastreio: "Cod. Rastreio",
  observacoes: "Observações",
  status: "Status",
  justificativaExclusao: "Justificativa da Exclusão",
  excluidoPor: "Excluído por",
  excluidoEm: "Excluído em"
};

const MOTOBOY_HEADER_TO_FIELD = Object.keys(MOTOBOY_FIELD_TO_HEADER).reduce(function (acc, key) {
  acc[MOTOBOY_FIELD_TO_HEADER[key]] = key;
  return acc;
}, {});

function doGet(e) {
  try {
    const action = getParam_(e, "action");

    if (!action || action === "ping") {
      return json_({ success: true, message: "Apps Script online" });
    }

    if (action === "getDashboardData" || action === "getDashboardSummary") {
      return json_({ success: true, data: getDashboardData_() });
    }

    if (action === "rebuildDashboardSummary" || action === "processDashboardDaily") {
      return json_({ success: true, data: processarResumoDashboardDiario_() });
    }

    if (action === "setupDailyTrigger") {
      return json_({ success: true, data: instalarGatilhoProcessamentoDiario_() });
    }

    if (action === "fetchExternal") {
      return json_({ success: true, data: fetchExternal_(getParam_(e, "url")) });
    }

    if (action === "listMotoboyRequests") {
      return json_({ success: true, data: listMotoboyRequests_(getParam_(e, "role")) });
    }

    throw new Error("Ação GET inválida: " + action);
  } catch (error) {
    return json_({ success: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const payload = parsePostBody_(e);

    if (payload.action === "createMotoboyRequest") {
      return json_({ success: true, data: createMotoboyRequest_(payload.data || {}) });
    }

    if (payload.action === "updateMotoboyRequest") {
      return json_({ success: true, data: updateMotoboyRequest_(payload.id, payload.data || {}) });
    }

    if (payload.action === "deleteMotoboyRequest") {
      return json_({ success: true, data: deleteMotoboyRequest_(payload.id, payload.data || {}) });
    }

    return json_({ success: true, action: "registerDesligamento", sheet: registerDesligamento_(payload) });
  } catch (error) {
    return json_({ success: false, error: error.message });
  }
}

function createMotoboyRequest_(data) {
  const sheet = getSheet_(MOTOBOY_SPREADSHEET_ID, MOTOBOY_SHEET_NAME, MOTOBOY_HEADERS);
  const headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
  const now = new Date();
  const rowObject = {};

  Object.keys(MOTOBOY_FIELD_TO_HEADER).forEach(function (field) {
    rowObject[MOTOBOY_FIELD_TO_HEADER[field]] = data[field] || "";
  });

  rowObject["Status"] = data.status || "Pendente";
  rowObject["Criado em"] = now;
  rowObject["Atualizado em"] = now;

  if (!rowObject["ID"]) {
    throw new Error("ID técnico da solicitação Motoboy é obrigatório.");
  }

  appendObjectRow_(sheet, headers, rowObject);
  hideColumnIfExists_(sheet, headers, "ID");

  return objectFromHeaders_(headers, rowObject, MOTOBOY_HEADER_TO_FIELD);
}

function readMotoboyDataRange_(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
}

function listMotoboyRequests_(role) {
  const sheet = getSheet_(MOTOBOY_SPREADSHEET_ID, MOTOBOY_SHEET_NAME, MOTOBOY_HEADERS);
  const headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
  
  const values = readMotoboyDataRange_(sheet, headers);

  if (values.length === 0) return [];

  return values
    .filter(function (row) {
      return row.some(function (cell) { return cell !== ""; });
    })
    .map(function (row) {
      const rowObject = {};
      headers.forEach(function (header, index) {
        rowObject[header] = row[index];
      });
      return objectFromHeaders_(headers, rowObject, MOTOBOY_HEADER_TO_FIELD);
    })
    .filter(function (request) {
      if (!request.id) return false;
      if (request.status === "Excluído") return false;
      if (role === "recepcao") return request.status !== "Concluído";
      return true;
    });
}

function updateMotoboyRequest_(id, data) {
  if (!id) throw new Error("ID da solicitação Motoboy é obrigatório.");

  const sheet = getSheet_(MOTOBOY_SPREADSHEET_ID, MOTOBOY_SHEET_NAME, MOTOBOY_HEADERS);
  const headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
  const idColumn = headers.indexOf("ID") + 1;

  if (idColumn === 0) throw new Error("Coluna ID não encontrada na planilha Motoboy.");

  const lastRow = sheet.getLastRow();
  const idValues = lastRow > 1 ? sheet.getRange(2, idColumn, lastRow - 1, 1).getValues() : [];
  const matchIndex = idValues.findIndex(function (row) { return String(row[0]) === String(id); });

  if (matchIndex === -1) throw new Error("Solicitação Motoboy não encontrada para o ID informado.");

  const targetRow = matchIndex + 2;
  const currentValues = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
  const rowObject = {};

  headers.forEach(function (header, index) {
    rowObject[header] = currentValues[index];
  });

  Object.keys(data).forEach(function (field) {
    const header = MOTOBOY_FIELD_TO_HEADER[field];
    if (header && headers.indexOf(header) !== -1) {
      rowObject[header] = data[field];
    }
  });

  rowObject["Atualizado em"] = new Date();

  if (data.recebido === "Sim" || data.recebido === true) {
    rowObject["Status"] = "Concluído";
  } else if (data.enviado === "Sim" && data.recebido === "Não") {
    rowObject["Status"] = "Pendente de recebimento";
  } else if (data.enviado === "Sim" || data.maquinaRetirada || data.codigoRastreio) {
    rowObject["Status"] = "Em andamento";
  }

  const nextValues = headers.map(function (header) {
    return rowObject[header] || "";
  });

  sheet.getRange(targetRow, 1, 1, headers.length).setValues([nextValues]);

  return objectFromHeaders_(headers, rowObject, MOTOBOY_HEADER_TO_FIELD);
}

function deleteMotoboyRequest_(id, data) {
  if (!id) throw new Error("ID da solicitação Motoboy é obrigatório.");
  if (!data.justificativa) throw new Error("Justificativa da exclusão é obrigatória.");

  const sheet = getSheet_(MOTOBOY_SPREADSHEET_ID, MOTOBOY_SHEET_NAME, MOTOBOY_HEADERS);
  const headers = ensureHeaders_(sheet, MOTOBOY_HEADERS);
  const idColumn = headers.indexOf("ID") + 1;

  if (idColumn === 0) throw new Error("Coluna ID não encontrada na planilha Motoboy.");

  const lastRow = sheet.getLastRow();
  const idValues = lastRow > 1 ? sheet.getRange(2, idColumn, lastRow - 1, 1).getValues() : [];
  const matchIndex = idValues.findIndex(function (row) { return String(row[0]) === String(id); });

  if (matchIndex === -1) throw new Error("Solicitação Motoboy não encontrada para o ID informado.");

  const targetRow = matchIndex + 2;
  const currentValues = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
  const rowObject = {};
  const now = new Date();

  headers.forEach(function (header, index) {
    rowObject[header] = currentValues[index];
  });

  rowObject["Status"] = "Excluído";
  rowObject["Justificativa da Exclusão"] = data.justificativa;
  rowObject["Excluído por"] = data.excluidoPor || "";
  rowObject["Excluído em"] = now;
  rowObject["Atualizado em"] = now;

  const nextValues = headers.map(function (header) {
    return rowObject[header] || "";
  });

  sheet.getRange(targetRow, 1, 1, headers.length).setValues([nextValues]);

  return objectFromHeaders_(headers, rowObject, MOTOBOY_HEADER_TO_FIELD);
}

function registerDesligamento_(data) {
  const sheet = getSheet_(DESLIGAMENTOS_SPREADSHEET_ID, DESLIGAMENTOS_SHEET_NAME, DESLIGAMENTOS_HEADERS);
  const headers = ensureHeaders_(sheet, DESLIGAMENTOS_HEADERS);

  const rowObject = {
    "Data Registro": new Date(),
    "Colaborador": data.colaborador || "",
    "Filial": data.filial || "",
    "Desligamento": data.desligamento || "",
    "Equipamento/Quantidade": data.equipamentoQuantidade || "",
    "Equip Devolvido": data.equipDevolvido || "",
    "Controle Maju": data.controleMaju || ""
  };

  appendObjectRow_(sheet, headers, rowObject);
  return sheet.getName();
}

function getDashboardData_() {
  var summary = obterResumoDashboardPersistido_();
  if (summary && summary.available && summary.filiais && summary.filiais["Todas"] && summary.filiais["Extrema"]) {
    return summary;
  }
  return processarResumoDashboardDiario_();
}

function obterResumoDashboardPersistido_() {
  var spreadsheet = getDesligadosSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(RESUMO_DASHBOARD_SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      available: false,
      message: "Resumo do dashboard ainda não processado. A rotina automática executa diariamente entre 06h e 07h."
    };
  }

  var values = sheet.getRange(1, 1, sheet.getLastRow(), 4).getValues();
  var meta = null;
  var filiais = {};

  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][0] || "").trim();
    var rawJson = values[i][1];
    if (!key || !rawJson) continue;

    try {
      var parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
      if (key === "METADATA") {
        meta = parsed;
      } else {
        filiais[key] = parsed;
      }
    } catch (e) {
      console.error("Erro ao fazer parse do resumo para a chave " + key + ": " + e.message);
    }
  }

  if (!meta || !meta.generationId || !filiais["Todas"]) {
    return {
      available: false,
      message: "Resumo do dashboard incompleto ou corrompido. Aguardando novo processamento diário."
    };
  }

  var dataTodas = filiais["Todas"] || {};

  return {
    available: true,
    formatVersion: meta.formatVersion || 1,
    generationId: meta.generationId,
    updatedAt: meta.updatedAt || "",
    lastUpdate: meta.updatedAt || "",
    filiais: filiais,
    totalDesligamentos: dataTodas.totalDesligamentos || 0,
    desligamentosMesAtual: dataTodas.desligamentosMesAtual || 0,
    mensalData: dataTodas.mensalData || Array(0),
    equipamentosMensal: dataTodas.equipamentosMensal || Array(0),
    equipamentosRanking: dataTodas.equipamentosRanking || Array(0),
    pendencias: dataTodas.pendencias || Array(0),
    recentReturns: dataTodas.recentReturns || Array(0)
  };
}

function processarResumoDashboardDiario_() {
  var spreadsheet = getDesligadosSpreadsheet_();
  var now = new Date();
  var timeZone = "America/Sao_Paulo";
  var currentMonthKey = buildMonthKey_(now);

  var branchKeys = ["Todas", "Barra Funda", "Extrema", "Belo Horizonte"];
  var accumulators = {};

  branchKeys.forEach(function (k) {
    accumulators[k] = {
      mensalMap: {},
      equipamentosMensalMap: {},
      equipamentosRankingMap: {},
      pendenciasList: [],
      recentReturnsList: [],
      totalDesligamentos: 0,
      desligamentosMesAtual: 0
    };
  });

  var sheets = spreadsheet.getSheets();
  sheets.forEach(function (sheet) {
    if (!isDesligadosMonthSheet_(sheet) && sheet.getName() !== DESLIGAMENTOS_SHEET_NAME) return;
    if (sheet.getLastRow() < 2) return;

    var values = sheet.getDataRange().getValues();
    var headerInfo = detectDesligadosHeader_(values);
    if (!headerInfo.found) return;

    var headers = values[headerInfo.rowIndex];
    var headerIndex = buildNormalizedHeaderIndex_(headers);
    var colaboradorIndex = findNormalizedHeaderIndex_(headerIndex, ["COLABORADOR", "Colaborador", "Nome"]);
    var desligamentoIndex = findNormalizedHeaderIndex_(headerIndex, ["DESLIGAMENTO", "Data Desligamento", "Data de Desligamento"]);
    var recebidoIndex = findNormalizedHeaderIndex_(headerIndex, ["RECEBIDO", "Recebimento", "Data Recebido", "Data do Recebimento"]);
    var filialIndex = findNormalizedHeaderIndex_(headerIndex, ["FILIAL", "Filial"]);
    var equipDevolvidoIndex = findNormalizedHeaderIndex_(headerIndex, ["Equip. Devolvido", "Equip Devolvido"]);
    var equipamentosIndex = findNormalizedHeaderIndex_(headerIndex, [
      "Equipamento(s) e Quantidade",
      "Equipamentos e Quantidade",
      "Equipamento/Quantidade",
      "Equipamento"
    ]);

    if (colaboradorIndex < 0) return;

    values.slice(headerInfo.rowIndex + 1).forEach(function (row) {
      var colaborador = row[colaboradorIndex];
      if (!colaborador || String(colaborador).trim() === "") return;

      var filialRaw = filialIndex >= 0 ? row[filialIndex] : "";
      var filialNormalizada = normalizarFilialSuportada_(filialRaw);
      if (!filialNormalizada) return;

      var desligamento = desligamentoIndex >= 0 ? row[desligamentoIndex] : "";
      var desligamentoDate = parseDate_(desligamento);
      var monthDate = desligamentoDate || getDateFromSheetName_(sheet.getName()) || now;
      var monthKey = buildMonthKey_(monthDate);

      var equipamentoStr = equipamentosIndex >= 0 ? row[equipamentosIndex] : "";
      var equipamentos = parseEquipments_(equipamentoStr);

      var statusDevolucao = equipDevolvidoIndex >= 0
        ? normalizeText_(row[equipDevolvidoIndex])
        : "";
      var isDevolvido = statusDevolucao === "devolvido" || statusDevolucao === "desligamento";

      var targetKeys = ["Todas", filialNormalizada];

      targetKeys.forEach(function (k) {
        var acc = accumulators[k];
        acc.totalDesligamentos += 1;
        acc.mensalMap[monthKey] = (acc.mensalMap[monthKey] || 0) + 1;

        if (monthKey === currentMonthKey) {
          acc.desligamentosMesAtual += 1;
        }

        equipamentos.forEach(function (equipamento) {
          acc.equipamentosMensalMap[monthKey] = (acc.equipamentosMensalMap[monthKey] || 0) + equipamento.qty;
          acc.equipamentosRankingMap[equipamento.name] = (acc.equipamentosRankingMap[equipamento.name] || 0) + equipamento.qty;
        });

        if (!isDevolvido) {
          var diffDays = desligamentoDate
            ? Math.ceil(Math.abs(now.getTime() - desligamentoDate.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          acc.pendenciasList.push({
            name: String(colaborador),
            date: desligamentoDate ? Utilities.formatDate(desligamentoDate, timeZone, "dd/MM/yyyy") : "N/A",
            filial: filialNormalizada,
            priority: diffDays > 7 ? "ALTA" : "NORMAL"
          });
        } else {
          var recebido = recebidoIndex >= 0 ? row[recebidoIndex] : "";
          var recebidoDate = parseDate_(recebido) || desligamentoDate;

          if (recebidoDate && !isNaN(recebidoDate.getTime())) {
            var diffDaysRec = Math.ceil(Math.abs(now.getTime() - recebidoDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDaysRec <= 31) {
              acc.recentReturnsList.push({
                name: String(colaborador),
                date: Utilities.formatDate(recebidoDate, timeZone, "dd/MM/yyyy"),
                equipments: equipamentoStr ? String(equipamentoStr) : "Não especificado",
                timestamp: recebidoDate.getTime()
              });
            }
          }
        }
      });
    });
  });

  var calculatedBranches = {};
  branchKeys.forEach(function (k) {
    var acc = accumulators[k];

    acc.recentReturnsList.sort(function (a, b) {
      return b.timestamp - a.timestamp;
    });

    var sortedMonthKeys = Object.keys(acc.mensalMap).sort(compareMonthKeys_);
    var sortedEquipMonthKeys = Object.keys(acc.equipamentosMensalMap).sort(compareMonthKeys_);

    var mensalData = sortedMonthKeys.map(function (month) {
      return { month: month, count: acc.mensalMap[month] };
    });

    var equipamentosMensal = sortedEquipMonthKeys.map(function (month) {
      return { month: month, count: acc.equipamentosMensalMap[month] };
    });

    var equipamentosRanking = Object.keys(acc.equipamentosRankingMap)
      .map(function (name) { return { name: name, count: acc.equipamentosRankingMap[name] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 10);

    calculatedBranches[k] = {
      totalDesligamentos: acc.totalDesligamentos,
      desligamentosMesAtual: acc.desligamentosMesAtual,
      mensalData: mensalData,
      equipamentosMensal: equipamentosMensal,
      equipamentosRanking: equipamentosRanking,
      pendencias: acc.pendenciasList.reverse().slice(0, 15),
      recentReturns: acc.recentReturnsList.slice(0, 50)
    };
  });

  // Validação estrita dos quatro conjuntos antes de publicar
  branchKeys.forEach(function (k) {
    if (!calculatedBranches[k]) {
      throw new Error("Falha ao calcular conjunto da filial: " + k);
    }
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var generationId = "GEN-" + Utilities.formatDate(now, timeZone, "yyyyMMdd-HHmmss") + "-" + Utilities.getUuid().slice(0, 6);
    var updatedAtFormatted = Utilities.formatDate(now, timeZone, "dd/MM/yyyy HH:mm:ss");

    var metaData = {
      formatVersion: 1,
      generationId: generationId,
      updatedAt: updatedAtFormatted,
      status: "ready"
    };

    var summarySheet = spreadsheet.getSheetByName(RESUMO_DASHBOARD_SHEET_NAME);
    if (!summarySheet) {
      summarySheet = spreadsheet.insertSheet(RESUMO_DASHBOARD_SHEET_NAME);
    }

    var rowsToWrite = [
      ["Chave", "Dados JSON", "Atualizado Em", "Generation ID"],
      ["METADATA", JSON.stringify(metaData), updatedAtFormatted, generationId],
      ["Todas", JSON.stringify(calculatedBranches["Todas"]), updatedAtFormatted, generationId],
      ["Barra Funda", JSON.stringify(calculatedBranches["Barra Funda"]), updatedAtFormatted, generationId],
      ["Extrema", JSON.stringify(calculatedBranches["Extrema"]), updatedAtFormatted, generationId],
      ["Belo Horizonte", JSON.stringify(calculatedBranches["Belo Horizonte"]), updatedAtFormatted, generationId]
    ];

    summarySheet.clearContents();
    summarySheet.getRange(1, 1, rowsToWrite.length, 4).setValues(rowsToWrite);

    return {
      available: true,
      formatVersion: 1,
      generationId: generationId,
      updatedAt: updatedAtFormatted,
      lastUpdate: updatedAtFormatted,
      filiais: calculatedBranches,
      ...calculatedBranches["Todas"]
    };
  } finally {
    lock.releaseLock();
  }
}

function instalarGatilhoProcessamentoDiario_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "executarRotinaDiariaDashboard" || fn === "executarRotinaDiariaDashboard_") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("executarRotinaDiariaDashboard")
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .inTimezone("America/Sao_Paulo")
    .create();

  // Executa a primeira geração do resumo para disponibilizar dados imediatamente
  return processarResumoDashboardDiario_();
}

function executarRotinaDiariaDashboard() {
  processarResumoDashboardDiario_();
}

function normalizarFilialSuportada_(filial) {
  var norm = normalizeText_(filial);
  if (!norm) return null;
  if (norm.indexOf("barra funda") !== -1 || norm === "bf" || norm === "sp") {
    return "Barra Funda";
  }
  if (norm.indexOf("extrema") !== -1 || norm === "mg - extrema" || norm === "cd extrema") {
    return "Extrema";
  }
  if (norm.indexOf("belo horizonte") !== -1 || norm === "bh" || norm === "mg - bh") {
    return "Belo Horizonte";
  }
  return null;
}

function getDesligadosSpreadsheet_() {
  const spreadsheetId = SCRIPT_PROPERTIES.getProperty(DESLIGAMENTOS_SPREADSHEET_ID);

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Configure a propriedade " + DESLIGAMENTOS_SPREADSHEET_ID + " nas Propriedades do Script.");
  }

  return spreadsheet;
}

function detectDesligadosHeader_(values) {
  const limit = Math.min(values.length, 10);

  for (let i = 0; i < limit; i++) {
    const headerIndex = buildNormalizedHeaderIndex_(values[i]);
    const colaboradorIndex = findNormalizedHeaderIndex_(headerIndex, ["COLABORADOR", "Colaborador", "Nome"]);

    if (colaboradorIndex >= 0) {
      return { found: true, rowIndex: i };
    }
  }

  return { found: false, rowIndex: 0 };
}

function buildNormalizedHeaderIndex_(headers) {
  const index = {};

  headers.forEach(function (header, i) {
    const normal = normalizeHeader_(header);
    if (normal) index[normal] = i;
  });

  return index;
}

function findNormalizedHeaderIndex_(headerIndex, names) {
  for (let i = 0; i < names.length; i++) {
    const key = normalizeHeader_(names[i]);
    if (Object.prototype.hasOwnProperty.call(headerIndex, key)) {
      return headerIndex[key];
    }
  }

  return -1;
}

function normalizeHeader_(value) {
  return normalizeText_(value)
    .replace(/[.\-_/()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText_(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isFilialPermitida_(filial) {
  if (!filial) return false;
  var str = normalizeText_(filial);
  return str.indexOf("barra funda") !== -1 ||
         str.indexOf("extrema") !== -1 ||
         str.indexOf("belo horizonte") !== -1 ||
         str === "bf" || str === "sp" ||
         str === "bh" || str === "mg - bh" ||
         str === "cd extrema" || str === "mg - extrema";
}

function isDesligadosMonthSheet_(sheet) {
  return getDateFromSheetName_(sheet.getName()) !== null;
}

function getDateFromSheetName_(sheetName) {
  const normalized = normalizeText_(sheetName);
  const months = getMonthNames_();
  let monthIndex = -1;

  for (let i = 0; i < months.length; i++) {
    if (normalized.indexOf(normalizeText_(months[i])) !== -1) {
      monthIndex = i;
      break;
    }
  }

  const yearMatch = normalized.match(/(19\d{2}|20\d{2})/);
  if (monthIndex === -1 || !yearMatch) return null;

  return new Date(parseInt(yearMatch[1], 10), monthIndex, 1);
}

function buildMonthKey_(date) {
  return getMonthNames_()[date.getMonth()] + " " + date.getFullYear();
}

function compareMonthKeys_(a, b) {
  const dateA = getDateFromSheetName_(a) || parseMonthKey_(a);
  const dateB = getDateFromSheetName_(b) || parseMonthKey_(b);

  if (!dateA && !dateB) return a.localeCompare(b);
  if (!dateA) return 1;
  if (!dateB) return -1;

  return dateA.getTime() - dateB.getTime();
}

function parseMonthKey_(key) {
  const normalized = normalizeText_(key);
  const months = getMonthNames_();
  let monthIndex = -1;

  for (let i = 0; i < months.length; i++) {
    if (normalized.indexOf(normalizeText_(months[i])) !== -1) {
      monthIndex = i;
      break;
    }
  }

  const yearMatch = normalized.match(/(19\d{2}|20\d{2})/);
  if (monthIndex === -1 || !yearMatch) return null;

  return new Date(parseInt(yearMatch[1], 10), monthIndex, 1);
}

function getMonthNames_() {
  return [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
}

function parseEquipments_(equipStr) {
  const result = [];
  if (!equipStr) return result;

  const str = String(equipStr);
  const regex = /(\d+)\s*[xX]?\s*([^0-9,+]+?)(?=\s*\d|\s*[+,]|$)/g;
  let match;
  let found = false;

  while ((match = regex.exec(str)) !== null) {
    const name = normalizeEquipmentName_(match[2]);
    if (name) {
      result.push({ qty: parseInt(match[1], 10), name: name });
      found = true;
    }
  }

  if (!found) {
    str.split(/,|\+/).forEach(function (part) {
      const name = normalizeEquipmentName_(part);
      if (name) result.push({ qty: 1, name: name });
    });
  }

  return result;
}

function normalizeEquipmentName_(name) {
  if (!name) return "";

  const variations = {
    notebook: "Notebook",
    notbook: "Notebook",
    notebock: "Notebook",
    note: "Notebook",
    laptop: "Notebook",
    notes: "Notebook",
    notebooks: "Notebook",
    fonte: "Fonte",
    font: "Fonte",
    fontes: "Fonte",
    carregador: "Fonte",
    carreg: "Fonte",
    mouse: "Mouse",
    mouses: "Mouse",
    monitor: "Monitor",
    monitores: "Monitor",
    tela: "Monitor",
    celular: "Celular",
    celulares: "Celular",
    iphone: "Celular",
    android: "Celular",
    teclado: "Teclado",
    teclados: "Teclado",
    macbook: "Macbook",
    mac: "Macbook",
    "mac book": "Macbook",
    headset: "Headset",
    fone: "Headset",
    fones: "Headset",
    headphone: "Headset",
    adaptador: "Adaptador",
    adaptadores: "Adaptador",
    mochila: "Mochila",
    mochilas: "Mochila"
  };

  const clean = String(name).replace(/[\(\)]/g, "").trim();
  const key = normalizeText_(clean);

  if (variations[key]) return variations[key];

  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function fetchExternal_(url) {
  if (!url) throw new Error("URL da planilha externa não fornecida.");

  const spreadsheet = SpreadsheetApp.openByUrl(url);
  const sheet = spreadsheet.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  if (!values.length) return [];

  const headers = values[0].map(function (header) { return String(header); });
  return values.slice(1).map(function (row) {
    const item = {};
    headers.forEach(function (header, index) {
      item[header] = row[index];
    });
    return item;
  });
}

function getSheet_(spreadsheetPropertyName, sheetName, defaultHeaders) {
  const spreadsheetId = SCRIPT_PROPERTIES.getProperty(spreadsheetPropertyName);
  const spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("Configure a propriedade " + spreadsheetPropertyName + " nas Propriedades do Script.");
  }

  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
  }

  return sheet;
}

function ensureHeaders_(sheet, defaultHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), defaultHeaders.length);
  const existingHeaders = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (header) { return String(header || "").trim(); })
    : [];

  if (!existingHeaders.some(Boolean)) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    return defaultHeaders.slice();
  }

  const headers = existingHeaders.slice();
  defaultHeaders.forEach(function (header) {
    if (headers.indexOf(header) === -1) {
      headers.push(header);
      sheet.getRange(1, headers.length).setValue(header);
    }
  });

  return headers;
}

function appendObjectRow_(sheet, headers, rowObject) {
  const row = headers.map(function (header) {
    return rowObject[header] || "";
  });
  sheet.appendRow(row);
}

function objectFromHeaders_(headers, rowObject, headerToField) {
  const result = {};
  headers.forEach(function (header) {
    const field = headerToField[header];
    if (field) result[field] = normalizeValue_(rowObject[header]);
  });
  return result;
}

function hideColumnIfExists_(sheet, headers, header) {
  const column = headers.indexOf(header) + 1;
  if (column > 0) sheet.hideColumns(column);
}

function findHeaderIndex_(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const index = headers.indexOf(names[i]);
    if (index !== -1) return index;
  }
  return -1;
}

function parsePostBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  const contents = e.postData.contents;
  const trimmed = String(contents).trim();
  if (!trimmed) return {};
  if (trimmed[0] === "{" || trimmed[0] === "[") {
    return JSON.parse(trimmed);
  }

  const params = parseFormBody_(contents);
  if (params.payload) return JSON.parse(params.payload);
  if (params.action) {
    const payload = { action: params.action };
    if (params.id) payload.id = params.id;
    if (params.data) payload.data = JSON.parse(params.data);
    return payload;
  }

  return {};
}

function parseFormBody_(contents) {
  const params = {};
  String(contents).split("&").forEach(function (part) {
    if (!part) return;
    const pair = part.split("=");
    const key = decodeURIComponent((pair[0] || "").replace(/\+/g, " "));
    const value = decodeURIComponent((pair.slice(1).join("=") || "").replace(/\+/g, " "));
    if (key) params[key] = value;
  });
  return params;
}

function getParam_(e, name) {
  return e && e.parameter ? e.parameter[name] : "";
}

function parseDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return value == null ? "" : value;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
