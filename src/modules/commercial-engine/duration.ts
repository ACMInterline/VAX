import type {
  CommercialLineInput,
  DurationCalculationInput,
  DurationCalculationLine,
  DurationCalculationResult,
  DurationModelDefinition,
  DurationRuleDefinition,
} from "./types";

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
}

function uniquePush(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function findRule(
  model: DurationModelDefinition,
  predicate: (rule: DurationRuleDefinition) => boolean,
): DurationRuleDefinition | undefined {
  return model.rules
    .filter((rule) => rule.active && predicate(rule))
    .sort((left, right) => left.priority - right.priority)[0];
}

function matchingItemRule(
  model: DurationModelDefinition,
  item: CommercialLineInput,
): DurationRuleDefinition | undefined {
  return findRule(
    model,
    (rule) =>
      (rule.type === "ITEM_BASE" || rule.type === "AREA_PRODUCTIVITY") &&
      rule.serviceCode === item.serviceCode &&
      rule.itemTypeCode === item.itemTypeCode,
  );
}

function calculateItemMinutes(
  rule: DurationRuleDefinition,
  item: CommercialLineInput,
): number {
  if (rule.type === "AREA_PRODUCTIVITY") {
    const area = item.areaHundredthsM2;
    const productivity = rule.productivityHundredthsM2PerHour;
    if (area === undefined || productivity === undefined) {
      throw new Error(`Duration rule ${rule.id} requires area and productivity.`);
    }
    assertPositiveInteger(area, "Area");
    assertPositiveInteger(productivity, "Area productivity");
    return Math.ceil((area * 60) / productivity);
  }

  const minutes = rule.minutes;
  if (minutes === undefined || !Number.isSafeInteger(minutes) || minutes < 0) {
    throw new Error(`Duration rule ${rule.id} has no valid minute value.`);
  }
  assertPositiveInteger(item.quantity, "Item quantity");

  switch (rule.billingUnit) {
    case "PER_ITEM":
      return minutes * item.quantity;
    case "PER_SIDE":
      if (item.sides !== 1 && item.sides !== 2) {
        throw new Error(`Duration rule ${rule.id} requires one or two sides.`);
      }
      return minutes * item.quantity * item.sides;
    case "PER_SEAT":
      if (item.seatCount === undefined) {
        throw new Error(`Duration rule ${rule.id} requires a seat count.`);
      }
      assertPositiveInteger(item.seatCount, "Seat count");
      return minutes * item.quantity * item.seatCount;
    default:
      throw new Error(`Duration rule ${rule.id} has no supported billing unit.`);
  }
}

function fixedLine(
  model: DurationModelDefinition,
  type: "JOB_SETUP" | "JOB_INSPECTION" | "JOB_CLEANUP",
): DurationCalculationLine {
  const rule = findRule(model, (entry) => entry.type === type);
  if (!rule || rule.minutes === undefined) {
    throw new Error(`Duration model ${model.code} is missing ${type}.`);
  }
  if (!Number.isSafeInteger(rule.minutes) || rule.minutes < 0) {
    throw new Error(`Duration rule ${rule.id} has invalid minutes.`);
  }
  return { kind: type, label: rule.label, minutes: rule.minutes, ruleId: rule.id };
}

export function calculateDuration(
  model: DurationModelDefinition,
  input: DurationCalculationInput,
): DurationCalculationResult {
  assertPositiveInteger(model.version, "Duration-model version");
  if (input.items.length === 0) {
    throw new Error("At least one cleaning item is required.");
  }

  const setupLine = fixedLine(model, "JOB_SETUP");
  const inspectionLine = fixedLine(model, "JOB_INSPECTION");
  const cleanupLine = fixedLine(model, "JOB_CLEANUP");
  const lines: DurationCalculationLine[] = [setupLine, inspectionLine];
  const warnings = model.provisional
    ? ["Development-only provisional duration model; field validation is required."]
    : [];
  const appliedRuleIds = [setupLine.ruleId, inspectionLine.ruleId];
  let baseCleaningMinutes = 0;
  let modifierMinutes = 0;
  let addonMinutes = 0;
  let manualAssessmentRequired = false;
  let declineOrReferRequired = false;

  for (const item of input.items) {
    assertPositiveInteger(item.quantity, "Item quantity");
    const itemRule = matchingItemRule(model, item);
    if (!itemRule) {
      manualAssessmentRequired = true;
      warnings.push(
        `No automatic duration rule exists for ${item.itemTypeCode}.`,
      );
    } else {
      uniquePush(appliedRuleIds, itemRule.id);
      const minutes = calculateItemMinutes(itemRule, item);
      baseCleaningMinutes += minutes;
      lines.push({
        kind: itemRule.type,
        label: itemRule.label,
        minutes,
        ruleId: itemRule.id,
      });
      if (itemRule.manualAssessmentRequired) {
        manualAssessmentRequired = true;
        warnings.push(`${itemRule.label}; duration requires assessment.`);
      }
    }

    for (const issueCode of item.issueCodes) {
      const issueRule = findRule(
        model,
        (rule) =>
          rule.type === "ISSUE_COMPLEXITY" && rule.issueCode === issueCode,
      );
      if (!issueRule) {
        manualAssessmentRequired = true;
        warnings.push(`${issueCode} has no automatic duration rule.`);
        continue;
      }
      uniquePush(appliedRuleIds, issueRule.id);
      if (issueRule.declineOrReferRequired) {
        manualAssessmentRequired = true;
        declineOrReferRequired = true;
        warnings.push(`${issueRule.label}; decline or refer.`);
      } else if (issueRule.manualAssessmentRequired) {
        manualAssessmentRequired = true;
        warnings.push(`${issueRule.label}; duration requires assessment.`);
      } else if ((issueRule.minutes ?? 0) > 0) {
        const minutes = (issueRule.minutes ?? 0) * item.quantity;
        modifierMinutes += minutes;
        lines.push({
          kind: "ISSUE_COMPLEXITY",
          label: issueRule.label,
          minutes,
          ruleId: issueRule.id,
        });
      }
    }

    for (const addonCode of item.addonCodes) {
      const addonRule = findRule(
        model,
        (rule) => rule.type === "ADD_ON_TIME" && rule.addonCode === addonCode,
      );
      if (!addonRule || addonRule.manualAssessmentRequired) {
        manualAssessmentRequired = true;
        warnings.push(
          addonRule
            ? `${addonRule.label}; add-on time requires confirmation.`
            : `${addonCode} has no automatic duration rule.`,
        );
        if (addonRule) uniquePush(appliedRuleIds, addonRule.id);
        continue;
      }
      if ((addonRule.minutes ?? 0) > 0) {
        uniquePush(appliedRuleIds, addonRule.id);
        const minutes = (addonRule.minutes ?? 0) * item.quantity;
        addonMinutes += minutes;
        lines.push({
          kind: "ADD_ON_TIME",
          label: addonRule.label,
          minutes,
          ruleId: addonRule.id,
        });
      }
    }

    for (const riskFlagCode of item.riskFlagCodes) {
      const riskRule = findRule(
        model,
        (rule) =>
          rule.type === "CUSTOM_ASSESSMENT" &&
          rule.riskFlagCode === riskFlagCode,
      );
      manualAssessmentRequired = true;
      if (riskRule) {
        uniquePush(appliedRuleIds, riskRule.id);
        warnings.push(`${riskRule.label}; duration requires assessment.`);
      } else {
        warnings.push(`${riskFlagCode} requires duration assessment.`);
      }
    }

    if (item.fibreMaterialCode !== undefined) {
      const materialRule = findRule(
        model,
        (rule) =>
          rule.type === "MATERIAL_SENSITIVITY" &&
          rule.fibreMaterialCode === item.fibreMaterialCode,
      );
      if (materialRule?.manualAssessmentRequired) {
        uniquePush(appliedRuleIds, materialRule.id);
        manualAssessmentRequired = true;
        warnings.push(`${materialRule.label}; duration requires assessment.`);
      }
    }

    if (item.treatmentLevelCode !== undefined) {
      const treatmentRule = findRule(
        model,
        (rule) =>
          rule.type === "TREATMENT_COMPLEXITY" &&
          rule.treatmentLevelCode === item.treatmentLevelCode,
      );
      if (treatmentRule?.manualAssessmentRequired) {
        uniquePush(appliedRuleIds, treatmentRule.id);
        manualAssessmentRequired = true;
        warnings.push(`${treatmentRule.label}; duration requires assessment.`);
      }
    }
  }

  const conditionRule = findRule(
    model,
    (rule) =>
      rule.type === "CONDITION_MULTIPLIER" &&
      rule.conditionBandCode === input.conditionBandCode,
  );
  if (!conditionRule) {
    manualAssessmentRequired = true;
    warnings.push("The selected condition has no duration rule.");
  } else {
    uniquePush(appliedRuleIds, conditionRule.id);
    if (conditionRule.manualAssessmentRequired) {
      manualAssessmentRequired = true;
      warnings.push(`${conditionRule.label}; duration requires assessment.`);
    } else {
      const multiplier = conditionRule.multiplierBasisPoints ?? 10_000;
      if (!Number.isSafeInteger(multiplier) || multiplier < 10_000) {
        throw new Error(`Duration rule ${conditionRule.id} has an invalid multiplier.`);
      }
      const adjustmentBasisPoints = multiplier - 10_000;
      if (adjustmentBasisPoints > 0) {
        const minutes = Math.ceil(
          (baseCleaningMinutes * adjustmentBasisPoints) / 10_000,
        );
        modifierMinutes += minutes;
        lines.push({
          kind: "CONDITION_MULTIPLIER",
          label: conditionRule.label,
          minutes,
          ruleId: conditionRule.id,
        });
      }
    }
  }

  lines.push(cleanupLine);
  uniquePush(appliedRuleIds, cleanupLine.ruleId);
  const partialEstimatedMinutes =
    setupLine.minutes +
    inspectionLine.minutes +
    baseCleaningMinutes +
    modifierMinutes +
    addonMinutes +
    cleanupLine.minutes;

  return {
    durationModelId: model.id,
    durationModelCode: model.code,
    durationModelVersion: model.version,
    lines,
    setupMinutes: setupLine.minutes,
    inspectionMinutes: inspectionLine.minutes,
    baseCleaningMinutes,
    modifierMinutes,
    addonMinutes,
    cleanupMinutes: cleanupLine.minutes,
    partialEstimatedMinutes,
    totalEstimatedMinutes: manualAssessmentRequired
      ? null
      : partialEstimatedMinutes,
    warnings,
    manualAssessmentRequired,
    declineOrReferRequired,
    appliedRuleIds,
  };
}
