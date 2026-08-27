export function isLiteralLoopbackOrUnspecifiedHostname(
  hostname: string,
): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[(.*)\]$/, "$1");

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "0.0.0.0" ||
    normalized === "::" ||
    normalized === "::1" ||
    normalized === "::ffff:0:0"
  ) {
    return true;
  }

  if (normalized.startsWith("127.")) {
    return true;
  }

  return /^(?:::ffff:|::)7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(normalized);
}
