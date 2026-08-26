import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { JobFormAction } from "@/components/job-execution";
import {
  AssignJobTeamForm,
  CancelJobForm,
  CreateJobFromBookingForm,
} from "./job-management-forms";

const jobReference = "JOB-0123456789ABCDEF01234567";
const unchangedAction: JobFormAction = async (state, formData) => {
  void formData;
  return state;
};

function expectNoClientAuthority(html: string): void {
  expect(html).not.toMatch(
    /name="(?:actorProfileId|createdByProfileId|updatedByProfileId|assignedAt|createdAt|updatedAt|startedAt|completedAt|teamAuthority)"/,
  );
  expect(html).not.toMatch(/name="(?:price|margin|quoteSnapshot|accessNotes)"/);
}

describe("Phase 3F Job management forms", () => {
  it.each([
    ["bg", "Създаване от потвърдена резервация", "Версия на резервацията"],
    ["en", "Create from a confirmed booking", "Booking version"],
  ] as const)("renders exact booking creation controls in %s", (locale, title, version) => {
    const html = renderToStaticMarkup(
      <CreateJobFromBookingForm action={unchangedAction} locale={locale} />,
    );

    expect(html).toContain(title);
    expect(html).toContain(`>${version}</label>`);
    expect(html).toContain('name="bookingReference"');
    expect(html).toContain('pattern="BKG-[A-F0-9]{24}"');
    expect(html).toContain('name="expectedBookingVersion"');
    expect(html).toMatch(/<label for="create-job-from-booking-reference">/);
    expectNoClientAuthority(html);
  });

  it.each([
    ["bg", "Точно назначаване на екип", "Назначи екипа"],
    ["en", "Exact team assignment", "Assign team"],
  ] as const)("renders a controlled team assignment in %s", (locale, title, submit) => {
    const html = renderToStaticMarkup(
      <AssignJobTeamForm
        action={unchangedAction}
        expectedJobVersion={3}
        jobReference={jobReference}
        locale={locale}
        teams={[{ id: "12", label: "Team Alpha" }]}
      />,
    );

    expect(html).toContain(title);
    expect(html).toContain(submit);
    expect(html).toContain(`name="jobReference" value="${jobReference}"`);
    expect(html).toContain('name="expectedJobVersion" value="3"');
    expect(html).toContain('name="operationsTeamId"');
    expect(html).toContain('<option value="12">Team Alpha</option>');
    expectNoClientAuthority(html);
  });

  it("renders an accessible controlled cancellation form", () => {
    const html = renderToStaticMarkup(
      <CancelJobForm
        action={unchangedAction}
        expectedJobVersion={3}
        jobReference={jobReference}
        locale="en"
      />,
    );

    expect(html).toContain("Cancel field job");
    expect(html).toMatch(/<label for="cancel-job-[^"]+-reason">/);
    expect(html).toContain('name="reasonCategory"');
    expect(html).toContain('value="CUSTOMER_REQUEST"');
    expect(html).toContain('value="SAFETY"');
    expect(html).toContain('name="reasonText"');
    expectNoClientAuthority(html);
  });
});
