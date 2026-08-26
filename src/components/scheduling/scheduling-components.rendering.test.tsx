import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingSchedulePanel } from "./booking-schedule-panel";
import { DispatchBoard } from "./dispatch-board";
import type {
  BookingSchedulePreviewView,
  DispatchDayView,
  SchedulingFormAction,
} from "./types";

const bookingReference = "BKG-0123456789ABCDEF01234567";
const jobReference = "JOB-0123456789ABCDEF01234567";
const serviceStart = new Date("2026-10-25T06:30:00.000Z");
const serviceEnd = new Date("2026-10-25T08:00:00.000Z");
const unchangedAction: SchedulingFormAction = async (state, formData) => {
  void formData;
  return state;
};

const emptyMetrics = {
  scheduledJobs: 0,
  serviceMinutes: 0,
  travelMinutes: 0,
  bufferMinutes: 0,
  idleMinutes: 480,
  utilizationPercent: 0,
  occupiedTeamHoursHundredths: 0,
  laborHoursHundredths: 0,
  revenuePerOccupiedTeamHourMinorUnits: null,
  currency: "EUR" as const,
};

function preview(): BookingSchedulePreviewView {
  return {
    bookingReference,
    expectedBookingVersion: 4,
    customerDisplayName: "Synthetic customer",
    propertyLabel: "Synthetic property",
    propertyAddress: "Synthetic address",
    preferredTimingLabel: "Morning",
    serviceDurationMinutes: 90,
    workDate: "2026-10-25",
    timeZone: "Europe/Sofia",
    currentAppointment: null,
    candidates: [
      {
        key: "server-issued-candidate-1",
        rank: 1,
        teamName: "Team A",
        equipmentLabel: "Machine A",
        serviceStart,
        serviceEnd,
        serviceDurationMinutes: 90,
        travelMinutes: 20,
        bufferMinutes: 15,
        readiness: "READY",
        selectable: true,
        fallbackTravelUsed: false,
        warnings: [],
      },
      {
        key: "server-issued-candidate-2",
        rank: 2,
        teamName: "Team B",
        equipmentLabel: null,
        serviceStart,
        serviceEnd,
        serviceDurationMinutes: 90,
        travelMinutes: 30,
        bufferMinutes: 15,
        readiness: "TRAVEL_REVIEW",
        selectable: false,
        fallbackTravelUsed: true,
        warnings: ["Synthetic review warning"],
      },
    ],
    reviewWarnings: ["Synthetic booking review warning"],
    provisionalConfiguration: true,
  };
}

function day(): DispatchDayView {
  return {
    workDate: "2026-10-25",
    timeZone: "Europe/Sofia",
    previousDate: "2026-10-24",
    nextDate: "2026-10-26",
    provisionalConfiguration: true,
    warnings: ["Synthetic day warning"],
    unscheduledBookings: [
      {
        bookingReference,
        customerDisplayName: "Synthetic customer",
        propertyLabel: "Synthetic property",
        preferredDate: "2026-10-25",
        appointmentWindowLabel: "Morning",
        serviceDurationMinutes: 90,
        readiness: "MISSING_TEAM",
        warnings: ["Team selection required"],
      },
    ],
    teams: [
      {
        id: 1,
        code: "TEAM_A",
        name: "Team A",
        workingWindowLabel: "08:00 – 17:00",
        appointments: [
          {
            bookingReference,
            bookingStatus: "CONFIRMED",
            jobReference,
            jobStatus: "READY",
            customerDisplayName: "Synthetic customer",
            propertyLabel: "Synthetic property",
            propertyAddress: "Synthetic address",
            propertyArea: "Synthetic district",
            serviceStart,
            serviceEnd,
            serviceDurationMinutes: 90,
            travelMinutes: 20,
            bufferMinutes: 15,
            equipmentLabel: "Machine A",
            readiness: "READY",
            fallbackTravelUsed: false,
            warnings: [],
          },
        ],
        metrics: { ...emptyMetrics, scheduledJobs: 1, serviceMinutes: 90 },
      },
    ],
    metrics: { ...emptyMetrics, scheduledJobs: 1, serviceMinutes: 90 },
  };
}

