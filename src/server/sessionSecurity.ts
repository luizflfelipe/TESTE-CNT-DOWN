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
  const allowThirdPartyCookies = env.EMBED_THIRD_PARTY_COOKIES === "true";
  return {
    secure: isProd || allowThirdPartyCookies,
    sameSite: allowThirdPartyCookies ? "none" as const : "lax" as const,
    httpOnly: true as const,
    ...(allowThirdPartyCookies ? { partitioned: true as const } : {}),
  };
}
