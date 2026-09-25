import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const app = readFileSync("src/App.tsx", "utf8");

for (const token of [
  "import Motoboy from '@/src/components/Motoboy'",
  "const [motoboyPendingCount, setMotoboyPendingCount]",
  "'form' | 'dashboard' | 'motoboy'",
  "setView('motoboy')",
  "Motoboy",
  "motoboyPendingCount > 0"
]) {
  assert.ok(app.includes(token), `missing ${token}`);
}

console.log("motoboy navigation verified");
