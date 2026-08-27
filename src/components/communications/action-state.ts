export type CommunicationsActionState = {
  status: "IDLE" | "ERROR" | "SUCCESS";
  message?: string;
  fieldErrors?: Readonly<Record<string, readonly string[] | undefined>>;
  communicationReference?: string;
  documentReference?: string;
};

export type CommunicationsFormAction = (
  previousState: CommunicationsActionState,
  formData: FormData,
) => Promise<CommunicationsActionState>;

export const initialCommunicationsActionState: CommunicationsActionState = {
  status: "IDLE",
};
