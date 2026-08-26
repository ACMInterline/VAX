import Link from "next/link";
import { TechnicianJobList } from "@/components/job-execution";
import { jobExecutionContent } from "@/components/job-execution/content";
import { jobStatuses } from "@/modules/job-execution/types";
import { CreateJobFromBookingForm } from "./_components/job-management-forms";
import {
  createJobPageService,
  loadActiveJobTeamOptions,
  parseJobSearchParams,
  requireJobPageContext,
  type JobSearchParams,
} from "./_lib/job-page";
import { presentJobPage } from "./_lib/job-presentation";
import { createJobFromBookingAction } from "./actions";

export const dynamic = "force-dynamic";

const content = {
  bg: {
    eyebrow: "Работа на терен",
    title: "Работни задачи",
    intro: "Планиране, изпълнение и безопасен преглед на задачите на терен.",
    search: "Референция, клиент или имот",
    status: "Статус",
    team: "Екип",
    from: "От дата",
    to: "До дата",
    review: "Служебен преглед",
    all: "Всички",
    required: "Изисква се",
    notRequired: "Не се изисква",
    apply: "Приложи",
    clear: "Изчисти",
    previous: "Предишна",
    next: "Следваща",
    page: (page: number, total: number) => `Страница ${page} · ${total} задачи`,
  },
  en: {
    eyebrow: "Field operations",
    title: "Field jobs",
    intro: "Schedule, execute, and safely review operational field jobs.",
    search: "Reference, customer, or property",
    status: "Status",
    team: "Team",
    from: "From date",
    to: "Through date",
    review: "Staff review",
    all: "All",
    required: "Required",
    notRequired: "Not required",
    apply: "Apply",
    clear: "Clear",
    previous: "Previous",
    next: "Next",
    page: (page: number, total: number) => `Page ${page} · ${total} jobs`,
  },
} as const;

function pageHref(
  page: number,
  values: Readonly<Record<string, string | undefined>>,
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    if (value) query.set(name, value);
  }
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/app/jobs?${suffix}` : "/app/jobs";
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<JobSearchParams>;
}) {
  const { actor, locale } = await requireJobPageContext();
  const parsed = await parseJobSearchParams(searchParams);
  const canSeeTeamFilter = actor.permissions.has("CUSTOMER_RECORDS_READ");
  const managementPermissions = [
    "FIELD_JOBS_READ",
    "OPERATIONS_MANAGE",
    "SCHEDULE_MANAGE",
  ] as const;
  const canCreateJobs = managementPermissions.every((permission) =>
    actor.permissions.has(permission),
  );
  const [result, teamOptions] = await Promise.all([
    createJobPageService().listJobs(actor, parsed.filters),
    canSeeTeamFilter || canCreateJobs
      ? loadActiveJobTeamOptions()
      : Promise.resolve(null),
  ]);
  const teams = teamOptions ?? [];
  const text = content[locale];
  const jobs = presentJobPage(result, locale);
  const hasPrevious = parsed.page > 1;
  const hasNext = result.offset + result.items.length < result.total;

  return (
    <section className="crm-page job-page" aria-labelledby="jobs-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 id="jobs-heading">{text.title}</h1>
          <p>{text.intro}</p>
        </div>
      </header>
      {canCreateJobs ? (
        <section className="crm-management-card">
          <CreateJobFromBookingForm
            action={createJobFromBookingAction}
            locale={locale}
          />
        </section>
      ) : null}
      <form className="crm-filters" method="get" action="/app/jobs">
        <label>
          <span>{text.search}</span>
          <input
            name="search"
            type="search"
            maxLength={160}
            defaultValue={parsed.values.search}
          />
        </label>
        <label>
          <span>{text.status}</span>
          <select name="status" defaultValue={parsed.values.status ?? ""}>
            <option value="">{text.all}</option>
            {jobStatuses.map((status) => (
              <option key={status} value={status}>
                {jobExecutionContent[locale].statuses[status].label}
              </option>
            ))}
          </select>
        </label>
        {canSeeTeamFilter ? (
          <label>
            <span>{text.team}</span>
            <select name="teamId" defaultValue={parsed.values.teamId ?? ""}>
              <option value="">{text.all}</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.label}</option>)}
            </select>
          </label>
        ) : null}
        <label>
          <span>{text.from}</span>
          <input name="scheduledFrom" type="date" defaultValue={parsed.values.scheduledFrom} />
        </label>
        <label>
          <span>{text.to}</span>
          <input name="scheduledTo" type="date" defaultValue={parsed.values.scheduledTo} />
        </label>
        <label>
          <span>{text.review}</span>
          <select name="manualReview" defaultValue={parsed.values.manualReview ?? ""}>
            <option value="">{text.all}</option>
            <option value="true">{text.required}</option>
            <option value="false">{text.notRequired}</option>
          </select>
        </label>
        <div className="crm-filters__actions">
          <button className="crm-form__submit" type="submit">{text.apply}</button>
          <Link className="crm-button" href="/app/jobs">{text.clear}</Link>
        </div>
      </form>
      <p className="crm-page__summary">{text.page(parsed.page, result.total)}</p>
      <TechnicianJobList jobs={jobs} locale={locale} />
      <nav className="crm-pagination" aria-label={text.title}>
        {hasPrevious ? <Link href={pageHref(parsed.page - 1, parsed.values)}>{text.previous}</Link> : <span />}
        {hasNext ? <Link href={pageHref(parsed.page + 1, parsed.values)}>{text.next}</Link> : <span />}
      </nav>
    </section>
  );
}
