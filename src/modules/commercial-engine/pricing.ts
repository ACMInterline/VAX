import type {
  CommercialLineInput,
  FuturePriceSnapshot,
  PriceBookDefinition,
  PriceCalculationInput,
  PriceCalculationLine,
  PriceCalculationResult,
  PriceRuleDefinition,
  VatConfiguration,
} from "./types";

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer.`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

function roundRatio(numerator: number, denominator: number): number {
  assertSafeInteger(numerator, "Calculation numerator");
  assertPositiveInteger(denominator, "Calculation denominator");
  const sign = Math.sign(numerator);
  return sign * Math.floor((Math.abs(numerator) + denominator / 2) / denominator);
}

function multiplySafe(left: number, right: number, label: string): number {
  const result = left * right;
  assertSafeInteger(result, label);
  return result;
}

function addSafe(left: number, right: number, label: string): number {
  const result = left + right;
  assertSafeInteger(result, label);
  return result;
}

function uniquePush(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function validateVatConfiguration(configuration: VatConfiguration): void {
  assertSafeInteger(configuration.rateBasisPoints, "VAT rate");
  if (
    configuration.rateBasisPoints < 0 ||
    configuration.rateBasisPoints > 10_000
  ) {
    throw new Error("VAT rate must be between 0 and 10000 basis points.");
  }
  if (
    configuration.mode === "VAT_NOT_REGISTERED" &&
    configuration.rateBasisPoints !== 0
  ) {
    throw new Error("A non-VAT-registered calculation must use a zero VAT rate.");
  }
}

function validateItem(item: CommercialLineInput): void {
  assertPositiveInteger(item.quantity, "Item quantity");
  if (item.areaHundredthsM2 !== undefined) {
    assertPositiveInteger(item.areaHundredthsM2, "Area");
  }
  if (item.seatCount !== undefined) {
    assertPositiveInteger(item.seatCount, "Seat count");
  }
  if (item.sides !== undefined && item.sides !== 1 && item.sides !== 2) {
    throw new Error("Mattress sides must be one or two.");
  }
}

function matchesItem(rule: PriceRuleDefinition, item: CommercialLineInput) {
  return (
    rule.active &&
    rule.serviceCode === item.serviceCode &&
    rule.itemTypeCode === item.itemTypeCode
  );
}

function matchesAreaBand(
  rule: PriceRuleDefinition,
  areaHundredthsM2: number,
): boolean {
  const minimum = rule.measurementMinHundredths ?? 0;
  const maximum = rule.measurementMaxHundredths;
  return (
    areaHundredthsM2 >= minimum &&
    (maximum === null || maximum === undefined || areaHundredthsM2 <= maximum)
  );
}

function findBaseRule(
  rules: readonly PriceRuleDefinition[],
  item: CommercialLineInput,
): PriceRuleDefinition | undefined {
  return rules
    .filter(
      (rule) =>
        matchesItem(rule, item) &&
        [
          "BASE_ITEM",
          "PER_AREA_M2",
          "PER_ITEM",
          "PER_SEAT",
          "CUSTOM_ASSESSMENT",
        ].includes(rule.type),
    )
    .filter((rule) =>
      rule.type === "PER_AREA_M2"
        ? item.areaHundredthsM2 !== undefined &&
          matchesAreaBand(rule, item.areaHundredthsM2)
        : true,
    )
    .sort((left, right) => left.priority - right.priority)[0];
}

function calculateRuleAmount(
  rule: PriceRuleDefinition,
  item: CommercialLineInput,
): number {
  const rate = rule.amountMinorUnits;
  if (rate === undefined) {
    throw new Error(`Price rule ${rule.id} has no configured amount.`);
  }
  assertSafeInteger(rate, `Price rule ${rule.id} amount`);
  if (rate < 0) {
    throw new Error(`Base price rule ${rule.id} cannot be negative.`);
  }

  switch (rule.billingUnit) {
    case "PER_ITEM":
      return multiplySafe(rate, item.quantity, "Per-item amount");
    case "PER_SIDE": {
      const sides = item.sides;
      if (sides === undefined) {
        throw new Error(`Price rule ${rule.id} requires a side count.`);
      }
      return multiplySafe(
        rate,
        multiplySafe(item.quantity, sides, "Billable mattress sides"),
        "Per-side amount",
      );
    }
    case "PER_SEAT": {
      const seats = item.seatCount;
      if (seats === undefined) {
        throw new Error(`Price rule ${rule.id} requires a seat count.`);
      }
      return multiplySafe(
        rate,
        multiplySafe(item.quantity, seats, "Billable seats"),
        "Per-seat amount",
      );
    }
    case "AREA_M2": {
      const area = item.areaHundredthsM2;
      if (area === undefined) {
        throw new Error(`Price rule ${rule.id} requires an area.`);
      }
      return roundRatio(
        multiplySafe(rate, area, "Area-rate product"),
        100,
      );
    }
    default:
      throw new Error(`Price rule ${rule.id} has no supported billing unit.`);
  }
}

function findRule(
  rules: readonly PriceRuleDefinition[],
  predicate: (rule: PriceRuleDefinition) => boolean,
  includeInactive = false,
): PriceRuleDefinition | undefined {
  return rules
    .filter((rule) => (includeInactive || rule.active) && predicate(rule))
    .sort((left, right) => left.priority - right.priority)[0];
}

export function calculatePrice(
  priceBook: PriceBookDefinition,
  input: PriceCalculationInput,
): PriceCalculationResult {
  if (priceBook.currency !== "EUR") {
    throw new Error("The Phase 2A commercial engine accepts EUR price books only.");
  }
  assertPositiveInteger(priceBook.version, "Price-book version");
  if (input.items.length === 0) {
    throw new Error("At least one cleaning item is required.");
  }

  const vatConfiguration =
    input.vatConfiguration ?? priceBook.vatConfiguration;
  validateVatConfiguration(vatConfiguration);

  const lines: PriceCalculationLine[] = [];
  const warnings: string[] = [];
  const appliedRuleIds: string[] = [];
  let workSubtotal = 0;
  let subtotal = 0;
  let manualAssessmentRequired = false;
  let declineOrReferRequired = false;

  if (priceBook.provisional || !priceBook.approvedForPublication) {
    warnings.push(
      "Development-only provisional price book; not approved for publication.",
    );
  }

  for (const item of input.items) {
    validateItem(item);
    const baseRule = findBaseRule(priceBook.rules, item);

    if (!baseRule) {
      manualAssessmentRequired = true;
      warnings.push(
        `No automatic ${item.itemTypeCode} price exists in this price-book version.`,
      );
    } else {
      uniquePush(appliedRuleIds, baseRule.id);
      if (
        baseRule.manualAssessmentRequired ||
        baseRule.adjustmentKind === "MANUAL_ASSESSMENT" ||
        baseRule.type === "CUSTOM_ASSESSMENT"
      ) {
        manualAssessmentRequired = true;
        warnings.push(`${baseRule.label}; manual assessment is required.`);
      }

      if (baseRule.amountMinorUnits !== undefined) {
        const amountMinorUnits = calculateRuleAmount(baseRule, item);
        lines.push({
          kind: baseRule.type,
          label: baseRule.label,
          amountMinorUnits,
          ruleId: baseRule.id,
        });
        workSubtotal = addSafe(
          workSubtotal,
          amountMinorUnits,
          "Work subtotal",
        );
        subtotal = addSafe(subtotal, amountMinorUnits, "Price subtotal");
      }
    }

    for (const issueCode of item.issueCodes) {
      const issueRule = findRule(
        priceBook.rules,
        (rule) => rule.type === "ISSUE_MODIFIER" && rule.issueCode === issueCode,
      );
      if (!issueRule) {
        manualAssessmentRequired = true;
        warnings.push(`${issueCode} has no automatic pricing rule.`);
        continue;
      }

      uniquePush(appliedRuleIds, issueRule.id);
      if (issueRule.adjustmentKind === "DECLINE_OR_REFER") {
        manualAssessmentRequired = true;
        declineOrReferRequired = true;
        warnings.push(`${issueRule.label}; decline or refer rather than auto-price.`);
      } else if (issueRule.adjustmentKind === "SUGGEST_ADD_ON") {
        manualAssessmentRequired = true;
        warnings.push(
          `${issueRule.label}; confirm ${issueRule.suggestedAddonCode ?? "an add-on"} before pricing.`,
        );
      } else if (issueRule.manualAssessmentRequired) {
        manualAssessmentRequired = true;
        warnings.push(`${issueRule.label}; manual assessment is required.`);
      }
    }

    for (const addonCode of item.addonCodes) {
      const addonRule = findRule(
        priceBook.rules,
        (rule) => rule.type === "ADD_ON" && rule.addonCode === addonCode,
      );
      if (!addonRule || addonRule.manualAssessmentRequired) {
        manualAssessmentRequired = true;
        warnings.push(
          addonRule
            ? `${addonRule.label}; no automatic amount is approved.`
            : `${addonCode} has no automatic price in this version.`,
        );
        if (addonRule) uniquePush(appliedRuleIds, addonRule.id);
        continue;
      }

      if (addonRule.amountMinorUnits !== undefined) {
        uniquePush(appliedRuleIds, addonRule.id);
        const amountMinorUnits = multiplySafe(
          addonRule.amountMinorUnits,
          item.quantity,
          "Add-on amount",
        );
        lines.push({
          kind: "ADD_ON",
          label: addonRule.label,
          amountMinorUnits,
          ruleId: addonRule.id,
        });
        subtotal = addSafe(subtotal, amountMinorUnits, "Price subtotal");
      }
    }

    for (const riskFlagCode of item.riskFlagCodes) {
      const riskRule = findRule(
        priceBook.rules,
        (rule) =>
          rule.type === "CUSTOM_ASSESSMENT" &&
          rule.riskFlagCode === riskFlagCode,
      );
      manualAssessmentRequired = true;
      if (riskRule) {
        uniquePush(appliedRuleIds, riskRule.id);
        warnings.push(`${riskRule.label}; manual assessment is required.`);
      } else {
        warnings.push(`${riskFlagCode} requires manual assessment.`);
      }
    }
  }

  const conditionRule = findRule(
    priceBook.rules,
    (rule) =>
      rule.type === "CONDITION_MODIFIER" &&
      rule.conditionBandCode === input.conditionBandCode,
  );
  if (!conditionRule) {
    manualAssessmentRequired = true;
    warnings.push("The selected condition has no commercial rule.");
  } else {
    uniquePush(appliedRuleIds, conditionRule.id);
    if (conditionRule.manualAssessmentRequired) {
      manualAssessmentRequired = true;
      warnings.push(`${conditionRule.label}; manual assessment is required.`);
    } else {
      const percentageBasisPoints = conditionRule.percentageBasisPoints ?? 0;
      assertSafeInteger(percentageBasisPoints, "Condition modifier");
      if (percentageBasisPoints !== 0) {
        const amountMinorUnits = roundRatio(
          multiplySafe(workSubtotal, percentageBasisPoints, "Condition product"),
          10_000,
        );
        lines.push({
          kind: "CONDITION_MODIFIER",
          label: conditionRule.label,
          amountMinorUnits,
          ruleId: conditionRule.id,
        });
        subtotal = addSafe(subtotal, amountMinorUnits, "Price subtotal");
      }
    }
  }

  const travelRule = findRule(
    priceBook.rules,
    (rule) =>
      rule.type === "TRAVEL_ZONE" &&
      rule.travelZoneCode === input.travelZoneCode,
  );
  if (!travelRule) {
    manualAssessmentRequired = true;
    warnings.push("The selected travel zone has no approved rule.");
  } else {
    uniquePush(appliedRuleIds, travelRule.id);
    if (travelRule.manualAssessmentRequired) {
      manualAssessmentRequired = true;
      warnings.push(`${travelRule.label}; manual assessment is required.`);
    } else if (travelRule.amountMinorUnits !== undefined) {
      lines.push({
        kind: "TRAVEL_ZONE",
        label: travelRule.label,
        amountMinorUnits: travelRule.amountMinorUnits,
        ruleId: travelRule.id,
      });
      subtotal = addSafe(
        subtotal,
        travelRule.amountMinorUnits,
        "Price subtotal",
      );
    }
  }
  warnings.push("Parking is pass-through until the owner approves another policy.");

  const timingRule = findRule(
    priceBook.rules,
    (rule) =>
      rule.type === "TIMING_MODIFIER" &&
      rule.timingCategoryCode === input.timingCategoryCode,
  );
  if (timingRule) {
    uniquePush(appliedRuleIds, timingRule.id);
    if (timingRule.manualAssessmentRequired) {
      manualAssessmentRequired = true;
      warnings.push(`${timingRule.label}; manual assessment is required.`);
    } else if (timingRule.amountMinorUnits !== undefined) {
      lines.push({
        kind: "TIMING_MODIFIER",
        label: timingRule.label,
        amountMinorUnits: timingRule.amountMinorUnits,
        ruleId: timingRule.id,
      });
      subtotal = addSafe(
        subtotal,
        timingRule.amountMinorUnits,
        "Price subtotal",
      );
    } else if ((timingRule.percentageBasisPoints ?? 0) !== 0) {
      const adjustment = roundRatio(
        multiplySafe(
          subtotal,
          timingRule.percentageBasisPoints ?? 0,
          "Timing product",
        ),
        10_000,
      );
      lines.push({
        kind: "TIMING_MODIFIER",
        label: timingRule.label,
        amountMinorUnits: adjustment,
        ruleId: timingRule.id,
      });
      subtotal = addSafe(subtotal, adjustment, "Price subtotal");
    }
  }

  const minimumRule = findRule(
    priceBook.rules,
    (rule) => rule.type === "MINIMUM_VISIT",
  );

  if (manualAssessmentRequired) {
    return {
      priceBookId: priceBook.id,
      priceBookCode: priceBook.code,
      priceBookVersion: priceBook.version,
      priceBookStatus: priceBook.status,
      currency: priceBook.currency,
      priceBasis: priceBook.priceBasis,
      lines,
      subtotalMinorUnits: subtotal,
      minimumVisitAdjustmentMinorUnits: null,
      netAmountMinorUnits: null,
      vatRateBasisPoints: vatConfiguration.rateBasisPoints,
      vatAmountMinorUnits: null,
      grossTotalMinorUnits: null,
      warnings,
      manualAssessmentRequired,
      declineOrReferRequired,
      appliedRuleIds,
    };
  }

  let minimumVisitAdjustmentMinorUnits = 0;
  if (minimumRule?.amountMinorUnits !== undefined) {
    uniquePush(appliedRuleIds, minimumRule.id);
    minimumVisitAdjustmentMinorUnits = Math.max(
      0,
      minimumRule.amountMinorUnits - subtotal,
    );
    lines.push({
      kind: "MINIMUM_VISIT_ADJUSTMENT",
      label: minimumRule.label,
      amountMinorUnits: minimumVisitAdjustmentMinorUnits,
      ruleId: minimumRule.id,
    });
  }

  const basisTotal = addSafe(
    subtotal,
    minimumVisitAdjustmentMinorUnits,
    "Minimum-adjusted total",
  );
  let netAmountMinorUnits: number;
  let vatAmountMinorUnits: number;
  let grossTotalMinorUnits: number;

  if (vatConfiguration.mode === "VAT_NOT_REGISTERED") {
    netAmountMinorUnits = basisTotal;
    vatAmountMinorUnits = 0;
    grossTotalMinorUnits = basisTotal;
  } else if (priceBook.priceBasis === "GROSS") {
    grossTotalMinorUnits = basisTotal;
    netAmountMinorUnits = roundRatio(
      multiplySafe(grossTotalMinorUnits, 10_000, "Gross-to-net product"),
      10_000 + vatConfiguration.rateBasisPoints,
    );
    vatAmountMinorUnits = grossTotalMinorUnits - netAmountMinorUnits;
  } else {
    netAmountMinorUnits = basisTotal;
    vatAmountMinorUnits = roundRatio(
      multiplySafe(
        netAmountMinorUnits,
        vatConfiguration.rateBasisPoints,
        "VAT product",
      ),
      10_000,
    );
    grossTotalMinorUnits = addSafe(
      netAmountMinorUnits,
      vatAmountMinorUnits,
      "Gross total",
    );
  }

  return {
    priceBookId: priceBook.id,
    priceBookCode: priceBook.code,
    priceBookVersion: priceBook.version,
    priceBookStatus: priceBook.status,
    currency: priceBook.currency,
    priceBasis: priceBook.priceBasis,
    lines,
    subtotalMinorUnits: subtotal,
    minimumVisitAdjustmentMinorUnits,
    netAmountMinorUnits,
    vatRateBasisPoints: vatConfiguration.rateBasisPoints,
    vatAmountMinorUnits,
    grossTotalMinorUnits,
    warnings,
    manualAssessmentRequired,
    declineOrReferRequired,
    appliedRuleIds,
  };
}

export function createPriceSnapshot(
  input: PriceCalculationInput,
  result: PriceCalculationResult,
  calculatedAt: string,
): FuturePriceSnapshot {
  if (Number.isNaN(Date.parse(calculatedAt))) {
    throw new Error("Snapshot timestamp must be a valid ISO-compatible instant.");
  }

  return {
    priceBookId: result.priceBookId,
    priceBookCode: result.priceBookCode,
    priceBookVersion: result.priceBookVersion,
    ruleIds: [...result.appliedRuleIds],
    inputs: input,
    calculationLines: [...result.lines],
    netAmountMinorUnits: result.netAmountMinorUnits,
    vatRateBasisPoints: result.vatRateBasisPoints,
    vatAmountMinorUnits: result.vatAmountMinorUnits,
    grossTotalMinorUnits: result.grossTotalMinorUnits,
    currency: result.currency,
    calculatedAt,
    manualAssessmentRequired: result.manualAssessmentRequired,
  };
}