describe("Phase 3G scheduling presentation", () => {
  it.each(["bg", "en"] as const)(
    "renders a semantic mobile-friendly %s day board with explicit DRAFT and review state",
    (locale) => {
      const html = renderToStaticMarkup(
        <DispatchBoard day={day()} includeRevenue={false} locale={locale} />,
      );

      expect(html).toContain('aria-labelledby="schedule-heading"');
      expect(html).toContain('method="get"');
      expect(html).toContain('name="date"');
      expect(html).toContain('value="2026-10-25"');
      expect(html).toContain("DRAFT");
      expect(html).toContain("Synthetic day warning");
      expect(html).toContain('href="/app/schedule"');
      expect(html).toContain('dateTime="2026-10-25T06:30:00.000Z"');
      expect(html).toMatch(/(?:8:30|08:30)/);
      expect(html).toContain(
        `/app/schedule/bookings/${bookingReference}?date=2026-10-25`,
      );
      expect(html).toContain(jobReference);
      expect(html).toContain("Synthetic district");
      expect(html).toContain(locale === "bg" ? "Потвърдена" : "Confirmed");
      expect(html).toContain(locale === "bg" ? "Готова" : "Ready");
      expect(html).not.toContain("Revenue per occupied team-hour");
      expect(html).not.toContain("Приход на зает екип-час");
    },
  );

  it("shows revenue only when the separately authorized staff projection includes it", () => {
    const withRevenue = {
      ...day(),
      metrics: {
        ...day().metrics,
        revenuePerOccupiedTeamHourMinorUnits: 12_345,
      },
    };

    const hidden = renderToStaticMarkup(
      <DispatchBoard day={withRevenue} includeRevenue={false} locale="en" />,
    );
    const visible = renderToStaticMarkup(
      <DispatchBoard day={withRevenue} includeRevenue locale="en" />,
    );

    expect(hidden).not.toContain("Revenue per occupied team-hour");
    expect(visible).toContain("Revenue per occupied team-hour");
    expect(visible).toContain("€123.45");
  });

  it("submits only references, concurrency evidence, selection, reason, and acknowledgement", () => {
    const reschedulePreview = {
      ...preview(),
      currentAppointment: {
        snapshotVersion: 2,
        serviceStart,
        serviceEnd,
        teamName: "Team A",
        equipmentLabel: "Machine A",
      },
    } satisfies BookingSchedulePreviewView;
    const html = renderToStaticMarkup(
      <BookingSchedulePanel
        action={unchangedAction}
        locale="en"
        preview={reschedulePreview}
      />,
    );

    for (const name of [
      "bookingReference",
      "expectedBookingVersion",
      "workDate",
      "candidateKey",
      "expectedOccupancySnapshotVersion",
      "reasonCategory",
      "reasonText",
      "acknowledged",
    ]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('type="radio"');
    expect(html).toContain('aria-busy="false"');
    expect(html).toContain("Provisional operational configuration");
    expect(html).toContain("Synthetic booking review warning");
    expect(html).toContain("The server derives the end time");
    expect(html).toContain('maxLength="500"');
    expect(html).toContain("<dialog");
    expect(html).toContain("Confirm the exact appointment");
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('aria-describedby=');
    expect(html).not.toMatch(
      /name="(?:teamId|equipmentId|serviceStart|serviceEnd|duration|travelMinutes|bufferMinutes|commercialSnapshot|schedulingSnapshot|customerId|propertyId|price)"/,
    );
  });

  it("does not invite a reschedule-only reason on initial scheduling", () => {
    const html = renderToStaticMarkup(
      <BookingSchedulePanel
        action={unchangedAction}
        locale="en"
        preview={preview()}
      />,
    );

    expect(html).not.toContain('name="reasonCategory"');
    expect(html).not.toContain('name="reasonText"');
    expect(html).not.toContain('name="expectedOccupancySnapshotVersion"');
  });

  it("disables a non-selectable fallback candidate and exposes its warning", () => {
    const html = renderToStaticMarkup(
      <BookingSchedulePanel
        action={unchangedAction}
        locale="en"
        preview={preview()}
      />,
    );

    expect(html).toMatch(
      /<input[^>]*disabled=""[^>]*value="server-issued-candidate-2"/,
    );
    expect(html).toContain(
      "The travel estimate used a fallback rule or is uncertain",
    );
    expect(html).toContain("Synthetic review warning");
  });
});
