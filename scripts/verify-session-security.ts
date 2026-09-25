import assert from "node:assert/strict";
import {
  requireSessionSecret,
  getSessionCookieOptions,
} from "../src/server/sessionSecurity.js";

function testSessionSecurity() {
  assert.throws(() => requireSessionSecret({} as any), /SESSION_SECRET/);
  assert.throws(
    () => requireSessionSecret({ SESSION_SECRET: "short" } as any),
    /at least 32/
  );

  const validSecret = "a".repeat(32);
  assert.equal(
    requireSessionSecret({ SESSION_SECRET: validSecret } as any),
    validSecret
  );

  const devOptions: Record<string, any> = getSessionCookieOptions({ NODE_ENV: "development" } as any);
  assert.equal(devOptions.secure, false);
  assert.equal(devOptions.httpOnly, true);
  assert.equal(devOptions.sameSite, "lax");
  assert.equal(devOptions.maxAge, undefined);

  const prodOptions: Record<string, any> = getSessionCookieOptions({ NODE_ENV: "production" } as any);
  assert.equal(prodOptions.secure, true);
  assert.equal(prodOptions.httpOnly, true);
  assert.equal(prodOptions.sameSite, "lax");
  assert.equal(prodOptions.maxAge, undefined);

  console.log("session security verified");
}

testSessionSecurity();
