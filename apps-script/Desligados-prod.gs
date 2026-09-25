/**
 * Google Apps Script
 * Melhorias feitas na última versão
 * 1. Pega colaboradores de TODAS as Filiais (Extrema, Belo Horizonte, etc.)
 * 2. Correção da Data: Só preenche a data de "Recebido" se a pessoa devolver o equipamento.
 * 3. Busca Global reforçada com nome normalizado.
 * 4. Alertas de E-mail com Destinatário e Cópia (CC)
 * 5. FILTRO EXCLUSIVO: Retorna e registra APENAS "Barra Funda".
 * 6. Aba por Data de Desligamento: usa a data de desligamento quando disponível.
 * 7. Correção lógica: se o colaborador já existe em mês anterior, atualiza a aba original.
 */

var CFG = {
  SPREADSHEET_ID: "1Ik_6Fr9okKUp2EiRAj0I1tE_m-u5wsGzodjAGg3GQa8",
  EMAIL_RESPONSAVEL: "maria.sousa@dafiti.com.br",
  EMAIL_COPIA: "erivaldo.siqueira@dafiti.com.br",
  ALERTAS_FILIAIS: {
    "Belo Horizonte": {
      to: "leila.gomes@dafiti.com.br",
      cc: "saulo.junior@dafiti.com.br,erivaldo.siqueira@dafiti.com.br"
    },
    "Extrema": {
      to: "guilherme.santos@dafiti.com.br",
      cc: "erivaldo.siqueira@dafiti.com.br"
    }
  },
  REMETENTE_PLANILHA: "suporte.dafiti@dafiti.com.br",
  TIMEZONE: "GMT-3",
  MAX_THREADS: 50,
  ESTILO: {
    FONTE: "Montserrat",
    TAMANHO: 10,
    ALINHAMENTO: "center",
    COR_CABECALHO: "#f3f4f6"
  }
};

var WEB_AUTH_MAX_SKEW_SECONDS = 300;
var WEB_AUTH_AUDIENCE = "desligados";

function stableStringify_(value) {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify_).join(",") + "]";
  return "{" + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ":" + stableStringify_(value[key]);
  }).join(",") + "}";
}

function bytesToHex_(bytes) {
  return bytes.map(function (value) {
    var normalized = value < 0 ? value + 256 : value;
    return ("0" + normalized.toString(16)).slice(-2);
  }).join("");
}

function verifyWebRequestAuth_(method, action, payload, auth) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty("BACKEND_SHARED_SECRET");
    if (!secret || secret.length < 32) return false;
    var timestamp = String(auth.timestamp || auth.authTimestamp || "");
    var nonce = String(auth.nonce || auth.authNonce || "");
    var supplied = String(auth.signature || auth.authSignature || "").toLowerCase();
    if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{32,128}$/i.test(nonce) || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
    if (Math.abs(Math.floor(new Date().getTime() / 1000) - Number(timestamp)) > WEB_AUTH_MAX_SKEW_SECONDS) return false;
    var digest = bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, stableStringify_(payload), Utilities.Charset.UTF_8));
    var canonical = [String(method).toUpperCase(), WEB_AUTH_AUDIENCE, String(action), timestamp, nonce, digest].join("\n");
    var expected = bytesToHex_(Utilities.computeHmacSha256Signature(canonical, secret, Utilities.Charset.UTF_8));
    var difference = 0;
    for (var i = 0; i < 64; i++) difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
    if (difference !== 0) return false;
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return false;
    try {
      var cache = CacheService.getScriptCache();
      var cacheKey = "web-auth:" + nonce;
      if (cache.get(cacheKey)) return false;
      cache.put(cacheKey, "1", WEB_AUTH_MAX_SKEW_SECONDS);
      return true;
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return false;
  }
}

function hasDuplicateSecurityParams_(e) {
  if (!e || !e.parameters) return false;
  return ["action", "authTimestamp", "authNonce", "authSignature", "payload"].some(function (key) {
    return e.parameters[key] && e.parameters[key].length !== 1;
  });
}

function isSignedGetRequest_(e, action) {
  if (hasDuplicateSecurityParams_(e)) return false;
  var params = (e && e.parameter) || {};
  var payload = {};
  Object.keys(params).sort().forEach(function (key) {
    if (["action", "authTimestamp", "authNonce", "authSignature"].indexOf(key) === -1) payload[key] = String(params[key]);
  });
  return verifyWebRequestAuth_("GET", action, payload, params);
}

function authenticatePostPayload_(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  var action = String(payload.action || "registerDesligamento");
  if (action !== "registerDesligamento") return false;
  var unsignedPayload = {};
  Object.keys(payload).forEach(function (key) {
    if (key !== "auth") unsignedPayload[key] = payload[key];
  });
  if (!verifyWebRequestAuth_("POST", action, unsignedPayload, payload.auth || {})) return false;
  delete payload.auth;
  return true;
}

var MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

var EQUIP_VARIATIONS = (function () {
  var map = {
    "Notebook": ["notebook", "notbook", "notebock", "note", "laptop", "notes", "notebooks"],
    "Fonte": ["fonte", "font", "fontes", "carregador", "carreg"],
    "Mouse": ["mouse", "mouses", "mous"],
    "Monitor": ["monitor", "monitores", "tela", "monit"],
    "Celular": ["celular", "celulares", "iphone", "android", "cel"],
    "Teclado": ["teclado", "teclados", "tec"],
    "Macbook": ["macbook", "mac", "macbooks", "mac book"],
    "Headset": ["headset", "headsets", "fone", "fones", "headphone", "head"],
    "Adaptador": ["adaptador", "adaptadores", "adap"],
    "Mochila": ["mochila", "mochilas", "bag"]
  };

  var reverse = {};

  for (var std in map) {
    if (map.hasOwnProperty(std)) {
      var vars = map[std];

      for (var i = 0; i < vars.length; i++) {
        reverse[vars[i]] = std;
      }
    }
  }

  return reverse;
})();

var EQUIP_REGEX = /(\d+)\s*[xX]?\s*([^0-9,+]+?)(?=\s*\d|\s*[+,]|$)/g;

