import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");

assert.ok(
  server.includes("dataEnvioRecebimento: z.string().max(120"),
  "dataEnvioRecebimento must accept the composed shipping/receiving date label"
);

console.log("motoboy shipping validation contract verified");
