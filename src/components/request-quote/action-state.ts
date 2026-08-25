export type RequestQuoteActionState = {
  status: "IDLE" | "ERROR" | "SUCCESS";
  message?: string;
  fieldErrors?: Readonly<Record<string, readonly string[] | undefined>>;
  values?: Readonly<Record<string, string | readonly string[] | undefined>>;
  requestReference?: string;
  quoteReference?: string;
};

export type RequestQuoteFormAction = (
  previousState: RequestQuoteActionState,
  formData: FormData,
) => Promise<RequestQuoteActionState>;

export const initialRequestQuoteActionState: RequestQuoteActionState = {
  status: "IDLE",
};

export function requestQuoteFieldMessages(
  state: RequestQuoteActionState,
  name: string,
): readonly string[] {
  return state.fieldErrors?.[name] ?? [];
}

export function requestQuoteStringValue(
  state: RequestQuoteActionState,
  name: string,
  fallback = "",
): string {
  const value = state.values?.[name];
  return typeof value === "string" ? value : fallback;
}
