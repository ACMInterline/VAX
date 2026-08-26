import Link from "next/link";
import {
  JobCompletionForm,
  JobItemInspectionForm,
  JobItemProgressForm,
  JobItemTreatmentCompletionForm,
  JobItemTreatmentPlanForm,
  JobProgressForm,
  TechnicianJobDetailCard,
} from "@/components/job-execution";
import {
  AssignJobTeamForm,
  CancelJobForm,
} from "../_components/job-management-forms";
import {
  completeJobAction,
  completeJobItemTreatmentAction,
  confirmJobItemTreatmentPlanAction,
  assignJobTeamAction,
  cancelJobAction,
  progressJobAction,
  recordJobItemInspectionAction,
  startJobItemTreatmentAction,
} from "../actions";
import {
  createJobPageService,
  loadJobOrNotFound,
  loadJobRouteOptions,
  parseJobRouteParams,
  referenceData,
  requireJobPageContext,
  type JobRouteParams,
} from "../_lib/job-page";
import {
  presentJobDetail,
  treatmentExecutionOptions,
  treatmentPlanOptions,
} from "../_lib/job-presentation";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<JobRouteParams>;
}) {
  const { actor, locale } = await requireJobPageContext();
  const route = await parseJobRouteParams(params);
  const service = createJobPageService();
  const [job, options] = await Promise.all([
    loadJobOrNotFound(service, actor, route.jobReference),
    loadJobRouteOptions(locale),
  ]);
  const references = referenceData(options);
  const view = presentJobDetail(job, references, locale);
  const canUpdate = actor.permissions.has("FIELD_JOBS_UPDATE");
  const managementPermissions = [
    "FIELD_JOBS_READ",
    "OPERATIONS_MANAGE",
    "SCHEDULE_MANAGE",
  ] as const;
  const canManageJob = managementPermissions.every((permission) =>
    actor.permissions.has(permission),
  );
  const canPrepare =
    canManageJob && ["PREPARED", "READY"].includes(job.status);
  const completionReady =
    job.status === "IN_PROGRESS" &&
    job.items.length > 0 &&
    job.items.every((item) =>
      ["COMPLETED", "DECLINED", "REFERRED"].includes(item.status),
    );
  const back = locale === "bg" ? "Към работните задачи" : "Back to field jobs";
  const workflowTitle = locale === "bg" ? "Изпълнение" : "Execution workflow";

  return (
    <section className="crm-page job-page" aria-labelledby="job-detail-route-heading">
      <Link className="crm-back-link" href="/app/jobs">{back}</Link>
      <h1 id="job-detail-route-heading" className="sr-only">{view.reference}</h1>
      <TechnicianJobDetailCard job={view} locale={locale} />

      {canPrepare ? (
        <section className="crm-management-card">
          <AssignJobTeamForm
            action={assignJobTeamAction}
            expectedJobVersion={job.version}
            jobReference={job.jobReference}
            locale={locale}
            teams={options.teams}
          />
          <CancelJobForm
            action={cancelJobAction}
            expectedJobVersion={job.version}
            jobReference={job.jobReference}
            locale={locale}
          />
        </section>
      ) : null}

      {canUpdate ? (
        <section className="crm-management-card" aria-labelledby="job-workflow-heading">
          <h2 id="job-workflow-heading">{workflowTitle}</h2>
          {job.status === "READY" ? (
            <JobProgressForm action={progressJobAction} expectedJobVersion={job.version} jobReference={job.jobReference} locale={locale} operation="START_TRAVEL" />
          ) : null}
          {job.status === "EN_ROUTE" ? (
            <JobProgressForm action={progressJobAction} expectedJobVersion={job.version} jobReference={job.jobReference} locale={locale} operation="MARK_ARRIVED" />
          ) : null}
          {job.status === "ARRIVED" ? (
            <JobProgressForm action={progressJobAction} expectedJobVersion={job.version} jobReference={job.jobReference} locale={locale} operation="START_WORK" />
          ) : null}

          {job.status === "IN_PROGRESS"
            ? job.items.map((item) => {
                if (item.status === "PENDING_INSPECTION") {
                  return (
                    <JobItemInspectionForm
                      key={item.id}
                      action={recordJobItemInspectionAction}
                      expectedItemVersion={item.version}
                      expectedJobVersion={job.version}
                      jobItemId={item.id}
                      jobReference={job.jobReference}
                      locale={locale}
                      options={references}
                    />
                  );
                }
                if (item.status === "INSPECTED" && item.inspection) {
                  return (
                    <JobItemTreatmentPlanForm
                      key={item.id}
                      action={confirmJobItemTreatmentPlanAction}
                      expectedItemVersion={item.version}
                      expectedJobVersion={job.version}
                      jobItemId={item.id}
                      jobReference={job.jobReference}
                      locale={locale}
                      options={treatmentPlanOptions(
                        references,
                        item.planned.quotedAddonIds,
                      )}
                      sourceInspectionId={item.inspection.id}
                    />
                  );
                }
                if (item.status === "TREATMENT_CONFIRMED" && item.treatmentPlan) {
                  return (
                    <JobItemProgressForm
                      key={item.id}
                      action={startJobItemTreatmentAction}
                      expectedItemVersion={item.version}
                      expectedJobVersion={job.version}
                      jobItemId={item.id}
                      jobReference={job.jobReference}
                      locale={locale}
                      operation="START_TREATMENT"
                      treatmentPlanId={item.treatmentPlan.id}
                    />
                  );
                }
                if (item.status === "IN_PROGRESS" && item.treatmentExecution) {
                  return (
                    <JobItemTreatmentCompletionForm
                      key={item.id}
                      action={completeJobItemTreatmentAction}
                      expectedItemVersion={item.version}
                      expectedJobVersion={job.version}
                      expectedTreatmentExecutionVersion={item.treatmentExecution.version}
                      jobItemId={item.id}
                      jobReference={job.jobReference}
                      locale={locale}
                      options={treatmentExecutionOptions(references)}
                      treatmentExecutionId={item.treatmentExecution.id}
                    />
                  );
                }
                return null;
              })
            : null}

          {completionReady ? (
            <JobCompletionForm action={completeJobAction} expectedJobVersion={job.version} jobReference={job.jobReference} locale={locale} />
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
