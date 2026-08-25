export function isLatestEditableQuoteDraft(
  status: string,
  quoteVersion: number,
  latestQuoteVersion: number,
): boolean {
  return (
    status === "DRAFT" &&
    Number.isSafeInteger(quoteVersion) &&
    quoteVersion > 0 &&
    quoteVersion === latestQuoteVersion
  );
}

export function isCurrentQuotableEstimate(
  sourceRequestVersion: number,
  currentRequestVersion: number,
  declineOrReferRequired: unknown,
): boolean {
  return (
    Number.isSafeInteger(sourceRequestVersion) &&
    sourceRequestVersion === currentRequestVersion &&
    declineOrReferRequired === false
  );
}
