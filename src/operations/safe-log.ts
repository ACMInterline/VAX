import { randomUUID } from "node:crypto";

export type OperationalEventCode =
  | "RATE_LIMIT_BACKEND_FAILURE"
  | "READINESS_CHECK_FAILED"
  | "AUTH_DEPENDENCY_UNAVAILABLE"
  | "DATABASE_DEPENDENCY_UNAVAILABLE"
  | "EMAIL_DEPENDENCY_UNAVAILABLE"
  | "MIGRATION_STATE_MISMATCH"
  | "FINANCE_INVARIANT_FAILURE"
  | "COMMUNICATION_DELIVERY_FAILURE";

export type OperationalErrorClass =
  | "DEPENDENCY_UNAVAILABLE"
  | "INVALID_CONFIGURATION"
  | "INVARIANT_VIOLATION"
  | "TIMEOUT"
  | "UNKNOWN";

export type OperationalLogInput = Readonly<{
  eventCode: OperationalEventCode;
  status: "INFO" | "WARNING" | "ERROR";
  correlationId?: string;
  route?: string;
  actorProfileId?: string;
  durationMs?: number;
  errorClass?: OperationalErrorClass;
}>;

export type SafeOperationalLogRecord = Readonly<{
  timestamp: string;
  eventCode: OperationalEventCode;
  status: "INFO" | "WARNING" | "ERROR";
  correlationId: string;
  route?: string;
  actorProfileId?: string;
  durationMs?: number;
  errorClass?: OperationalErrorClass;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeRoutePattern = /^\/[a-z0-9/_-]{0,119}$/i;

export function createSafeOperationalLogRecord(
  input: OperationalLogInput,
  now: () => Date = () => new Date(),
): SafeOperationalLogRecord {
  const correlationId =
    input.correlationId && uuidPattern.test(input.correlationId)
      ? input.correlationId.toLowerCase()
      : randomUUID();
  const route =
    input.route && safeRoutePattern.test(input.route) ? input.route : undefined;
  const actorProfileId =
    input.actorProfileId && uuidPattern.test(input.actorProfileId)
      ? input.actorProfileId.toLowerCase()
      : undefined;
  const durationMs =
    input.durationMs !== undefined &&
    Number.isFinite(input.durationMs) &&
    input.durationMs >= 0
      ? Math.round(input.durationMs)
      : undefined;

  return {
    timestamp: now().toISOString(),
    eventCode: input.eventCode,
    status: input.status,
    correlationId,
    ...(route ? { route } : {}),
    ...(actorProfileId ? { actorProfileId } : {}),
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(input.errorClass ? { errorClass: input.errorClass } : {}),
  };
}
export type OperationalLogSink = (
  record: SafeOperationalLogRecord,
) => void | Promise<void>;

export interface OperationalErrorReporter {
  capture(input: OperationalLogInput): Promise<void>;
}

class SafeConsoleOperationalErrorReporter implements OperationalErrorReporter {
  async capture(input: OperationalLogInput): Promise<void> {
    const record = createSafeOperationalLogRecord(input);
    process.stderr.write(`${JSON.stringify(record)}\n`);
  }
}

let reporter: OperationalErrorReporter =
  new SafeConsoleOperationalErrorReporter();

export function setOperationalErrorReporter(
  next: OperationalErrorReporter,
): () => void {
  const previous = reporter;
  reporter = next;
  return () => {
    reporter = previous;
  };
}

export async function reportOperationalError(
  input: OperationalLogInput,
): Promise<void> {
  try {
    await reporter.capture(input);
  } catch {
    // Observability must never alter the application failure mode.
  }
}
