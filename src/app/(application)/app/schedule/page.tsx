import { DispatchBoard } from "@/components/scheduling/dispatch-board";
import {
  createSchedulePageService,
  parseScheduleSearchParams,
  presentDispatchDay,
  requireSchedulePageContext,
  type ScheduleSearchParams,
} from "./_lib/schedule-page";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<ScheduleSearchParams>;
}) {
  const { actor, locale } = await requireSchedulePageContext();
  const workDate = await parseScheduleSearchParams(searchParams);
  const includeRevenue = actor.permissions.has("COMMERCIAL_RULES_READ");
  const day = await createSchedulePageService().getDispatchDay(actor, {
    workDate,
    includeRevenue,
  });

  return (
    <DispatchBoard
      day={presentDispatchDay(day, locale)}
      includeRevenue={includeRevenue}
      locale={locale}
    />
  );
}
