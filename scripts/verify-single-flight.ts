import assert from "node:assert/strict";
import { createSingleFlight } from "../src/server/singleFlight.js";

async function testSingleFlight() {
  const singleFlight = createSingleFlight<number>();
  let executions = 0;

  const task = () =>
    singleFlight(async () => {
      executions += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return executions;
    });

  const [a, b, c] = await Promise.all([task(), task(), task()]);
  assert.equal(executions, 1, "Single flight should deduplicate concurrent runs");
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(c, 1);

  const d = await task();
  assert.equal(executions, 2, "Single flight allows subsequent runs after completion");
  assert.equal(d, 2);

  console.log("single flight verified");
}

testSingleFlight().catch((err) => {
  console.error(err);
  process.exit(1);
});
