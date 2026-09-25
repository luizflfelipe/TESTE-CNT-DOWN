import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const appsScripts = [
  readFileSync("apps-script/Desligados-prod.gs", "utf8"),
  readFileSync("apps-script/Controle-Motoboy-homologacao.gs", "utf8"),
];

for (const token of [
  "function createAppsScriptPostOptions(payload: unknown): RequestInit",
  "const body = new URLSearchParams()",
  "body.set(\"payload\", JSON.stringify(payload))",
  "\"Content-Type\": \"application/x-www-form-urlencoded;charset=UTF-8\"",
  "createSignedAppsScriptPostRequest",
  "APPS_SCRIPT_SHARED_SECRET",
  "createHmac(\"sha256\"",
]) {
  assert.ok(server.includes(token), `missing server token: ${token}`);
}

for (const appsScript of appsScripts) {
  for (const token of [
    "function verifyWebRequestAuth_",
    "BACKEND_SHARED_SECRET",
    "authenticatePostPayload_",
    "if (e.parameter && e.parameter.payload)",
    "return JSON.parse(e.parameter.payload)",
  ]) {
    assert.ok(appsScript.includes(token), `missing Apps Script token: ${token}`);
  }
}

console.log("signed apps script post payload contract verified");
