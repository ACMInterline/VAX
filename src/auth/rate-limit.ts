export type AuthAttemptScope =
  | "LOGIN"
  | "SIGNUP"
  | "PASSWORD_RESET"
  | "EMAIL_VERIFICATION"
  | "ADMIN_MUTATION"
  | "BOOKING_MUTATION"
  | "JOB_MUTATION"
  | "PUBLIC_REQUEST";

export type AuthRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export interface AuthRateLimiter {
  consume(scope: AuthAttemptScope, key: string): Promise<AuthRateLimitResult>;
}

const scopePolicies: Record<
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
  ): Promise<AuthRateLimitResult> {
    const currentTime = this.now();
    const policy = scopePolicies[scope];
    const mapKey = `${scope}:${key}`;
    const current = this.attempts.get(mapKey);

    if (!current || current.resetsAt <= currentTime) {
      this.prune(currentTime);
      this.attempts.set(mapKey, {
        count: 1,
        resetsAt: currentTime + policy.windowMilliseconds,
      });
      return { allowed: true };
    }

    if (current.count >= policy.limit) {
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

export function createRuntimeAuthRateLimiter(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthRateLimiter {
  return environment.NODE_ENV === "production"
    ? new ProductionRateLimiterRequired()
    : new InMemoryAuthRateLimiter();
}
