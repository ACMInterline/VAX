export type FinanceActionState = {
  status: "IDLE" | "ERROR" | "SUCCESS";
  message?: string;
  fieldErrors?: Readonly<Record<string, readonly string[] | undefined>>;
  invoiceReference?: string;
  paymentReference?: string;
};

export type FinanceFormAction = (
  previousState: FinanceActionState,
  formData: FormData,
) => Promise<FinanceActionState>;

export const initialFinanceActionState: FinanceActionState = {
  status: "IDLE",
};

export function financeFieldMessages(
  state: FinanceActionState,
  name: string,
): readonly string[] {
  return state.fieldErrors?.[name] ?? [];
}
