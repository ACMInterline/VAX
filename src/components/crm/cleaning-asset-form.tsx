"use client";

import type { AuthLocale } from "@/auth/validation";
import { crmContent } from "@/content/crm";
import {
  crmStringValue,
  crmStringValues,
  type CrmFormAction,
} from "./action-state";
import { crmComponentContent } from "./component-content";
import type { CleaningAssetFormOptions } from "./form-options";
import {
  CrmFieldError,
  CrmFormFeedback,
  CrmSubmitButton,
  crmFieldAccessibility,
  crmFieldId,
  useCrmAction,
  type CrmFormFieldDefinition,
} from "./form-support";

export type CleaningAssetFormInitialValues = Readonly<{
  areaId?: string | null;
  cleaningItemTypeId?: number | null;
  label?: string;
  approximateLengthCm?: number | null;
  approximateWidthCm?: number | null;
  approximateAreaHundredthsM2?: number | null;
  approximateSeatCount?: number | null;
  reportedFibreMaterialId?: number | null;
  reportedSurfaceConstructionId?: number | null;
  customerReportedConditionLevelId?: number | null;
  customerConditionNotes?: string | null;
  colourAppearanceNotes?: string | null;
  approximateAcquisitionYear?: number | null;
  operationalNotes?: string | null;
  reportedIssueTypeIds?: readonly number[];
  reportedRiskFlagIds?: readonly number[];
}>;

