import "server-only";

import { createHmac } from "node:crypto";

export const businessAuthorityActorContextMetadataKey =
  "business_authority_actor_context_v1";

const keyDerivationDomain = "vax/business-authority/actor-context/key/v1";
const signatureDomain = "vax/business-authority/actor-context/signature/v1";

type ActorContextEnvironment = "development" | "staging" | "production";

export type BusinessAuthorityActorContextInput = Readonly<{
  actorProfileId: string;
  providerUserId: string;
  primaryCorrelationId: string;
  secondaryCorrelationId: string | null;
  issuedAtEpochSeconds: number;
}>;

function requiredCookieSecret(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  const secret = environment.NEON_AUTH_COOKIE_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Business-authority actor context is unavailable.");
  }
  return secret;
}

function requiredActorContextEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): ActorContextEnvironment {
  const configured = environment.VAX_ENVIRONMENT?.trim();
  if (
    configured !== "development" &&
    configured !== "staging" &&
    configured !== "production"
  ) {
    throw new Error("Business-authority actor context is unavailable.");
  }
  return configured;
}

function encodedField(value: string): string {
  const encoded = Buffer.from(value, "utf8").toString("base64");
  return `${encoded.length}:${encoded}`;
}

export function businessAuthorityActorContextPayload(
  input: BusinessAuthorityActorContextInput,
): string {
  return [
    signatureDomain,
    encodedField(input.actorProfileId),
    encodedField(input.providerUserId),
    encodedField(input.primaryCorrelationId),
    encodedField(input.secondaryCorrelationId ?? ""),
    input.issuedAtEpochSeconds.toString(10),
  ].join("|");
}

export function deriveBusinessAuthorityActorContextKey(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const deploymentEnvironment = requiredActorContextEnvironment(environment);
  return createHmac("sha256", requiredCookieSecret(environment))
    .update(`${keyDerivationDomain}|${deploymentEnvironment}`, "utf8")
    .digest("hex");
}

export function signBusinessAuthorityActorContext(
  input: BusinessAuthorityActorContextInput,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const derivedKey = Buffer.from(
    deriveBusinessAuthorityActorContextKey(environment),
    "hex",
  );
  return createHmac("sha256", derivedKey)
    .update(businessAuthorityActorContextPayload(input), "utf8")
    .digest("hex");
}
