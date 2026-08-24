export type AdminActionState = {
  status: "IDLE" | "ERROR" | "SUCCESS";
  message?: string;
};

export const initialAdminActionState: AdminActionState = { status: "IDLE" };
