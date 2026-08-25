import type { QuoteStatus, RequestStatus } from "./types";

const requestTransitions = {
  SUBMITTED: ["IN_REVIEW"],
  IN_REVIEW: ["NEEDS_REVIEW", "READY_TO_QUOTE", "DECLINED"],
  NEEDS_REVIEW: ["IN_REVIEW", "READY_TO_QUOTE", "DECLINED"],
  // QUOTED is entered only by the atomic quote-issue transaction.
  READY_TO_QUOTE: ["IN_REVIEW", "DECLINED"],
  QUOTED: ["CLOSED"],
  CLOSED: [],
  DECLINED: [],
} as const satisfies Record<RequestStatus, readonly RequestStatus[]>;

const quoteTransitions = {
  DRAFT: ["ISSUED"],
  ISSUED: ["SUPERSEDED", "EXPIRED", "WITHDRAWN"],
  SUPERSEDED: [],
  EXPIRED: [],
  WITHDRAWN: [],
} as const satisfies Record<QuoteStatus, readonly QuoteStatus[]>;

export class InvalidLifecycleTransitionError extends Error {
  constructor(domain: "request" | "quote", from: string, to: string) {
    super(`Invalid ${domain} lifecycle transition: ${from} -> ${to}.`);
    this.name = "InvalidLifecycleTransitionError";
  }
}

export type RequestTransitionContext = Readonly<{
  /** Set only by the transaction that withdraws or expires the active quote. */
  cause?: "ACTIVE_QUOTE_BECAME_INACTIVE";
}>;

export function canTransitionRequestStatus(
  from: RequestStatus,
  to: RequestStatus,
  context: RequestTransitionContext = {},
): boolean {
  if (from === "QUOTED" && to === "READY_TO_QUOTE") {
    return context.cause === "ACTIVE_QUOTE_BECAME_INACTIVE";
  }
  return (requestTransitions[from] as readonly RequestStatus[]).includes(to);
}

export function assertRequestStatusTransition(
  from: RequestStatus,
  to: RequestStatus,
  context: RequestTransitionContext = {},
): void {
  if (!canTransitionRequestStatus(from, to, context)) {
    throw new InvalidLifecycleTransitionError("request", from, to);
  }
}

export function canTransitionQuoteStatus(
  from: QuoteStatus,
  to: QuoteStatus,
): boolean {
  return (quoteTransitions[from] as readonly QuoteStatus[]).includes(to);
}

export function assertQuoteStatusTransition(
  from: QuoteStatus,
  to: QuoteStatus,
): void {
  if (!canTransitionQuoteStatus(from, to)) {
    throw new InvalidLifecycleTransitionError("quote", from, to);
  }
}

export function canEditQuoteCommercialTerms(status: QuoteStatus): boolean {
  return status === "DRAFT";
}

export function assertQuoteCommercialTermsMutable(status: QuoteStatus): void {
  if (!canEditQuoteCommercialTerms(status)) {
    throw new Error("Only a DRAFT quote may change commercial terms.");
  }
}

export function assertNextAggregateVersion(
  currentVersion: number,
  candidateVersion: number,
): void {
  if (
    !Number.isSafeInteger(currentVersion) ||
    currentVersion < 0 ||
    !Number.isSafeInteger(candidateVersion) ||
    candidateVersion !== currentVersion + 1
  ) {
    throw new Error("The new version must be the next positive integer version.");
  }
}

export function nextAggregateVersion(currentVersion: number): number {
  const nextVersion = currentVersion + 1;
  assertNextAggregateVersion(currentVersion, nextVersion);
  return nextVersion;
}
