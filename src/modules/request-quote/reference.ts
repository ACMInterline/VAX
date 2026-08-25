import { randomBytes } from "node:crypto";

export const PUBLIC_REFERENCE_ENTROPY_BYTES = 12;

type EntropySource = (size: number) => Uint8Array;

function encodeUpperHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function generatePublicReference(
  prefix: "REQ" | "Q",
  entropySource: EntropySource = randomBytes,
): string {
  const entropy = entropySource(PUBLIC_REFERENCE_ENTROPY_BYTES);
  if (entropy.byteLength !== PUBLIC_REFERENCE_ENTROPY_BYTES) {
    throw new Error("The reference entropy source returned an invalid length.");
  }

  return `${prefix}-${encodeUpperHex(entropy)}`;
}

export function generateRequestReference(
  entropySource?: EntropySource,
): string {
  return generatePublicReference("REQ", entropySource);
}

export function generateQuoteReference(entropySource?: EntropySource): string {
  return generatePublicReference("Q", entropySource);
}
