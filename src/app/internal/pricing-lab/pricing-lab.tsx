"use client";

import { useMemo, useState } from "react";
import {
  cleaningItemTypes,
  getCatalogueLabel,
  issueTypes,
  serviceAddons,
  services,
  type CleaningItemTypeCode,
  type IssueTypeCode,
  type ServiceAddonCode,
  type ServiceCode,
} from "@/modules/service-catalogue/catalogue";
import {
  commercialConditionBands,
  developmentDurationModel,
  residentialDraftPriceBook,
  timingCategories,
  travelZones,
} from "@/modules/commercial-engine/development-config";
import { calculateDuration } from "@/modules/commercial-engine/duration";
import { calculatePrice } from "@/modules/commercial-engine/pricing";
import type {
  CommercialConditionBandCode,
  TimingCategoryCode,
  TravelZoneCode,
} from "@/modules/commercial-engine/types";

const euroFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(minorUnits: number | null): string {
  return minorUnits === null
    ? "Manual assessment"
    : euroFormatter.format(minorUnits / 100);
}

function parseAreaHundredths(value: string): number | undefined {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return undefined;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const result = whole * 100 + fraction;
  return Number.isSafeInteger(result) && result > 0 ? result : undefined;
}

function serviceForItem(itemTypeCode: CleaningItemTypeCode): ServiceCode {
  if (itemTypeCode === "CARPET_FIXED") return "CARPET_CARE";
  if (itemTypeCode === "RUG" || itemTypeCode === "RUNNER") {
    return "RUG_RUNNER_CARE";
  }
  if (itemTypeCode.startsWith("MATTRESS_")) return "MATTRESS_CARE";
  if (
    itemTypeCode === "OFFICE_CARPET" ||
    itemTypeCode === "COMMERCIAL_UPHOLSTERY"
  ) {
    return "COMMERCIAL_TEXTILE_CARE";
  }
  if (itemTypeCode === "OTHER_TEXTILE_SURFACE") {
    return "DELICATE_TEXTILE_ASSESSMENT";
  }
  return "UPHOLSTERY_CARE";
}

