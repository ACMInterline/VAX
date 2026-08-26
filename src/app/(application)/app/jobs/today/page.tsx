import Link from "next/link";
import { redirect } from "next/navigation";
import { TechnicianJobList } from "@/components/job-execution/job-cards";
import { schedulingContent } from "@/content/scheduling";
import {
  requireTechnicianTodayRead,
  SchedulingAuthorizationError,
} from "@/modules/scheduling-dispatch/policy";
import {
  sofiaDayBounds,
  sofiaTodayDate,
} from "@/modules/scheduling-dispatch/time";
import {
  createJobPageService,
  requireJobPageContext,
} from "../_lib/job-page";
import { presentJobPage } from "../_lib/job-presentation";

export const dynamic = "force-dynamic";

export default async function TodayJobsPage() {
  const { actor, locale } = await requireJobPageContext();
  try {
    requireTechnicianTodayRead(actor);
  } catch (error) {
    if (error instanceof SchedulingAuthorizationError) {
      redirect("/app?access=denied");
    }
    throw error;
  }
  const workDate = sofiaTodayDate();
  const { startInclusive, endExclusive } = sofiaDayBounds(workDate);
  const result = await createJobPageService().listJobs(actor, {
    scheduledFrom: startInclusive,
    scheduledTo: endExclusive,
    limit: 100,
    offset: 0,
  });
  const content = schedulingContent[locale];

  return (
    <section className="crm-page job-page" aria-labelledby="today-jobs-heading">
      <Link className="crm-back-link" href="/app/jobs">
        {content.today.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.today.eyebrow}</p>
          <h1 id="today-jobs-heading">{content.today.title}</h1>
          <p>{content.today.intro}</p>
        </div>
      </header>
      <p>
        <time dateTime={workDate}>{content.common.date(workDate)}</time>
        {" · Europe/Sofia"}
      </p>
      <TechnicianJobList jobs={presentJobPage(result, locale)} locale={locale} />
    </section>
  );
}
