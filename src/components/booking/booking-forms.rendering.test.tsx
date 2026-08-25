import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BookingFormAction } from "./action-state";
import {
  BookingCancellationForm,
  CustomerQuoteAcceptanceForm,
  StaffQuoteAcceptanceForm,
} from "./booking-forms";

const quoteReference = "Q-0123456789ABCDEF01234567";
const bookingReference = "BKG-0123456789ABCDEF01234567";
const unchangedAction: BookingFormAction = async (state, formData) => {
  void formData;
  return state;
};

describe("booking mutation form presentation", () => {
  it.each(["bg", "en"] as const)(
    "renders an explicit %s customer acceptance without schedule or payment claims",
    (locale) => {
      const html = renderToStaticMarkup(
        <CustomerQuoteAcceptanceForm
          action={unchangedAction}
          expectedQuoteVersion={3}
          locale={locale}
          quoteReference={quoteReference}
        />,
      );

      expect(html).toContain(
        `name="quoteReference" value="${quoteReference}"`,
      );
      expect(html).toContain('name="expectedQuoteVersion" value="3"');
      expect(html).toContain('name="acknowledged"');
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('aria-busy="false"');
      expect(html).toMatch(
        locale === "en"
          ? /does not confirm an exact appointment/
          : /не потвърждава точен час/,
      );
      expect(html).toMatch(
        locale === "en"
          ? /No payment is taken or recorded/
          : /не се извършва или отчита плащане/,
      );
      expect(html).not.toMatch(
        /name="(?:customerId|propertyId|price|teamId|scheduledStart)"/,
      );
    },
  );

  it("requires staff instruction evidence without accepting commercial or scheduling authority", () => {
    const html = renderToStaticMarkup(
      <StaffQuoteAcceptanceForm
        action={unchangedAction}
        expectedQuoteVersion={5}
        locale="en"
        quoteReference={quoteReference}
      />,
    );

    expect(html).toContain('name="acceptanceSource"');
    expect(html).toContain('value="PHONE"');
    expect(html).toContain('value="EMAIL"');
    expect(html).toContain('value="IN_PERSON"');
    expect(html).toContain('value="OTHER_RECORDED"');
    expect(html).toContain('name="acceptanceNote"');
    expect(html).toContain('name="customerInstructionConfirmed"');
    expect(html).toContain("Fail closed");
    expect(html).toContain("Do not reinterpret");
    expect(html).not.toMatch(
      /name="(?:customerId|propertyId|price|teamId|scheduledStart|commercialSnapshot)"/,
    );
  });

  it("records controlled cancellation evidence and states the finance exclusion", () => {
    const html = renderToStaticMarkup(
      <BookingCancellationForm
        action={unchangedAction}
        bookingReference={bookingReference}
        expectedVersion={2}
        locale="en"
      />,
    );

    expect(html).toContain(
      `name="bookingReference" value="${bookingReference}"`,
    );
    expect(html).toContain('name="expectedVersion" value="2"');
    expect(html).toContain('name="reasonCategory"');
    expect(html).toContain('name="reasonText"');
    expect(html).toContain('name="cancellationAcknowledged"');
    expect(html).toContain(
      "No cancellation fee, refund, payment, or invoice",
    );
    expect(html).not.toMatch(/name="(?:refund|fee|payment|invoice)"/);
  });
});
