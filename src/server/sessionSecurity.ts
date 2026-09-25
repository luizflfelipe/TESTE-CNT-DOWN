export function requireSessionSecret(env: NodeJS.ProcessEnv): string {
  const secret = env.SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error("SESSION_SECRET must be configured.");
  }

  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return secret;
}

export function getSessionCookieOptions(env: NodeJS.ProcessEnv) {
  const isProd = env.NODE_ENV === "production";
  return {
    secure: isProd,
    sameSite: "lax" as const,
    httpOnly: true as const,
  };
}

