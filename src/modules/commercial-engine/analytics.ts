import type {
  ContributionEstimate,
  ContributionInputs,
} from "./types";

function requireNonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer.`);
  }
}

function roundSigned(numerator: number, denominator: number): number {
  const sign = Math.sign(numerator);
  return sign * Math.floor((Math.abs(numerator) + denominator / 2) / denominator);
}

export function estimateContribution(
  input: ContributionInputs,
): ContributionEstimate {
  requireNonnegativeInteger(input.grossRevenueMinorUnits, "Gross revenue");
  requireNonnegativeInteger(input.vatAmountMinorUnits, "VAT amount");
  requireNonnegativeInteger(input.estimatedTeamMinutes, "Team minutes");
  requireNonnegativeInteger(
    input.labourCostPerTeamHourMinorUnits,
    "Labour cost per team hour",
  );
  requireNonnegativeInteger(
    input.estimatedConsumablesMinorUnits,
    "Consumables",
  );
  requireNonnegativeInteger(input.estimatedTravelCostMinorUnits, "Travel cost");
  if (input.vatAmountMinorUnits > input.grossRevenueMinorUnits) {
    throw new Error("VAT cannot exceed gross revenue.");
  }

  const estimatedLabourCostMinorUnits = roundSigned(
    input.labourCostPerTeamHourMinorUnits * input.estimatedTeamMinutes,
    60,
  );
  const netRevenueMinorUnits =
    input.grossRevenueMinorUnits - input.vatAmountMinorUnits;
  const estimatedContributionMinorUnits =
    netRevenueMinorUnits -
    estimatedLabourCostMinorUnits -
    input.estimatedConsumablesMinorUnits -
    input.estimatedTravelCostMinorUnits;

  return {
    estimatedTeamMinutes: input.estimatedTeamMinutes,
    estimatedLabourCostMinorUnits,
    estimatedConsumablesMinorUnits: input.estimatedConsumablesMinorUnits,
    estimatedTravelCostMinorUnits: input.estimatedTravelCostMinorUnits,
    estimatedContributionMinorUnits,
    contributionPerTeamHourMinorUnits:
      input.estimatedTeamMinutes === 0
        ? null
        : roundSigned(
            estimatedContributionMinorUnits * 60,
            input.estimatedTeamMinutes,
          ),
  };
}
