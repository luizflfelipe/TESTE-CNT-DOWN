import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { after, before, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import vm from "node:vm";

const PROJECT_PORT = 3000;
const SHARED_SECRET = "apps-script-test-secret-with-at-least-32-bytes";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function digest(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function signature(method: string, audience: string, action: string, timestamp: string, nonce: string, payload: unknown): string {
  const canonical = [method.toUpperCase(), audience, action, timestamp, nonce, digest(payload)].join("\n");
  return crypto.createHmac("sha256", SHARED_SECRET).update(canonical).digest("hex");
}

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with ${child.exitCode}`);
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("server did not start in time");
}

function createAppsScriptSandbox(file: string) {
  const cache = new Map<string, string>();
  const sandbox: Record<string, any> = {
    console,
    Date,
    JSON,
    Math,
    Object,
    Array,
    String,
    Error,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => key === "BACKEND_SHARED_SECRET" ? SHARED_SECRET : null,
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key: string) => cache.get(key) ?? null,
        put: (key: string, value: string) => cache.set(key, value),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => true,
        releaseLock: () => undefined,
      }),
    },
    Utilities: {
      Charset: { UTF_8: "UTF_8" },
      DigestAlgorithm: { SHA_256: "SHA_256" },
      computeDigest: (_algorithm: string, input: string) => [...crypto.createHash("sha256").update(input).digest()].map((b) => b > 127 ? b - 256 : b),
      computeHmacSha256Signature: (input: string, secret: string) => [...crypto.createHmac("sha256", secret).update(input).digest()].map((b) => b > 127 ? b - 256 : b),
    },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }),
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox;
}

function signedGetEvent(audience: string, action: string, payload: Record<string, string> = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString("hex");
  return {
    parameter: {
      action,
      ...payload,
      authTimestamp: timestamp,
      authNonce: nonce,
      authSignature: signature("GET", audience, action, timestamp, nonce, payload),
    },
  };
}

let backend: ChildProcess;
let upstream: http.Server;
let upstreamPort = 0;
let observedSignedRequest = false;
let observedSignedPost = false;

before(async () => {
  upstream = http.createServer(async (req, res) => {
    if (req.method === "POST") {
      let rawBody = "";
      for await (const chunk of req) rawBody += chunk;
      const form = new URLSearchParams(rawBody);
      const envelope = JSON.parse(form.get("payload") || "{}");
      const { auth = {}, ...payload } = envelope;
      const action = String(payload.action || "");
      observedSignedPost = auth.signature === signature(
        "POST",
        "desligados",
        action,
        String(auth.timestamp || ""),
        String(auth.nonce || ""),
        payload,
      );
      res.writeHead(observedSignedPost ? 200 : 401, { "content-type": "application/json" });
      res.end(JSON.stringify(observedSignedPost
        ? { success: true, action, sheet: "test" }
        : { success: false, error: "Unauthorized" }));
      return;
    }

    const url = new URL(req.url || "/", "http://localhost");
    const action = url.searchParams.get("action") || "";
    const timestamp = url.searchParams.get("authTimestamp") || "";
    const nonce = url.searchParams.get("authNonce") || "";
    const supplied = url.searchParams.get("authSignature") || "";
    const payload: Record<string, string> = {};
    for (const [key, value] of url.searchParams) {
      if (!["action", "authTimestamp", "authNonce", "authSignature"].includes(key)) payload[key] = value;
    }
    observedSignedRequest = supplied === signature("GET", "desligados", action, timestamp, nonce, payload);
    res.writeHead(observedSignedRequest ? 200 : 401, { "content-type": "application/json" });
    res.end(JSON.stringify(observedSignedRequest
      ? { success: true, data: { totalDesligamentos: 0, mensalData: [], equipamentosMensal: [], equipamentosRanking: [], pendencias: [], recentReturns: [] } }
      : { success: false, error: "Unauthorized" }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  upstreamPort = (upstream.address() as any).port;

  backend = spawn("./node_modules/.bin/tsx", ["server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      SESSION_SECRET: "session-test-secret-with-at-least-32-characters",
      APPS_SCRIPT_SHARED_SECRET: SHARED_SECRET,
      GOOGLE_SCRIPT_URL: `http://127.0.0.1:${upstreamPort}/exec`,
      TI_PASSWORD: "test-ti-password",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(`http://127.0.0.1:${PROJECT_PORT}/api/auth/status`, backend);
});

after(async () => {
  backend?.kill("SIGTERM");
  await new Promise<void>((resolve) => upstream?.close(() => resolve()));
});

test("protected Express routes reject a request without a verified session", async () => {
  const response = await fetch(`http://127.0.0.1:${PROJECT_PORT}/api/dashboard-data`);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("an authenticated Express request signs the Google Apps Script request", async () => {
  const login = await fetch(`http://127.0.0.1:${PROJECT_PORT}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({ password: "test-ti-password" }),
  });
  assert.equal(login.status, 200);
  const setCookies = login.headers.getSetCookie();
  assert.ok(setCookies.length >= 2);
  const cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");

  const response = await fetch(`http://127.0.0.1:${PROJECT_PORT}/api/dashboard-data`, {
    headers: { cookie },
  });
  assert.equal(response.status, 200);
  assert.equal(observedSignedRequest, true);

  const register = await fetch(`http://127.0.0.1:${PROJECT_PORT}/api/register`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ colaborador: "Teste de Segurança", filial: "Barra Funda" }),
  });
  assert.equal(register.status, 200);
  assert.equal(observedSignedPost, true);
});

for (const file of [
  "apps-script/Desligados-prod.gs",
  "apps-script/Controle-Motoboy-homologacao.gs",
]) {
  const audience = file.includes("Motoboy") ? "motoboy" : "desligados";
  const readAction = file.includes("Motoboy") ? "ping" : "getDashboardData";
  test(`${file} rejects an unsigned request before accessing a spreadsheet`, () => {
    const sandbox = createAppsScriptSandbox(file);
    const result = sandbox.doGet({ parameter: { action: readAction } });
    const body = JSON.parse(result.text);
    assert.deepEqual(body, { success: false, error: "Unauthorized" });
  });

  test(`${file} accepts a fresh valid HMAC and rejects its replay`, () => {
    const sandbox = createAppsScriptSandbox(file);
    const event = signedGetEvent(audience, readAction);
    assert.equal(sandbox.verifyWebRequestAuth_("GET", readAction, {}, event.parameter), true);
    assert.equal(sandbox.verifyWebRequestAuth_("GET", readAction, {}, event.parameter), false);
  });

  test(`${file} rejects an unsigned POST before performing a write`, () => {
    const sandbox = createAppsScriptSandbox(file);
    const payload = file.includes("Motoboy")
      ? { action: "createMotoboyRequest", data: { id: "MOTO-TEST" } }
      : { action: "registerDesligamento", colaborador: "Teste" };
    const encoded = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
    const result = sandbox.doPost({
      parameter: { payload: JSON.stringify(payload) },
      parameters: { payload: [JSON.stringify(payload)] },
      postData: { contents: encoded },
    });
    assert.deepEqual(JSON.parse(result.text), { success: false, error: "Unauthorized" });
  });
}

test("the Motoboy maintenance action is not exposed through doGet", () => {
  const sandbox = createAppsScriptSandbox("apps-script/Controle-Motoboy-homologacao.gs");
  const result = sandbox.doGet(signedGetEvent("motoboy", "setupMotoboySheet"));
  const body = JSON.parse(result.text);
  assert.equal(body.success, false);
  assert.match(body.error, /inválida/i);
});