function isFilialPermitida(filial) {
  if (!filial) return false;

  var str = normalizarTexto(filial);

  return str.indexOf("barra funda") !== -1 ||
         str.indexOf("extrema") !== -1 ||
         str.indexOf("belo horizonte") !== -1 ||
         str === "bf" || str === "sp" ||
         str === "bh" || str === "mg - bh" ||
         str === "cd extrema" || str === "mg - extrema";
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
}

function nowDateStr() {
  return Utilities.formatDate(new Date(), CFG.TIMEZONE, "dd/MM/yyyy");
}

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return "";

  return valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isTextoVazio(valor) {
  return (
    valor === null ||
    valor === undefined ||
    valor.toString().trim() === ""
  );
}

function ensureRowLength(row, minLength) {
  var arr = row ? row.slice() : [];

  while (arr.length < minLength) {
    arr.push("");
  }

  return arr;
}

function simplificarChaveCabecalho(valor) {
  return normalizarTexto(valor)
    .replace(/[.\-_/()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeaderIndex(headerRow) {
  var idx = {};

  if (!headerRow) return idx;

  for (var i = 0; i < headerRow.length; i++) {
    var normal = normalizarTexto(headerRow[i]);
    var simples = simplificarChaveCabecalho(headerRow[i]);

    if (normal) idx[normal] = i;
    if (simples) idx[simples] = i;
  }

  return idx;
}

function getHeaderIndex(headerIndex, nomesPossiveis, fallback) {
  if (!headerIndex) return fallback;

  for (var i = 0; i < nomesPossiveis.length; i++) {
    var normal = normalizarTexto(nomesPossiveis[i]);
    var simples = simplificarChaveCabecalho(nomesPossiveis[i]);

    if (headerIndex.hasOwnProperty(normal)) {
      return headerIndex[normal];
    }

    if (headerIndex.hasOwnProperty(simples)) {
      return headerIndex[simples];
    }
  }

  return fallback;
}

function getCell(row, index) {
  if (!row || index === null || index === undefined || index < 0) return "";
  return row[index];
}

function ensureMonthSheet(ss, date) {
  var name = MONTHS[date.getMonth()] + date.getFullYear();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 9).setValues([[
      "COLABORADOR", "CARGO", "DESLIGAMENTO", "RECEBIDO",
      "FILIAL", "E-MAIL", "Equip. Devolvido", "Controle Maju", "Equipamento(s) e Quantidade"
    ]]);

    aplicarEstiloMontserrat(sheet.getRange(1, 1, 1, 9), true);
  }

  return sheet;
}

function parseDateSafe(dateString) {
  if (dateString instanceof Date) {
    return isNaN(dateString.getTime()) ? null : dateString;
  }

  if (typeof dateString === "number" && !isNaN(dateString)) {
    if (dateString > 20000 && dateString < 80000) {
      return new Date(Math.round((dateString - 25569) * 86400 * 1000));
    }
  }

  if (!dateString || typeof dateString !== "string" || dateString.trim() === "") {
    return null;
  }

  var clean = dateString.trim();

  if (clean.indexOf("-") !== -1) {
    var partsIso = clean.split("T")[0].split("-");

    if (partsIso.length === 3) {
      var dateIso = new Date(
        parseInt(partsIso[0], 10),
        parseInt(partsIso[1], 10) - 1,
        parseInt(partsIso[2], 10)
      );

      if (!isNaN(dateIso.getTime())) return dateIso;
    }
  }

  if (clean.indexOf("/") !== -1) {
    var partsBr = clean.split(" ")[0].split("/");

    if (partsBr.length === 3) {
      var dateBr = new Date(
        parseInt(partsBr[2], 10),
        parseInt(partsBr[1], 10) - 1,
        parseInt(partsBr[0], 10)
      );

      if (!isNaN(dateBr.getTime())) return dateBr;
    }
  }

  var parsed = new Date(clean);

  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

function getTargetSheetByDesligamento(ss, desligamento) {
  var dataDesligamento = parseDateSafe(desligamento);

  if (dataDesligamento) {
    return ensureMonthSheet(ss, dataDesligamento);
  }

  console.warn(
    "Data de desligamento ausente ou inválida. Usando aba do mês atual como fallback. Valor recebido: " +
    desligamento
  );

  return ensureMonthSheet(ss, new Date());
}

function aplicarEstiloMontserrat(range, isHeader) {
  range
    .setFontFamily(CFG.ESTILO.FONTE)
    .setFontSize(CFG.ESTILO.TAMANHO)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment(CFG.ESTILO.ALINHAMENTO);

  if (isHeader) {
    range
      .setFontWeight("bold")
      .setBackground(CFG.ESTILO.COR_CABECALHO);
  }
}

function detectarLinhaCabecalho(data) {
  if (!data || data.length === 0) {
    return { found: false, rowIndex: 0, headerIndex: {}, idxNome: -1 };
  }

  var limite = Math.min(data.length, 10);

  for (var r = 0; r < limite; r++) {
    var headerIndex = buildHeaderIndex(data[r]);
    var idxNome = getHeaderIndex(headerIndex, ["colaborador", "nome"], -1);

    if (idxNome !== -1) {
      return { found: true, rowIndex: r, headerIndex: headerIndex, idxNome: idxNome };
    }
  }

  var fallbackHeaderIndex = buildHeaderIndex(data[0]);

  return {
    found: false,
    rowIndex: 0,
    headerIndex: fallbackHeaderIndex,
    idxNome: getHeaderIndex(fallbackHeaderIndex, ["colaborador", "nome"], 0)
  };
}

function getSheetMonthYear(sheetName) {
  var normalized = normalizarTexto(sheetName);
  var monthIndex = -1;

  for (var i = 0; i < MONTHS.length; i++) {
    if (normalized.indexOf(normalizarTexto(MONTHS[i])) !== -1) {
      monthIndex = i;
      break;
    }
  }

  var yearMatch = normalized.match(/(19\d{2}|20\d{2})/);

  if (monthIndex === -1 || !yearMatch) {
    return null;
  }

  return { month: monthIndex, year: parseInt(yearMatch[1], 10) };
}

function isOfficialMonthSheetProd_(sheetName) {
  var info = getSheetMonthYear(sheetName);
  if (!info) return false;

  var normalizedName = normalizarTexto(sheetName).replace(/\s+/g, "");
  var officialName = normalizarTexto(MONTHS[info.month]) + String(info.year);
  return normalizedName === officialName;
}

function sheetMatchesDesligamento(sheetName, desligamento) {
  var dataDesligamento = parseDateSafe(desligamento);
  if (!dataDesligamento) return false;

  var sheetInfo = getSheetMonthYear(sheetName);
  if (!sheetInfo) return false;

  return (
    sheetInfo.month === dataDesligamento.getMonth() &&
    sheetInfo.year === dataDesligamento.getFullYear()
  );
}

function calcularScoreMatchColaborador(match) {
  var score = 0;

  var idxDesligamento = getHeaderIndex(match.headerIndex, ["desligamento", "data desligamento"], 2);
  var idxEquipDev = getHeaderIndex(match.headerIndex, ["equip. devolvido", "equip devolvido"], 6);

  var desligamento = getCell(match.dadosExistentes, idxDesligamento);
  var dataDesligamento = parseDateSafe(desligamento);

  if (dataDesligamento) score += 50;
  if (sheetMatchesDesligamento(match.aba.getName(), desligamento)) score += 50;

  var statusDev = normalizarTexto(getCell(match.dadosExistentes, idxEquipDev));
  if (statusDev !== "devolvido" && statusDev !== "desligamento") score += 10;

  return score;
}

function buscarColaboradorGlobal(ss, nome) {
  if (!nome) return null;

  var sheets = ss.getSheets();
  var search = normalizarTexto(nome);
  var matches = [];

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (sheet.getLastRow() < 2) continue;

    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) continue;

    var headerInfo = detectarLinhaCabecalho(data);
    var sheetMonthInfo = getSheetMonthYear(sheet.getName());

    if (!headerInfo.found && !sheetMonthInfo) continue;

    var idxNome = headerInfo.idxNome;
    if (idxNome === -1) continue;

    for (var i = headerInfo.rowIndex + 1; i < data.length; i++) {
      var nomePlanilha = normalizarTexto(data[i][idxNome]);
      if (!nomePlanilha) continue;

      if (nomePlanilha === search) {
        matches.push({
          aba: sheet,
          linha: i + 1,
          dadosExistentes: data[i],
          headers: data[headerInfo.rowIndex].map(function (h) { return normalizarTexto(h); }),
          headerIndex: headerInfo.headerIndex,
          headerRowIndex: headerInfo.rowIndex + 1
        });
      }
    }
  }

  if (matches.length === 0) return null;

  matches.forEach(function (match) {
    match.score = calcularScoreMatchColaborador(match);
  });

  matches.sort(function (a, b) {
    return b.score - a.score;
  });

  return matches[0];
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getDashboardData";
    if (["getDashboardData", "getDashboardSummary"].indexOf(action) === -1) {
      throw new Error("Ação GET inválida para Desligados: " + action);
    }
    if (!isSignedGetRequest_(e, action)) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === "getDashboardData" || action === "getDashboardSummary") {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: getDashboardSummary()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = getSpreadsheet();
    var sheets = ss.getSheets();

    var totalDes = 0;
    var mesAtDes = 0;
    var resMensal = {};
    var equipRank = {};
    var pends = [];
    var recentReturns = [];

    var now = new Date();
    var curYr = now.getFullYear();

    sheets.forEach(function (sheet) {
      if (sheet.getLastRow() < 2) return;

      var sheetName = sheet.getName();
      if (!isOfficialMonthSheetProd_(sheetName)) return;
      var fMonth = -1;
      var sYear = curYr.toString();

      var yMatch = sheetName.match(/\d{4}/);
      if (yMatch) sYear = yMatch[0];

      for (var i = 0; i < MONTHS.length; i++) {
        if (normalizarTexto(sheetName).indexOf(normalizarTexto(MONTHS[i])) !== -1) {
          fMonth = i;
          break;
        }
      }

      if (fMonth === -1) return;

      var data = sheet.getDataRange().getValues();
      var hd = data[0].map(function (h) { return h.toString().toLowerCase().trim(); });
      var idx = {};
      hd.forEach(function (h, i) { idx[h] = i; });

      var key = MONTHS[fMonth] + "|" + sYear;
      if (!resMensal[key]) {
        resMensal[key] = { count: 0, equip: 0 };
      }

      for (var row = 1; row < data.length; row++) {
        var nome = data[row][idx["colaborador"]];
        if (!nome || nome.toString().trim() === "") continue;

        var filialObj = data[row][idx["filial"]];
        if (!isFilialPermitida(filialObj)) continue;

        resMensal[key].count++;
        totalDes++;

        if (fMonth === now.getMonth() && sYear == curYr) {
          mesAtDes++;
        }

        var dev = idx["equip. devolvido"] !== undefined
          ? data[row][idx["equip. devolvido"]].toString().trim().toLowerCase()
          : "";

        var isDevolvido = dev === "devolvido" || dev === "desligamento";

        var equipStr = idx["equipamento(s) e quantidade"] !== undefined
          ? data[row][idx["equipamento(s) e quantidade"]]
          : "";

        if (!isDevolvido) {
          var rawDate = data[row][idx["desligamento"]];
          var diffDays = rawDate instanceof Date
            ? Math.ceil(Math.abs(now - rawDate) / (1000 * 60 * 60 * 24))
            : 0;

          pends.push({
            name: nome.toString(),
            date: rawDate instanceof Date
              ? Utilities.formatDate(rawDate, "GMT-3", "dd/MM/yyyy")
              : "N/A",
            filial: filialObj || "N/A",
            priority: diffDays > 7 ? "ALTA" : "NORMAL"
          });
        } else {
          var idxRecebido = idx["recebido"] !== undefined ? idx["recebido"] :
            idx["recebimento"] !== undefined ? idx["recebimento"] :
            idx["data recebido"] !== undefined ? idx["data recebido"] :
            idx["data"] !== undefined ? idx["data"] : undefined;

          var recDateStr = idxRecebido !== undefined ? data[row][idxRecebido] : undefined;
          if (!recDateStr) recDateStr = data[row][idx["desligamento"]];

          var recDate = null;
          if (recDateStr instanceof Date) {
            recDate = recDateStr;
          } else if (typeof recDateStr === "string" && recDateStr.trim() !== "") {
            var dateOnly = recDateStr.split(" ")[0];
            var parts = dateOnly.split("/");
            if (parts.length === 3) {
              recDate = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
              recDate = new Date(recDateStr);
            }
          }

          if (recDate && !isNaN(recDate.getTime())) {
            var diffDaysRec = Math.ceil(
              Math.abs(now.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (diffDaysRec <= 31) {
              recentReturns.push({
                name: nome.toString(),
                date: recDate instanceof Date
                  ? Utilities.formatDate(recDate, "GMT-3", "dd/MM/yyyy")
                  : typeof recDateStr === "string" ? recDateStr : "N/A",
                equipments: equipStr.toString() || "Não especificado",
                timestamp: recDate.getTime(),
                filial: normalizarFilialProd_(filialObj) || "Barra Funda"
              });
            }
          }
        }

        if (equipStr && isDevolvido) {
          var items = parseEquipments(equipStr);
          items.forEach(function (it) {
            resMensal[key].equip += it.qty;
            equipRank[it.name] = (equipRank[it.name] || 0) + it.qty;
          });
        }
      }
    });

    recentReturns.sort(function (a, b) {
      return b.timestamp - a.timestamp;
    });

    var sortedKeys = Object.keys(resMensal).sort(function (a, b) {
      var pA = a.split("|");
      var pB = b.split("|");
      if (pA[1] !== pB[1]) return pA[1] - pB[1];
      return MONTHS.indexOf(pA[0]) - MONTHS.indexOf(pB[0]);
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: {
        totalDesligamentos: totalDes,
        desligamentosMesAtual: mesAtDes,
        mensalData: sortedKeys.map(function (k) {
          return { month: k.replace("|", " "), count: resMensal[k].count };
        }),
        equipamentosMensal: sortedKeys.map(function (k) {
          return { month: k.replace("|", " "), count: resMensal[k].equip };
        }),
        equipamentosRanking: Object.keys(equipRank).map(function (k) {
          return { name: k, count: equipRank[k] };
        }).sort(function (a, b) {
          return b.count - a.count;
        }).slice(0, 10),
        pendencias: pends.reverse().slice(0, 15),
        recentReturns: recentReturns.slice(0, 50),
        lastUpdate: new Date().toLocaleTimeString("pt-BR")
      }
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message,
      stack: err.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Nenhum dado foi recebido no POST.");
    }

    var contents = parsePostBody_(e);
    if (!contents || typeof contents !== "object" || Array.isArray(contents)) {
      throw new Error("O conteúdo recebido não possui um objeto JSON válido.");
    }
    if (hasDuplicateSecurityParams_(e) || !authenticatePostPayload_(contents)) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    contents.equipDevolvido = contents.equipDevolvido || "Devolvido";
    contents.controleMaju = contents.controleMaju || "Entregue";
    contents.origem = contents.origem || "Portal Web";

    var registroSalvo = registrarNaPlanilha(contents);

    // A falha no Slack não pode desfazer o cadastro já salvo.
    var slackEnviado = false;
    var erroSlack = null;

    try {
      notificarNovoColaboradorSlack({
        colaborador: contents.colaborador,
        equipamentoQuantidade:
          contents.equipamentoQuantidade ||
          contents.equipamentos ||
          "Não informado",
        equipDevolvido: contents.equipDevolvido,
        filial: contents.filial || "Barra Funda",
        origem: contents.origem
      });

      slackEnviado = true;
    } catch (erro) {
      erroSlack = erro.toString();
      console.error("Cadastro salvo, mas a notificação Slack falhou: " + erroSlack);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      colaborador: contents.colaborador || null,
      registroSalvo: registroSalvo || null,
      slackEnviado: slackEnviado,
      erroSlack: erroSlack
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function notificarNovoColaboradorSlack(dados) {
  var webhookUrl = PropertiesService
    .getScriptProperties()
    .getProperty("SLACK_WEBHOOK_URL");

  if (!webhookUrl) {
    throw new Error(
      "A propriedade SLACK_WEBHOOK_URL não está configurada no projeto."
    );
  }

  var dataAtual = Utilities.formatDate(
    new Date(),
    CFG.TIMEZONE,
    "dd/MM/yyyy HH:mm"
  );

  var payload = {
    text: "📦 Equipamento registrado e disponível para coleta na recepção.",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📦 Equipamento disponível para coleta"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Um novo equipamento foi registrado e está disponível para coleta na recepção.*"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Colaborador:*\n" + (dados.colaborador || "Não informado")
          },
          {
            type: "mrkdwn",
            text: "*Quantidade de equipamentos:*\n" +
              (dados.equipamentoQuantidade || "Não informado")
          },
          {
            type: "mrkdwn",
            text: "*Status:*\n" +
              (dados.equipDevolvido || "Devolvido")
          },
          {
            type: "mrkdwn",
            text: "*Filial:*\n" + (dados.filial || "Barra Funda")
          },
          {
            type: "mrkdwn",
            text: "*Local de coleta:*\nRecepção"
          },
          {
            type: "mrkdwn",
            text: "*Data do registro:*\n" + dataAtual
          }
        ]
      }
    ]
  };

  var resposta = UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var status = resposta.getResponseCode();
  var corpoResposta = resposta.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      "Falha ao enviar notificação ao Slack. HTTP " +
      status +
      ": " +
      corpoResposta
    );
  }

  console.log(
    "Notificação Slack enviada para o colaborador: " +
    (dados.colaborador || "Não informado")
  );

  return true;
}