export function CleaningAssetForm({
  action,
  initialValues,
  locale,
  options,
  propertyId,
}: {
  action: CrmFormAction;
  initialValues?: CleaningAssetFormInitialValues;
  locale: AuthLocale;
  options: CleaningAssetFormOptions;
  propertyId: string;
}) {
  const [state, formAction, pending] = useCrmAction(action);
  const content = crmContent[locale];
  const componentContent = crmComponentContent[locale];
  const prefix = `crm-asset-create-${propertyId}`;
  const fieldId = (name: string) => crmFieldId(prefix, name);
  const value = (
    name: string,
    fallback?: string | number | null,
  ): string => crmStringValue(state, name, fallback == null ? "" : String(fallback));
  const values = (name: string, fallback: readonly number[] = []) =>
    crmStringValues(
      state,
      name,
      fallback.map((entry) => String(entry)),
    );
  const fields: CrmFormFieldDefinition[] = [
    { name: "cleaningItemTypeId", id: fieldId("cleaningItemTypeId"), label: content.forms.asset.itemType },
    { name: "areaId", id: fieldId("areaId"), label: content.forms.asset.area },
    { name: "label", id: fieldId("label"), label: content.forms.asset.label },
    {
      name: "approximateLengthCm",
      id: fieldId("approximateLengthCm"),
      label: content.forms.asset.approximateLength,
    },
    {
      name: "approximateWidthCm",
      id: fieldId("approximateWidthCm"),
      label: content.forms.asset.approximateWidth,
    },
    {
      name: "approximateAreaHundredthsM2",
      id: fieldId("approximateAreaHundredthsM2"),
      label: content.forms.asset.approximateArea,
    },
    {
      name: "approximateSeatCount",
      id: fieldId("approximateSeatCount"),
      label: componentContent.approximateSeatCount,
    },
    {
      name: "reportedFibreMaterialId",
      id: fieldId("reportedFibreMaterialId"),
      label: content.forms.asset.material,
    },
    {
      name: "reportedSurfaceConstructionId",
      id: fieldId("reportedSurfaceConstructionId"),
      label: content.forms.asset.construction,
    },
    {
      name: "customerReportedConditionLevelId",
      id: fieldId("customerReportedConditionLevelId"),
      label: content.forms.asset.customerCondition,
    },
    {
      name: "customerConditionNotes",
      id: fieldId("customerConditionNotes"),
      label: content.forms.asset.customerCondition,
    },
    {
      name: "colourAppearanceNotes",
      id: fieldId("colourAppearanceNotes"),
      label: content.forms.asset.colourNotes,
    },
    {
      name: "approximateAcquisitionYear",
      id: fieldId("approximateAcquisitionYear"),
      label: content.forms.asset.acquisitionOrAge,
    },
    {
      name: "reportedIssueTypeIds",
      id: fieldId("reportedIssueTypeIds"),
      label: content.forms.asset.knownIssues,
    },
    {
      name: "reportedRiskFlagIds",
      id: fieldId("reportedRiskFlagIds"),
      label: content.forms.asset.riskFlags,
    },
    {
      name: "operationalNotes",
      id: fieldId("operationalNotes"),
      label: content.forms.asset.operationalNotes,
    },
  ];
  const canonicalHintId = `${prefix}-canonical-hint`;
  const conditionHintId = `${prefix}-condition-hint`;
  const noPriceHintId = `${prefix}-no-price-hint`;
  const selectedIssues = values(
    "reportedIssueTypeIds",
    initialValues?.reportedIssueTypeIds,
  );
  const selectedRisks = values(
    "reportedRiskFlagIds",
    initialValues?.reportedRiskFlagIds,
  );

  return (
    <form
      action={formAction}
      className="crm-form crm-form--cleaning-asset crm-form--create"
      aria-busy={pending}
      aria-labelledby={`${prefix}-title`}
      noValidate
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <h2 id={`${prefix}-title`}>{content.forms.asset.createTitle}</h2>
      <p className="crm-form__notice" id={noPriceHintId}>
        {content.forms.asset.noAutomaticPrice}
      </p>
      <CrmFormFeedback
        fields={fields}
        state={state}
        title={content.common.validationSummaryTitle}
      />

      <fieldset className="crm-form__section">
        <legend>{content.forms.asset.identityLegend}</legend>
        <div className="crm-form__grid">
          <div className="crm-form__field">
            <label htmlFor={fieldId("cleaningItemTypeId")}>
              {content.forms.asset.itemType}
            </label>
            <select
              id={fieldId("cleaningItemTypeId")}
              name="cleaningItemTypeId"
              defaultValue={value(
                "cleaningItemTypeId",
                initialValues?.cleaningItemTypeId,
              )}
              required
              {...crmFieldAccessibility(
                state,
                "cleaningItemTypeId",
                fieldId("cleaningItemTypeId"),
                canonicalHintId,
              )}
            >
              <option value="">{componentContent.choose}</option>
              {options.itemTypes.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={option.active === false}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <CrmFieldError
              fieldId={fieldId("cleaningItemTypeId")}
              name="cleaningItemTypeId"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("areaId")}>{content.forms.asset.area}</label>
            <select
              id={fieldId("areaId")}
              name="areaId"
              defaultValue={value("areaId", initialValues?.areaId)}
              {...crmFieldAccessibility(state, "areaId", fieldId("areaId"))}
            >
              <option value="">{content.forms.asset.noArea}</option>
              {options.areas.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={option.active === false}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <CrmFieldError fieldId={fieldId("areaId")} name="areaId" state={state} />
          </div>

          <div className="crm-form__field crm-form__field--wide">
            <label htmlFor={fieldId("label")}>{content.forms.asset.label}</label>
            <input
              id={fieldId("label")}
              name="label"
              type="text"
              defaultValue={value("label", initialValues?.label)}
              required
              maxLength={160}
              {...crmFieldAccessibility(
                state,
                "label",
                fieldId("label"),
                noPriceHintId,
              )}
            />
            <CrmFieldError fieldId={fieldId("label")} name="label" state={state} />
          </div>
        </div>
      </fieldset>

      <fieldset className="crm-form__section">
        <legend>{content.forms.asset.profileLegend}</legend>
        <p className="crm-form__hint" id={canonicalHintId}>
          {componentContent.canonicalReferencesHint}
        </p>
        <div className="crm-form__grid">
          <div className="crm-form__field">
            <label htmlFor={fieldId("approximateLengthCm")}>
              {content.forms.asset.approximateLength} ({componentContent.centimetres})
            </label>
            <input
              id={fieldId("approximateLengthCm")}
              name="approximateLengthCm"
              type="number"
              inputMode="numeric"
              min={1}
              max={100_000}
              step={1}
              defaultValue={value(
                "approximateLengthCm",
                initialValues?.approximateLengthCm,
              )}
              {...crmFieldAccessibility(
                state,
                "approximateLengthCm",
                fieldId("approximateLengthCm"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("approximateLengthCm")}
              name="approximateLengthCm"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("approximateWidthCm")}>
              {content.forms.asset.approximateWidth} ({componentContent.centimetres})
            </label>
            <input
              id={fieldId("approximateWidthCm")}
              name="approximateWidthCm"
              type="number"
              inputMode="numeric"
              min={1}
              max={100_000}
              step={1}
              defaultValue={value(
                "approximateWidthCm",
                initialValues?.approximateWidthCm,
              )}
              {...crmFieldAccessibility(
                state,
                "approximateWidthCm",
                fieldId("approximateWidthCm"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("approximateWidthCm")}
              name="approximateWidthCm"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("approximateAreaHundredthsM2")}>
              {content.forms.asset.approximateArea} ({componentContent.areaHundredths})
            </label>
            <input
              id={fieldId("approximateAreaHundredthsM2")}
              name="approximateAreaHundredthsM2"
              type="number"
              inputMode="numeric"
              min={1}
              max={100_000_000}
              step={1}
              defaultValue={value(
                "approximateAreaHundredthsM2",
                initialValues?.approximateAreaHundredthsM2,
              )}
              {...crmFieldAccessibility(
                state,
                "approximateAreaHundredthsM2",
                fieldId("approximateAreaHundredthsM2"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("approximateAreaHundredthsM2")}
              name="approximateAreaHundredthsM2"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("approximateSeatCount")}>
              {componentContent.approximateSeatCount}
            </label>
            <input
              id={fieldId("approximateSeatCount")}
              name="approximateSeatCount"
              type="number"
              inputMode="numeric"
              min={1}
              max={10_000}
              step={1}
              defaultValue={value(
                "approximateSeatCount",
                initialValues?.approximateSeatCount,
              )}
              {...crmFieldAccessibility(
                state,
                "approximateSeatCount",
                fieldId("approximateSeatCount"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("approximateSeatCount")}
              name="approximateSeatCount"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("reportedFibreMaterialId")}>
              {content.forms.asset.material}
            </label>
            <select
              id={fieldId("reportedFibreMaterialId")}
              name="reportedFibreMaterialId"
              defaultValue={value(
                "reportedFibreMaterialId",
                initialValues?.reportedFibreMaterialId,
              )}
              {...crmFieldAccessibility(
                state,
                "reportedFibreMaterialId",
                fieldId("reportedFibreMaterialId"),
                canonicalHintId,
              )}
            >
              <option value="">{content.forms.asset.unknownReference}</option>
              {options.fibreMaterials.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={option.active === false}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <CrmFieldError
              fieldId={fieldId("reportedFibreMaterialId")}
              name="reportedFibreMaterialId"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("reportedSurfaceConstructionId")}>
              {content.forms.asset.construction}
            </label>
            <select
              id={fieldId("reportedSurfaceConstructionId")}
              name="reportedSurfaceConstructionId"
              defaultValue={value(
                "reportedSurfaceConstructionId",
                initialValues?.reportedSurfaceConstructionId,
              )}
              {...crmFieldAccessibility(
                state,
                "reportedSurfaceConstructionId",
                fieldId("reportedSurfaceConstructionId"),
                canonicalHintId,
              )}
            >
              <option value="">{content.forms.asset.unknownReference}</option>
              {options.surfaceConstructions.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={option.active === false}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <CrmFieldError
              fieldId={fieldId("reportedSurfaceConstructionId")}
              name="reportedSurfaceConstructionId"
              state={state}
            />
          </div>

          <div className="crm-form__field crm-form__field--wide">
            <label htmlFor={fieldId("colourAppearanceNotes")}>
              {content.forms.asset.colourNotes}
            </label>
            <textarea
              id={fieldId("colourAppearanceNotes")}
              name="colourAppearanceNotes"
              defaultValue={value(
                "colourAppearanceNotes",
                initialValues?.colourAppearanceNotes,
              )}
              maxLength={1_000}
              rows={3}
              {...crmFieldAccessibility(
                state,
                "colourAppearanceNotes",
                fieldId("colourAppearanceNotes"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("colourAppearanceNotes")}
              name="colourAppearanceNotes"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("approximateAcquisitionYear")}>
              {content.forms.asset.acquisitionOrAge}
            </label>
            <input
              id={fieldId("approximateAcquisitionYear")}
              name="approximateAcquisitionYear"
              type="number"
              inputMode="numeric"
              min={1800}
              max={new Date().getUTCFullYear()}
              step={1}
              defaultValue={value(
                "approximateAcquisitionYear",
                initialValues?.approximateAcquisitionYear,
              )}
              {...crmFieldAccessibility(
                state,
                "approximateAcquisitionYear",
                fieldId("approximateAcquisitionYear"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("approximateAcquisitionYear")}
              name="approximateAcquisitionYear"
              state={state}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="crm-form__section">
        <legend>{content.forms.asset.conditionLegend}</legend>
        <p className="crm-form__hint" id={conditionHintId}>
          {content.forms.asset.customerConditionHint}
        </p>
        <div className="crm-form__grid">
          <div className="crm-form__field">
            <label htmlFor={fieldId("customerReportedConditionLevelId")}>
              {content.forms.asset.customerCondition}
            </label>
            <select
              id={fieldId("customerReportedConditionLevelId")}
              name="customerReportedConditionLevelId"
              defaultValue={value(
                "customerReportedConditionLevelId",
                initialValues?.customerReportedConditionLevelId,
              )}
              {...crmFieldAccessibility(
                state,
                "customerReportedConditionLevelId",
                fieldId("customerReportedConditionLevelId"),
                conditionHintId,
              )}
            >
              <option value="">{content.forms.asset.unknownReference}</option>
              {options.conditionLevels.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={option.active === false}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <CrmFieldError
              fieldId={fieldId("customerReportedConditionLevelId")}
              name="customerReportedConditionLevelId"
              state={state}
            />
          </div>

          <div className="crm-form__field crm-form__field--wide">
            <label htmlFor={fieldId("customerConditionNotes")}>
              {content.forms.asset.customerCondition}
            </label>
            <textarea
              id={fieldId("customerConditionNotes")}
              name="customerConditionNotes"
              defaultValue={value(
                "customerConditionNotes",
                initialValues?.customerConditionNotes,
              )}
              maxLength={2_000}
              rows={4}
              {...crmFieldAccessibility(
                state,
                "customerConditionNotes",
                fieldId("customerConditionNotes"),
                conditionHintId,
              )}
            />
            <CrmFieldError
              fieldId={fieldId("customerConditionNotes")}
              name="customerConditionNotes"
              state={state}
            />
          </div>
        </div>

        <fieldset
          className="crm-form__choice-group"
          id={fieldId("reportedIssueTypeIds")}
          {...crmFieldAccessibility(
            state,
            "reportedIssueTypeIds",
            fieldId("reportedIssueTypeIds"),
            `${prefix}-issues-hint`,
          )}
        >
          <legend>{content.forms.asset.knownIssues}</legend>
          <p className="crm-form__hint" id={`${prefix}-issues-hint`}>
            {componentContent.reportedIssuesHint}
          </p>
          <div className="crm-form__choices">
            {options.issueTypes.map((option) => (
              <label key={option.id} className="crm-form__choice">
                <input
                  name="reportedIssueTypeIds"
                  type="checkbox"
                  value={option.id}
                  disabled={option.active === false}
                  defaultChecked={selectedIssues.includes(String(option.id))}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <CrmFieldError
            fieldId={fieldId("reportedIssueTypeIds")}
            name="reportedIssueTypeIds"
            state={state}
          />
        </fieldset>

        <fieldset
          className="crm-form__choice-group"
          id={fieldId("reportedRiskFlagIds")}
          {...crmFieldAccessibility(
            state,
            "reportedRiskFlagIds",
            fieldId("reportedRiskFlagIds"),
            `${prefix}-risks-hint`,
          )}
        >
          <legend>{content.forms.asset.riskFlags}</legend>
          <p className="crm-form__hint" id={`${prefix}-risks-hint`}>
            {componentContent.reportedRisksHint}
          </p>
          <div className="crm-form__choices">
            {options.riskFlags.map((option) => (
              <label key={option.id} className="crm-form__choice">
                <input
                  name="reportedRiskFlagIds"
                  type="checkbox"
                  value={option.id}
                  disabled={option.active === false}
                  defaultChecked={selectedRisks.includes(String(option.id))}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <CrmFieldError
            fieldId={fieldId("reportedRiskFlagIds")}
            name="reportedRiskFlagIds"
            state={state}
          />
        </fieldset>

        <div className="crm-form__grid">
          <div className="crm-form__field crm-form__field--wide">
            <label htmlFor={fieldId("operationalNotes")}>
              {content.forms.asset.operationalNotes}
            </label>
            <textarea
              id={fieldId("operationalNotes")}
              name="operationalNotes"
              defaultValue={value(
                "operationalNotes",
                initialValues?.operationalNotes,
              )}
              maxLength={2_000}
              rows={4}
              {...crmFieldAccessibility(
                state,
                "operationalNotes",
                fieldId("operationalNotes"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("operationalNotes")}
              name="operationalNotes"
              state={state}
            />
          </div>
        </div>
      </fieldset>

      <div className="crm-form__actions">
        <CrmSubmitButton
          disabled={options.itemTypes.length === 0}
          idleLabel={content.common.add}
          pending={pending}
          pendingLabel={content.common.saving}
        />
      </div>
    </form>
  );
}
