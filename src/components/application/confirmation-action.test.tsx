import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ApplicationConfirmationAction,
  type ApplicationActionState,
} from "./confirmation-action";

async function unchangedAction(
  state: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  void formData;
  return state;
}

describe("application confirmation action", () => {
  it("renders a labelled native dialog with explicit hidden context", () => {
    const html = renderToStaticMarkup(
      <ApplicationConfirmationAction
        action={unchangedAction}
        cancelLabel="Cancel"
        confirmLabel="Archive"
        description="The record remains in history."
        fields={{ customerId: "customer-id", expectedVersion: "3" }}
        initialState={{ status: "IDLE" }}
        pendingLabel="Archiving…"
        title="Archive customer"
        variant="danger"
      >
        Archive
      </ApplicationConfirmationAction>,
    );

    expect(html).toContain("<dialog");
    expect(html).toContain("Archive customer");
    expect(html).toContain("The record remains in history.");
    expect(html).toContain('name="customerId"');
    expect(html).toContain('value="customer-id"');
    expect(html).toContain('name="expectedVersion"');
    expect(html).toContain("application-confirmation-action--danger");
  });

  it("disables the trigger when the caller denies the operation", () => {
    const html = renderToStaticMarkup(
      <ApplicationConfirmationAction
        action={unchangedAction}
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        description="Confirm the change."
        disabled
        fields={{ id: "record-id" }}
        initialState={{ status: "IDLE" }}
        title="Confirm change"
      >
        Change
      </ApplicationConfirmationAction>,
    );

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Change<\/button>/);
  });
});
