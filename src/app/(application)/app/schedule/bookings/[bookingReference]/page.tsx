import { BookingSchedulePanel } from "@/components/scheduling/booking-schedule-panel";
import {
  createSchedulePageService,
  loadBookingPreviewOrNotFound,
  parseScheduleBookingRouteParams,
  parseScheduleSearchParams,
  presentBookingSchedulePreview,
  requireSchedulePageContext,
  type ScheduleBookingRouteParams,
  type ScheduleSearchParams,
} from "../../_lib/schedule-page";
import { confirmScheduleAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function BookingSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<ScheduleBookingRouteParams>;
  searchParams: Promise<ScheduleSearchParams>;
}) {
  const { actor, locale } = await requireSchedulePageContext();
  const [{ bookingReference }, workDate] = await Promise.all([
    parseScheduleBookingRouteParams(params),
    parseScheduleSearchParams(searchParams),
  ]);
  const preview = await loadBookingPreviewOrNotFound(
    createSchedulePageService(),
    actor,
    { bookingReference, workDate },
  );

  return (
    <BookingSchedulePanel
      action={confirmScheduleAction}
      locale={locale}
      preview={presentBookingSchedulePreview(preview, locale)}
    />
  );
}
