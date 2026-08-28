import { getVaxEnvironment } from "@/operations/environment";

export type AuthAttemptScope =
  | "LOGIN"
  | "SIGNUP"
  | "PASSWORD_RESET"
  | "EMAIL_VERIFICATION"
  | "ADMIN_MUTATION"
  | "BOOKING_MUTATION"
  | "JOB_MUTATION"
  | "FINANCE_MUTATION"
  | "COMMUNICATION_MUTATION"
  | "PUBLIC_REQUEST";

export type AuthRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type AuthRateLimitDimension = "SOURCE" | "ACCOUNT" | "SOURCE_ACCOUNT";

export interface AuthRateLimiter {
  consume(
    scope: AuthAttemptScope,
    key: string,
    dimension?: AuthRateLimitDimension,
  ): Promise<AuthRateLimitResult>;
}

const sourceLimitMultiplier = 5;

export const authRateLimitPolicies: Record<
  AuthAttemptScope,
  { limit: number; windowMilliseconds: number }
> = {
  LOGIN: { limit: 5, windowMilliseconds: 15 * 60 * 1000 },
  SIGNUP: { limit: 3, windowMilliseconds: 60 * 60 * 1000 },
  PASSWORD_RESET: { limit: 3, windowMilliseconds: 60 * 60 * 1000 },
  EMAIL_VERIFICATION: { limit: 5, windowMilliseconds: 15 * 60 * 1000 },
  ADMIN_MUTATION: { limit: 20, windowMilliseconds: 5 * 60 * 1000 },
  BOOKING_MUTATION: { limit: 10, windowMilliseconds: 5 * 60 * 1000 },
  JOB_MUTATION: { limit: 30, windowMilliseconds: 5 * 60 * 1000 },
  FINANCE_MUTATION: { limit: 20, windowMilliseconds: 5 * 60 * 1000 },
  COMMUNICATION_MUTATION: { limit: 20, windowMilliseconds: 5 * 60 * 1000 },
  PUBLIC_REQUEST: { limit: 5, windowMilliseconds: 60 * 60 * 1000 },
};

type AttemptWindow = { count: number; resetsAt: number };

export class InMemoryAuthRateLimiter implements AuthRateLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();
  private readonly now: () => number;
  private readonly maximumKeys: number;

  constructor(options?: { now?: () => number; maximumKeys?: number }) {
    this.now = options?.now ?? Date.now;
    this.maximumKeys = options?.maximumKeys ?? 5_000;
  }

  async consume(
    scope: AuthAttemptScope,
    key: string,
    dimension: AuthRateLimitDimension = "SOURCE_ACCOUNT",
  ): Promise<AuthRateLimitResult> {
    const currentTime = this.now();
    const policy = authRateLimitPolicies[scope];
    const limit =
      dimension === "SOURCE"
        ? policy.limit * sourceLimitMultiplier
        : policy.limit;
    const mapKey = `${scope}:${dimension}:${key}`;
    const current = this.attempts.get(mapKey);

    if (!current || current.resetsAt <= currentTime) {
      this.prune(currentTime);
      this.attempts.set(mapKey, {
        count: 1,
        resetsAt: currentTime + policy.windowMilliseconds,
      });
      return { allowed: true };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.resetsAt - currentTime) / 1_000),
        ),
      };
    }

    current.count += 1;
    return { allowed: true };
  }

  private prune(currentTime: number): void {
    for (const [key, attempt] of this.attempts) {
      if (attempt.resetsAt <= currentTime) {
        this.attempts.delete(key);
      }
    }

    if (this.attempts.size >= this.maximumKeys) {
      const oldestKey = this.attempts.keys().next().value;
      if (oldestKey) {
        this.attempts.delete(oldestKey);
      }
    }
  }
}

export class ProductionRateLimiterRequired implements AuthRateLimiter {
  async consume(): Promise<AuthRateLimitResult> {
    return { allowed: false, retryAfterSeconds: 60 };
  }
}

export type SharedRateLimitStoreResult = Readonly<{
  attemptCount: number;
  resetsAt: Date;
}>;

export interface SharedRateLimitStore {
  consumeWindow(input: Readonly<{
    scope: AuthAttemptScope;
    keyHash: string;
    limit: number;
    windowMilliseconds: number;
  }>): Promise<SharedRateLimitStoreResult>;
  pruneExpired?(maximumRows: number): Promise<number>;
}

export class SharedAuthRateLimiter implements AuthRateLimiter {
  private consumptionCount = 0;

  constructor(private readonly store: SharedRateLimitStore) {}

  async consume(
    scope: AuthAttemptScope,
    key: string,
    dimension: AuthRateLimitDimension = "SOURCE_ACCOUNT",
  ): Promise<AuthRateLimitResult> {
    if (!/^[0-9a-f]{64}$/.test(key)) {
      throw new Error("Shared rate-limit key is invalid.");
    }
    const policy = authRateLimitPolicies[scope];
    const limit =
      dimension === "SOURCE"
        ? policy.limit * sourceLimitMultiplier
        : policy.limit;
    const result = await this.store.consumeWindow({
      scope,
      keyHash: key,
      limit,
      windowMilliseconds: policy.windowMilliseconds,
    });

    this.consumptionCount += 1;
    if (this.consumptionCount % 256 === 0 && this.store.pruneExpired) {
      await this.store.pruneExpired(100).catch(() => 0);
    }

    if (result.attemptCount <= limit) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((result.resetsAt.getTime() - Date.now()) / 1_000),
      ),
    };
  }
}

export function createRuntimeAuthRateLimiter(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  sharedLimiter?: AuthRateLimiter,
): AuthRateLimiter {
  try {
    const deployment = getVaxEnvironment(environment);
    const backend = environment.RATE_LIMIT_BACKEND?.trim();

    if (
      deployment === "development" &&
      (backend === undefined || backend === "" || backend === "memory")
    ) {
      return new InMemoryAuthRateLimiter();
    }
    if (backend === "database" && sharedLimiter) return sharedLimiter;
  } catch {
    // Invalid production-like configuration deliberately selects fail-closed.
  }
  return new ProductionRateLimiterRequired();
}
