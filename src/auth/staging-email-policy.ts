import { getVaxEnvironment, isStrictHostedEnvironment } from "@/operations/environment";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maximumStagingRecipients = 20;

export type StagingEmailPolicy = Readonly<{
  deliveryMode: "mail_sink" | "sandbox";
  recipients: ReadonlySet<string>;
}>;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getHostedStagingEmailPolicy(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): StagingEmailPolicy | undefined {
  if (
    getVaxEnvironment(environment) !== "staging" ||
    !isStrictHostedEnvironment(environment)
  ) {
    return undefined;
  }

  const deliveryMode = environment.EMAIL_DELIVERY_MODE?.trim();
  const configured = environment.STAGING_AUTH_EMAIL_ALLOWLIST?.trim();
  if (
    (deliveryMode !== "mail_sink" && deliveryMode !== "sandbox") ||
    !configured
  ) {
    throw new Error("Hosted staging email delivery is not configured safely.");
  }

  const entries = configured.split(",");
  const recipients = new Set<string>();
  for (const entry of entries) {
    const recipient = normalizeEmail(entry);
    if (
      !recipient ||
      recipient.length > 254 ||
      recipient.includes("*") ||
      !emailPattern.test(recipient)
    ) {
      throw new Error("Hosted staging email delivery is not configured safely.");
    }
    recipients.add(recipient);
  }

  if (
    recipients.size === 0 ||
    recipients.size > maximumStagingRecipients ||
    recipients.size !== entries.length
  ) {
    throw new Error("Hosted staging email delivery is not configured safely.");
  }

  return { deliveryMode, recipients };
}

export function isAuthEmailAllowedForDeployment(
  email: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  try {
    const policy = getHostedStagingEmailPolicy(environment);
    return !policy || policy.recipients.has(normalizeEmail(email));
  } catch {
    return false;
  }
}