function parsePostBody_(e) {
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  var contents = e.postData.contents;
  var trimmed = contents.toString().trim();

  if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
    return JSON.parse(trimmed);
  }

  var params = {};
  trimmed.split("&").forEach(function (part) {
    if (!part) return;

    var pair = part.split("=");
    var key = decodeURIComponent((pair[0] || "").replace(/\+/g, " "));
    var value = decodeURIComponent((pair.slice(1).join("=") || "").replace(/\+/g, " "));

    if (key) params[key] = value;
  });

  if (params.payload) {
    return JSON.parse(params.payload);
  }

  return params;
}

function registrarNaPlanilha(contents) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = getSpreadsheet();
    var novoStatusDev = contents.equipDevolvido || "Pendente";
    var novoStatusMaju = contents.controleMaju || "Não Entregue";
    var obs = contents.equipamentoQuantidade || contents.equipamentos || contents.origem || "Portal Web";
    var origemNormalizada = normalizarTexto(contents.origem);
    var veioDoPortal = origemNormalizada.indexOf("portal web") !== -1;
    var isFromEmail = origemNormalizada.indexOf("email automato") !== -1 || origemNormalizada.indexOf("importado") !== -1;

    var encontrada = buscarColaboradorGlobal(ss, contents.colaborador);

    if (encontrada) {
      var sheet = encontrada.aba;
      var existing = ensureRowLength(encontrada.dadosExistentes, 9).slice(0, 9);
      var headerIndex = encontrada.headerIndex || buildHeaderIndex(encontrada.headers);

      function getIdx(nomesPossiveis, fallback) {
        return getHeaderIndex(headerIndex, nomesPossiveis, fallback);
      }

      var idxColaborador = getIdx(["colaborador", "nome"], 0);
      var idxCargo = getIdx(["cargo"], 1);
      var idxDesligamento = getIdx(["desligamento", "data desligamento"], 2);
      var idxRecebido = getIdx(["recebido", "recebimento", "data recebido"], 3);
      var idxFilial = getIdx(["filial"], 4);
      var idxEmail = getIdx(["e-mail", "email"], 5);
      var idxEquipDev = getIdx(["equip. devolvido", "equip devolvido"], 6);
      var idxMaju = getIdx(["controle maju"], 7);
      var idxEquips = getIdx(["equipamento(s) e quantidade", "equipamentos e quantidade"], 8);

      existing[idxColaborador] = contents.colaborador || existing[idxColaborador];
      if (contents.cargo) existing[idxCargo] = contents.cargo;
      if (isTextoVazio(existing[idxDesligamento])) existing[idxDesligamento] = contents.desligamento || "";
      if (contents.filial) existing[idxFilial] = contents.filial;
      if (isFromEmail || isTextoVazio(existing[idxEmail])) {
        existing[idxEmail] = contents.email || existing[idxEmail];
      }

      if (normalizarTexto(novoStatusDev) === "devolvido" || normalizarTexto(novoStatusDev) === "desligamento") {
        if (veioDoPortal && isTextoVazio(existing[idxRecebido])) {
          existing[idxRecebido] = nowDateStr();
        }
        existing[idxEquipDev] = novoStatusDev;
        existing[idxMaju] = "Entregue";
        existing[idxEquips] = obs;
      }

      var range = sheet.getRange(encontrada.linha, 1, 1, 9);
      range.setValues([existing]);
      aplicarEstiloMontserrat(range, false);
    } else {
      var dataDesligamento = parseDateSafe(contents.desligamento);
      var sheetAtual = dataDesligamento
        ? getTargetSheetByDesligamento(ss, contents.desligamento)
        : ensureMonthSheet(ss, new Date());

      var rowData = [[
        contents.colaborador || "",
        contents.cargo || "",
        contents.desligamento || "",
        veioDoPortal && normalizarTexto(novoStatusDev) === "devolvido" ? nowDateStr() : "",
        contents.filial || "",
        contents.email || "",
        novoStatusDev,
        novoStatusMaju,
        obs
      ]];

      var nextRow = sheetAtual.getLastRow() + 1;
      sheetAtual.getRange(nextRow, 1, 1, 9).setValues(rowData);
      aplicarEstiloMontserrat(sheetAtual.getRange(nextRow, 1, 1, 9), false);
    }
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function processarEmailsRecebidos() {
  var query = "from:" + CFG.REMETENTE_PLANILHA + " has:attachment is:unread filename:(xlsx OR xls OR csv)";
  var threads = GmailApp.search(query, 0, CFG.MAX_THREADS);

  if (!threads || threads.length === 0) return;

  for (var i = 0; i < threads.length; i++) {
    try {
      var msgs = threads[i].getMessages();
      if (!msgs || msgs.length === 0) continue;

      var lastMessage = msgs[msgs.length - 1];
      var attachments = lastMessage.getAttachments({ includeInlineImages: false });
      if (!attachments || attachments.length === 0) continue;

      for (var k = 0; k < attachments.length; k++) {
        var attachment = attachments[k];
        var fileName = attachment.getName() || "Arquivo_Sem_Nome";
        if (!/\.(xlsx|xls|csv)$/i.test(fileName)) continue;

        var rawData = extrairDadosDoAnexoV3(attachment);
        if (rawData && rawData.length > 0) {
          var headerRowIdx = -1;

          for (var r = 0; r < Math.min(rawData.length, 15); r++) {
            var rowStr = rawData[r].join("|").toLowerCase();
            if (rowStr.indexOf("nome") !== -1 && rowStr.indexOf("cargo") !== -1) {
              headerRowIdx = r;
              break;
            }
          }

          if (headerRowIdx === -1) continue;

          var headers = rawData[headerRowIdx].map(function (h) {
            return h ? h.toString().toLowerCase().trim() : "";
          });

          var iNome = headers.indexOf("nome");
          var iEmail = headers.indexOf("e-mail") !== -1 ? headers.indexOf("e-mail") : headers.indexOf("email");
          var iCargo = headers.indexOf("cargo");
          var iDeslig = headers.indexOf("desligamento");
          var iFilial = headers.indexOf("filial");

          if (iNome === -1) continue;

          var rows = rawData.slice(headerRowIdx + 1);
          rows.forEach(function (row) {
            var nomeColab = row[iNome];
            if (nomeColab && nomeColab.toString().trim() !== "" && nomeColab.toString().toLowerCase().indexOf("nome") === -1) {
              var filialLida = iFilial !== -1 && row[iFilial] ? row[iFilial].toString().trim() : "";
              if (isFilialPermitida(filialLida)) {
                var payload = {
                  colaborador: nomeColab.toString().trim(),
                  email: iEmail !== -1 && row[iEmail] ? row[iEmail].toString().trim() : "",
                  cargo: iCargo !== -1 && row[iCargo] ? row[iCargo].toString().trim() : "",
                  desligamento: iDeslig !== -1 && row[iDeslig] ? row[iDeslig] : "",
                  filial: filialLida,
                  origem: "Email Autômato (" + fileName + ")"
                };

                registrarNaPlanilha(payload);
              }
            }
          });
        }
      }

      threads[i].markRead();
    } catch (e) {
      console.error("Falha no bloco: " + e.message);
    }
  }
}

