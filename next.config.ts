import type { NextConfig } from "next";

const baselineSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const privatePageHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: baselineSecurityHeaders },
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
