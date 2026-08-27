import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const actionState = vi.hoisted(() => ({
  current: {
    status: "ERROR" as const,
    message: "Check the fields and try again.",
    fieldErrors: {
      eventType: ["Event is required."],
      documentType: ["Document type is required."],
      sourceReference: ["Reference is invalid."],
    },
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: vi.fn((action) => [actionState.current, action, false]),
  };
});

import { communicationsContent } from "@/content/communications";
import type { CommunicationsFormAction } from "./action-state";
import { CreatePortalCommunicationForm } from "./forms";

const action: CommunicationsFormAction = async () => actionState.current;

describe("communication mutation form accessibility", () => {
  it("uses one focused alert and described styled field errors", () => {
    const html = renderToStaticMarkup(
      <CreatePortalCommunicationForm
        action={action}
        content={communicationsContent.en}
        idempotencyKey="10000000-0000-4000-8000-000000000001"
      />,
    );

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toMatch(
      /class="application-action-status application-action-status--error" role="alert"[^>]*tabindex="-1"/,
    );
    expect(html.match(/class="application-field-error"/g)).toHaveLength(3);
    expect(html).not.toContain("crm-form__error");

    for (const [controlId, errorId] of [
      ["communication-event-type", "communication-event-type-error"],
      ["communication-document-type", "communication-document-type-error"],
      ["communication-source-reference", "communication-source-reference-error"],
    ] as const) {
      expect(html).toMatch(
        new RegExp(
          `id="${controlId}"[^>]*aria-invalid="true"[^>]*aria-describedby="${errorId}"`,
        ),
      );
      expect(html).toContain(`id="${errorId}"`);
    }

    expect(html).toContain("Event is required.");
    expect(html).toContain("Document type is required.");
    expect(html).toContain("Reference is invalid.");
  });
});