function extrairDadosDoAnexoV3(anexo) {
  var rawBlob = anexo.copyBlob();
  var bytes = rawBlob.getBytes();
  var name = anexo.getName();
  var contentType = "application/octet-stream";

  if (name.toLowerCase().endsWith(".xlsx")) {
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (name.toLowerCase().endsWith(".xls")) {
    contentType = "application/vnd.ms-excel";
  } else if (name.toLowerCase().endsWith(".csv")) {
    contentType = "text/csv";
  }

  var cleanBlob = Utilities.newBlob(bytes, contentType, "SCAN_" + name);
  var resource = {
    name: "TEMP_" + Utilities.getUuid(),
    mimeType: "application/vnd.google-apps.spreadsheet"
  };

  var file = Drive.Files.create(resource, cleanBlob);
  var spreadsheet = SpreadsheetApp.openById(file.id);
  var data = spreadsheet.getSheets()[0].getDataRange().getValues();

  Drive.Files.remove(file.id);
  return data;
}

function enviarAlertasPrioridadeAlta() {
  var ss = getSpreadsheet();
  var sheets = ss.getSheets();
  var now = new Date();
  var pendenciasAltas = [];

  sheets.forEach(function (sheet) {
    if (sheet.getLastRow() < 2) return;

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function (h) {
      return h.toString().toLowerCase().trim();
    });

    var idx = {};
    headers.forEach(function (h, i) { idx[h] = i; });

    for (var row = 1; row < data.length; row++) {
      var nome = data[row][idx["colaborador"]];
      if (!nome) continue;

      var filialObj = data[row][idx["filial"]];
      if (!isFilialPermitida(filialObj)) continue;

      var devStatus = (data[row][idx["equip. devolvido"]] || "").toString().trim().toLowerCase();
      if (devStatus !== "devolvido" && devStatus !== "desligamento") {
        var regDate = parseDateSafe(data[row][idx["desligamento"]]);
        if (regDate) {
          var diffDays = Math.ceil((now - regDate) / (1000 * 60 * 60 * 24));
          if (diffDays > 7) {
            pendenciasAltas.push({
              nome: nome,
              dias: diffDays,
              data: Utilities.formatDate(regDate, CFG.TIMEZONE, "dd/MM/yyyy"),
              filial: normalizarFilialProd_(filialObj)
            });
          }
        }
      }
    }
  });

  ["Barra Funda", "Belo Horizonte", "Extrema"].forEach(function (filial) {
    var pendencias = pendenciasAltas.filter(function (p) { return p.filial === filial; });
    if (!pendencias.length) return;
    pendencias.sort(function (a, b) { return b.dias - a.dias; });
    var destino = filial === "Barra Funda"
      ? { to: CFG.EMAIL_RESPONSAVEL, cc: CFG.EMAIL_COPIA }
      : CFG.ALERTAS_FILIAIS[filial];
    var html = '<div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;border:1px solid #1e293b;border-radius:12px;overflow:hidden;background:#fff">' +
      '<div style="background:#020617;padding:30px 20px;text-align:center;border-bottom:4px solid #f97316">' +
      '<h1 style="color:#fff;font-size:20px"><span style="color:#f97316">ALERTA</span> DE PENDÊNCIAS</h1>' +
      '<p style="color:#94a3b8">' + filial + ' — Atrasos críticos em devoluções</p></div>' +
      '<div style="padding:30px 20px;color:#334155"><p><strong>Atenção T.I,</strong><br>Existem <strong>' +
      pendencias.length + '</strong> ex-funcionários em ' + filial + ' com equipamentos pendentes há mais de 7 dias.</p>';
    pendencias.forEach(function (p) {
      html += '<div style="background:#f8fafc;border-left:4px solid #f97316;padding:12px;margin-bottom:10px">' +
        '<strong>' + escaparHtmlAlerta_(p.nome) + '</strong> (Filial: ' + filial + ')<br>' +
        '<span style="color:#b91c1c;font-weight:bold">' + p.dias + ' DIAS ATRASO</span> (Desde: ' + p.data + ')</div>';
    });
    html += '<div style="text-align:center;margin-top:30px"><a href="https://site-desligados.onrender.com/" ' +
      'style="background:#020617;color:#22d3ee;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold">' +
      'Acessar Dashboard</a></div></div></div>';
    MailApp.sendEmail({
      to: destino.to,
      cc: destino.cc,
      subject: "🕒 URGENTE: " + pendencias.length + " Pendências de Devolução (Offboarding) - " + filial,
      body: filial + " — Pendências acima de 7 dias:\n" + pendencias.map(function (p) {
        return p.nome + " — " + p.dias + " dias (desde " + p.data + ")";
      }).join("\n"),
      htmlBody: html
    });
  });
  return pendenciasAltas;
}

