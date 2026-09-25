import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const server = readFileSync("server.ts", "utf8");
const motoboy = readFileSync("src/components/Motoboy.tsx", "utf8");

assert.ok(
  server.includes("centroCusto: z.string().max(100, \"Centro de custo muito longo\").optional().default(\"\")"),
  "backend must allow empty Centro de Custo"
);

assert.ok(
  motoboy.includes('<Field label="Centro de Custo" value={form.centroCusto}'),
  "Centro de Custo field must remain visible"
);

assert.ok(
  !motoboy.includes('<Field label="Centro de Custo" value={form.centroCusto} onChange={(value) => setForm((prev) => ({ ...prev, centroCusto: value }))} required />'),
  "Centro de Custo field must not be required"
);

console.log("motoboy optional cost center verified");
