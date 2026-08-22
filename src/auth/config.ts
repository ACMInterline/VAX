export type AuthRuntimeConfiguration = {
  baseUrl: string;
  cookieSecret: string;
  requireVerifiedEmail: boolean;
};

export function getAuthRuntimeConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthRuntimeConfiguration {
  const baseUrl = environment.NEON_AUTH_BASE_URL?.trim();
  const cookieSecret = environment.NEON_AUTH_COOKIE_SECRET?.trim();

  if (!baseUrl) {
    throw new Error("Authentication service is not configured.");
  }
  if (!cookieSecret || cookieSecret.length < 32) {
    throw new Error("Authentication cookie security is not configured.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("Authentication service is not configured.");
  }
  const localHttp =
    parsedUrl.protocol === "http:" &&
    (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1");
  if (parsedUrl.protocol !== "https:" && !localHttp) {
    throw new Error("Authentication service is not configured.");
  }

  return {
    baseUrl: parsedUrl.toString().replace(/\/$/, ""),
    cookieSecret,
    requireVerifiedEmail:
      environment.NODE_ENV === "production" ||
      environment.AUTH_REQUIRE_VERIFIED_EMAIL === "true",
  };
}
