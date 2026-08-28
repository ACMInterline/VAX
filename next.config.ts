import type { NextConfig } from "next";

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export function createBaselineSecurityHeaders(
  environment: RuntimeEnvironment = process.env,
) {
  const productionBuild = environment.NODE_ENV === "production";
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${productionBuild ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  const publicSiteUrl = environment.PUBLIC_SITE_URL?.trim();
  let secureHostedOrigin = false;
  try {
    const parsed = publicSiteUrl ? new URL(publicSiteUrl) : null;
    secureHostedOrigin =
      productionBuild &&
      parsed?.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === "";
  } catch {
    secureHostedOrigin = false;
  }

  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    ...(secureHostedOrigin
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ]
      : []),
  ];
}

const privatePageHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const stagingHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-VAX-Environment", value: "staging" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Avoid socket-backed PostCSS child processes in restricted build workers.
    turbopackPluginRuntimeStrategy: "workerThreads",
  },
  async headers() {
    return [
      { source: "/:path*", headers: createBaselineSecurityHeaders() },
      ...(process.env.VAX_ENVIRONMENT === "staging"
        ? [{ source: "/:path*", headers: stagingHeaders }]
        : []),
      { source: "/app/:path*", headers: privatePageHeaders },
      {
        source:
          "/:locale(bg|en)?/:page(login|signup|forgot-password|reset-password|verify-email)",
        headers: privatePageHeaders,
      },
    ];
  },
};

export default nextConfig;