export function PricingLab() {
  const [serviceCode, setServiceCode] =
    useState<ServiceCode>("UPHOLSTERY_CARE");
  const [itemTypeCode, setItemTypeCode] =
    useState<CleaningItemTypeCode>("SOFA_3_SEAT");
  const [quantity, setQuantity] = useState(1);
  const [sides, setSides] = useState<1 | 2>(1);
  const [area, setArea] = useState("30.00");
  const [conditionBandCode, setConditionBandCode] =
    useState<CommercialConditionBandCode>("NORMAL");
  const [issueCode, setIssueCode] = useState<IssueTypeCode | "">("");
  const [addonCode, setAddonCode] = useState<ServiceAddonCode | "">("");
  const [travelZoneCode, setTravelZoneCode] =
    useState<TravelZoneCode>("SOFIA_CORE");
  const [timingCategoryCode, setTimingCategoryCode] =
    useState<TimingCategoryCode>("STANDARD");

  const calculation = useMemo(() => {
    try {
      const areaHundredthsM2 = parseAreaHundredths(area);
      const item = {
        serviceCode,
        itemTypeCode,
        quantity,
        sides,
        areaHundredthsM2,
        issueCodes: issueCode ? [issueCode] : [],
        addonCodes: addonCode ? [addonCode] : [],
        riskFlagCodes: [],
      } as const;
      const price = calculatePrice(residentialDraftPriceBook, {
        items: [item],
        conditionBandCode,
        travelZoneCode,
        timingCategoryCode,
      });
      const duration = calculateDuration(developmentDurationModel, {
        items: [item],
        conditionBandCode,
      });
      return { price, duration, error: null };
    } catch (error) {
      return {
        price: null,
        duration: null,
        error:
          error instanceof Error
            ? error.message
            : "The development calculation could not be completed.",
      };
    }
  }, [
    addonCode,
    area,
    conditionBandCode,
    issueCode,
    itemTypeCode,
    quantity,
    serviceCode,
    sides,
    timingCategoryCode,
    travelZoneCode,
  ]);

  const usesArea =
    itemTypeCode === "CARPET_FIXED" ||
    itemTypeCode === "RUG" ||
    itemTypeCode === "RUNNER" ||
    itemTypeCode === "OFFICE_CARPET";
  const usesSides = itemTypeCode.startsWith("MATTRESS_");

  return (
    <div className="pricing-lab-grid">
      <section className="pricing-lab-panel pricing-lab-controls">
        <div className="pricing-lab-panel-heading">
          <p>01 · Inputs</p>
          <h2>Development scenario</h2>
        </div>

        <label>
          Canonical service
          <select
            value={serviceCode}
            onChange={(event) =>
              setServiceCode(event.target.value as ServiceCode)
            }
          >
            {services.map((service) => (
              <option key={service.code} value={service.code}>
                {getCatalogueLabel(service, "en")}
              </option>
            ))}
          </select>
        </label>

        <label>
          Cleaning item
          <select
            value={itemTypeCode}
            onChange={(event) => {
              const nextItemTypeCode = event.target
                .value as CleaningItemTypeCode;
              setItemTypeCode(nextItemTypeCode);
              setServiceCode(serviceForItem(nextItemTypeCode));
            }}
          >
            {cleaningItemTypes.map((item) => (
              <option key={item.code} value={item.code}>
                {getCatalogueLabel(item, "en")}
              </option>
            ))}
          </select>
        </label>

        <div className="pricing-lab-control-row">
          <label>
            Quantity
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </label>
          {usesSides ? (
            <label>
              Sides per mattress
              <select
                value={sides}
                onChange={(event) =>
                  setSides(event.target.value === "2" ? 2 : 1)
                }
              >
                <option value={1}>One side</option>
                <option value={2}>Both sides</option>
              </select>
            </label>
          ) : null}
          {usesArea ? (
            <label>
              Area (m²)
              <input
                inputMode="decimal"
                value={area}
                onChange={(event) => setArea(event.target.value)}
                aria-describedby="area-boundary-note"
              />
            </label>
          ) : null}
        </div>
        {usesArea ? (
          <p className="pricing-lab-hint" id="area-boundary-note">
            Selected-band semantics apply one rate to the total measured area.
          </p>
        ) : null}

        <label>
          Commercial condition band
          <select
            value={conditionBandCode}
            onChange={(event) =>
              setConditionBandCode(
                event.target.value as CommercialConditionBandCode,
              )
            }
          >
            {commercialConditionBands.map((band) => (
              <option key={band.code} value={band.code}>
                {getCatalogueLabel(band, "en")}
              </option>
            ))}
          </select>
        </label>

        <label>
          Declared issue
          <select
            value={issueCode}
            onChange={(event) =>
              setIssueCode(event.target.value as IssueTypeCode | "")
            }
          >
            <option value="">No issue selected</option>
            {issueTypes.map((issue) => (
              <option key={issue.code} value={issue.code}>
                {getCatalogueLabel(issue, "en")}
              </option>
            ))}
          </select>
        </label>

        <label>
          Conditional add-on
          <select
            value={addonCode}
            onChange={(event) =>
              setAddonCode(event.target.value as ServiceAddonCode | "")
            }
          >
            <option value="">No add-on selected</option>
            {serviceAddons.map((addon) => (
              <option key={addon.code} value={addon.code}>
                {getCatalogueLabel(addon, "en")}
              </option>
            ))}
          </select>
        </label>

        <div className="pricing-lab-control-row">
          <label>
            Travel zone
            <select
              value={travelZoneCode}
              onChange={(event) =>
                setTravelZoneCode(event.target.value as TravelZoneCode)
              }
            >
              {travelZones.map((zone) => (
                <option key={zone.code} value={zone.code}>
                  {getCatalogueLabel(zone, "en")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Appointment timing
            <select
              value={timingCategoryCode}
              onChange={(event) =>
                setTimingCategoryCode(
                  event.target.value as TimingCategoryCode,
                )
              }
            >
              {timingCategories.map((timing) => (
                <option key={timing.code} value={timing.code}>
                  {getCatalogueLabel(timing, "en")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="pricing-lab-results" aria-live="polite">
        {calculation.error ? (
          <section className="pricing-lab-panel pricing-lab-error" role="alert">
            <p>Calculation unavailable</p>
            <h2>Check the development input</h2>
            <div>{calculation.error}</div>
          </section>
        ) : null}

        {calculation.price ? (
          <section className="pricing-lab-panel">
            <div className="pricing-lab-panel-heading">
              <p>02 · Price</p>
              <h2>Explainable gross calculation</h2>
            </div>
            <div className="pricing-lab-lines">
              {calculation.price.lines.map((line) => (
                <div key={`${line.ruleId}-${line.kind}`}>
                  <span>{line.label}</span>
                  <strong>{formatMoney(line.amountMinorUnits)}</strong>
                </div>
              ))}
            </div>
            <dl className="pricing-lab-summary">
              <div>
                <dt>Net amount</dt>
                <dd>{formatMoney(calculation.price.netAmountMinorUnits)}</dd>
              </div>
              <div>
                <dt>VAT reference (20%)</dt>
                <dd>{formatMoney(calculation.price.vatAmountMinorUnits)}</dd>
              </div>
              <div className="pricing-lab-total">
                <dt>Gross total</dt>
                <dd>{formatMoney(calculation.price.grossTotalMinorUnits)}</dd>
              </div>
            </dl>
            {calculation.price.manualAssessmentRequired ? (
              <p className="pricing-lab-manual">Manual assessment required</p>
            ) : null}
            <ul className="pricing-lab-warnings">
              {calculation.price.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {calculation.duration ? (
          <section className="pricing-lab-panel">
            <div className="pricing-lab-panel-heading">
              <p>03 · Duration</p>
              <h2>Independent service estimate</h2>
            </div>
            <div className="pricing-lab-lines">
              {calculation.duration.lines.map((line) => (
                <div key={`${line.ruleId}-${line.kind}`}>
                  <span>{line.label}</span>
                  <strong>{line.minutes} min</strong>
                </div>
              ))}
            </div>
            <dl className="pricing-lab-summary">
              <div className="pricing-lab-total">
                <dt>Estimated cleaning duration</dt>
                <dd>
                  {calculation.duration.totalEstimatedMinutes === null
                    ? "Manual assessment"
                    : `${calculation.duration.totalEstimatedMinutes} min`}
                </dd>
              </div>
            </dl>
            <ul className="pricing-lab-warnings">
              {calculation.duration.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
