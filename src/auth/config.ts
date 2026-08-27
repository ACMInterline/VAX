import { isLiteralLoopbackOrUnspecifiedHostname } from "@/lib/url-security";

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
  const isLoopback = isLiteralLoopbackOrUnspecifiedHostname(
    parsedUrl.hostname,
  );
  const localHttp =
    environment.NODE_ENV !== "production" &&
    parsedUrl.protocol === "http:" &&
    isLoopback;
  if (
    (parsedUrl.protocol !== "https:" && !localHttp) ||
    (environment.NODE_ENV === "production" && isLoopback) ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.search !== "" ||
    parsedUrl.hash !== "" ||
    baseUrl.includes("?") ||
    baseUrl.includes("#")
  ) {
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
