export type AuthActionState = {
  status: "IDLE" | "ERROR" | "SUCCESS";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  nextStep?: "VERIFY_EMAIL";
};

export function withVerificationNextStep(
  state: AuthActionState,
  required: boolean,
): AuthActionState {
  return required ? { ...state, nextStep: "VERIFY_EMAIL" } : state;
}
