"use client";

import type { AuthLocale } from "@/auth/validation";
import { jobExecutionContent } from "./content";
import {
  JobFieldError,
  JobFormFeedback,
  JobSubmitButton,
  jobFieldAccessibility,
  jobFormId,
  useJobAction,
} from "./form-support";
import type {
  InspectionFormOptions,
  JobFormAction,
  JobItemProgressOperation,
  JobProgressOperation,
  TreatmentExecutionFormOptions,
  TreatmentPlanFormOptions,
} from "./types";

function JobAuthorityFields({
  expectedJobVersion,
  jobReference,
}: {
  expectedJobVersion: number;
  jobReference: string;
}) {
  return (
    <>
      <input type="hidden" name="jobReference" value={jobReference} />
      <input
        type="hidden"
        name="expectedJobVersion"
        value={expectedJobVersion}
      />
    </>
  );
}

function JobItemAuthorityFields({
  expectedItemVersion,
  jobItemId,
}: {
  expectedItemVersion: number;
  jobItemId: string;
}) {
  return (
    <>
      <input type="hidden" name="jobItemId" value={jobItemId} />
      <input
        type="hidden"
        name="expectedJobItemVersion"
        value={expectedItemVersion}
      />
    </>
  );
}

export function JobProgressForm({
  action,
  expectedJobVersion,
  jobReference,
  locale,
  operation,
}: {
  action: JobFormAction;
  expectedJobVersion: number;
  jobReference: string;
  locale: AuthLocale;
  operation: JobProgressOperation;
}) {
  const [state, formAction, pending] = useJobAction(action);
  const content = jobExecutionContent[locale];
  const formId = jobFormId("job-progress", `${jobReference}-${operation}`);
  return (
    <form
      id={formId}
      className="crm-form job-progress-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <h3>{content.forms.progressTitle}</h3>
      <p className="crm-form__notice">{content.forms.progressIntro}</p>
      <JobAuthorityFields
        expectedJobVersion={expectedJobVersion}
        jobReference={jobReference}
      />
      <input type="hidden" name="operation" value={operation} />
      <JobFormFeedback fields={[]} state={state} title={content.forms.check} />
      <div className="crm-form__actions">
        <JobSubmitButton
          idleLabel={content.progressOperations[operation]}
          pending={pending}
          pendingLabel={content.forms.pending}
        />
      </div>
    </form>
  );
}

