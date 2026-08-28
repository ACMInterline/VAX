import { getAuthRuntimeConfiguration } from "@/auth/config";
import { checkAuthenticationProviderAvailability } from "@/auth/neon-provider";
import {
  checkOperationalDatabaseReadiness,
  type OperationalDatabaseReadiness,
} from "@/db/health";
import { getVaxEnvironment } from "./environment";

export type ReadinessCheckState = "READY" | "DEGRADED" | "NOT_READY";

export type ReadinessSnapshot = Readonly<{
  status: "ready" | "degraded" | "not_ready";
  checks: Readonly<{
    database: ReadinessCheckState;
    auth: ReadinessCheckState;
    migrations: ReadinessCheckState;
    rateLimit: ReadinessCheckState;
    email: ReadinessCheckState;
  }>;
}>;

type ReadinessDependencies = Readonly<{
  database: () => Promise<OperationalDatabaseReadiness>;
  authAvailability: () => Promise<boolean>;
  environment: Readonly<Record<string, string | undefined>>;
}>;

type ReadinessResponseFactoryOptions = Readonly<{
  dependencies?: Partial<ReadinessDependencies>;
  now?: () => number;
  probeTimeoutMilliseconds?: number;
  ttlMilliseconds?: number;
}>;

const unavailableSnapshot: ReadinessSnapshot = {
  status: "not_ready",
  checks: {
    database: "NOT_READY",
    auth: "NOT_READY",
    migrations: "NOT_READY",
    rateLimit: "NOT_READY",
    email: "NOT_READY",
  },
};

function configuredAuthState(
  environment: Readonly<Record<string, string | undefined>>,
  available: boolean,
): ReadinessCheckState {
  try {
    getAuthRuntimeConfiguration(environment);
    return available ? "READY" : "NOT_READY";
  } catch {
    return "NOT_READY";
  }
}
function configuredRateLimitState(
  environment: Readonly<Record<string, string | undefined>>,
  database: OperationalDatabaseReadiness,
): ReadinessCheckState {
  try {
    const deployment = getVaxEnvironment(environment);
    const backend = environment.RATE_LIMIT_BACKEND?.trim();
    if (
      deployment === "development" &&
      (backend === undefined || backend === "" || backend === "memory")
    ) {
      return "DEGRADED";
    }
    return backend === "database" &&
      (environment.RATE_LIMIT_HASH_SECRET?.trim().length ?? 0) >= 32 &&
      database.connected &&
      database.rateLimitPrivilegesReady
      ? "READY"
      : "NOT_READY";
  } catch {
    return "NOT_READY";
  }
}

function configuredEmailState(
  environment: Readonly<Record<string, string | undefined>>,
): ReadinessCheckState {
  try {
    const deployment = getVaxEnvironment(environment);
    const mode = environment.EMAIL_DELIVERY_MODE?.trim();
    if (deployment === "production") {
      return mode === "custom_smtp" ? "READY" : "NOT_READY";
    }
    if (deployment === "staging") {
      return mode === "mail_sink" || mode === "sandbox"
        ? "READY"
        : "NOT_READY";
    }
    return mode === "mail_sink" || mode === "sandbox"
      ? "READY"
      : "DEGRADED";
  } catch {
    return "NOT_READY";
  }
}

export async function createReadinessSnapshot(
  dependencies: Partial<ReadinessDependencies> = {},
): Promise<ReadinessSnapshot> {
  const environment = dependencies.environment ?? process.env;
  const [database, authAvailable] = await Promise.all([
    (dependencies.database ?? checkOperationalDatabaseReadiness)(),
    (dependencies.authAvailability ?? checkAuthenticationProviderAvailability)(),
  ]);
  const checks = {
    database:
      database.connected && database.runtimeIdentitySafe
        ? "READY"
        : "NOT_READY",
    auth: configuredAuthState(environment, authAvailable),
    migrations: database.migrationReady ? "READY" : "NOT_READY",
    rateLimit: configuredRateLimitState(environment, database),
    email: configuredEmailState(environment),
  } as const;
  const values = Object.values(checks);
  const status = values.includes("NOT_READY")
    ? "not_ready"
    : values.includes("DEGRADED")
      ? "degraded"
      : "ready";
  return { status, checks };
}

function responseForReadinessSnapshot(snapshot: ReadinessSnapshot): Response {
  return Response.json(snapshot, {
    status: snapshot.status === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

async function withProbeTimeout<T>(
  operation: Promise<T>,
  timeoutMilliseconds: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Readiness probe timed out.")),
      timeoutMilliseconds,
    );
    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function createReadinessResponseFactory(
  options: ReadinessResponseFactoryOptions = {},
): () => Promise<Response> {
  const now = options.now ?? Date.now;
  const requestedTtl = options.ttlMilliseconds ?? 5_000;
  const ttlMilliseconds = Number.isFinite(requestedTtl)
    ? Math.min(30_000, Math.max(1, requestedTtl))
    : 5_000;
  const requestedProbeTimeout = options.probeTimeoutMilliseconds ?? 3_000;
  const probeTimeoutMilliseconds = Number.isFinite(requestedProbeTimeout)
    ? Math.min(30_000, Math.max(1, requestedProbeTimeout))
    : 3_000;
  let cachedSnapshot: ReadinessSnapshot | undefined;
  let cacheExpiresAt = 0;
  let activeProbe: Promise<ReadinessSnapshot> | undefined;
  let pendingSnapshot: Promise<ReadinessSnapshot> | undefined;

  return async () => {
    const currentTime = now();
    if (cachedSnapshot && currentTime < cacheExpiresAt) {
      return responseForReadinessSnapshot(cachedSnapshot);
    }
    if (activeProbe && !pendingSnapshot) {
      cachedSnapshot = unavailableSnapshot;
      cacheExpiresAt = now() + ttlMilliseconds;
      return responseForReadinessSnapshot(unavailableSnapshot);
    }
    if (!pendingSnapshot) {
      const probe = createReadinessSnapshot(options.dependencies);
      activeProbe = probe;
      probe.then(
        () => {
          if (activeProbe === probe) activeProbe = undefined;
        },
        () => {
          if (activeProbe === probe) activeProbe = undefined;
        },
      );
      pendingSnapshot = withProbeTimeout(
        probe,
        probeTimeoutMilliseconds,
      )
        .catch(() => unavailableSnapshot)
        .then((snapshot) => {
          cachedSnapshot = snapshot;
          cacheExpiresAt = now() + ttlMilliseconds;
          return snapshot;
        })
        .finally(() => {
          pendingSnapshot = undefined;
        });
    }
    return responseForReadinessSnapshot(await pendingSnapshot);
  };
}

export const createReadinessResponse = createReadinessResponseFactory();
