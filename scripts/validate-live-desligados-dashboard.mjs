import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";

function readEnvValue(name) {
  if (existsSync(".env")) {
    const env = readFileSync(".env", "utf8");
    const line = env.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim();
  }
  if (process.env[name] && process.env[name].trim()) {
    return process.env[name].trim();
  }
  return "";
}

const scriptUrl = readEnvValue("GOOGLE_SCRIPT_URL");
const sharedSecret = readEnvValue("APPS_SCRIPT_SHARED_SECRET");
assert.ok(scriptUrl, "GOOGLE_SCRIPT_URL must be configured in .env");
assert.ok(sharedSecret.length >= 32, "APPS_SCRIPT_SHARED_SECRET must have at least 32 characters");

const url = new URL(scriptUrl);
const action = "getDashboardData";
const timestamp = String(Math.floor(Date.now() / 1000));
const nonce = crypto.randomBytes(16).toString("hex");
const payloadDigest = crypto.createHash("sha256").update("{}").digest("hex");
const canonical = ["GET", "desligados", action, timestamp, nonce, payloadDigest].join("\n");
const signature = crypto.createHmac("sha256", sharedSecret).update(canonical).digest("hex");
url.searchParams.set("action", action);
url.searchParams.set("authTimestamp", timestamp);
url.searchParams.set("authNonce", nonce);
url.searchParams.set("authSignature", signature);

const response = await fetch(url, { redirect: "follow" });
const text = await response.text();

let payload;
try {
  payload = JSON.parse(text);
} catch {
  throw new Error(`Apps Script did not return JSON. First 120 chars: ${text.slice(0, 120)}`);
}

assert.equal(payload.success, true, payload.error || "Apps Script returned success=false");

const data = payload.data;
assert.ok(data, "Apps Script response must include data");

const issues = [];
const firstMonth = data.mensalData?.[0]?.month || "";
const firstEquipMonth = data.equipamentosMensal?.[0]?.month || "";

if (/^\d{2}\/\d{4}$/.test(firstMonth)) {
  issues.push(`mensalData still uses legacy month format: ${firstMonth}`);
}

if (/^\d{2}\/\d{4}$/.test(firstEquipMonth)) {
  issues.push(`equipamentosMensal still uses legacy month format: ${firstEquipMonth}`);
}

if (JSON.stringify(data.equipamentosMensal || []) === JSON.stringify(data.mensalData || [])) {
  issues.push("equipamentosMensal still mirrors mensalData instead of summing equipment quantities");
}

if (Array.isArray(data.pendencias) && data.pendencias.length === 0) {
  issues.push("pendencias is empty; confirm this is real data, not legacy fixed []");
}

if (Array.isArray(data.recentReturns) && data.recentReturns.length === 0) {
  issues.push("recentReturns is empty; confirm this is real data, not legacy fixed []");
}

console.log(JSON.stringify({
  totalDesligamentos: data.totalDesligamentos,
  desligamentosMesAtual: data.desligamentosMesAtual,
  mensalDataCount: data.mensalData?.length || 0,
  equipamentosMensalCount: data.equipamentosMensal?.length || 0,
  equipamentosRankingCount: data.equipamentosRanking?.length || 0,
  pendenciasCount: data.pendencias?.length || 0,
  recentReturnsCount: data.recentReturns?.length || 0,
  firstMonth,
  firstEquipMonth,
  lastUpdate: data.lastUpdate,
  issues,
}, null, 2));

assert.equal(issues.length, 0, `Dashboard payload still has ${issues.length} issue(s)`);