export function JobItemInspectionForm({
  action,
  expectedItemVersion,
  expectedJobVersion,
  jobItemId,
  jobReference,
  locale,
  options,
}: {
  action: JobFormAction;
  expectedItemVersion: number;
  expectedJobVersion: number;
  jobItemId: string;
  jobReference: string;
  locale: AuthLocale;
  options: InspectionFormOptions;
}) {
  const [state, formAction, pending] = useJobAction(action);
  const content = jobExecutionContent[locale].forms;
  const prefix = jobFormId("job-inspection", jobItemId);
  const itemTypeId = `${prefix}-item-type`;
  const measurementModeId = `${prefix}-measurement-mode`;
  const quantityId = `${prefix}-quantity`;
  const areaId = `${prefix}-area`;
  const seatCountId = `${prefix}-seat-count`;
  const sidesId = `${prefix}-sides`;
  const conditionId = `${prefix}-condition`;
  const materialId = `${prefix}-material`;
  const constructionId = `${prefix}-construction`;
  const issuesId = `${prefix}-issues`;
  const risksId = `${prefix}-risks`;
  const damageId = `${prefix}-existing-damage`;
  const damageNotesId = `${prefix}-existing-damage-notes`;
  const notesId = `${prefix}-technician-notes`;
  const fields = [
    { name: "observedCleaningItemTypeId", id: itemTypeId, label: content.cleaningItemType },
    { name: "measurementModeId", id: measurementModeId, label: content.measurementMode },
    { name: "quantity", id: quantityId, label: content.quantity },
    { name: "areaHundredthsM2", id: areaId, label: content.areaHundredthsM2 },
    { name: "seatCount", id: seatCountId, label: content.seatCount },
    { name: "sides", id: sidesId, label: content.sides },
    { name: "observedConditionLevelId", id: conditionId, label: content.condition },
    { name: "confirmedFibreMaterialId", id: materialId, label: content.material },
    { name: "confirmedSurfaceConstructionId", id: constructionId, label: content.construction },
    { name: "issues", id: issuesId, label: content.issues },
    { name: "risks", id: risksId, label: content.risks },
    { name: "existingDamageNotes", id: damageNotesId, label: content.existingDamageNotes },
    { name: "technicianNotes", id: notesId, label: content.technicianNotes },
    { name: "_form", id: prefix, label: content.inspectionTitle },
  ] as const;

  return (
    <form
      id={prefix}
      className="crm-form job-inspection-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <h3>{content.inspectionTitle}</h3>
      <p className="crm-form__notice">{content.inspectionIntro}</p>
      <JobAuthorityFields
        expectedJobVersion={expectedJobVersion}
        jobReference={jobReference}
      />
      <JobItemAuthorityFields
        expectedItemVersion={expectedItemVersion}
        jobItemId={jobItemId}
      />
      <JobFormFeedback fields={fields} state={state} title={content.check} />
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor={itemTypeId}>{content.cleaningItemType}</label>
          <select id={itemTypeId} name="observedCleaningItemTypeId" required defaultValue="" {...jobFieldAccessibility(state, "observedCleaningItemTypeId", itemTypeId)}>
            <option value="" disabled>{content.choose}</option>
            {options.cleaningItemTypes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <JobFieldError fieldId={itemTypeId} name="observedCleaningItemTypeId" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={measurementModeId}>{content.measurementMode}</label>
          <select id={measurementModeId} name="measurementModeId" required defaultValue="" {...jobFieldAccessibility(state, "measurementModeId", measurementModeId)}>
            <option value="" disabled>{content.choose}</option>
            {options.measurementModes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <JobFieldError fieldId={measurementModeId} name="measurementModeId" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={quantityId}>{content.quantity}</label>
          <input id={quantityId} name="quantity" type="number" min={1} max={100_000} step={1} defaultValue={1} required {...jobFieldAccessibility(state, "quantity", quantityId)} />
          <JobFieldError fieldId={quantityId} name="quantity" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={areaId}>{content.areaHundredthsM2}</label>
          <input id={areaId} name="areaHundredthsM2" type="number" min={1} max={100_000_000} step={1} {...jobFieldAccessibility(state, "areaHundredthsM2", areaId)} />
          <JobFieldError fieldId={areaId} name="areaHundredthsM2" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={seatCountId}>{content.seatCount}</label>
          <input id={seatCountId} name="seatCount" type="number" min={1} max={10_000} step={1} {...jobFieldAccessibility(state, "seatCount", seatCountId)} />
          <JobFieldError fieldId={seatCountId} name="seatCount" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={sidesId}>{content.sides}</label>
          <select id={sidesId} name="sides" defaultValue="" {...jobFieldAccessibility(state, "sides", sidesId)}>
            <option value="">{content.choose}</option>
            <option value="1">{content.oneSide}</option>
            <option value="2">{content.twoSides}</option>
          </select>
          <JobFieldError fieldId={sidesId} name="sides" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={conditionId}>{content.condition}</label>
          <select
            id={conditionId}
            name="observedConditionLevelId"
            required
            defaultValue=""
            {...jobFieldAccessibility(state, "observedConditionLevelId", conditionId)}
          >
            <option value="" disabled>{content.choose}</option>
            {options.conditions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <JobFieldError fieldId={conditionId} name="observedConditionLevelId" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={materialId}>{content.material}</label>
          <select
            id={materialId}
            name="confirmedFibreMaterialId"
            required
            defaultValue=""
            {...jobFieldAccessibility(state, "confirmedFibreMaterialId", materialId)}
          >
            <option value="" disabled>{content.choose}</option>
            {options.materials.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <JobFieldError fieldId={materialId} name="confirmedFibreMaterialId" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={constructionId}>{content.construction}</label>
          <select
            id={constructionId}
            name="confirmedSurfaceConstructionId"
            required
            defaultValue=""
            {...jobFieldAccessibility(state, "confirmedSurfaceConstructionId", constructionId)}
          >
            <option value="" disabled>{content.choose}</option>
            {options.constructions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <JobFieldError fieldId={constructionId} name="confirmedSurfaceConstructionId" state={state} />
        </div>
      </div>
      <fieldset className="crm-form__section">
        <legend>{content.inspectionTitle}</legend>
        <div className="crm-form__choices">
          <label className="crm-form__choice" htmlFor={damageId}><input id={damageId} type="checkbox" name="existingDamageObserved" value="true" /><span>{content.existingDamage}</span></label>
          <label className="crm-form__choice"><input type="checkbox" name="colourfastnessConcern" value="true" /><span>{content.colourfastnessConcern}</span></label>
          <label className="crm-form__choice"><input type="checkbox" name="moistureSensitivity" value="true" /><span>{content.moistureSensitivity}</span></label>
          <label className="crm-form__choice"><input type="checkbox" name="unsafeContaminationObserved" value="true" /><span>{content.unsafeContamination}</span></label>
          <label className="crm-form__choice"><input type="checkbox" name="unsafeStructuralConditionObserved" value="true" /><span>{content.unsafeStructure}</span></label>
        </div>
      </fieldset>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={damageNotesId}>{content.existingDamageNotes}</label>
        <textarea id={damageNotesId} name="existingDamageNotes" maxLength={2_000} {...jobFieldAccessibility(state, "existingDamageNotes", damageNotesId)} />
        <JobFieldError fieldId={damageNotesId} name="existingDamageNotes" state={state} />
      </div>
      <fieldset id={issuesId} className="crm-form__section">
        <legend>{content.issues}</legend>
        <div className="crm-form__choices">
          {options.issues.map((option) => (
            <label className="crm-form__choice" key={option.id}>
              <input type="checkbox" name="issueTypeIds" value={option.id} />
              <span>{option.label}</span>
            </label>
          ))}
          <label className="crm-form__choice">
            <input type="checkbox" name="noKnownIssuesAcknowledged" value="true" />
            <span>{content.noKnownIssues}</span>
          </label>
        </div>
        <JobFieldError fieldId={issuesId} name="issues" state={state} />
      </fieldset>
      <fieldset id={risksId} className="crm-form__section">
        <legend>{content.risks}</legend>
        <div className="crm-form__choices">
          {options.risks.map((option) => (
            <label className="crm-form__choice" key={option.id}>
              <input type="checkbox" name="riskFlagIds" value={option.id} />
              <span>{option.label}</span>
            </label>
          ))}
          <label className="crm-form__choice">
            <input type="checkbox" name="noKnownRisksAcknowledged" value="true" />
            <span>{content.noKnownRisks}</span>
          </label>
        </div>
        <JobFieldError fieldId={risksId} name="risks" state={state} />
      </fieldset>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={notesId}>{content.technicianNotes}</label>
        <textarea id={notesId} name="technicianNotes" maxLength={4_000} {...jobFieldAccessibility(state, "technicianNotes", notesId)} />
        <JobFieldError fieldId={notesId} name="technicianNotes" state={state} />
      </div>
      <div className="crm-form__actions">
        <JobSubmitButton idleLabel={content.submit} pending={pending} pendingLabel={content.pending} />
      </div>
    </form>
  );
}

export function JobItemTreatmentPlanForm({
  action,
  expectedItemVersion,
  expectedJobVersion,
  jobItemId,
  jobReference,
  locale,
  options,
  sourceInspectionId,
}: {
  action: JobFormAction;
  expectedItemVersion: number;
  expectedJobVersion: number;
  jobItemId: string;
  jobReference: string;
  locale: AuthLocale;
  options: TreatmentPlanFormOptions;
  sourceInspectionId: string;
}) {
  const [state, formAction, pending] = useJobAction(action);
  const content = jobExecutionContent[locale];
  const prefix = jobFormId("job-treatment-plan", jobItemId);
  const decisionId = `${prefix}-decision`;
  const treatmentLevelId = `${prefix}-treatment-level`;
  const mechanicalActionId = `${prefix}-mechanical-action`;
  const treatmentApproachId = `${prefix}-treatment-approach`;
  const addonsId = `${prefix}-addons`;
  const productId = `${prefix}-product`;
  const rationaleId = `${prefix}-rationale`;
  const acknowledgementId = `${prefix}-acknowledgement`;
  const fields = [
    { name: "decision", id: decisionId, label: content.forms.outcome },
    { name: "treatmentLevelId", id: treatmentLevelId, label: content.forms.treatmentLevel },
    { name: "mechanicalActionLevelId", id: mechanicalActionId, label: content.forms.mechanicalAction },
    { name: "treatmentApproachId", id: treatmentApproachId, label: content.forms.treatmentApproach },
    { name: "addonIds", id: addonsId, label: content.forms.addons },
    { name: "cleaningProductId", id: productId, label: content.forms.product },
    { name: "technicianRationale", id: rationaleId, label: content.forms.rationale },
    { name: "safetyAcknowledged", id: acknowledgementId, label: content.forms.safetyAcknowledgement },
    { name: "_form", id: prefix, label: content.forms.planTitle },
  ] as const;
  return (
    <form
      id={prefix}
      className="crm-form job-treatment-plan-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <h3>{content.forms.planTitle}</h3>
      <p className="crm-form__notice">{content.forms.planIntro}</p>
      <JobAuthorityFields expectedJobVersion={expectedJobVersion} jobReference={jobReference} />
      <JobItemAuthorityFields expectedItemVersion={expectedItemVersion} jobItemId={jobItemId} />
      <input type="hidden" name="sourceInspectionId" value={sourceInspectionId} />
      <JobFormFeedback fields={fields} state={state} title={content.forms.check} />
      <fieldset id={decisionId} className="crm-form__section">
        <legend>{content.forms.outcome}</legend>
        <div className="crm-form__choices">
          {(["PERFORM", "PERFORM_WITH_LIMITATIONS", "DECLINE", "REFER", "REQUIRES_REVIEW"] as const).map((decision) => (
            <label className="crm-form__choice" key={decision}>
              <input type="radio" name="decision" value={decision} required />
              <span>{content.planDecisions[decision]}</span>
            </label>
          ))}
        </div>
        <JobFieldError fieldId={decisionId} name="decision" state={state} />
      </fieldset>
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor={treatmentLevelId}>{content.forms.treatmentLevel}</label>
          <select id={treatmentLevelId} name="treatmentLevelId" defaultValue="" {...jobFieldAccessibility(state, "treatmentLevelId", treatmentLevelId)}>
            <option value="">{content.forms.choose}</option>
            {options.treatmentLevels.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <JobFieldError fieldId={treatmentLevelId} name="treatmentLevelId" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={mechanicalActionId}>{content.forms.mechanicalAction}</label>
          <select id={mechanicalActionId} name="mechanicalActionLevelId" defaultValue="" {...jobFieldAccessibility(state, "mechanicalActionLevelId", mechanicalActionId)}>
            <option value="">{content.forms.choose}</option>
            {options.mechanicalActions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <JobFieldError fieldId={mechanicalActionId} name="mechanicalActionLevelId" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={treatmentApproachId}>{content.forms.treatmentApproach}</label>
          <select id={treatmentApproachId} name="treatmentApproachId" defaultValue="" {...jobFieldAccessibility(state, "treatmentApproachId", treatmentApproachId)}>
            <option value="">{content.forms.choose}</option>
            {options.treatmentApproaches.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <JobFieldError fieldId={treatmentApproachId} name="treatmentApproachId" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={productId}>{content.forms.product}</label>
          <select id={productId} name="cleaningProductId" defaultValue="" {...jobFieldAccessibility(state, "cleaningProductId", productId)}>
            <option value="">{content.forms.choose}</option>
            {options.products.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <JobFieldError fieldId={productId} name="cleaningProductId" state={state} />
        </div>
      </div>
      <fieldset id={addonsId} className="crm-form__section">
        <legend>{content.forms.addons}</legend>
        <div className="crm-form__choices">
          {options.addons.map((option) => (
            <label className="crm-form__choice" key={option.id}>
              <input type="checkbox" name="addonIds" value={option.id} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <JobFieldError fieldId={addonsId} name="addonIds" state={state} />
      </fieldset>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={rationaleId}>{content.forms.rationale}</label>
        <textarea id={rationaleId} name="technicianRationale" maxLength={2_000} required {...jobFieldAccessibility(state, "technicianRationale", rationaleId)} />
        <JobFieldError fieldId={rationaleId} name="technicianRationale" state={state} />
      </div>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={acknowledgementId} className="crm-form__choice">
          <input
            id={acknowledgementId}
            type="checkbox"
            name="safetyAcknowledged"
            value="true"
            required
            {...jobFieldAccessibility(state, "safetyAcknowledged", acknowledgementId)}
          />
          <span>{content.forms.safetyAcknowledgement}</span>
        </label>
        <JobFieldError fieldId={acknowledgementId} name="safetyAcknowledged" state={state} />
      </div>
      <div className="crm-form__actions">
        <JobSubmitButton idleLabel={content.forms.submit} pending={pending} pendingLabel={content.forms.pending} />
      </div>
    </form>
  );
}

export function JobItemProgressForm({
  action,
  expectedItemVersion,
  expectedJobVersion,
  jobItemId,
  jobReference,
  locale,
  operation,
  treatmentPlanId,
}: {
  action: JobFormAction;
  expectedItemVersion: number;
  expectedJobVersion: number;
  jobItemId: string;
  jobReference: string;
  locale: AuthLocale;
  operation: JobItemProgressOperation;
  treatmentPlanId: string;
}) {
  const [state, formAction, pending] = useJobAction(action);
  const content = jobExecutionContent[locale];
  const formId = jobFormId("job-item-progress", `${jobItemId}-${operation}`);
  return (
    <form id={formId} className="crm-form job-item-progress-form" action={formAction} aria-busy={pending} noValidate>
      <h3>{content.forms.itemProgressTitle}</h3>
      <JobAuthorityFields expectedJobVersion={expectedJobVersion} jobReference={jobReference} />
      <JobItemAuthorityFields expectedItemVersion={expectedItemVersion} jobItemId={jobItemId} />
      <input type="hidden" name="treatmentPlanId" value={treatmentPlanId} />
      <input type="hidden" name="operation" value={operation} />
      <JobFormFeedback fields={[]} state={state} title={content.forms.check} />
      <div className="crm-form__actions">
        <JobSubmitButton idleLabel={content.itemProgressOperations[operation]} pending={pending} pendingLabel={content.forms.pending} />
      </div>
    </form>
  );
}

export function JobItemTreatmentCompletionForm({
  action,
  expectedItemVersion,
  expectedJobVersion,
  expectedTreatmentExecutionVersion,
  jobItemId,
  jobReference,
  locale,
  options,
  treatmentExecutionId,
}: {
  action: JobFormAction;
  expectedItemVersion: number;
  expectedJobVersion: number;
  expectedTreatmentExecutionVersion: number;
  jobItemId: string;
  jobReference: string;
  locale: AuthLocale;
  options: TreatmentExecutionFormOptions;
  treatmentExecutionId: string;
}) {
  const [state, formAction, pending] = useJobAction(action);
  const content = jobExecutionContent[locale];
  const prefix = jobFormId("job-treatment-completion", jobItemId);
  const levelId = `${prefix}-level`;
  const mechanicalId = `${prefix}-mechanical`;
  const approachId = `${prefix}-approach`;
  const addonsId = `${prefix}-addons`;
  const productId = `${prefix}-product`;
  const resultId = `${prefix}-result`;
  const notesId = `${prefix}-notes`;
  const fields = [
    { name: "performedTreatmentLevelId", id: levelId, label: content.forms.treatmentLevel },
    { name: "performedMechanicalActionLevelId", id: mechanicalId, label: content.forms.mechanicalAction },
    { name: "performedTreatmentApproachId", id: approachId, label: content.forms.treatmentApproach },
    { name: "performedAddonIds", id: addonsId, label: content.forms.addons },
    { name: "cleaningProductId", id: productId, label: content.forms.product },
    { name: "resultClassification", id: resultId, label: content.forms.resultClassification },
    { name: "technicianNotes", id: notesId, label: content.forms.technicianNotes },
    { name: "_form", id: prefix, label: content.forms.treatmentCompletionTitle },
  ] as const;
  return (
    <form id={prefix} className="crm-form job-treatment-completion-form" action={formAction} aria-busy={pending} noValidate>
      <h3>{content.forms.treatmentCompletionTitle}</h3>
      <JobAuthorityFields expectedJobVersion={expectedJobVersion} jobReference={jobReference} />
      <JobItemAuthorityFields expectedItemVersion={expectedItemVersion} jobItemId={jobItemId} />
      <input type="hidden" name="treatmentExecutionId" value={treatmentExecutionId} />
      <input type="hidden" name="expectedTreatmentExecutionVersion" value={expectedTreatmentExecutionVersion} />
      <JobFormFeedback fields={fields} state={state} title={content.forms.check} />
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor={levelId}>{content.forms.treatmentLevel}</label>
          <select id={levelId} name="performedTreatmentLevelId" defaultValue="" required {...jobFieldAccessibility(state, "performedTreatmentLevelId", levelId)}>
            <option value="" disabled>{content.forms.choose}</option>
            {options.treatmentLevels.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <JobFieldError fieldId={levelId} name="performedTreatmentLevelId" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={mechanicalId}>{content.forms.mechanicalAction}</label>
          <select id={mechanicalId} name="performedMechanicalActionLevelId" defaultValue="" required {...jobFieldAccessibility(state, "performedMechanicalActionLevelId", mechanicalId)}>
            <option value="" disabled>{content.forms.choose}</option>
            {options.mechanicalActions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <JobFieldError fieldId={mechanicalId} name="performedMechanicalActionLevelId" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={approachId}>{content.forms.treatmentApproach}</label>
          <select id={approachId} name="performedTreatmentApproachId" defaultValue="" required {...jobFieldAccessibility(state, "performedTreatmentApproachId", approachId)}>
            <option value="" disabled>{content.forms.choose}</option>
            {options.treatmentApproaches.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <JobFieldError fieldId={approachId} name="performedTreatmentApproachId" state={state} />
        </div>
        <div className="crm-form__field">
          <label htmlFor={productId}>{content.forms.product}</label>
          <select id={productId} name="cleaningProductId" defaultValue="" {...jobFieldAccessibility(state, "cleaningProductId", productId)}>
            <option value="">{content.forms.choose}</option>
            {options.products.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <JobFieldError fieldId={productId} name="cleaningProductId" state={state} />
        </div>
      </div>
      <fieldset id={addonsId} className="crm-form__section">
        <legend>{content.forms.addons}</legend>
        <div className="crm-form__choices">
          {options.addons.map((option) => <label className="crm-form__choice" key={option.id}><input type="checkbox" name="performedAddonIds" value={option.id} /><span>{option.label}</span></label>)}
        </div>
        <JobFieldError fieldId={addonsId} name="performedAddonIds" state={state} />
      </fieldset>
      <fieldset id={resultId} className="crm-form__section">
        <legend>{content.forms.resultClassification}</legend>
        <div className="crm-form__choices">
          {(["COMPLETED_AS_PLANNED", "COMPLETED_WITH_LIMITATIONS", "PARTIAL_IMPROVEMENT", "NO_OBSERVABLE_IMPROVEMENT", "STOPPED_FOR_SAFETY"] as const).map((result) => (
            <label className="crm-form__choice" key={result}><input type="radio" name="resultClassification" value={result} required /><span>{content.resultClassifications[result]}</span></label>
          ))}
        </div>
        <JobFieldError fieldId={resultId} name="resultClassification" state={state} />
      </fieldset>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={notesId}>{content.forms.technicianNotes}</label>
        <textarea id={notesId} name="technicianNotes" maxLength={4_000} {...jobFieldAccessibility(state, "technicianNotes", notesId)} />
        <JobFieldError fieldId={notesId} name="technicianNotes" state={state} />
      </div>
      <div className="crm-form__actions"><JobSubmitButton idleLabel={content.forms.submit} pending={pending} pendingLabel={content.forms.pending} /></div>
    </form>
  );
}

export function JobCompletionForm({
  action,
  expectedJobVersion,
  jobReference,
  locale,
}: {
  action: JobFormAction;
  expectedJobVersion: number;
  jobReference: string;
  locale: AuthLocale;
}) {
  const [state, formAction, pending] = useJobAction(action);
  const content = jobExecutionContent[locale].forms;
  const prefix = jobFormId("job-completion", jobReference);
  const summaryId = `${prefix}-summary`;
  const careId = `${prefix}-care`;
  const internalNotesId = `${prefix}-internal-notes`;
  const acknowledgementId = `${prefix}-acknowledgement`;
  const fields = [
    { name: "internalCompletionNotes", id: internalNotesId, label: content.internalCompletionNotes },
    { name: "customerVisibleCompletionNotes", id: summaryId, label: content.customerSummary },
    { name: "customerVisibleCareNotes", id: careId, label: content.careInstructions },
    { name: "completionAcknowledged", id: acknowledgementId, label: content.completionAcknowledgement },
    { name: "_form", id: prefix, label: content.completionTitle },
  ] as const;
  return (
    <form id={prefix} className="crm-form job-completion-form" action={formAction} aria-busy={pending} noValidate>
      <h3>{content.completionTitle}</h3>
      <p className="crm-form__notice">{content.completionIntro}</p>
      <JobAuthorityFields expectedJobVersion={expectedJobVersion} jobReference={jobReference} />
      <JobFormFeedback fields={fields} state={state} title={content.check} />
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={internalNotesId}>{content.internalCompletionNotes}</label>
        <textarea id={internalNotesId} name="internalCompletionNotes" maxLength={4_000} required {...jobFieldAccessibility(state, "internalCompletionNotes", internalNotesId)} />
        <JobFieldError fieldId={internalNotesId} name="internalCompletionNotes" state={state} />
      </div>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={summaryId}>{content.customerSummary}</label>
        <textarea id={summaryId} name="customerVisibleCompletionNotes" maxLength={2_000} {...jobFieldAccessibility(state, "customerVisibleCompletionNotes", summaryId)} />
        <JobFieldError fieldId={summaryId} name="customerVisibleCompletionNotes" state={state} />
      </div>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={careId}>{content.careInstructions}</label>
        <textarea id={careId} name="customerVisibleCareNotes" maxLength={2_000} {...jobFieldAccessibility(state, "customerVisibleCareNotes", careId)} />
        <JobFieldError fieldId={careId} name="customerVisibleCareNotes" state={state} />
      </div>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={acknowledgementId} className="crm-form__choice">
          <input id={acknowledgementId} type="checkbox" name="completionAcknowledged" value="true" required {...jobFieldAccessibility(state, "completionAcknowledged", acknowledgementId)} />
          <span>{content.completionAcknowledgement}</span>
        </label>
        <JobFieldError fieldId={acknowledgementId} name="completionAcknowledged" state={state} />
      </div>
      <div className="crm-form__actions">
        <JobSubmitButton idleLabel={content.submit} pending={pending} pendingLabel={content.pending} />
      </div>
    </form>
  );
}
