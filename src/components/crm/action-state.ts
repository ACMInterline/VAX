export type CrmActionState = {
  status: "IDLE" | "ERROR" | "SUCCESS";
  message?: string;
  fieldErrors?: Readonly<Record<string, readonly string[] | undefined>>;
  values?: Readonly<Record<string, string | readonly string[] | undefined>>;
};

export type CrmFormAction = (
  previousState: CrmActionState,
  formData: FormData,
) => Promise<CrmActionState>;

export const initialCrmActionState: CrmActionState = { status: "IDLE" };

export function crmFieldMessages(
  state: CrmActionState,
  name: string,
): readonly string[] {
  return state.fieldErrors?.[name] ?? [];
}

export function crmFieldIsInvalid(
  state: CrmActionState,
  name: string,
): boolean {
  return crmFieldMessages(state, name).length > 0;
}

export function crmStringValue(
  state: CrmActionState,
  name: string,
  fallback = "",
): string {
  const value = state.values?.[name];
  return typeof value === "string" ? value : fallback;
}

export function crmStringValues(
  state: CrmActionState,
  name: string,
  fallback: readonly string[] = [],
): readonly string[] {
  const value = state.values?.[name];
  if (Array.isArray(value)) return value;
  return typeof value === "string" ? [value] : fallback;
}