function escaparHtmlAlerta_(valor) {
  return String(valor).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function normalizeEquipmentName(name) {
  if (!name) return "";

  var clean = name.toString().replace(/[\(\)]/g, "").trim();
  var key = clean.toLowerCase();

  if (EQUIP_VARIATIONS[key]) return EQUIP_VARIATIONS[key];
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function parseEquipments(equipStr) {
  var res = [];
  if (!equipStr) return res;

  var str = equipStr.toString();
  if (/^email\s+automato\b/.test(normalizarTexto(str))) return res;
  EQUIP_REGEX.lastIndex = 0;

  var match;
  var found = false;

  while ((match = EQUIP_REGEX.exec(str)) !== null) {
    var norm = normalizeEquipmentName(match[2]);
    if (norm) {
      res.push({ qty: parseInt(match[1], 10), name: norm });
      found = true;
    }
  }

  if (!found) {
    var pts = str.split(/,|\+/);
    for (var i = 0; i < pts.length; i++) {
      var n = normalizeEquipmentName(pts[i]);
      if (n) res.push({ qty: 1, name: n });
    }
  }

  return res;
}

function getDashboardSummary() {
  var summary = obterResumoDashboardPersistidoProd();
  if (summary && summary.available && summary.filiais && summary.filiais["Todas"] && summary.filiais["Extrema"]) {
    return summary;
  }
  return processarResumoDashboardDiarioProd();
}

function obterResumoDashboardPersistidoProd() {
  var ss = getSpreadsheet();
  var sheetName = "Resumo_Dashboard";
  var sheet = ss.getSheetByName(sheetName);

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
      console.error("Erro ao fazer parse do resumo para chave " + key + ": " + e.message);
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

function processarResumoDashboardDiarioProd() {
  var ss = getSpreadsheet();
  var now = new Date();
  var timeZone = "America/Sao_Paulo";
  var currentSheetName = MONTHS[now.getMonth()] + now.getFullYear();

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
      desligamentosMesAtual: 0,
      currentMonthNames: {},
      porMes: {}
    };
  });

  var sheets = ss.getSheets();
  sheets.forEach(function (sheet) {
    if (sheet.getLastRow() < 2) return;
    var name = sheet.getName();
    if (name === "Resumo_Dashboard" || name === "Formulário" || name === "Configs") return;
    if (!isOfficialMonthSheetProd_(name)) return;
    var isCurrentMonthSheet = name === currentSheetName;

    var values = sheet.getDataRange().getValues();
    if (!values || values.length < 2) return;

    var headers = values[0].map(function (h) { return normalizarTexto(h); });
    var iNome = headers.indexOf("colaborador");
    if (iNome === -1) iNome = headers.indexOf("nome");
    if (iNome === -1) return;

    var iDeslig = headers.indexOf("desligamento");
    if (iDeslig === -1) iDeslig = headers.indexOf("data desligamento");

    var iRec = headers.indexOf("recebido");
    if (iRec === -1) iRec = headers.indexOf("data recebido");

    var iFilial = headers.indexOf("filial");
    var iEquipDev = headers.indexOf("equip. devolvido");
    if (iEquipDev === -1) iEquipDev = headers.indexOf("equip devolvido");

    var iEquip = getHeaderIndex(buildHeaderIndex(values[0]), [
      "equipamento(s) e quantidade",
      "equipamentos e quantidade",
      "equipamento/quantidade",
      "equipamento"
    ], -1);

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var colaborador = row[iNome];
      if (!colaborador || String(colaborador).trim() === "") continue;

      var filialRaw = iFilial !== -1 ? row[iFilial] : "";
      var filialNorm = normalizarFilialProd_(filialRaw);
      if (!filialNorm) continue;

      var deslig = iDeslig !== -1 ? row[iDeslig] : null;
      var desligDate = parseDateSafe(deslig);
      var sheetMonth = getSheetMonthYear(sheet.getName());
      var sheetDate = sheetMonth ? new Date(sheetMonth.year, sheetMonth.month, 1) : null;
      var monthDate = sheetDate || now;
      var monthKey = MONTHS[monthDate.getMonth()] + " " + monthDate.getFullYear();

      var equipStr = iEquip !== -1 ? row[iEquip] : "";
      var equips = parseEquipments(equipStr);

      var statusDev = iEquipDev !== -1 ? normalizarTexto(row[iEquipDev]) : "";
      var isDev = statusDev === "devolvido" || statusDev === "desligamento";

      var targets = ["Todas", filialNorm];
      targets.forEach(function (k) {
        var acc = accumulators[k];
        if (!acc.porMes[monthKey]) acc.porMes[monthKey] = { names: {}, ranking: {}, pendencias: [], recentReturns: [] };
        var monthly = acc.porMes[monthKey];
        monthly.names[normalizarTexto(colaborador)] = true;
        acc.totalDesligamentos += 1;
        acc.mensalMap[monthKey] = (acc.mensalMap[monthKey] || 0) + 1;

        if (isCurrentMonthSheet) {
          var personKey = normalizarTexto(colaborador);
          if (!acc.currentMonthNames[personKey]) {
            acc.currentMonthNames[personKey] = true;
            acc.desligamentosMesAtual += 1;
          }
        }

        (isDev ? equips : []).forEach(function (eq) {
          acc.equipamentosMensalMap[monthKey] = (acc.equipamentosMensalMap[monthKey] || 0) + eq.qty;
          acc.equipamentosRankingMap[eq.name] = (acc.equipamentosRankingMap[eq.name] || 0) + eq.qty;
          monthly.ranking[eq.name] = (monthly.ranking[eq.name] || 0) + eq.qty;
        });

        if (!isDev) {
          var diff = desligDate ? Math.ceil(Math.abs(now.getTime() - desligDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
          acc.pendenciasList.push({
            name: String(colaborador),
            date: (desligDate && !isNaN(desligDate.getTime())) ? Utilities.formatDate(desligDate, timeZone, "dd/MM/yyyy") : "N/A",
            filial: filialNorm,
            priority: diff > 7 ? "ALTA" : "NORMAL"
          });
          monthly.pendencias.push(acc.pendenciasList[acc.pendenciasList.length - 1]);
        } else {
          var rec = iRec !== -1 ? row[iRec] : null;
          var recDate = parseDateSafe(rec) || desligDate;
          monthly.recentReturns.push({
            name: String(colaborador),
            date: recDate ? Utilities.formatDate(recDate, timeZone, "dd/MM/yyyy") : "N/A",
            equipments: equipStr ? String(equipStr) : "Não especificado",
            timestamp: recDate ? recDate.getTime() : 0,
            filial: filialNorm
          });

          if (recDate && !isNaN(recDate.getTime())) {
            var diffRec = Math.ceil(Math.abs(now.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffRec <= 31) {
              acc.recentReturnsList.push({
                name: String(colaborador),
                date: Utilities.formatDate(recDate, timeZone, "dd/MM/yyyy"),
                equipments: equipStr ? String(equipStr) : "Não especificado",
                timestamp: recDate.getTime(),
                filial: filialNorm
              });
            }
          }
        }
      });
    }
  });

  var calculatedBranches = {};
  branchKeys.forEach(function (k) {
    var acc = accumulators[k];

    acc.recentReturnsList.sort(function (a, b) {
      return b.timestamp - a.timestamp;
    });

    var sortedMonths = Object.keys(acc.mensalMap).sort(compareMonthKeysProd_);

    var mensalData = sortedMonths.map(function (m) { return { month: m, count: acc.mensalMap[m] }; });
    var equipamentosMensal = sortedMonths.map(function (m) { return { month: m, count: acc.equipamentosMensalMap[m] || 0 }; });
    var equipamentosRanking = Object.keys(acc.equipamentosRankingMap)
      .map(function (name) { return { name: name, count: acc.equipamentosRankingMap[name] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 10);

    var porMes = {};
    sortedMonths.forEach(function (month) {
      var monthly = acc.porMes[month];
      var count = Object.keys(monthly.names).length;
      porMes[month] = {
        totalDesligamentos: count,
        desligamentosMesAtual: count,
        mensalData: [{ month: month, count: acc.mensalMap[month] }],
        equipamentosMensal: [{ month: month, count: acc.equipamentosMensalMap[month] || 0 }],
        equipamentosRanking: Object.keys(monthly.ranking).map(function (name) {
          return { name: name, count: monthly.ranking[name] };
        }).sort(function (a, b) { return b.count - a.count; }).slice(0, 10),
        pendencias: monthly.pendencias.slice().reverse().slice(0, 15),
        recentReturns: monthly.recentReturns.sort(function (a, b) { return b.timestamp - a.timestamp; }).slice(0, 50)
      };
    });
    calculatedBranches[k] = {
      porMes: porMes,
      totalDesligamentos: acc.totalDesligamentos,
      desligamentosMesAtual: acc.desligamentosMesAtual,
      mensalData: mensalData,
      equipamentosMensal: equipamentosMensal,
      equipamentosRanking: equipamentosRanking,
      pendencias: acc.pendenciasList.reverse().slice(0, 15),
      recentReturns: acc.recentReturnsList.slice(0, 50)
    };
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var genId = "GEN-" + Utilities.formatDate(now, timeZone, "yyyyMMdd-HHmmss") + "-" + Utilities.getUuid().slice(0, 6);
    var updatedStr = Utilities.formatDate(now, timeZone, "dd/MM/yyyy HH:mm:ss");

    var metaData = {
      formatVersion: 1,
      generationId: genId,
      updatedAt: updatedStr,
      status: "ready"
    };

    var sheet = ss.getSheetByName("Resumo_Dashboard");
    if (!sheet) {
      sheet = ss.insertSheet("Resumo_Dashboard");
    }

    var rows = [
      ["Chave", "Dados JSON", "Atualizado Em", "Generation ID"],
      ["METADATA", JSON.stringify(metaData), updatedStr, genId],
      ["Todas", JSON.stringify(calculatedBranches["Todas"]), updatedStr, genId],
      ["Barra Funda", JSON.stringify(calculatedBranches["Barra Funda"]), updatedStr, genId],
      ["Extrema", JSON.stringify(calculatedBranches["Extrema"]), updatedStr, genId],
      ["Belo Horizonte", JSON.stringify(calculatedBranches["Belo Horizonte"]), updatedStr, genId]
    ];

    sheet.clearContents();
    sheet.getRange(1, 1, rows.length, 4).setValues(rows);

    return {
      available: true,
      formatVersion: 1,
      generationId: genId,
      updatedAt: updatedStr,
      lastUpdate: updatedStr,
      filiais: calculatedBranches,
      ...calculatedBranches["Todas"]
    };
  } finally {
    lock.releaseLock();
  }
}

function compareMonthKeysProd_(a, b) {
  var months = MONTHS;
  function toTime(value) {
    var match = String(value || "").match(/^(.*?)\s+(19\d{2}|20\d{2})$/);
    if (!match) return null;
    var monthIndex = months.indexOf(match[1]);
    return monthIndex === -1 ? null : new Date(parseInt(match[2], 10), monthIndex, 1).getTime();
  }

  var timeA = toTime(a);
  var timeB = toTime(b);
  if (timeA === null && timeB === null) return String(a).localeCompare(String(b));
  if (timeA === null) return 1;
  if (timeB === null) return -1;
  return timeA - timeB;
}

function normalizarFilialProd_(filial) {
  var norm = normalizarTexto(filial);
  if (!norm) return null;
  if (norm.indexOf("barra funda") !== -1 || norm === "bf" || norm === "sp") return "Barra Funda";
  if (norm.indexOf("extrema") !== -1 || norm === "mg - extrema" || norm === "cd extrema") return "Extrema";
  if (norm.indexOf("belo horizonte") !== -1 || norm === "bh" || norm === "mg - bh") return "Belo Horizonte";
  return null;
}

function instalarGatilhoProcessamentoDiarioProd() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "processarResumoDashboardDiarioProd") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("processarResumoDashboardDiarioProd")
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .inTimezone("America/Sao_Paulo")
    .create();

  return processarResumoDashboardDiarioProd();
}
