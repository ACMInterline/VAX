export type BookingActionState = {
  status: "IDLE" | "ERROR" | "SUCCESS";
  message?: string;
  fieldErrors?: Readonly<Record<string, readonly string[] | undefined>>;
  bookingReference?: string;
};

export type BookingFormAction = (
  previousState: BookingActionState,
  formData: FormData,
) => Promise<BookingActionState>;

export const initialBookingActionState: BookingActionState = {
  status: "IDLE",
};

export function bookingFieldMessages(
  state: BookingActionState,
  name: string,
): readonly string[] {
  return state.fieldErrors?.[name] ?? [];
}
